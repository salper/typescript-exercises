import * as fs from 'fs'

type JsonScalar<T extends Object> = T[keyof T]

type FieldOperator<T> =
  | { $eq: JsonScalar<T> }
  | { $gt: JsonScalar<T> }
  | { $lt: JsonScalar<T> }
  | { $in: JsonScalar<T>[] }

type Unionize<T extends object> = { [k in keyof T]: { k: k; v: T[k] } }[keyof T]

type QueryableKeys<T extends object> = Extract<
  Unionize<T>,
  { v: JsonScalar<T> }
>['k']

type Query<T extends Object> =
  | { $and: Query<T>[] }
  | { $or: Query<T>[] }
  | { $text: string }
  | { [field in QueryableKeys<T>]?: FieldOperator<T> }

type ProjectionOptions<T extends Object> = Partial<{ [k in keyof T]: 1 }>

type SortOptions<T extends Object> = Partial<{ [k in keyof T]: -1 | 1 }>

type QueryOptions<T extends Object> = {
  projection?: ProjectionOptions<T>
  sort?: SortOptions<T>
}

export class Database<T extends Object> {
  protected filename: string
  protected fullTextSearchFieldNames: (keyof T)[]

  constructor(filename: string, fullTextSearchFieldNames: (keyof T)[]) {
    this.filename = filename
    this.fullTextSearchFieldNames = fullTextSearchFieldNames
  }

  async readFile(): Promise<T[]> {
    return new Promise((resolve, reject) =>
      fs.readFile(this.filename, (err, content) =>
        err
          ? reject(err)
          : resolve(
              String(content)
                .split('\n')
                .filter((line) => line.startsWith('E'))
                .map((line) => JSON.parse(line.substring(1))),
            ),
      ),
    )
  }

  testEntry(query: Query<T>, entry: T): boolean {
    if ('$and' in query) {
      return query.$and.every((query) => this.testEntry(query, entry))
    }

    if ('$or' in query) {
      return query.$or.some((query) => this.testEntry(query, entry))
    }

    if ('$text' in query) {
      return Object.entries(entry).some(([key, value]) => {
        if (!this.fullTextSearchFieldNames.includes(key as keyof T)) {
          return false
        }

        return String(value)
          .split(/\s+/)
          .some(
            (token) => token.toLowerCase() == String(query.$text).toLowerCase(),
          )
      })
    }

    return Object.entries(query).every((pair) => {
      const key = pair[0] as keyof T
      const value = pair[1] as FieldOperator<T>
      if ('$eq' in value) {
        return entry[key as keyof T] === value.$eq
      }

      if ('$gt' in value) {
        return entry[key as keyof T] > value.$gt
      }

      if ('$lt' in value) {
        return entry[key as keyof T] < value.$lt
      }

      if ('$in' in value) {
        return value.$in.includes(entry[key as keyof T])
      }

      return false
    })
  }

  filterEntries(
    query: Query<T>,
    entries: T[],
    projection?: ProjectionOptions<T>,
  ): Partial<T>[] {
    return entries
      .filter((entry) => this.testEntry(query, entry))
      .map((entry) =>
        projection
          ? Object.keys(projection).reduce(
              (result, k) => ({ ...result, [k]: entry[k as keyof T] }),
              {},
            )
          : entry,
      )
  }

  async find(
    query: Query<T>,
    { projection, sort }: QueryOptions<T> = {},
  ): Promise<Partial<T>[]> {
    const entries: T[] = await this.readFile()
    return sort
      ? this.filterEntries(query, entries, projection).sort((x, y) =>
          Object.keys(sort).reduce((result, k) => {
            if (result !== 0) {
              return result
            }

            if (x[k as keyof T] < y[k as keyof T]) {
              return sort[k as keyof T] === 1 ? -1 : -1
            }

            if (x[k as keyof T] > y[k as keyof T]) {
              return sort[k as keyof T] ? 1 : -1
            }

            return 0
          }, 0),
        )
      : this.filterEntries(query, entries, projection)
  }
}

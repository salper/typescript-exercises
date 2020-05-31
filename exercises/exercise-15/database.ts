import * as fs from 'fs'

type EntryValue = {
  _id: number
}

type EntryStatus = 'D' | 'E'

type Entry<T> = { status: EntryStatus; value: T }

type JsonScalar<T> = T[keyof T]

type FieldOperator<T> =
  | { $eq: JsonScalar<T> }
  | { $gt: JsonScalar<T> }
  | { $lt: JsonScalar<T> }
  | { $in: JsonScalar<T>[] }

type Unionize<T> = { [k in keyof T]: { k: k; v: T[k] } }[keyof T]

type QueryableKeys<T> = Extract<Unionize<T>, { v: JsonScalar<T> }>['k']

type Query<T> =
  | { $and: Query<T>[] }
  | { $or: Query<T>[] }
  | { $text: string }
  | { [field in QueryableKeys<T>]?: FieldOperator<T> }

type ProjectionOptions<T> = Partial<{ [k in keyof T]: 1 }>

type SortOptions<T> = Partial<{ [k in keyof T]: -1 | 1 }>

type QueryOptions<T> = {
  projection?: ProjectionOptions<T>
  sort?: SortOptions<T>
}

export class Database<T extends EntryValue> {
  protected filename: string
  protected fullTextSearchFieldNames: (keyof T)[]
  protected entries: Promise<Entry<T>[]>

  constructor(filename: string, fullTextSearchFieldNames: (keyof T)[]) {
    this.filename = filename
    this.fullTextSearchFieldNames = fullTextSearchFieldNames
    this.entries = new Promise((resolve, reject) =>
      fs.readFile(this.filename, (err, content) =>
        err
          ? reject(err)
          : resolve(
              String(content)
                .split('\n')
                .filter(Boolean)
                .map((line) => ({
                  status: line.substring(0, 1) as EntryStatus,
                  value: JSON.parse(line.substring(1)),
                })),
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

  selectEntries(query: Query<T>, entries: T[]): T[] {
    return entries.filter((entry) => this.testEntry(query, entry))
  }

  projectEntries(entries: T[], options?: ProjectionOptions<T>): Partial<T>[] {
    return options
      ? entries.map((entry) =>
          Object.keys(options).reduce(
            (result, k) => ({ ...result, [k]: entry[k as keyof T] }),
            {},
          ),
        )
      : entries
  }

  sortEntries(entries: T[], options?: SortOptions<T>): T[] {
    return options
      ? entries.sort((x, y) =>
          Object.keys(options).reduce((result, k) => {
            if (result !== 0) {
              return result
            }

            if (x[k as keyof T] < y[k as keyof T]) {
              return options[k as keyof T] === 1 ? -1 : 1
            }

            if (x[k as keyof T] > y[k as keyof T]) {
              return options[k as keyof T] === 1 ? 1 : -1
            }

            return 0
          }, 0),
        )
      : entries
  }

  async find(
    query: Query<T>,
    { projection, sort }: QueryOptions<T> = {},
  ): Promise<Partial<T>[]> {
    const entries = (await this.entries)
      .filter(({ status }) => status === 'E')
      .map(({ value }) => value)

    return this.projectEntries(
      this.sortEntries(this.selectEntries(query, entries), sort),
      projection,
    )
  }

  async insert(entry: T): Promise<void> {
    await (this.entries = this.entries.then((entries) =>
      entries.concat([{ status: 'E', value: entry }]),
    ))
  }

  async delete(query: Query<T>): Promise<void> {
    const entries = (await this.entries)
      .filter(({ status }) => status === 'E')
      .map(({ value }) => value)

    const filteredEntries = this.selectEntries(query, entries)
    this.entries = this.entries.then((entries) =>
      entries.map((entry) =>
        filteredEntries.find(({ _id }) => _id === entry.value._id)
          ? { ...entry, status: 'D' }
          : entry,
      ),
    )
  }
}

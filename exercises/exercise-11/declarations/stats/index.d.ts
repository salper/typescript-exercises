declare module 'stats' {
  type Comparator<T> = (a: T, b: T) => number

  function GetIndex<T>(input: T[], comparator: Comparator<T>): number
  function GetElement<T>(input: T[], comparator: Comparator<T>): T | null

  export const getMaxIndex: typeof GetIndex
  export const getMinIndex: typeof GetIndex
  export const getMedianIndex: typeof GetIndex

  export const getMaxElement: typeof GetElement
  export const getMinElement: typeof GetElement
  export const getMedianElement: typeof GetElement

  export const getAverageValue: <T>(
    input: T[],
    getValue: (a: T, b: T) => number,
  ) => number
}

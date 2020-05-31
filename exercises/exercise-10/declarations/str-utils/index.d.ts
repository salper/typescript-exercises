declare module 'str-utils' {
  type strtToStr = (value: string) => string

  export const strReverse: strtToStr

  export const strToLower: strtToStr

  export const strToUpper: strtToStr

  export const strRandomize: strtToStr

  export const strInvertCase: strtToStr
}

// This enabled module augmentation mode.
import 'date-wizard'

declare module 'date-wizard' {
  interface DateDetails {
    hours: number
    minutes: number
    seconds: number
  }

  const pad: (s: number) => string
}

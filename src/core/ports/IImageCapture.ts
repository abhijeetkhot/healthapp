import type { Result } from '../Result'

export interface IImageCapture {
  capturePhoto(): Promise<Result<string>>
  scanBarcode(): Promise<Result<string | null>>
}

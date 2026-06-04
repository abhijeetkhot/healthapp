import type { Result } from '../Result'

export interface IStorage {
  uploadMealPhoto(imageBase64: string): Promise<Result<string>>
}

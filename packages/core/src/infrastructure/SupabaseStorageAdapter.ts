import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { err, ok, type Result } from '../Result'
import type { IStorage } from '../ports/IStorage'

const BUCKET = 'meal-photos'

/** "data:image/jpeg;base64,/9j/..." or bare base64 → Buffer */
export function decodeImageBase64(base64: string): { buffer: Buffer; mimeType: string } {
  const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
  if (match) {
    return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') }
  }
  return { mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') }
}

/** YYYY/MM/DD/<uuid>.<ext> — deterministic, sorted by upload date. */
export function buildPhotoPath(now: Date, mimeType: string): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const ext = mimeType.split('/')[1]?.replace('+xml', '') ?? 'jpg'
  return `${y}/${m}/${d}/${randomUUID()}.${ext}`
}

function makeClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export class SupabaseStorageAdapter implements IStorage {
  private readonly client: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.client = client ?? makeClient()
  }

  async uploadMealPhoto(imageBase64: string): Promise<Result<string>> {
    try {
      const { buffer, mimeType } = decodeImageBase64(imageBase64)
      const path = buildPhotoPath(new Date(), mimeType)
      const { error } = await this.client.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: mimeType, upsert: false })
      if (error) return err(new Error(`uploadMealPhoto: ${error.message}`))
      return ok(path)
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }
}

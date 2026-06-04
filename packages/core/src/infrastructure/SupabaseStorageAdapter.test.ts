import { describe, expect, it } from 'vitest'
import { buildPhotoPath, decodeImageBase64 } from './SupabaseStorageAdapter'

describe('decodeImageBase64', () => {
  it('parses a data URL with explicit mime type', () => {
    const { buffer, mimeType } = decodeImageBase64('data:image/png;base64,iVBORw0KGgo=')
    expect(mimeType).toBe('image/png')
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('falls back to image/jpeg for bare base64 input', () => {
    const { mimeType } = decodeImageBase64('iVBORw0KGgo=')
    expect(mimeType).toBe('image/jpeg')
  })

  it('handles webp data URLs', () => {
    const { mimeType } = decodeImageBase64('data:image/webp;base64,UklGRg==')
    expect(mimeType).toBe('image/webp')
  })
})

describe('buildPhotoPath', () => {
  it('produces a YYYY/MM/DD/uuid.ext path', () => {
    const path = buildPhotoPath(new Date('2026-05-13T10:30:00Z'), 'image/jpeg')
    expect(path).toMatch(/^2026\/05\/13\/[0-9a-f-]+\.jpeg$/)
  })

  it('zero-pads single-digit months and days', () => {
    const path = buildPhotoPath(new Date('2026-01-05T00:00:00Z'), 'image/png')
    expect(path).toMatch(/^2026\/01\/05\//)
  })

  it('uses the right extension for each supported mime', () => {
    expect(buildPhotoPath(new Date('2026-05-13T10:00:00Z'), 'image/png')).toMatch(/\.png$/)
    expect(buildPhotoPath(new Date('2026-05-13T10:00:00Z'), 'image/webp')).toMatch(/\.webp$/)
    expect(buildPhotoPath(new Date('2026-05-13T10:00:00Z'), 'image/gif')).toMatch(/\.gif$/)
  })

  it('generates unique uuids across calls on the same date', () => {
    const date = new Date('2026-05-13T10:00:00Z')
    const a = buildPhotoPath(date, 'image/jpeg')
    const b = buildPhotoPath(date, 'image/jpeg')
    expect(a).not.toBe(b)
  })
})

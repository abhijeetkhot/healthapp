import { describe, expect, it } from 'vitest'
import { decodeImage } from './ClaudeVisionAdapter'

describe('decodeImage', () => {
  it('parses a data URL with image/jpeg', () => {
    const { mediaType, data } = decodeImage('data:image/jpeg;base64,/9j/4AAQ=')
    expect(mediaType).toBe('image/jpeg')
    expect(data).toBe('/9j/4AAQ=')
  })

  it('parses image/png data URL', () => {
    const { mediaType } = decodeImage('data:image/png;base64,iVBORw0KGgo=')
    expect(mediaType).toBe('image/png')
  })

  it('parses image/webp data URL', () => {
    const { mediaType } = decodeImage('data:image/webp;base64,UklGRg==')
    expect(mediaType).toBe('image/webp')
  })

  it('defaults bare base64 to image/jpeg', () => {
    const { mediaType, data } = decodeImage('/9j/4AAQSkZJRg==')
    expect(mediaType).toBe('image/jpeg')
    expect(data).toBe('/9j/4AAQSkZJRg==')
  })

  it('does not split off the base64 prefix when bare', () => {
    const raw = 'abcdef==' // not a data URL — must pass through unchanged
    expect(decodeImage(raw).data).toBe('abcdef==')
  })
})

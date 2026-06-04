import { describe, expect, it } from 'vitest'
import { mergeByPriority } from './HealthSyncService'

const oura = {
  source: 'oura' as const,
  metrics: {
    readinessScore: 85,
    sleepScore: 78,
    hrv: 42.5,
    restingHR: 55,
    sleepDuration: 420,
    deepSleepMinutes: 90,
    remSleepMinutes: 110,
    bodyTempDeviation: -0.1,
  },
}

const apple = {
  source: 'apple-health' as const,
  metrics: {
    steps: 8200,
    activeCalories: 350,
    restingHR: 58,
  },
}

describe('mergeByPriority', () => {
  it('returns a row with date and syncedAt even when no providers contribute', () => {
    const merged = mergeByPriority('2026-05-13', [])
    expect(merged.date).toBe('2026-05-13')
    expect(merged.sources).toEqual([])
    expect(merged.syncedAt).toBeTruthy()
    expect(merged.readinessScore).toBeUndefined()
    expect(merged.steps).toBeUndefined()
  })

  it('takes Oura-priority fields exclusively from Oura', () => {
    const merged = mergeByPriority('2026-05-13', [oura, apple])
    expect(merged.readinessScore).toBe(85)
    expect(merged.sleepScore).toBe(78)
    expect(merged.hrv).toBe(42.5)
    expect(merged.deepSleepMinutes).toBe(90)
  })

  it('prefers Oura restingHR when both Oura and Apple provide it', () => {
    const merged = mergeByPriority('2026-05-13', [oura, apple])
    expect(merged.restingHR).toBe(55)
  })

  it('falls back to Apple restingHR when Oura is absent', () => {
    const merged = mergeByPriority('2026-05-13', [apple])
    expect(merged.restingHR).toBe(58)
  })

  it('takes Apple-priority fields from Apple when Oura has none', () => {
    const merged = mergeByPriority('2026-05-13', [oura, apple])
    expect(merged.steps).toBe(8200)
    expect(merged.activeCalories).toBe(350)
  })

  it('records every contributing source in sources[]', () => {
    const merged = mergeByPriority('2026-05-13', [oura, apple])
    expect(merged.sources).toContain('oura')
    expect(merged.sources).toContain('apple-health')
    expect(merged.sources).toHaveLength(2)
  })

  it('omits a source from sources[] when it contributed no fields', () => {
    const emptyApple = { source: 'apple-health' as const, metrics: {} }
    const merged = mergeByPriority('2026-05-13', [oura, emptyApple])
    expect(merged.sources).toEqual(['oura'])
  })

  it('is order-independent across the contributions array', () => {
    const a = mergeByPriority('2026-05-13', [oura, apple])
    const b = mergeByPriority('2026-05-13', [apple, oura])
    expect(a.restingHR).toBe(b.restingHR)
    expect(a.steps).toBe(b.steps)
    expect(a.readinessScore).toBe(b.readinessScore)
  })

  it('treats undefined values as missing, not as zero', () => {
    const partial = { source: 'oura' as const, metrics: { hrv: 0 } }
    const merged = mergeByPriority('2026-05-13', [partial])
    expect(merged.hrv).toBe(0)
    expect(merged.sources).toEqual(['oura'])
  })
})

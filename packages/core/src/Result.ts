export type Result<T, E extends Error = Error> =
  | { ok: true;  value: T }
  | { ok: false; error: E }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const err = <E extends Error>(e: E): Result<never, E> => ({ ok: false, error: e })

export function tryCatch<T>(fn: () => T): Result<T> {
  try {
    return ok(fn())
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

export async function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn())
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

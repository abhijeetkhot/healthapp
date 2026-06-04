import type { FastifyReply } from 'fastify'
import type { Result } from '@health/core'

export function respond<T>(reply: FastifyReply, result: Result<T>, successStatus = 200) {
  return result.ok
    ? reply.code(successStatus).send(result.value)
    : reply.code(500).send({ error: result.error.message })
}

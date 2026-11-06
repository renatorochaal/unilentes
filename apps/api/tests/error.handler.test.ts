import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, Response } from 'express'
import { errorHandler } from '../src/shared/middleware/error.handler'

class PrismaClientKnownRequestError extends Error {
  code = 'P2002'
  constructor(public meta: { target?: string | string[] }) { super('duplicado') }
}

function run(meta: { target?: string | string[] }) {
  const sent: { status?: number; body?: { message: string } } = {}
  const res = {
    status(code: number) { sent.status = code; return this },
    json(body: { message: string }) { sent.body = body; return this },
  } as unknown as Response
  errorHandler(new PrismaClientKnownRequestError(meta), {} as Request, res, () => {})
  return sent
}

test('P2002 responde JSON com target string (MySQL) ou lista', () => {
  assert.equal(run({ target: 'products_code_key' }).status, 409)
  assert.match(run({ target: 'products_code_key' }).body!.message, /products_code_key/)
  assert.match(run({ target: ['name', 'brandId'] }).body!.message, /name, brandId/)
  assert.match(run({}).body!.message, /valor/)
})

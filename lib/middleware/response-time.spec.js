import test from 'ava'
import td from 'testdouble'

import responseTime from './response-time'

test.beforeEach(t => {
  t.context.ctx = {
    set: td.function()
  }
})

test('logs request', async t => {
  const { ctx } = t.context
  const next = async () => {}
  await responseTime({resHeader: 'x-res-time'})(ctx, next)
  td.verify(ctx.set('x-res-time', td.matchers.contains(/\d+ms/)))
  t.pass()
})

test('checks arguments', t => {
  const msg = /Response time middleware/
  t.throws(() => responseTime({resHeader: ''}), msg, 'when bad response header')
})
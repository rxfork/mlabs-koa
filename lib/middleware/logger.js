import { v4 as uuidv4 } from 'uuid'
import { identity, isNonEmptyString } from '@meltwater/phi'

const errPrefix = 'Logger middleware:'
const logProps = { isRequestLog: true, isAppLog: false }

const addProp = (k, v) => (isNonEmptyString(v) ? { [k]: v } : {})

export const log = ({
  addReq = true,
  reqNameHeader = 'x-request-name',
  requestIdParamName = 'reqId',
  generator = uuidv4
} = {}) => (ctx, next) => {
  ctx.state.log = ctx.state.log.child({
    serializers: { res: identity },
    execId: generator(),
    ...addProp('reqId', ctx.state[requestIdParamName]),
    ...addProp('reqName', ctx.get(reqNameHeader)),
    ...addProp('reqUrl', ctx.request.url),
    ...addProp('reqMethod', ctx.request.method),
    ...(addReq ? { req: ctx.request } : {})
  })

  return next()
}

export default ({ level = 'info' } = {}) => {
  if (!isNonEmptyString(level)) {
    throw new Error(
      `${errPrefix} option 'level' must be string, got ${typeof level}.`
    )
  }

  return async (ctx, next) => {
    const start = Date.now()

    ctx.state.log[level]({ req: ctx.request, ...logProps }, 'Request: Start')

    await next()

    const resStatusCode = ctx.response.status
    const res = {
      time: Date.now() - start,
      size: ctx.response.length,
      headers: ctx.response.headers,
      statusCode: resStatusCode
    }

    ctx.state.log[level]({ res, resStatusCode, ...logProps }, 'Request: End')
  }
}

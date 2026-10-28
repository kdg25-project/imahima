import { Hono } from 'hono'

const routesRoutes = new Hono()

routesRoutes.post('/', (c) => {
  // TODO: リクエストボディの検証と Google Routes API 呼び出しを実装する。
  return c.json({ error: 'Not Implemented' }, 501)
})

export default routesRoutes

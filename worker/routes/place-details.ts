import { Hono } from 'hono'

const placeDetailsRoutes = new Hono()

placeDetailsRoutes.get('/:placeId', (c) => {
  // TODO: placeId の検証と Google Places Details API 呼び出しを実装する。
  return c.json({ error: 'Not Implemented' }, 501)
})

export default placeDetailsRoutes

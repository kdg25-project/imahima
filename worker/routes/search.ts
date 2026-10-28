import { Hono } from 'hono'

const searchRoutes = new Hono()

searchRoutes.get('/', (c) => {
  // TODO: 天気と POI の取得、統合、ランキングを実装する。
  return c.json({ error: 'Not Implemented' }, 501)
})

export default searchRoutes

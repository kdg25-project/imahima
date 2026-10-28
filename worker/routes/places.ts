import { Hono } from 'hono'

const placesRoutes = new Hono()

placesRoutes.get('/', (c) => {
  // TODO: クエリ検証、カテゴリ変換、Google Places API 呼び出しを実装する。
  return c.json({ error: 'Not Implemented' }, 501)
})

export default placesRoutes

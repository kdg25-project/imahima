import { Hono } from 'hono'

const weatherRoutes = new Hono()

weatherRoutes.get('/', (c) => {
  // TODO: ここにクエリ検証とOpen-Meteoの取得処理を実装する
  return c.json({ error: 'Not Implemented' }, 501)
})

export default weatherRoutes

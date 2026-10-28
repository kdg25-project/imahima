import { Hono } from 'hono'
import type { HealthResponse } from '../shared/health'
import searchRoutes from './routes/search'

const app = new Hono()

app.get('/api/health', (c) => c.json<HealthResponse>({ status: 'ok' }))
app.route('/api/search', searchRoutes)
app.notFound((c) => c.json({ error: 'Not Found' }, 404))

export default app

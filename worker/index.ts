import { Hono } from 'hono'
import type { HealthResponse } from '../shared/health'
import routesRoutes from './routes/routes'

const app = new Hono()

app.get('/api/health', (c) => c.json<HealthResponse>({ status: 'ok' }))
app.route('/api/routes', routesRoutes)
app.notFound((c) => c.json({ error: 'Not Found' }, 404))

export default app

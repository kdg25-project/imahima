import { Hono } from 'hono'
import type { HealthResponse } from '../shared/health'
import placesRoutes from './routes/places'
import weatherRoutes from './routes/weather'

const app = new Hono()

app.get('/api/health', (c) => c.json<HealthResponse>({ status: 'ok' }))
app.route('/api/places', placesRoutes)
app.route('/api/weather', weatherRoutes)
app.notFound((c) => c.json({ error: 'Not Found' }, 404))

export default app

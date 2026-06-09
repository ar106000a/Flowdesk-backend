import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import { initSocket } from './lib/socket.js'
import { errorHandler } from './middleware/errorHandler.js'
import projectRoutes from './routes/project.js'
import taskRoutes from './routes/task.js'

const app = express()
const httpServer = createServer(app)

initSocket(httpServer)

// ─── Stripe webhook BEFORE express.json() — Day 10 ───────────────────────────
// app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook)

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/projects', projectRoutes)
app.use('/api/projects/:projectId/tasks', taskRoutes)

// Uncomment as we build:
// app.use('/api/time', timeRoutes)
// app.use('/api/invoices', invoiceRoutes)
// app.use('/api/stripe', stripeRoutes)
// app.use('/app/portal', clientRoutes)
// app.use('/api/members', memberRoutes)
// app.use('/api/dashboard', dashboardRoutes)
// app.use('/api/upload', uploadRoutes)

app.use((req, res) => {
  res.status(404).json({ message: `${req.method} ${req.path} not found` })
})

app.use(errorHandler)

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`)
  console.log(`[Server] Env: ${process.env.NODE_ENV || 'development'}`)
})
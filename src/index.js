import express from "express";
import { createServer } from "http";
import cors from "cors";
import { initSocket } from "./lib/socket.js";
import { errorHandler } from "./middleware/errorHandler.js";
import projectRoutes from "./routes/project.js";
import taskRoutes from "./routes/task.js";

const app = express();
const httpServer = createServer(app);

// ─── Initialize socket FIRST — before routes ──────────────────────────────────
// Controllers call getIO() lazily, so order doesn't matter for them
// But we want the server ready before any requests come in
initSocket(httpServer);

// ─── IMPORTANT: Stripe webhook BEFORE express.json() ─────────────────────────
// Uncomment on Day 10:
// import { stripeWebhook } from './controllers/stripe/stripeController.js'
// app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook)

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/projects", projectRoutes);
app.use("/api/projects/:projectId/tasks", taskRoutes);

// Uncomment as we build each day:
// app.use('/api/invoices', invoiceRoutes)
// app.use('/api/stripe', stripeRoutes)
// app.use('/app/portal', clientRoutes)
// app.use('/api/members', memberRoutes)
// app.use('/api/comments', commentRoutes)
// app.use('/api/dashboard', dashboardRoutes)
// app.use('/api/upload', uploadRoutes)

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `${req.method} ${req.path} not found` });
});

// ─── Error handler — must be last ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] Env: ${process.env.NODE_ENV || "development"}`);
});

import { AppError } from "../utils/AppError.js";

// Express knows this is an error handler because it has 4 parameters (err, req, res, next)
// It must be registered LAST in index.js — after all routes
export function errorHandler(err, req, res, next) {
  // If it's our custom AppError, use its status code
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  // Supabase errors come back as objects with a message field
  if (err.message) {
    console.error("[Unhandled Error]", err);
    return res.status(500).json({
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    });
  }

  // Fallback
  console.error("[Unknown Error]", err);
  res.status(500).json({ message: "Internal server error" });
}

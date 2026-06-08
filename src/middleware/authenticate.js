import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

// This middleware runs before every protected route handler
// It reads the JWT from the Authorization header, verifies it,
// and attaches the decoded user payload to req.user
//
// Usage in routes:
//   router.get('/projects', authenticate, getProjects)
//   router.post('/projects', authenticate, createProject)

export function authenticate(req, res, next) {
  // 1. Read the header
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return next(new AppError("No authorization header provided", 401));
  }

  // 2. Header format must be: "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return next(
      new AppError("Authorization header format must be: Bearer <token>", 401),
    );
  }

  const token = parts[1];

  // 3. Verify the token using the same secret the auth-wrapper used to sign it
  //    If expired or tampered with, jwt.verify throws — we catch it below
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // 4. Attach user info to the request so route handlers can use it
    //    req.user.id is the most used — it's the user's UUID from Supabase auth
    req.user = {
      id: decoded.sub || decoded.id || decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (err) {
    // jwt.verify throws TokenExpiredError or JsonWebTokenError
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Access token expired", 401));
    }
    return next(new AppError("Invalid access token", 401));
  }
}

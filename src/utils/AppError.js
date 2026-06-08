// AppError lets us throw errors with HTTP status codes from anywhere in the app
// Instead of: res.status(404).json({ message: 'Not found' })
// We do:       throw new AppError('Not found', 404)
// The errorHandler middleware catches it and sends the right response

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
    // Captures the stack trace, excluding the constructor call itself
    Error.captureStackTrace(this, this.constructor);
  }
}

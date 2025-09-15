class AppError extends Error { constructor(msg, status=500, code="APP_ERROR"){ super(msg); this.statusCode=status; this.code=code; } }
class BadRequestError extends AppError { constructor(msg="Bad Request"){ super(msg,400,"BAD_REQUEST"); } }
class NotFoundError extends AppError { constructor(msg="Not Found"){ super(msg,404,"NOT_FOUND"); } }
class DbError extends AppError { constructor(msg="Database Error"){ super(msg,500,"DB_ERROR"); } }
const toHttpStatus = (err)=> err?.statusCode || 500;
module.exports = { AppError, BadRequestError, NotFoundError, DbError, toHttpStatus };
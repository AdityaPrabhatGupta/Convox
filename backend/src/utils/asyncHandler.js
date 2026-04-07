 /**
 * Wraps async route handlers to eliminate repetitive try/catch blocks.
 * Any thrown error is automatically forwarded to Express error middleware.
 *
 * @param {Function} fn - Async controller function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;

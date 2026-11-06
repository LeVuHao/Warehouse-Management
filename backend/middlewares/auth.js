const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT Access Token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'Quyền truy cập bị từ chối. Không tìm thấy token.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret', (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
    req.user = decoded;
    next();
  });
};

/**
 * Middleware to restrict access based on roles
 * @param {...string} allowedRoles - List of allowed roles, e.g. "admin", "staff"
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
    }
    next();
  };
};

/**
 * Shorthand middleware: only admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Chỉ admin mới có quyền thực hiện hành động này.' });
  }
  next();
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
};

const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  // Primary: HTTP-only cookie (set by login endpoint)
  let token = req.cookies?.token;

  // Fallback: Authorization header (for API clients and test suites using supertest)
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    }
  }

  if (!token) {
    return res.status(403).json({ message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized. Invalid token.' });
  }
};

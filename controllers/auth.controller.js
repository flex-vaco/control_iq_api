const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const COOKIE_OPTIONS = {
  httpOnly: true,
  // secure only over HTTPS in production; localhost works over HTTP in dev/test
  secure: process.env.NODE_ENV === 'production',
  // 'strict' in production prevents cross-site cookie sending; 'lax' for dev/test
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 60 * 60 * 1000, // 1 hour — matches JWT expiry
  path: '/'
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'User account is inactive.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const payload = {
      userId: user.user_id,
      email: user.email,
      tenantId: user.tenant_id,
      roleId: user.role_id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Set token in HTTP-only cookie — JS cannot read this value
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({ success: true, user: payload });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

exports.me = (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      user: {
        userId: decoded.userId,
        email: decoded.email,
        tenantId: decoded.tenantId,
        roleId: decoded.roleId,
      }
    });
  } catch {
    res.status(401).json({ message: 'Invalid or expired session.' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ message: 'Logged out successfully.' });
};

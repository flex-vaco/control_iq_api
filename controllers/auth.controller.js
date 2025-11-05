const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // 1. Find user by email
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // 2. Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ message: 'User account is inactive.' });
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    //const isMatch = (password === user.password);
    
    if (!isMatch) {
      // Note: Seed data password is 'Admin@123'
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // 4. Create JWT Payload
    const payload = {
      userId: user.user_id,
      email: user.email,
      tenantId: user.tenant_id,
      roleId: user.role_id,
    };

    // 5. Sign the token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Token expires in 1 hour
    );

    // 6. Send response
    res.json({
      success: true,
      token: `Bearer ${token}`,
      user: payload
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};
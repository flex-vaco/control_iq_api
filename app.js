const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const apiRoutes = require('./routes/api.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      callback(null, true);
    } else {
      const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.length === 0) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};

// Rate limits relaxed in test environment to avoid blocking test suites
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' }
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.options('*', cors(corsOptions));

app.get('/api/health', (req, res) => {
  const currentTime = new Date();
  const today = currentTime.toLocaleString('en-UK');
  res.json({ message: 'This is Hello from ControlIQ API!', date: today });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/data', apiLimiter, apiRoutes);

module.exports = app;

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const apiRoutes = require('./routes/api.routes');
const authRoutes = require('./routes/auth.routes');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 5000;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || process.env.NODE_ENV === 'development') {
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
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions)); // Allow cross-origin requests with proper configuration
app.use(express.json({ limit: '50mb' })); // Parse JSON request bodies with increased limit for large imports
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Support URL-encoded bodies

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// // Handle all UI requests by serving the React app's index.html
// app.use(express.static('/apps/control_iq/control_iq_ui/build'));
// app.get('*', (req, res) => {
//   res.sendFile(path.join('/apps/control_iq/control_iq_ui/build', 'index.html')); // Adjust path as needed
// });

//Health check
app.get('/api/health', (req, res) => {
  const currentTime = new Date();
  const today = currentTime.toLocaleString('en-UK');
  res.json({ message: 'This is Hello from ControlIQ API!', date: today });
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Routes ---
// Authentication routes (e.g., /api/auth/login)
app.use('/api/auth', authRoutes);

// Main API data routes (e.g., /api/data/rcm)
app.use('/api/data', apiRoutes);

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

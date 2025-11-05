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

// Middleware
app.use(cors()); // Allow cross-origin requests (from React)
app.use(express.json({ limit: '50mb' })); // Parse JSON request bodies with increased limit for large imports
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Support URL-encoded bodies

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
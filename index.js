// server.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const appRoutes = require('./routes/appRoutes');
const paymentRoutes = require('./routes/payment'); 
const db = require('./config');  


// Load environment variables
dotenv.config();

// Initialize the app
const app = express();

// cors
app.use(cors());

// Middleware to parse incoming JSON requests
app.use(express.json());

app.use(express.static('uploads'));
app.use('/uploads', express.static('uploads'));

// view engine setup
app.set('views', path.join(__dirname, 'views'));

// Use payment routes
app.use('/api/payment', paymentRoutes);

// Route middleware
app.use('/api/auth', authRoutes);

//Route Flutter App
app.use('/api/app', appRoutes);
// Default route


app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// Other middlewares and configurations



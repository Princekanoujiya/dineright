const db = require('../config');
const jwt = require('jsonwebtoken');

// Middleware to verify the token and extract customer_id
exports.verifyCustomerToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Access Denied. No token provided.' });
  }

  // Extract the token from the "Bearer <token>" format
  const token = authHeader.split(' ')[1];

  // Verify the token and extract customer_id
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or has expired' });
    }

    const query = `SELECT * FROM superadmin_login WHERE superadmin_id = ?`;

    db.query(query, [decoded.superadmin_id], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }

      // Check if the customer exists
      if (result.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Attach customer details to the request object
      req.superadmin_id = result[0].superadmin_id;
      req.superadmin_email = result[0].superadmin_email;

      next(); // Proceed to the next middleware or route handler
    });
  });
};

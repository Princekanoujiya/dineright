
// const jwt = require('jsonwebtoken');

// exports.verifyCustomerToken = (req, res, next) => {
//   const token = req.headers['authorization'];
  
//   if (!token) {
//     return res.status(403).json({ error: 'No token provided' });
//   }

//   jwt.verify(token.split(' ')[1], process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       return res.status(500).json({ error: 'Failed to authenticate token' });
//     }
//     req.customer_id = decoded.id;
//     next();
//   });
// };
const jwt = require('jsonwebtoken');

// Middleware to verify the token and extract customer_id
exports.verifyCustomerToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ error: 'No token provided' });
  }

  // Verify the token and extract customer_id
  jwt.verify(token.split(' ')[1], process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to authenticate token' });
    }

    req.customer_id = decoded.customer_id; // Add customer_id to request object
    next();
  });
};

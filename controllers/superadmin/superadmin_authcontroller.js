const db = require('../../config');
const jwt = require('jsonwebtoken');

exports.loginSuperadmin = (req, res) => {
    const { superadmin_email, superadmin_password } = req.body;

    // Check if required fields are provided
    if (!superadmin_email || !superadmin_password) {
        return res.status(400).json({ error_msg: "Email and Password are required" });
    }

    // Query to find the superadmin by email
    const query = `SELECT * FROM superadmin_login WHERE superadmin_email = ?`;
    db.query(query, [superadmin_email], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error_msg: 'Database error' });
        }

        // Check if superadmin exists
        if (result.length === 0) {
            return res.status(404).json({ error_msg: 'Invalid email or password' });
        }

        // Superadmin found, now compare the password
        const superadmin = result[0];

        // Directly compare the password (no bcrypt)
        if (superadmin_password !== superadmin.superadmin_password) {
            return res.status(400).json({ error_msg: 'Invalid email or password' });
        }

        // Passwords match, generate JWT token
        const token = jwt.sign(
            { superadmin_id: superadmin.superadmin_id, email: superadmin.superadmin_email },
            process.env.JWT_SECRET,
            { expiresIn: '9h' }     
        );

        // Send success response with token
        return res.status(200).json({
            message: 'Login successful',
            token: token,
            superadmin_id: superadmin.superadmin_id
        });
    });
};
exports.getGuests = (req, res) => {
    const query = 'SELECT * FROM users';
  
    db.query(query, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ error: 'No users found' });
      }
  
      res.status(200).json({ users: results });
    });
};
exports.updateUserStatusAndCommission = (req, res) => {
    const { id } = req.params; // Get user id from the request parameters
    const { status, commission } = req.body; // Get status and commission from the request body
  
    if (!status || commission == null) {
      return res.status(400).json({ error: 'Status and commission are required' });
    }
  
    // Update query
    const updateQuery = 'UPDATE users SET status = ?, commission = ? WHERE id = ?';
    
    // Execute the update query
    db.query(updateQuery, [status, commission, id], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      res.status(200).json({ message: 'User status and commission updated successfully',id });
    });
};
exports.updateCommissionStatus = (req, res) => {
    const { id } = req.params; // Get user id from the request parameters
    const { commission_status } = req.body; // Get status and commission from the request body
  
    if (!commission_status == null) {
      return res.status(400).json({ error: 'Commission Status are required' });
    }
  
    // Update query
    const updateQuery = 'UPDATE users SET commission_status = ? WHERE id = ?';
    
    // Execute the update query
    db.query(updateQuery, [commission_status, id], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      res.status(200).json({ message: 'User commission status updated successfully',id });
    });
};  
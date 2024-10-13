const db = require('../../config');
const jwt = require('jsonwebtoken');

exports.loginSuperadmin = (req, res) => {
    const { superadmin_email, superadmin_password } = req.body;

    // Check if required fields are provided
    if (!superadmin_email || !superadmin_password) {
        return res.status(200).json({ error_msg: "Email and Password are required",response:false });
    }

    // Query to find the superadmin by email
    const query = `SELECT * FROM superadmin_login WHERE superadmin_email = ?`;
    db.query(query, [superadmin_email], (err, result) => {
        if (err) {
            console.error('Database error_msg:', err);
            return res.status(500).json({ error_msg: 'Database error' ,response:false});
        }

        // Check if superadmin exists
        if (result.length === 0) {
            return res.status(404).json({ error_msg: 'Invalid email or password',response:false });
        }

        // Superadmin found, now compare the password
        const superadmin = result[0];

        // Directly compare the password (no bcrypt)
        if (superadmin_password !== superadmin.superadmin_password) {
            return res.status(200).json({ error_msg: 'Invalid email or password' ,response:false});
        }

        // Passwords match, generate JWT token
        const token = jwt.sign(
            { superadmin_id: superadmin.superadmin_id, email: superadmin.superadmin_email },
            process.env.JWT_SECRET,
            { expiresIn: '9h' }     
        );

        // Send success response with token
        return res.status(200).json({
            success_msg: 'Login successful',
            token: token,
            superadmin_id: superadmin.superadmin_id,
            response:true,
        });
    });
};
exports.getGuests = (req, res) => {
    const query = 'SELECT * FROM users';
  
    db.query(query, (err, results) => {
      if (err) {
        console.error('Database error_msg:', err);
        return res.status(500).json({ error_msg: 'Database error', details: err.message,response:false });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ error_msg: 'No users found' ,response:false});
      }
  
      res.status(200).json({ users: results ,response:true,success_msg:true});
    });
};
exports.updateUserStatusAndCommission = (req, res) => {
    const { id } = req.params; 
    const { status, commission } = req.body; 
  
    if (!status || commission == null) {
      return res.status(200).json({ error_msg: 'Status and commission are required' ,response:false});
    }
  
    // Update query
    const updateQuery = 'UPDATE users SET status = ?, commission = ? WHERE id = ?';
    
    // Execute the update query
    db.query(updateQuery, [status, commission, id], (err, result) => {
      if (err) {
        console.error('Database error_msg:', err);
        return res.status(500).json({ error_msg: 'Database error', details: err.message,response:false });
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error_msg: 'User not found' ,response:false});
      }
  
      res.status(200).json({ success_msg: 'User status and commission updated successfully',id ,response:true});
    });
};
exports.updateCommissionStatus = (req, res) => {
    const { id } = req.params; // Get user id from the request parameters
    const { commission_status } = req.body; // Get status and commission from the request body
  
    if (!commission_status == null) {
      return res.status(200).json({ error_msg: 'Commission Status are required' ,response:false});
    }
  
    // Update query
    const updateQuery = 'UPDATE users SET commission_status = ? WHERE id = ?';
    
    // Execute the update query
    db.query(updateQuery, [commission_status, id], (err, result) => {
      if (err) {
        console.error('Database error_msg:', err);
        return res.status(500).json({ error_msg: 'Database error', details: err.message ,response:false});
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error_msg: 'User not found' ,response:false});
      }
  
      res.status(200).json({ success_msg: 'User commission status updated successfully',id ,response:true});
    });
};  
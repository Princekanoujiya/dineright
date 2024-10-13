const db = require('../config');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');


exports.createOrUpdateCustomer = (req, res) => {
  const { customer_id, customer_name, customer_email } = req.body;
  if (!customer_name || !customer_email) {
    return res.status(200).json({ error_msg: "Customer name and email are required",response:false });
  }
  // Check if the email is unique before insert or update
  const emailCheckQuery = 'SELECT * FROM customers WHERE customer_email = ? AND customer_id != ?';
  db.query(emailCheckQuery, [customer_email, customer_id || 0], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message ,response:false}); 
    }

    if (result.length > 0) {
      return res.status(200).json({ error_msg: "Email is already in use",response:false });
    }

    // Function to send OTP email
    const sendOtpEmail = (email, otp, customerId) => {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_SERVICE,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false,
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_SERVICE,
        to: email,
        subject: 'OTP Verification',
        text: `Your OTP is ${otp}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message,response:false });
        }
        console.log('OTP sent to email:', email);
        res.status(200).json({ 
          success_msg: 'Customer processed successfully and OTP sent to email',
          customer_id: customerId ,
          response:true
        });
      });
    };

    const otp = Math.floor(1000 + Math.random() * 9000);
    console.log('OTP:', otp);
    if (customer_id) {
      // Update existing customer
      const updateQuery = 'UPDATE customers SET customer_name = ?, customer_email = ?, otp = ? WHERE customer_id = ?';
      db.query(updateQuery, [customer_name, customer_email, otp, customer_id], (err, result) => {
        if (err) return res.status(200).json({ error_msg: err.message ,response:false}); 
        if (result.affectedRows === 0) {
          return res.status(200).json({ error_msg: "Customer not found" ,response:false});
        }
        // Send OTP after updating
        sendOtpEmail(customer_email, otp, customer_id);
      });
    } else {
      // Insert new customer
      const insertQuery = 'INSERT INTO customers (customer_name, customer_email, otp) VALUES (?, ?, ?)';
      db.query(insertQuery, [customer_name, customer_email, otp], (err, result) => {
        if (err) return res.status(200).json({ error_msg: err.message ,response:false});
        const newCustomerId = result.insertId; 
        sendOtpEmail(customer_email, otp, newCustomerId); 
      });
    }
  });
};



exports.verifyCustomerOtp = (req, res) => {
  const { customer_id, otp } = req.body;

  // Check if required fields are provided
  if (!customer_id || !otp) {
    return res.status(200).json({ error_msg: "Customer ID and OTP are required" ,response:false});
  }
  const otpCheckQuery = 'SELECT * FROM customers WHERE customer_id = ? AND otp = ?';
  db.query(otpCheckQuery, [customer_id, otp], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message ,response:false});
    }
    if (result.length === 0) {
      return res.status(200).json({ error_msg: "Invalid OTP or Customer ID",response:false });
    }
    const customer = result[0]; 

    const verifyCustomerQuery = 'UPDATE customers SET otp = NULL WHERE customer_id = ?';
    db.query(verifyCustomerQuery, [customer_id], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: err.message ,response:false});
      }

      if (result.affectedRows === 0) {
        return res.status(200).json({ error_msg: "Customer not found",response:false});
      }

      // Generate JWT token
      const token = jwt.sign(
        { customer_id: customer.customer_id, customer_email: customer.customer_email },
        process.env.JWT_SECRET, 
        { expiresIn: 31536000 * 90 }
      );

      res.status(200).json({
        success_msg: "OTP verified successfully",
        token: token,
        customer_id: customer.customer_id,
        response:true,
      });
    });
  });
};
exports.getAllCustomers = (req, res) => {
  const selectQuery = 'SELECT * FROM customers WHERE is_deleted=0';

  db.query(selectQuery, (err, results) => {
    if (err) return res.status(200).json({ error_msg: err.message ,response:false});
    res.json(results);
  });
};
exports.getCustomerInfo = (req, res) => {
  const { customer_id } = req.params;

  // Query to fetch user information
  const query = 'SELECT * FROM customers WHERE customer_id = ?';
  db.query(query, [customer_id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message,response:false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'Customer not found' ,response:false});
    }

    res.status(200).json({ user: results[0] ,response:true,success_msg:'Customer found successfully'});
  });
};
exports.loginWithEmail = (req, res) => {
  const { customer_email } = req.body;

  // Check if the customer_email is provided
  if (!customer_email) {
    return res.status(200).json({ error_msg: "Customer email is required",response:false });
  }

  // Query to check if the email exists in the database
  const emailCheckQuery = 'SELECT * FROM customers WHERE customer_email = ?';
  db.query(emailCheckQuery, [customer_email], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message ,response:false});
    }

    if (result.length === 0) {
      return res.status(200).json({ error_msg: "Customer with this email does not exist" ,response:false});
    }

    const customer = result[0];

    // Generate a new OTP
    const otp = Math.floor(1000 + Math.random() * 9000);

    // Update the OTP in the database
    const updateOtpQuery = 'UPDATE customers SET otp = ? WHERE customer_id = ?';
    db.query(updateOtpQuery, [otp, customer.customer_id], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: err.message ,response:false});
      }

      // Function to send OTP email
      const sendOtpEmail = (email, otp) => {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_SERVICE,
            pass: process.env.EMAIL_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          }
        });

        const mailOptions = {
          from: process.env.EMAIL_SERVICE,
          to: email,
          subject: 'OTP Login Verification',
          text: `Your OTP for login is ${otp}`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message ,response:false});
          }
          console.log('OTP sent to email:', email);
          res.status(200).json({ success_msg: 'OTP sent successfully to your email', customer_id: customer.customer_id ,response:true});
        });
      };

      // Send the OTP email
      sendOtpEmail(customer_email, otp);
    });
  });
};
exports.resendOtp = (req, res) => {
  const {customer_id} = req.body;
  if (!customer_id) {
    return res.status(200).json({ error_msg: "Customer ID is required",response:false });
  }
  const idCheckQuery = 'SELECT * FROM customers WHERE customer_id = ?';
  db.query(idCheckQuery, [customer_id], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message ,response:false});
    }
    if (result.length === 0) {
      return res.status(200).json({ error_msg: "Customer with this ID does not exist",response:false });
    }
    const customer = result[0];
    const otp = Math.floor(1000 + Math.random() * 9000);
    const updateOtpQuery = 'UPDATE customers SET otp = ? WHERE customer_id = ?';
    db.query(updateOtpQuery, [otp, customer.customer_id], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: err.message ,response:false});
      }
      // Function to send OTP email
      const sendOtpEmail = (email, otp) => {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_SERVICE,
            pass: process.env.EMAIL_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          }
        });

        const mailOptions = {
          from: process.env.EMAIL_SERVICE,
          to: customer.customer_email, 
          subject: 'Resend OTP Verification',
          text: `Your new OTP is ${otp}`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message,response:false});
          }
          console.log('OTP resent to email:', customer.customer_email);
          res.status(200).json({ success_msg: 'OTP resent successfully to your email', customer_id: customer.customer_id ,response:true});
        });
      };

      // Send the new OTP email
      sendOtpEmail(customer.customer_email, otp);
    });
  });
};
// Get all restaurants with their service time
exports.getAllRestaurantWithTime = (req, res) => {
  const selectQuery = `
    SELECT users.*, service_time.*
    FROM users
    JOIN service_time ON users.id = service_time.userId
    WHERE users.is_deleted = 0`;

  db.query(selectQuery, (err, results) => {
    if (err) return res.status(200).json({ error_msg: err.message, response: false });
    
    res.status(200).json({
      success_msg: "Data fetched successfully",
      response: true,
      data: results
    });
  });
};
// Get restaurant day details
exports.getrestrodaydetails = (req, res) => {
  const selectQuery = `
    SELECT service_time.*, days_listing.day_name, users.id AS userId
    FROM service_time
    JOIN days_listing ON service_time.day_id = days_listing.day_id
    JOIN users ON service_time.userId = users.id
    WHERE users.is_deleted = 0`;

  db.query(selectQuery, (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message, response: false });
    }

    // Group results by userId and rename it to id
    const groupedData = results.reduce((acc, row) => {
      if (!acc[row.userId]) {
        acc[row.userId] = {
          id: row.userId,  
          days: []
        };
      }

      acc[row.userId].days.push({
        day_name: row.day_name,
        start_time: row.start_time,
        end_time: row.end_time,
        status: row.status,
        is_deleted: row.is_deleted
      });

      return acc;
    }, {});

    // Convert the grouped data object to an array
    const resultArray = Object.values(groupedData);
    
    res.status(200).json({
      success_msg: "Day details fetched successfully", 
      response: true,
      data: resultArray
    });
  });
};

// controllers/authController.js
const db = require('../config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Temporary upload directory
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Create a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage }).single('image');

// Check if email exists
const checkEmailExists = (email, id = null) => {
  return new Promise((resolve, reject) => {
    const query = id ? 'SELECT id FROM users WHERE email = ? AND id != ?' : 'SELECT id FROM users WHERE email = ?';
    const params = id ? [email, id] : [email];
    db.query(query, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.length > 0);
      }
    });
  });
};

// Insert or Update a user (restaurant)
exports.createOrUpdateOneStep = async (req, res) => {
  console.log('Request Body:', req.body);
  console.log('Uploaded File:', req.file);

  // Handle file upload first
  upload(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ error: 'Multer error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Error uploading file', details: err.message });
    }

    const { id, username, email, phone, pancard, gst_no } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    try {
      // Check if the email is already in use
      const emailExists = await checkEmailExists(email, id);
      if (emailExists) {
        return res.status(400).json({ error: 'Email is already in use' });
      }

      if (id) {
        // Update user if id is provided
        const getUserQuery = 'SELECT image FROM users WHERE id = ?';
        db.query(getUserQuery, [id], (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Database error during user retrieval', details: err.message });
          }
          if (result.length === 0) {
            return res.status(404).json({ error: 'User (restaurant) not found' });
          }

          const oldImage = result[0].image;
          const updateQuery = `
            UPDATE users 
            SET username = ?, email = ?, phone = ?, pancard = ?, image = ?, gst_no = ? 
            WHERE id = ?`;
          db.query(updateQuery, [username, email, phone, pancard, image || oldImage, gst_no, id], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Database error during update', details: err.message });
            }

            // Move the file if a new image is uploaded
            if (req.file) {
              const dir = `uploads/registered_restaurants/${id}`;
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }

              const tempPath = req.file.path; // Path where multer saves the file initially
              const newPath = path.join(dir, req.file.filename);

              fs.rename(tempPath, newPath, (err) => {
                if (err) {
                  return res.status(500).json({ error: 'Error moving file', details: err.message });
                }

                // Remove old image file if it exists and is different
                if (oldImage && oldImage !== image) {
                  const oldImagePath = path.join(dir, oldImage);
                  fs.unlink(oldImagePath, (err) => {
                    if (err) {
                      console.warn('Warning: Failed to delete old image', err.message);
                    }
                  });
                }

                res.status(200).json({ message: 'User (restaurant) updated successfully', id });
              });
            } else {
              res.status(200).json({ message: 'User (restaurant) updated successfully', id });
            }
          });
        });
      } else {
        // Insert new user if id is not provided
        const insertQuery = `
          INSERT INTO users (username, email, phone, pancard, gst_no) 
          VALUES (?, ?, ?, ?, ?)`;
        db.query(insertQuery, [username, email, phone, pancard, gst_no], (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Database error during insertion', details: err.message });
          }

          const newid = result.insertId; // Get the newly inserted id

          // Create the directory and move the file if uploaded
          const dir = `uploads/registered_restaurants/${newid}`;
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          if (req.file) {
            const tempPath = req.file.path; // Path where multer saves the file initially
            const newPath = path.join(dir, req.file.filename);

            fs.rename(tempPath, newPath, (err) => {
              if (err) {
                return res.status(500).json({ error: 'Error moving file', details: err.message });
              }

              // Update the user record with the image filename
              const updateImageQuery = `
                UPDATE users 
                SET image = ? 
                WHERE id = ?`;
              db.query(updateImageQuery, [req.file.filename, newid], (err) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error during image update', details: err.message });
                }

                res.status(201).json({ message: 'User (restaurant) created successfully', id: newid });
              });
            });
          } else {
            res.status(201).json({ message: 'User (restaurant) created successfully', id: newid });
          }
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Unexpected error', details: error.message });
    }
  });
};



















// Step 1: Collect User Information
exports.stepOne = (req, res) => {
  const { username, email, phone, pancard } = req.body;

  // Validate inputs
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Store in database (assuming you have a users table)
  const query = `INSERT INTO users (username, email, phone, pancard, image) VALUES (?, ?, ?, ?, ?)`;
  db.query(query, [username, email, phone, pancard, req.file.filename], (err, result) => {
    if (err) throw err;
    res.status(200).json({ message: 'Step 1 completed', userId: result.insertId });
  });
};

// Step 2: Restaurant Information
exports.stepTwo = (req, res) => {
  const { userId, restaurantName, restaurantAddress } = req.body;

  const query = `UPDATE users SET restaurantName=?, restaurantAddress=? WHERE id=?`;
  db.query(query, [restaurantName, restaurantAddress, userId], (err, result) => {
    if (err) throw err;
    res.status(200).json({ message: 'Step 2 completed', userId });
  });
};

// Step 3: Send OTP to email
exports.sendOtp = (req, res) => {
  const { email } = req.body;

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  console.log('Generated OTP:', otp); // Log OTP for debugging

  // Send email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_SERVICE,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false  // Allow self-signed certificates
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
      console.error('Error sending email:', error);  // Log detailed email error
      return res.status(500).json({ error: 'Error sending OTP', details: error.message });
    }

    // Save OTP to DB
    const query = `UPDATE users SET otp=? WHERE email=?`;
    db.query(query, [otp, email], (err, result) => {
      if (err) {
        console.error('Database error:', err);  // Log database error
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      console.log('OTP sent to email:', email); // Log success
      res.status(200).json({ message: 'OTP sent to email' });
    });
  });
};

// Step 4: Verify OTP
exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  // Query to check OTP
  const query = `SELECT otp FROM users WHERE email=?`;
  db.query(query, [email], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if the OTP matches
    if (result[0].otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // OTP verified successfully
    res.status(200).json({ message: 'OTP verified successfully' });
  });
};

// Step 5: Set Password
exports.setPassword = (req, res) => {
  const { email, password, confirmPassword } = req.body;

  // Check if passwords match
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  // Hash the password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: 'Error hashing password' });
    }

    // Update user with the hashed password and clear the OTP
    const query = `UPDATE users SET password=?, otp=NULL WHERE email=?`;
    db.query(query, [hashedPassword, email], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Password set successfully
      res.status(200).json({ message: 'Password set successfully' });
    });
  });
};

//step 6 : Insert Timing Data using user ID
exports.insertTimingData = (req, res) => {
  const { userId, day_id, start_time, end_time } = req.body;

  // Insert timing data into service_time table
  const timingQuery = 'INSERT INTO service_time (user_id, day_id, start_time, end_time) VALUES (?, ?, ?, ?)';
  db.query(timingQuery, [userId, day_id, start_time, end_time], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error while inserting timing data' });
    }

    // Timing data inserted successfully
    res.status(200).json({ message: 'Timing data inserted successfully' });
  });
};

//step 7 : Insert Dining Area using user ID and dining area ID
exports.insertDiningArea = (req, res) => {
  const { userId, dining_area_id } = req.body;

  // Insert dining area data into selected_dining_areas table
  const query = 'INSERT INTO selected_dining_areas (userId, dining_area_id) VALUES (?, ?)';
  db.query(query, [userId, dining_area_id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error while inserting dining area data', details: err.message });
    }

    // Dining area data inserted successfully
    res.status(200).json({ message: 'Dining area data inserted successfully' });
  });
};

//step 8 : Insert Dining Area Table
exports.insertDiningTable = async (req, res) => {
  const { userId, dining_area_id, table_name, table_no_of_seats } = req.body;

  try {
    // Insert dining area data into all_tables table
    const query = 'INSERT INTO all_tables (userId, dining_area_id, table_name, table_no_of_seats) VALUES (?, ?, ?, ?)';
    await db.promise().query(query, [userId, dining_area_id, table_name, table_no_of_seats]);

    // Retrieve the user's email
    const userQuery = 'SELECT email FROM users WHERE id = ?';
    const [userResult] = await db.promise().query(userQuery, [userId]);

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userEmail = userResult[0].email;

    // Retrieve the superadmin email
    const superadminQuery = 'SELECT superadmin_email FROM superadmin_login';
    const [superadminResult] = await db.promise().query(superadminQuery);

    const superadminEmail = superadminResult[0].superadmin_email;

    // Recipients (restaurant, and super admin)
    const recipients = [ userEmail, superadminEmail];

    // Send email to user
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_SERVICE,  // Your email service
        pass: process.env.EMAIL_PASSWORD  // Your email password
      },
      tls: {
        rejectUnauthorized: false  // Allow self-signed certificates
      }
    });

    const mailOptions = {
      from: '"DineRights" <' + process.env.EMAIL_SERVICE + '>', // Sender name
      to: recipients,
      subject: 'Your Restaurant Listing Request Has Been Submitted to DineRights',
      text: `Dear Restaurant Owner/Manager,

Thank you for registering with DineRights! We are pleased to inform you that your dining area table "${table_name}" with ${table_no_of_seats} seats has been successfully added to our system, and your listing request is now under review.

What Happens Next:
Once approved, your restaurant will be live on the DineRights website and mobile app, allowing diners to easily find and book a table.

Access Your Dashboard:
You can log in to your Restaurant Panel Dashboard using the link below:
[Dashboard Login Link]

Important Information:
Approval Notification: You will receive an email once your listing is approved and live.
Terms and Conditions: Please take a moment to review our terms and conditions here: [Terms and Conditions Link].

If you have any questions or need assistance, please feel free to contact our support team at [Support Email] or [Support Phone Number].

Thank you for choosing DineRights. We look forward to helping you reach more diners and succeed with your restaurant.

Best regards,
The DineRights Team
[Website Link] | [Phone Number]`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Dining table data inserted successfully and email sent to user.' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'An error occurred', details: err.message });
  }
};


// Step 6: login
exports.login = (req, res) => {
  const { email, password } = req.body;

  // Query to find user by email
  const query = `SELECT * FROM users WHERE email=?`;
  db.query(query, [email], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = results[0];

    // Ensure password exists before comparing
    if (!user.password) {
      return res.status(400).json({ error: 'Password not set for this user' });
    }

    // Compare password
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Error comparing passwords:', err);  // Log detailed bcrypt error
        return res.status(500).json({ error: 'Error during password comparison', details: err.message });
      }

      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Create JWT token
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '9h' });
      res.status(200).json({ message: 'Login successful', token });
    });
  });
};

exports.getUserInfo = (req, res) => {
  const { userId } = req.params;

  // Query to fetch user information
  const query = 'SELECT * FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ user: results[0] });
  });
};

exports.getTimingData = (req, res) => {
  const { userId } = req.params;

  // Query to fetch timing data
  const query = 'SELECT * FROM service_time WHERE userId = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    res.status(200).json({ timingData: results });
  });
};

exports.getDiningAreas = (req, res) => {
  const { userId } = req.params;

  // Query to fetch dining area data
  const query = 'SELECT * FROM selected_dining_areas WHERE userId = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    res.status(200).json({ diningAreas: results });
  });
};

exports.getDiningTables = (req, res) => {
  const { userId } = req.params;

  // Query to fetch dining tables data
  const query = 'SELECT * FROM all_tables WHERE userId = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    res.status(200).json({ diningTables: results });
  });
};



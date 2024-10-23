// controllers/authController.js
const db = require('../config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { response } = require('express');



exports.resendrestaurantOtpAfterLogin = (req, res) => {
  const { userId } = req.body;

  // Check if userId is provided
  if (!userId) {
    return res.status(200).json({ error_msg: "User ID is required", response: false });
  }

  const idCheckQuery = 'SELECT * FROM users WHERE id = ?';
  
  // Check if user exists
  db.query(idCheckQuery, [userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error while checking user ID', details: err.message, response: false });
    }
    if (result.length === 0) {
      return res.status(200).json({ error_msg: "User with this ID does not exist", response: false });
    }

    const user = result[0];  // User found

    // Check if the user has signup_status = 1
    if (user.signup_status !== 1) {
      return res.status(200).json({ error_msg: 'User is not signed up. OTP cannot be sent.', response: false });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);  

    const updateOtpQuery = 'UPDATE users SET otp = ? WHERE id = ?';

    // Update the user's OTP in the database
    db.query(updateOtpQuery, [otp, user.id], (err, updateResult) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error while updating OTP', details: err.message, response: false });
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
          to: email,  // Send to user's email
          subject: 'Resend OTP Verification',
          text: `Your new OTP is ${otp}. Please use this to verify your account.`,
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message, response: false });
          }
          console.log('OTP resent to email:', email);
          res.status(200).json({ success_msg: 'OTP resent successfully to your email', userId: user.id, response: true });
        });
      };

      // Send the new OTP email
      sendOtpEmail(user.email, otp);
    });
  });
};
exports.resendrestaurantOtp = (req, res) => {
  const { userId } = req.body;

  // Check if userId is provided
  if (!userId) {
    return res.status(200).json({ error_msg: "User ID is required", response: false });
  }

  const idCheckQuery = 'SELECT * FROM users WHERE id = ?';
  
  // Check if user exists
  db.query(idCheckQuery, [userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error while checking user ID', details: err.message, response: false });
    }
    if (result.length === 0) {
      return res.status(200).json({ error_msg: "User with this ID does not exist", response: false });
    }

    const user = result[0];  // User found
    const otp = Math.floor(1000 + Math.random() * 9000);  // Generate 4-digit OTP

    const updateOtpQuery = 'UPDATE users SET otp = ? WHERE id = ?';

    // Update the user's OTP in the database
    db.query(updateOtpQuery, [otp, user.id], (err, updateResult) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error while updating OTP', details: err.message, response: false });
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
          to: email,  // Send to user's email
          subject: 'Resend OTP Verification',
          text: `Your new OTP is ${otp}. Please use this to verify your account.`,
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message, response: false });
          }
          console.log('OTP resent to email:', email);
          res.status(200).json({ success_msg: 'OTP resent successfully to your email', userId: user.id, response: true });
        });
      };

      // Send the new OTP email
      sendOtpEmail(user.email, otp);
    });
  });
};

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

// Set up multer storage to store all files in the same directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Set destination to the same folder for all uploads
    cb(null, 'uploads/registered_restaurants/');
  },
  filename: function (req, file, cb) {
    // Create a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Allow multiple files for 'image' without a max limit and single 'license_image'
const upload = multer({ storage: storage }).fields([
  { name: 'image', maxCount: Infinity }, // Set maxCount to Infinity
  { name: 'license_image', maxCount: 1 }
]);

// Insert or Update a user (restaurant)
exports.createOrUpdateOneStep = async (req, res) => {
  console.log('Request Body:', req.body);
  console.log('Uploaded Files:', req.files);

  // Handle file uploads first
  upload(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(200).json({ error_msg: 'Multer error', details: err.message, response: false });
    } else if (err) {
      return res.status(200).json({ error_msg: 'Error uploading files', details: err.message, response: false });
    }

    const { id, username, email, phone, pancard, gst_no } = req.body;
    const licenseImage = req.files['license_image'] ? req.files['license_image'][0].filename : null;
    const images = req.files['image'] || []; 

    if (!username) {
      return res.status(200).json({ error_msg: 'Username is required', response: false });
    }

    try {
      // Check if the email is already in use
      const emailExists = await checkEmailExists(email, id);
      if (emailExists) {
        return res.status(200).json({ error_msg: 'Email is already in use', response: false });
      }

      if (id) {
        // Update user if id is provided
        const getUserQuery = 'SELECT license_image FROM users WHERE id = ?';
        db.query(getUserQuery, [id], (err, result) => {
          if (err) {
            return res.status(200).json({ error_msg: 'Database error during user retrieval', details: err.message, response: false });
          }
          if (result.length === 0) {
            return res.status(200).json({ error_msg: 'User (restaurant) not found', response: false });
          }

          const oldLicenseImage = result[0].license_image;
          const updateQuery = `
            UPDATE users 
            SET username = ?, email = ?, phone = ?, pancard = ?, license_image = ?, gst_no = ? 
            WHERE id = ?`;
          db.query(updateQuery, [username, email, phone, pancard, licenseImage || oldLicenseImage, gst_no, id], (err) => {
            if (err) {
              return res.status(200).json({ error_msg: 'Database error during update', details: err.message, response: false });
            }

            // Move the files if new license_image is uploaded
            if (req.files['license_image']) {
              handleFileMove(req.files['license_image'][0], 'license_image', id, oldLicenseImage);
            }

            // Insert multiple images into restaurant_fassai_images table
            if (images.length > 0) {
              images.forEach((imageFile) => {
                handleImageInsertAndMove(imageFile, id);
              });
            }

            res.status(200).json({ success_msg: 'User (restaurant) updated successfully', id, response: true });
          });
        });
      } else {
        // Insert new user if id is not provided
        const insertQuery = `
          INSERT INTO users (username, email, phone, pancard, gst_no) 
          VALUES (?, ?, ?, ?, ?)`;
        db.query(insertQuery, [username, email, phone, pancard, gst_no], (err, result) => {
          if (err) {
            return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
          }

          const newId = result.insertId;

          // Move and insert the uploaded files for new user
          if (req.files['license_image']) {
            handleFileMove(req.files['license_image'][0], 'license_image', newId);
          }

          // Insert multiple images into restaurant_fassai_images table
          if (images.length > 0) {
            images.forEach((imageFile) => {
              handleImageInsertAndMove(imageFile, newId);
            });
          }

          res.status(200).json({ success_msg: 'User (restaurant) created successfully', userId: newId, response: true });
        });
      }
    } catch (error) {
      res.status(200).json({ error_msg: 'Unexpected error', details: error.message, response: false });
    }
  });
};

// Helper function to insert image into restaurant_fassai_images and move file
const handleImageInsertAndMove = (file, restaurantId) => {
  const dir = `uploads/registered_restaurants/${restaurantId}`; 
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = file.path;  // Path where multer saves the file initially
  const newPath = path.join(dir, file.filename);

  // Move the file to its final location
  fs.rename(tempPath, newPath, (err) => {
    if (err) {
      console.error('Error moving image:', err);
      return;
    }

    // Insert the image record into the restaurant_fassai_images table
    const insertImageQuery = `
      INSERT INTO restaurant_fassai_images (userId, restaurant_fassai_image_name) 
      VALUES (?, ?)`; 
    db.query(insertImageQuery, [restaurantId, file.filename], (err) => {
      if (err) {
        console.error('Database error during image insert:', err);
      }
    });
  });
};

// Helper function to move the license_image and update the database
const handleFileMove = (file, field, id, oldFile = null) => {
  const dir = `uploads/registered_restaurants/${id}`; 
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = file.path;
  const newPath = path.join(dir, file.filename);

  fs.rename(tempPath, newPath, (err) => {
    if (err) {
      console.error(`Error moving ${field}:`, err);
      return;
    }

    // Remove old file if it exists and is different
    if (oldFile && oldFile !== file.filename) {
      const oldFilePath = path.join(dir, oldFile);
      fs.unlink(oldFilePath, (err) => {
        if (err) {
          console.warn(`Warning: Failed to delete old ${field}`, err.message);
        }
      });
    }

    // Update the user record with the new file name
    const updateFileQuery = `
      UPDATE users 
      SET ${field} = ? 
      WHERE id = ?`;
    db.query(updateFileQuery, [file.filename, id], (err) => {
      if (err) {
        console.error(`Database error during ${field} update:`, err);
      }
    });
  });
};

exports.stepTwo = (req, res) => {
  const { userId, restaurantName, restaurantAddress } = req.body;

  const query = `UPDATE users SET restaurantName=?, restaurantAddress=? WHERE id=?`;
  db.query(query, [restaurantName, restaurantAddress, userId], (err, result) => {
    if (err) throw err;
    res.status(200).json({ success_msg: 'Step 2 completed',response:true});
  });
};
// Step 3: Send OTP to email
exports.sendOtp = (req, res) => {
  const { userId, email } = req.body;

  // Generate OTP
  const otp = Math.floor(1000 + Math.random() * 9000); 

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
      return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message,response:false });
    }

    // Save OTP to DB based on userId
    const query = `UPDATE users SET otp=? WHERE id=?`;
    db.query(query, [otp, userId], (err, result) => {
      if (err) {
        console.error('Database error_msg:', err);  // Log database error
        return res.status(200).json({ error_msg: 'Database error', details: err.message,response:false });
      }
      console.log('OTP sent to email:', email); // Log success
      res.status(200).json({ success_msg: 'OTP sent to email', response: true });
    });
  });
};

// Step 4: Verify OTP 
exports.verifyOtp = (req, res) => {
  const { userId, otp } = req.body;

  // Query to check OTP based on userId
  const query = `SELECT otp FROM users WHERE id=?`;
  db.query(query, [userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error' ,response:false});
    }

    if (result.length === 0) {
      return res.status(200).json({ error_msg: 'User not found',response:false });
    }

    // Check if the OTP matches
    if (result[0].otp !== otp) {
      return res.status(200).json({ error_msg: 'Invalid OTP',response:false });
    }

    // OTP verified successfully
    res.status(200).json({ success_msg: 'OTP verified successfully' , response: true});
  });
};

exports.restro_guest_time_duration = (req, res) => {
  const { userId, restro_guest, restro_spending_time } = req.body;

  // Step 1: Check if the record already exists for the given userId
  const checkQuery = 'SELECT * FROM restro_guest_time_duration WHERE userId = ?';
  db.query(checkQuery, [userId], (err, result) => {
    if (err) {
      console.error('Database error during check:', err); // Log the error
      return res.status(200).json({ error_msg: 'Database error during record check', response: false });
    }

    // Step 2: Delete existing records if found, before inserting new ones
    const deleteQuery = 'DELETE FROM restro_guest_time_duration WHERE userId = ?';
    db.query(deleteQuery, [userId], (err) => {
      if (err) {
        console.error('Database error during deletion:', err); // Log the error
        return res.status(200).json({ error_msg: 'Database error while deleting existing records', response: false });
      }

      // Step 3: Insert new records
      const insertQuery = 'INSERT INTO restro_guest_time_duration (userId, restro_guest, restro_spending_time) VALUES ?';
      const values = restro_guest.map((guest, index) => [userId, guest, restro_spending_time[index]]); // Create an array of values

      db.query(insertQuery, [values], (err, result) => {
        if (err) {
          console.error('Database error during insert:', err); // Log the error
          return res.status(200).json({ error_msg: 'Database error while inserting timing data', response: false });
        }

        // Records inserted successfully
        res.status(200).json({ success_msg: 'Timing data inserted successfully', response: true });
      });
    });
  });
};

exports.setPassword = (req, res) => {
  const { userId, password, confirmPassword } = req.body;

  // Check if passwords match
  if (password !== confirmPassword) {
    return res.status(200).json({ error_msg: 'Passwords do not match',response:false });
  }

  // Hash the password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Error hashing password',response:false });
    }

    // Update user with the hashed password and clear the OTP
    const query = `UPDATE users SET password=?, otp=NULL WHERE id=?`;
    db.query(query, [hashedPassword, userId], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error',response:false });
      }

      // Password set successfully
      res.status(200).json({ success_msg: 'Password set successfully' ,response:true});
    });
  });
};

exports.insertTimingData = (req, res) => {
  const { userId, day_id, start_time, end_time ,status} = req.body;

  // Insert timing data into service_time table
  const timingQuery = 'INSERT INTO service_time (userId, day_id, start_time, end_time,status) VALUES (?, ?, ?, ?,?)';
  
  db.query(timingQuery, [userId, day_id, start_time, end_time,status], (err, result) => {
    if (err) {
      console.error('Database error_msg:', err); // Log the database error for debugging
      return res.status(200).json({ error_msg: 'Database error while inserting timing data' ,response:false});
    }

    // Timing data inserted successfully
    res.status(200).json({ success_msg: 'Timing data inserted successfully', service_time_id: result.insertId ,response:true});
  });
};

exports.insertOrUpdateTimingData = (req, res) => {
  const { userId, data } = req.body;

  // Check if the data array exists and has entries
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(200).json({ error_msg: 'No timing data provided', response: false });
  }

  // Loop through each timing object in the data array
  const promises = data.map((timing) => {
    const { day_id, start_time, end_time, status } = timing;

    // Check if the required fields are available
    if (!day_id || !start_time || !end_time || !status) {
      return Promise.reject(new Error(`Missing required fields for day_id: ${day_id}`));
    }

    // Check if a record already exists for this userId and day_id
    const checkQuery = 'SELECT * FROM service_time WHERE userId = ? AND day_id = ?';
    return new Promise((resolve, reject) => {
      db.query(checkQuery, [userId, day_id], (err, result) => {
        if (err) {
          console.error('Error during select:', err);
          return reject({ error_msg: 'Database error during record check', response: false });
        }

        if (result.length > 0) {
          // If record exists, update it
          const updateQuery = 'UPDATE service_time SET start_time = ?, end_time = ?, status = ? WHERE userId = ? AND day_id = ?';
          db.query(updateQuery, [start_time, end_time, status, userId, day_id], (err) => {
            if (err) {
              console.error('Error during update:', err);
              return reject({ error_msg: 'Database error while updating timing data', response: false });
            }
            resolve({ success_msg: `Timing data updated for day_id: ${day_id}`, response: true });
          });
        } else {
          // Insert a new record if no record exists
          const insertQuery = 'INSERT INTO service_time (userId, day_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)';
          db.query(insertQuery, [userId, day_id, start_time, end_time, status], (err, result) => {
            if (err) {
              console.error('Error during insert:', err);
              return reject({ error_msg: 'Database error while inserting timing data', response: false });
            }
            resolve({ success_msg: `Timing data inserted for day_id: ${day_id}`, service_time_id: result.insertId, response: true });
          });
        }
      });
    });
  });

  // Wait for all promises to resolve
  Promise.all(promises)
    .then((results) => res.status(200).json({ messages: results, response: true }))
    .catch((error) => res.status(200).json({ error_msg: 'Error processing timing data', details: error, response:false }));
};

exports.insertDiningArea = (req, res) => {
  const { userId, dining_area_ids } = req.body; // Expecting dining_area_ids to be an array

  // Check if dining_area_ids is an array and not empty
  if (!Array.isArray(dining_area_ids) || dining_area_ids.length === 0) {
    return res.status(200).json({
      error_msg: 'No dining areas provided',
      response: false
    });
  }

  // Build the values array for batch insert
  const values = dining_area_ids.map(dining_area_id => [userId, dining_area_id]);

  // Insert multiple dining area data into selected_dining_areas table
  const query = 'INSERT INTO selected_dining_areas (userId, dining_area_id) VALUES ?';
  db.query(query, [values], (err, result) => {
    if (err) {
      return res.status(200).json({
        error_msg: 'Database error while inserting dining area data',
        details: err.message,
        response: false
      });
    }

    // Dining area data inserted successfully
    res.status(200).json({
      success_msg: 'Dining area data inserted successfully',
      affectedRows: result.affectedRows, // Number of rows inserted
      response: true
    });
  });
};


exports.insertDiningTable = (req, res) => {
  const { userId, dining_areas } = req.body;

  // Check if dining_areas exists and contains valid data
  if (!Array.isArray(dining_areas) || dining_areas.length === 0) {
    return res.status(200).json({
      error_msg: 'No dining areas or tables provided',
      response: false
    });
  }

  // Prepare the values for bulk insert
  const values = [];
  dining_areas.forEach(area => {
    area.tables.forEach(table => {
      values.push([userId, area.dining_area_id, table.table_name, table.table_no_of_seats]);
    });
  });

  if (values.length === 0) {
    return res.status(200).json({
      error_msg: 'No tables provided for insertion',
      response: false
    });
  }

  // Query to insert multiple dining tables
  const query = 'INSERT INTO all_tables (userId, dining_area_id, table_name, table_no_of_seats) VALUES ?';
  
  db.query(query, [values], (err, result) => {
    if (err) {
      return res.status(200).json({ 
        error_msg: 'Database error while inserting dining table data', 
        details: err.message, 
        response: false 
      });
    }

    // After successful insertion, retrieve the user's email
    const userQuery = 'SELECT email FROM users WHERE id = ?';
    db.query(userQuery, [userId], (err, userResult) => {
      if (err || userResult.length === 0) {
        return res.status(200).json({
          error_msg: 'Database error while retrieving user email',
          table_count: result.affectedRows, // Number of rows inserted
          response: false
        });
      }

      const userEmail = userResult[0].email;

      // Set up email transport
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_SERVICE,  
          pass: process.env.EMAIL_PASSWORD  
        },
        tls: {
          rejectUnauthorized: false  
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_SERVICE,
        to: userEmail,
        subject: 'Your Restaurant Tables Have Been Added to Dine Right',
        text: `Dear Restaurant Owner/Manager,

Thank you for registering your restaurant tables with Dine Right! We are pleased to inform you that multiple dining tables have been successfully added to our system.

What Happens Next:
Your restaurant will be live on the Dine Right website and mobile app after approval, allowing diners to easily book a table.

Thank you for choosing Dine Right. We look forward to helping you succeed.

Best regards,
The Dine Right Team`
      };

      // Send email notification
      transporter.sendMail(mailOptions, (emailError, info) => {
        if (emailError) {
          console.error('Error sending email:', emailError);
          return res.status(200).json({ 
            error_msg: 'Error sending email', 
            details: emailError.message, 
            table_count: result.affectedRows, // Number of rows inserted
            response: false 
          });
        }

        // Update signup_status in the users table
        const updateQuery = 'UPDATE users SET signup_status = 1 WHERE id = ?';
        db.query(updateQuery, [userId], (updateErr) => {
          if (updateErr) {
            console.error('Error updating signup status:', updateErr);
            return res.status(200).json({ 
              error_msg: 'Error updating signup status', 
              details: updateErr.message, 
              table_count: result.affectedRows, 
              response: false 
            });
          }

          res.status(200).json({ 
            success_msg: 'Dining table data inserted successfully, email sent to user, and signup status updated.', 
            table_count: result.affectedRows, // Number of rows inserted
            response: true 
          });
        });
      });
    });
  });
};


// Step 6: login
exports.login = (req, res) => {
  const { email, password } = req.body;

  // Query to find user by email
  const query = `SELECT * FROM users WHERE email=?`;
  db.query(query, [email], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'User not found',response:false });
    }

    const user = results[0];

    // Ensure password exists before comparing
    if (!user.password) {
      return res.status(200).json({ error_msg: 'Password not set for this user',response:false });
    }

    // Compare password
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Error comparing passwords:', err);  // Log detailed bcrypt error
        return res.status(200).json({ error_msg: 'Error during password comparison', details: err.message,response:false });
      }

      if (!isMatch) {
        return res.status(200).json({ error_msg: 'Invalid credentials',response:false });
      }

      // Create JWT token
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.status(200).json({ success_msg: 'Login successful', token ,response:true});
    });
  });
};
exports.getUserInfo = (req, res) => {
  const { userId } = req.params;

  // Query to fetch user information
  const query = 'SELECT * FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message,response:false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'User not found',response:false });
    }

    res.status(200).json({ user: results[0],success_msg:'success',response:true });
  });
};

exports.getUsersInfo = (req, res) => {
  const query = `
    SELECT users.*, banner_images.banner_image, banner_images.banner_image_id, banner_images.userId
    FROM users
    LEFT JOIN banner_images ON users.id = banner_images.banner_image_id
    WHERE users.status = ?
  `;
  const status = 'Activated';

  db.query(query, [status], (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message ,response:false});
    }
    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'No users found',response:false });
    }

    const baseURL = process.env.BASE_URL;

    // Modify the results to include the full URL for banner_image
    const updatedResults = results.map(user => {
      if (user.banner_image && user.userId) {
        // Use banner_images.userId to construct the URL
        user.banner_image = `${baseURL}/uploads/banner_images/${user.userId}/${user.banner_image}`;
      } else {
        user.banner_image = null; // Handle case where no banner image exists
      }
      return user;
    });

    res.status(200).json({ users: updatedResults, success_msg: 'success', response: true });
  });
};
exports.getRestroInfo = (req, res) => {
  const query = 'SELECT * FROM users';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message ,response:false});
    }
    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'No users found',response:false });
    }
    // custom image url
    let userData = [];
    for (const user of results){
    
      user.image = `${process.env.BASE_URL}/uploads/registered_restaurants/${user.id}/${user.image}`;
      user.license_image = `${process.env.BASE_URL}/uploads/registered_restaurants/${user.id}/${user.license_image}`;
      userData.push(user);
    }

    res.status(200).json({ users: userData ,success_msg:'success',response:true});
  });
};

exports.getTimingDatabyResrtoId = (req, res) => {
  const { userId } = req.userId;

  // Query to fetch timing data along with the day name from the days_listing table
  const query = `
    SELECT st.service_time_id,st.day_id, dl.day_name, st.start_time, st.end_time, st.status 
    FROM service_time st
    JOIN days_listing dl ON st.day_id = dl.day_id
    WHERE st.userId = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
    }

    // Send the results with the day name and timing data
    res.status(200).json({ timingData: results, success_msg: 'Success', response: true });
  });
};
exports.updateTimingData = (req, res) => {
  const userId = req.body.userId;
  const { service_time_id, day_id, start_time, end_time, status } = req.body;

  // Check if all required fields are provided
  if (!userId || !service_time_id || !day_id || !start_time || !end_time || !status) {
    return res.status(200).json({ error_msg: 'Missing required fields', response: false });
  }

  // Query to update the timing data based on userId and service_time_id
  const updateQuery = `
    UPDATE service_time 
    SET start_time = ?, end_time = ?, status = ?, day_id = ?
    WHERE userId = ? AND service_time_id = ?
  `;

  db.query(updateQuery, [start_time, end_time, status, day_id, userId, service_time_id], (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
    }

    // Check if the update affected any rows
    if (results.affectedRows === 0) {
      return res.status(200).json({ error_msg: 'No matching record found to update', response: false });
    }

    // Send success message
    res.status(200).json({ success_msg: 'Timing data updated successfully', response: true });
  });
};


exports.getTimingData = (req, res) => {
  const { userId } = req.params;

  // Query to fetch timing data along with the day name from the days_listing table
  // ice_time_id
  const query = `
    SELECT st.day_id, dl.day_name, st.start_time, st.end_time, st.status 
    FROM service_time st
    JOIN days_listing dl ON st.day_id = dl.day_id
    WHERE st.userId = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
    }

    // Send the results with the day name and timing data
    res.status(200).json({ timingData: results, success_msg: 'Success', response: true });
  });
};

exports.getDiningAreas = (req, res) => {
  const { userId } = req.params;

  // Query to fetch dining area data
  const query = `SELECT da.dining_area_id, da.dining_area_type 
  FROM selected_dining_areas sda
  JOIN dining_areas da ON da.dining_area_id = sda.dining_area_id
   WHERE userId = ?`;
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message,response:false });
    }

    res.status(200).json({ diningAreas: results ,success_msg:'success',response:true});
  });
};

exports.getDiningTables = (req, res) => {
  const { userId } = req.params;

  // Query to fetch dining tables data
  const query = 'SELECT * FROM all_tables WHERE userId = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message,response:false });
    }

    res.status(200).json({ diningTables: results ,success_msg:'success',response:true});
  });
};

// exports.loginWithOtp = (req, res) => {
//   const { email } = req.body;

//   // Step 1: Query to check if the email exists
//   const query = `SELECT * FROM users WHERE email=?`;
//   db.query(query, [email], (err, results) => {
//     if (err) {
//       console.error('Database error_msg:', err); // Log the error for debugging
//       return res.status(200).json({ error_msg: 'Database error during email check', details: err.message,response:false });
//     }

//     if (results.length === 0) {
//       return res.status(200).json({ error_msg: 'User not found. Please register first.',response:false });
//     }

//     const user = results[0];

//     // Step 2: Generate OTP
//     const otp = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit OTP
//     console.log('Generated OTP:', otp); // Log OTP for debugging

//     // Step 3: Send OTP via email
//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: process.env.EMAIL_SERVICE,
//         pass: process.env.EMAIL_PASSWORD,
//       },
//       tls: {
//         rejectUnauthorized: false,
//       },
//     });

//     const mailOptions = {
//       from: process.env.EMAIL_SERVICE,
//       to: email,
//       subject: 'Your OTP for Login',
//       text: `Your OTP is ${otp}`,
//     };

//     transporter.sendMail(mailOptions, (error, info) => {
//       if (error) {
//         console.error('Error sending email:', error); // Log email error
//         return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message ,response:false});
//       }
//       // Step 4: Save OTP to the database for future verification
//       const otpQuery = `UPDATE users SET otp=? WHERE email=?`;
//       db.query(otpQuery, [otp, email], (err, result) => {
//         if (err) {
//           console.error('Database error during OTP save:', err); // Log error
//           return res.status(200).json({ error_msg: 'Database error while saving OTP', details: err.message,response:false });
//         }
//         // Step 5: Send response after successful OTP generation and email
//         res.status(200).json({ success_msg: 'OTP sent to email successfully. Please verify OTP to complete login.',response:true });
//       });
//     });
//   });
// };


// OTP verification function

exports.loginWithOtp = (req, res) => {
  const { email } = req.body;

  // Step 1: Query to check if the email exists and get the signup_status
  const query = `SELECT * FROM users WHERE email=?`;
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('Database error_msg:', err); // Log the error for debugging
      return res.status(200).json({ error_msg: 'Database error during email check', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'User not found. Please register first.', response: false });
    }

    const user = results[0];

    // Step 2: Check signup_status
    if (user.signup_status === 0) {
      return res.status(200).json({ error_msg: 'Restaurant not found.', response: false });
    } else if (user.signup_status === 1) {
      // Step 3: Generate OTP
      const otp = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit OTP
      console.log('Generated OTP:', otp); // Log OTP for debugging

      // Step 4: Send OTP via email
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_SERVICE,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_SERVICE,
        to: email,
        subject: 'Your OTP for Login',
        text: `Your OTP is ${otp}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error); // Log email error
          return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message, response: false });
        }

        // Step 5: Save OTP to the database for future verification
        const otpQuery = `UPDATE users SET otp=? WHERE email=?`;
        db.query(otpQuery, [otp, email], (err, result) => {
          if (err) {
            console.error('Database error during OTP save:', err); // Log error
            return res.status(200).json({ error_msg: 'Database error while saving OTP', details: err.message, response: false });
          }
          // Step 6: Send response after successful OTP generation and email
          res.status(200).json({  userId:user.id, success_msg: 'OTP sent to email successfully. Please verify OTP to complete login.', response: true });
        });
      });
    }
  });
};

exports.verifyLoginOtp = (req, res) => {
  const { email, otp } = req.body;

  // Step 1: Query to check if the provided OTP matches the one in the database
  const query = `SELECT * FROM users WHERE email=? AND otp=?`;
  db.query(query, [email, otp], (err, results) => {
    if (err) {
      console.error('Database error during OTP check:', err); 
      return res.status(200).json({ error_msg: 'Database error during OTP verification', details: err.message,response:false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'Invalid OTP. Please try again.',response:false });
    }

    const user = results[0];

    // Step 2: OTP is valid, create JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET,  { expiresIn: 31536000 * 90 });

    // Clear OTP after successful verification
    const clearOtpQuery = `UPDATE users SET otp=NULL WHERE email=?`;
    db.query(clearOtpQuery, [email], (err, result) => {
      if (err) {
        console.error('Database error during OTP clearing:', err); // Log error
        return res.status(200).json({ error_msg: 'Database error while clearing OTP', details: err.message,response:false });
      }      

      const restorantName = user.restaurantName;

      // Step 3: Send success response with token
      res.status(200).json({ success_msg: 'Login successful', restorantName, token,response:true });
    });
  });
};

exports.stepTwoAndSendOtp = (req, res) => {
  const { userId, restaurantName, restaurantAddress,restaurant_type_id, cuisine_id,city_id } = req.body;

  // Step 1: Update user information (restaurantName and restaurantAddress)
  const updateQuery = `UPDATE users SET restaurantName=?,restaurantAddress=?,city_id=? WHERE id=?`;
  db.query(updateQuery, [restaurantName, restaurantAddress, city_id ,userId], (err, result) => {
    if (err) {
      console.error('Database error during update:', err);
      return res.status(200).json({ error_msg: 'Error updating user information', details: err.message,response:false });
    }

    // Step 2: Insert multiple restaurant_type_id and userId into the restaurant_types table
    const restaurantTypeInsertPromises = restaurant_type_id.map(typeId => {
      const restaurantTypeQuery = `INSERT INTO selected_restaurant_types (restaurant_type_id, userId) VALUES (?, ?) ON DUPLICATE KEY UPDATE restaurant_type_id=?`;
      return new Promise((resolve, reject) => {
        db.query(restaurantTypeQuery, [typeId, userId, typeId], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
    });

    // Step 3: Insert multiple cuisine_id and userId into the cuisines table
    const cuisineInsertPromises = cuisine_id.map(cuisineId => {
      const cuisinesQuery = `INSERT INTO selected_cuisines (cuisine_id, userId) VALUES (?, ?) ON DUPLICATE KEY UPDATE cuisine_id=?`;
      return new Promise((resolve, reject) => {
        db.query(cuisinesQuery, [cuisineId, userId, cuisineId], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
    });

    // Execute both insertion processes (restaurant types and cuisines)
    Promise.all([...restaurantTypeInsertPromises, ...cuisineInsertPromises])
      .then(() => {
        // Step 4: Fetch email from users table for OTP
        const emailQuery = `SELECT email FROM users WHERE id=?`;
        db.query(emailQuery, [userId], (err, result) => {
          if (err) {
            console.error('Database error during email fetch:', err);
            return res.status(200).json({ error_msg: 'Error fetching email', details: err.message ,response:false});
          }

          if (result.length === 0) {
            return res.status(200).json({ error_msg: 'User not found',response:false });
          }

          const email = result[0].email;

          // Step 5: Generate OTP
          const otp = Math.floor(1000 + Math.random() * 9000);
          console.log('Generated OTP:', otp);

          // Step 6: Send email with OTP
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_SERVICE,
              pass: process.env.EMAIL_PASSWORD,
            },
            tls: {
              rejectUnauthorized: false // Allow self-signed certificates
            }
          });

          const mailOptions = {
            from: `DineRight <${process.env.EMAIL_SERVICE}>`,
            to: email,
            subject: 'OTP Verification',
            text: `Your OTP is ${otp}`,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Error sending email:', error);
              return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message ,response:false});
            }

            // Step 7: Save OTP to database
            const otpQuery = `UPDATE users SET otp=? WHERE id=?`;
            db.query(otpQuery, [otp, userId], (err, result) => {
              if (err) {
                console.error('Database error during OTP update:', err);
                return res.status(200).json({ error_msg: 'Error saving OTP', details: err.message,response:false });
              }

              console.log('OTP sent to email:', email);
              res.status(200).json({ success_msg: 'User data updated and OTP sent to email' ,response:true});
            });
          });
        });
      })
      .catch(err => {
        console.error('Error during multiple inserts:', err);
        res.status(200).json({ error_msg: 'Error inserting restaurant type or cuisine information', details: err.message,response:false });
      });
  });
};

//restaurant details with cuisins and restaurant types

exports.getSelectedCuisines = (req, res) => {
  // Query to join selected_cuisines with cuisines table and group by userId
  const query = `
    SELECT sc.userId, c.cuisine_id, c.cuisine_name 
    FROM selected_cuisines sc
    JOIN cuisines c ON sc.cuisine_id = c.cuisine_id
    ORDER BY sc.userId;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'No cuisines found', response: false });
    }

    // Group cuisines by userId
    const groupedResults = results.reduce((acc, row) => {
      const { userId, cuisine_id, cuisine_name } = row;

      // If userId doesn't exist in the accumulator, initialize it
      if (!acc[userId]) {
        acc[userId] = {
          userId: userId,
          cuisines: [],
        };
      }

      // Push the current cuisine to the respective userId's array
      acc[userId].cuisines.push({
        cuisine_id,
        cuisine_name,
      });

      return acc;
    }, {});

    // Convert the grouped object into an array
    const finalResults = Object.values(groupedResults);

    // Return the results with a success message
    res.status(200).json({ success_msg: 'Cuisines retrieved successfully', response: true, data: finalResults });
  });
};


exports.getSelectedRestaurantTypes = (req, res) => {
  // Query to join selected_restaurant_types with restaurant_types table and group by userId
  const query = `
    SELECT sr.userId, rt.restaurant_type_id, rt.restaurant_type_name 
    FROM selected_restaurant_types sr
    JOIN restaurant_types rt ON sr.restaurant_type_id = rt.restaurant_type_id
    ORDER BY sr.userId;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'No restaurant types found', response: false });
    }

    // Group restaurant types by userId
    const groupedResults = results.reduce((acc, row) => {
      const { userId, restaurant_type_id, restaurant_type_name } = row;
      if (!acc[userId]) {
        acc[userId] = {
          userId: userId,
          restaurant_types: [], 
        };
      }
      acc[userId].restaurant_types.push({ 
        restaurant_type_id, 
        restaurant_type_name,
      });

      return acc;
    }, {});

    // Convert the grouped object into an array
    const finalResults = Object.values(groupedResults);

    // Return the results with a success message
    res.status(200).json({ success_msg: 'Restaurant types retrieved successfully', response: true, data: finalResults });
  });
};



exports.getUserInfoWithCuisinesAndRestaurantTypes = (req, res) => {
  // Query to join users with selected_cuisines and selected_restaurant_types
  const query = `
    SELECT u.*, 
           c.cuisine_id, c.cuisine_name,
           rt.restaurant_type_id, rt.restaurant_type_name
    FROM users u
    LEFT JOIN selected_cuisines sc ON u.id = sc.userId
    LEFT JOIN cuisines c ON sc.cuisine_id = c.cuisine_id
    LEFT JOIN selected_restaurant_types srt ON u.id = srt.userId
    LEFT JOIN restaurant_types rt ON srt.restaurant_type_id = rt.restaurant_type_id
    ORDER BY u.id;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'No data found', response: false });
    }

    // Group data by userId
    const groupedResults = results.reduce((acc, row) => {
      const { id: userId, name, email, phone, address, cuisine_id, cuisine_name, restaurant_type_id, restaurant_type_name } = row;

      // If userId doesn't exist in the accumulator, initialize it
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          name,
          email,
          phone,
          address,
          cuisines: [],
          restaurant_types: []
        };
      }

      // If the current row has a cuisine, add it to the cuisines array
      if (cuisine_id && cuisine_name) {
        acc[userId].cuisines.push({ cuisine_id, cuisine_name });
      }

      // If the current row has a restaurant type, add it to the restaurant_types array
      if (restaurant_type_id && restaurant_type_name) {
        acc[userId].restaurant_types.push({ restaurant_type_id, restaurant_type_name });
      }

      return acc;
    }, {});

    // Convert the grouped object into an array
    const finalResults = Object.values(groupedResults);

    // Return the results with a success message
    res.status(200).json({ success_msg: 'Data retrieved successfully', response: true, data: finalResults });
  });
};


exports.getDaysListing = (req, res) => {
  // Query to fetch all days
  const query = 'SELECT * FROM days_listing';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'No days found', response: false });
    }

    res.status(200).json({ days: results, success_msg: 'Days retrieved successfully', response: true });
  });
};
exports.getAllDiningAreas = (req, res) => {
  // Query to fetch all dining areas
  const query = 'SELECT * FROM dining_areas';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ 
        error_msg: 'Database error', 
        details: err.message, 
        response: false 
      });
    }

    // Check if any dining areas are found
    if (results.length === 0) {
      return res.status(200).json({ 
        error_msg: 'No dining areas found', 
        response: false 
      });
    }

    // Send response with the list of dining areas
    res.status(200).json({ 
      diningAreas: results, 
      success_msg: 'Dining areas retrieved successfully', 
      response: true 
    });
  });
};
exports.getAllCities = (req, res) => {
  // Query to fetch all dining areas
  const query = 'SELECT * FROM cities';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error_msg:', err);
      return res.status(200).json({ 
        error_msg: 'Database error', 
        details: err.message, 
        response: false 
      });
    }

    // Check if any dining areas are found
    if (results.length === 0) {
      return res.status(200).json({ 
        error_msg: 'No cities found', 
        response: false 
      });
    }

    // Send response with the list of dining areas
    res.status(200).json({ 
      diningAreas: results, 
      success_msg: 'Cities retrieved successfully', 
      response: true 
    });
  });
};

// exports.stepTwoAndSendOtp = (req, res) => {
//   const { userId, restaurantName, restaurantAddress, restaurant_type_id, cuisine_id, city_id } = req.body;
//   const restaurantLogo = req.file;

//   console.log(req.body ,"data")

//   res.json(req.body)
  
//   // Assuming you are using multer for file uploads

//   // Step 1: Update user information (restaurantName, restaurantAddress, city_id)
//   const updateQuery = `UPDATE users SET restaurantName=?,restaurantAddress=?,city_id=? WHERE id=?`;
//   db.query(updateQuery, [restaurantName, restaurantAddress, city_id, userId], (err, result) => {
//     if (err) {
//       console.error('Database error during update:', err);
//       return res.status(200).json({ error_msg: 'Error updating user information', details: err.message, response: false });
//     }

//     // Step 2: Insert restaurant_logo (if provided)
//     if (restaurantLogo) {
//       const baseURL = process.env.BASE_URL;
//       const uploadDir = path.join(__dirname, `../uploads/restaurant_logo/${userId}/`);

//       // Ensure the directory exists
//       if (!fs.existsSync(uploadDir)) {
//         fs.mkdirSync(uploadDir, { recursive: true });
//       }

//       // Save the restaurant logo
//       const logoPath = `${baseURL}/uploads/restaurant_logo/${userId}/${restaurantLogo.filename}`;
//       const logoUpdateQuery = `UPDATE users SET restaurant_logo=? WHERE id=?`;

//       db.query(logoUpdateQuery, [logoPath, userId], (err, result) => {
//         if (err) {
//           console.error('Error updating restaurant_logo:', err);
//           return res.status(200).json({ error_msg: 'Error saving restaurant logo', details: err.message, response: false });
//         }
//       });
//     }

//     // Step 3: Insert multiple restaurant_type_id and userId into the restaurant_types table
//     const restaurantTypeInsertPromises = restaurant_type_id.map(typeId => {
//       const restaurantTypeQuery = `INSERT INTO selected_restaurant_types (restaurant_type_id, userId) VALUES (?, ?) ON DUPLICATE KEY UPDATE restaurant_type_id=?`;
//       return new Promise((resolve, reject) => {
//         db.query(restaurantTypeQuery, [typeId, userId, typeId], (err, result) => {
//           if (err) return reject(err);
//           resolve(result);
//         });
//       });
//     });

//     // Step 4: Insert multiple cuisine_id and userId into the cuisines table
//     const cuisineInsertPromises = cuisine_id.map(cuisineId => {
//       const cuisinesQuery = `INSERT INTO selected_cuisines (cuisine_id, userId) VALUES (?, ?) ON DUPLICATE KEY UPDATE cuisine_id=?`;
//       return new Promise((resolve, reject) => {
//         db.query(cuisinesQuery, [cuisineId, userId, cuisineId], (err, result) => {
//           if (err) return reject(err);
//           resolve(result);
//         });
//       });
//     });

//     // Execute both insertion processes (restaurant types and cuisines)
//     Promise.all([...restaurantTypeInsertPromises, ...cuisineInsertPromises])
//       .then(() => {
//         // Step 5: Fetch email from users table for OTP
//         const emailQuery = `SELECT email FROM users WHERE id=?`;
//         db.query(emailQuery, [userId], (err, result) => {
//           if (err) {
//             console.error('Database error during email fetch:', err);
//             return res.status(200).json({ error_msg: 'Error fetching email', details: err.message, response: false });
//           }

//           if (result.length === 0) {
//             return res.status(200).json({ error_msg: 'User not found', response: false });
//           }

//           const email = result[0].email;

//           // Step 6: Generate OTP
//           const otp = Math.floor(1000 + Math.random() * 9000);
//           console.log('Generated OTP:', otp);

//           // Step 7: Send email with OTP
//           const transporter = nodemailer.createTransport({
//             service: 'gmail',
//             auth: {
//               user: process.env.EMAIL_SERVICE,
//               pass: process.env.EMAIL_PASSWORD,
//             },
//             tls: {
//               rejectUnauthorized: false // Allow self-signed certificates
//             }
//           });

//           const mailOptions = {
//             from: `DineRight <${process.env.EMAIL_SERVICE}>`,
//             to: email,
//             subject: 'OTP Verification',
//             text: `Your OTP is ${otp}`,
//           };

//           transporter.sendMail(mailOptions, (error, info) => {
//             if (error) {
//               console.error('Error sending email:', error);
//               return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message, response: false });
//             }

//             // Step 8: Save OTP to database
//             const otpQuery = `UPDATE users SET otp=? WHERE id=?`;
//             db.query(otpQuery, [otp, userId], (err, result) => {
//               if (err) {
//                 console.error('Database error during OTP update:', err);
//                 return res.status(200).json({ error_msg: 'Error saving OTP', details: err.message, response: false });
//               }

//               console.log('OTP sent to email:', email);
//               res.status(200).json({ success_msg: 'User data updated and OTP sent to email', response: true });
//             });
//           });
//         });
//       })
//       .catch(err => {
//         console.error('Error during multiple inserts:', err);
//         res.status(200).json({ error_msg: 'Error inserting restaurant type or cuisine information', details: err.message, response: false });
//       });
//   });
// };




exports.getRestraurantProfileDetails = (req, res) => {
  const userId = req.userId; 
  const query = 'SELECT username, email, phone, pancard, restaurantName, restaurantAddress ,resataurantDescription, fassai_licence_no,gst_no, restaurant_bank_account_no ,restaurant_ifsc_code,restaurant_bank_name, restaurant_branch_name, commission, status FROM users WHERE id = ?';

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(200).json({ error_msg: 'Database error while fetching user details', details: err.message, response: false });
    }
    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'User not found', response: false });
    }
    const resaturantProfileDetails = results[0];
  
    res.status(200).json({ success_msg: 'User details fetched successfully', userId , resaturantProfileDetails, response: true });
  });
};

exports.updateRestraurantProfileDetails = (req, res) => {
  const userId = req.userId; 
  const {
    username,
    email,
    phone,
    pancard,
    restaurantName,
    restaurantAddress,
    resataurantDescription,
    fassai_licence_no,
    gst_no,
    restaurant_bank_account_no,
    restaurant_ifsc_code,
    restaurant_bank_name,
    restaurant_branch_name
  } = req.body;

  // Validate that required fields are provided
  if (!username || !email || !phone || !restaurantName ||!restaurantAddress ||!gst_no) {
    return res.status(400).json({ error_msg: 'All required fields must be filled', response: false });
  }

  const updateQuery = `
    UPDATE users 
    SET username = ?, email = ?, phone = ?, pancard = ?, restaurantName = ?, restaurantAddress = ?, 
        resataurantDescription = ?, fassai_licence_no = ?, gst_no = ?, 
        restaurant_bank_account_no = ?, restaurant_ifsc_code = ?, restaurant_bank_name = ?, restaurant_branch_name = ?
    WHERE id = ?
  `;

  const values = [
    username,
    email,
    phone,
    pancard,
    restaurantName,
    restaurantAddress,
    resataurantDescription,
    fassai_licence_no,
    gst_no,
    restaurant_bank_account_no,
    restaurant_ifsc_code,
    restaurant_bank_name,
    restaurant_branch_name,
    userId,
  ];

  // Execute the query to update the profile
  db.query(updateQuery, values, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(200).json({ error_msg: 'Database error while updating profile details', details: err.message, response: false });
    }

    // If no rows were updated, return an error
    if (result.affectedRows === 0) {
      return res.status(200).json({ error_msg: 'User not found or no changes made', response: false });
    }

    res.status(200).json({ success_msg: 'Restaurant profile details updated successfully', response: true });
  });
};
   
        
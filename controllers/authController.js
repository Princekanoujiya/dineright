// controllers/authController.js
const db = require('../config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

          const newId = result.insertId; // Get the newly inserted id

          // Create the directory and move the file if uploaded
          const dir = `uploads/registered_restaurants/${newId}`;
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
              db.query(updateImageQuery, [req.file.filename, newId], (err) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error during image update', details: err.message });
                }

                res.status(201).json({ message: 'User (restaurant) created successfully', id: newId });
              });
            });
          } else {
            res.status(201).json({ message: 'User (restaurant) created successfully', id: newId });
          }
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Unexpected error', details: error.message });
    }
  });
};









// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     // Temporary upload directory
//     cb(null, 'uploads/');
//   },
//   filename: function (req, file, cb) {
//     // Create a unique filename
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({ storage: storage }).single('image');

// // Check if email exists
// const checkEmailExists = (email, userId = null) => {
//   return new Promise((resolve, reject) => {
//     const query = userId ? 'SELECT userId FROM users WHERE email = ? AND userId != ?' : 'SELECT userId FROM users WHERE email = ?';
//     const params = userId ? [email, userId] : [email];
//     db.query(query, params, (err, result) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(result.length > 0);
//       }
//     });
//   });
// };

// // Insert or Update a user (restaurant)
// exports.createOrUpdateOneStep = async (req, res) => {
//   console.log('Request Body:', req.body);
//   console.log('Uploaded File:', req.file);

//   // Handle file upload first
//   upload(req, res, async function (err) {
//     if (err instanceof multer.MulterError) {
//       return res.status(500).json({ error: 'Multer error', details: err.message });
//     } else if (err) {
//       return res.status(500).json({ error: 'Error uploading file', details: err.message });
//     }

//     const { userId, username, email, phone, pancard, gst_no } = req.body;
//     const image = req.file ? req.file.filename : null;

//     if (!username) {
//       return res.status(400).json({ error: 'Username is required' });
//     }

//     try {
//       // Check if the email is already in use
//       const emailExists = await checkEmailExists(email, userId);
//       if (emailExists) {
//         return res.status(400).json({ error: 'Email is already in use' });
//       }

//       if (userId) {
//         // Update user if userId is provided
//         const getUserQuery = 'SELECT image FROM users WHERE userId = ?';
//         db.query(getUserQuery, [userId], (err, result) => {
//           if (err) {
//             return res.status(500).json({ error: 'Database error during user retrieval', details: err.message });
//           }
//           if (result.length === 0) {
//             return res.status(404).json({ error: 'User (restaurant) not found' });
//           }

//           const oldImage = result[0].image;
//           const updateQuery = `
//             UPDATE users 
//             SET username = ?, email = ?, phone = ?, pancard = ?, image = ?, gst_no = ? 
//             WHERE userId = ?`;
//           db.query(updateQuery, [username, email, phone, pancard, image || oldImage, gst_no, userId], (err) => {
//             if (err) {
//               return res.status(500).json({ error: 'Database error during update', details: err.message });
//             }

//             // Move the file if a new image is uploaded
//             if (req.file) {
//               const dir = `uploads/registered_restaurants/${userId}`;
//               if (!fs.existsSync(dir)) {
//                 fs.mkdirSync(dir, { recursive: true });
//               }

//               const tempPath = req.file.path; // Path where multer saves the file initially
//               const newPath = path.join(dir, req.file.filename);

//               fs.rename(tempPath, newPath, (err) => {
//                 if (err) {
//                   return res.status(500).json({ error: 'Error moving file', details: err.message });
//                 }

//                 // Remove old image file if it exists and is different
//                 if (oldImage && oldImage !== image) {
//                   const oldImagePath = path.join(dir, oldImage);
//                   fs.unlink(oldImagePath, (err) => {
//                     if (err) {
//                       console.warn('Warning: Failed to delete old image', err.message);
//                     }
//                   });
//                 }

//                 res.status(200).json({ message: 'User (restaurant) updated successfully', userId });
//               });
//             } else {
//               res.status(200).json({ message: 'User (restaurant) updated successfully', userId });
//             }
//           });
//         });
//       } else {
//         // Insert new user if userId is not provided
//         const insertQuery = `
//           INSERT INTO users (username, email, phone, pancard, gst_no) 
//           VALUES (?, ?, ?, ?, ?)`;
//         db.query(insertQuery, [username, email, phone, pancard, gst_no], (err, result) => {
//           if (err) {
//             return res.status(500).json({ error: 'Database error during insertion', details: err.message });
//           }

//           const newUserId = result.insertId; // Get the newly inserted userId

//           // Create the directory and move the file if uploaded
//           const dir = `uploads/registered_restaurants/${newUserId}`;
//           if (!fs.existsSync(dir)) {
//             fs.mkdirSync(dir, { recursive: true });
//           }

//           if (req.file) {
//             const tempPath = req.file.path; // Path where multer saves the file initially
//             const newPath = path.join(dir, req.file.filename);

//             fs.rename(tempPath, newPath, (err) => {
//               if (err) {
//                 return res.status(500).json({ error: 'Error moving file', details: err.message });
//               }

//               // Update the user record with the image filename
//               const updateImageQuery = `
//                 UPDATE users 
//                 SET image = ? 
//                 WHERE userId = ?`;
//               db.query(updateImageQuery, [req.file.filename, newUserId], (err) => {
//                 if (err) {
//                   return res.status(500).json({ error: 'Database error during image update', details: err.message });
//                 }

//                 res.status(201).json({ message: 'User (restaurant) created successfully', userId: newUserId });
//               });
//             });
//           } else {
//             res.status(201).json({ message: 'User (restaurant) created successfully', userId: newUserId });
//           }
//         });
//       }
//     } catch (error) {
//       res.status(500).json({ error: 'Unexpected error', details: error.message });
//     }
//   });
// };

// Step 2: Restaurant Information
// exports.stepTwo = (req, res) => {
//   const { userId, restaurantName, restaurantAddress } = req.body;

//   const query = `UPDATE users SET restaurantName=?, restaurantAddress=? WHERE id=?`;
//   db.query(query, [restaurantName, restaurantAddress, userId], (err, result) => {
//     if (err) throw err;
//     res.status(200).json({ message: 'Step 2 completed',userId });
//   });
// };
exports.stepTwo = (req, res) => {
  const { userId, restaurantName, restaurantAddress } = req.body;

  const query = `UPDATE users SET restaurantName=?, restaurantAddress=? WHERE id=?`;
  db.query(query, [restaurantName, restaurantAddress, userId], (err, result) => {
    if (err) throw err;
    res.status(200).json({ message: 'Step 2 completed' });
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
      return res.status(500).json({ error: 'Error sending OTP', details: error.message });
    }

    // Save OTP to DB based on userId
    const query = `UPDATE users SET otp=? WHERE id=?`;
    db.query(query, [otp, userId], (err, result) => {
      if (err) {
        console.error('Database error:', err);  // Log database error
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      console.log('OTP sent to email:', email); // Log success
      res.status(200).json({ message: 'OTP sent to email' });
    });
  });
};


exports.stepTwoAndSendOtp = (req, res) => {
  const { userId, restaurantName, restaurantAddress } = req.body;

  // Step 1: Update user information (restaurantName and restaurantAddress)
  const updateQuery = `UPDATE users SET restaurantName=?, restaurantAddress=? WHERE id=?`;
  db.query(updateQuery, [restaurantName, restaurantAddress, userId], (err, result) => {
    if (err) {
      console.error('Database error during update:', err); // Log database error
      return res.status(500).json({ error: 'Error updating user information', details: err.message });
    }
    const emailQuery = `SELECT email FROM users WHERE id=?`;
    db.query(emailQuery, [userId], (err, result) => {
      if (err) {
        console.error('Database error during email fetch:', err); // Log database error
        return res.status(500).json({ error: 'Error fetching email', details: err.message });
      }

      if (result.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const email = result[0].email;

      // Step 3: Generate OTP
      const otp = Math.floor(1000 + Math.random() * 9000);
      console.log('Generated OTP:', otp); // Log OTP for debugging

      // Step 4: Send email with OTP
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
          console.error('Error sending email:', error); // Log email error
          return res.status(500).json({ error: 'Error sending OTP', details: error.message });
        }

        // Step 5: Save OTP to database
        const otpQuery = `UPDATE users SET otp=? WHERE id=?`;
        db.query(otpQuery, [otp, userId], (err, result) => {
          if (err) {
            console.error('Database error during OTP update:', err); // Log database error
            return res.status(500).json({ error: 'Error saving OTP', details: err.message });
          }

          console.log('OTP sent to email:', email); // Log success
          res.status(200).json({ message: 'User data updated and OTP sent to email' });
        });
      });
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

exports.restro_guest_time_duration = (req, res) => {
  const { userId, restro_guest, restro_spending_time } = req.body;

  // Step 1: Check if the record already exists for the given userId
  const checkQuery = 'SELECT * FROM restro_guest_time_duration WHERE userId = ?';
  db.query(checkQuery, [userId], (err, result) => {
    if (err) {
      console.error('Database error during check:', err); // Log the error
      return res.status(500).json({ error: 'Database error during record check' });
    }

    if (result.length > 0) {
      // Step 2: If record exists, update the existing record
      const updateQuery = 'UPDATE restro_guest_time_duration SET restro_guest = ?, restro_spending_time = ? WHERE userId = ?';
      db.query(updateQuery, [restro_guest, restro_spending_time, userId], (err, result) => {
        if (err) {
          console.error('Database error during update:', err); // Log the error
          return res.status(500).json({ error: 'Database error while updating timing data' });
        }

        // Record updated successfully
        res.status(200).json({ message: 'Timing data updated successfully' });
      });
    } else {
      // Step 3: If no record exists, insert a new record
      const insertQuery = 'INSERT INTO restro_guest_time_duration (userId, restro_guest, restro_spending_time) VALUES (?, ?, ?)';
      db.query(insertQuery, [userId, restro_guest, restro_spending_time], (err, result) => {
        if (err) {
          console.error('Database error during insert:', err); // Log the error
          return res.status(500).json({ error: 'Database error while inserting timing data' });
        }

        // Record inserted successfully
        res.status(200).json({ message: 'Timing data inserted successfully', restro_guest_time_duration_id: result.insertId });
      });
    }
  });
};



exports.setPassword = (req, res) => {
  const { userId, password, confirmPassword } = req.body;

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
    const query = `UPDATE users SET password=?, otp=NULL WHERE id=?`;
    db.query(query, [hashedPassword, userId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Password set successfully
      res.status(200).json({ message: 'Password set successfully' });
    });
  });
};

exports.insertTimingData = (req, res) => {
  const { userId, day_id, start_time, end_time ,status} = req.body;

  // Insert timing data into service_time table
  const timingQuery = 'INSERT INTO service_time (userId, day_id, start_time, end_time,status) VALUES (?, ?, ?, ?,?)';
  
  db.query(timingQuery, [userId, day_id, start_time, end_time,status], (err, result) => {
    if (err) {
      console.error('Database error:', err); // Log the database error for debugging
      return res.status(500).json({ error: 'Database error while inserting timing data' });
    }

    // Timing data inserted successfully
    res.status(200).json({ message: 'Timing data inserted successfully', service_time_id: result.insertId });
  });
};
exports.insertOrUpdateTimingData = (req, res) => {
  const { userId, day_id, start_time, end_time, status } = req.body;

  // Step 1: Check if the timing data already exists for the given userId and day_id
  const checkQuery = 'SELECT * FROM service_time WHERE userId = ? AND day_id = ?';
  db.query(checkQuery, [userId, day_id], (err, result) => {
    if (err) {
      console.error('Database error during check:', err); // Log the error
      return res.status(500).json({ error: 'Database error during record check' });
    }

    if (result.length > 0) {
      // Step 2: If record exists, update the existing record
      const updateQuery = 'UPDATE service_time SET start_time = ?, end_time = ?, status = ? WHERE userId = ? AND day_id = ?';
      db.query(updateQuery, [start_time, end_time, status, userId, day_id], (err, result) => {
        if (err) {
          console.error('Database error during update:', err); // Log the error
          return res.status(500).json({ error: 'Database error while updating timing data' });
        }

        // Timing data updated successfully
        res.status(200).json({ message: 'Timing data updated successfully' });
      });
    } else {
      // Step 3: If no record exists, insert a new record
      const insertQuery = 'INSERT INTO service_time (userId, day_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)';
      db.query(insertQuery, [userId, day_id, start_time, end_time, status], (err, result) => {
        if (err) {
          console.error('Database error during insert:', err); // Log the error
          return res.status(500).json({ error: 'Database error while inserting timing data' });
        }

        // Timing data inserted successfully
        res.status(200).json({ message: 'Timing data inserted successfully', service_time_id: result.insertId });
      });
    }
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
    res.status(200).json({ message: 'Dining area data inserted successfully',selected_dining_area_id: result.insertId  });
  });
};

//step 8 : Insert Dining Area Table
exports.insertDiningTable = (req, res) => {
  const { userId, dining_area_id, table_name, table_no_of_seats } = req.body;

  // Insert dining area data into all_tables table
  const query = 'INSERT INTO all_tables (userId, dining_area_id, table_name, table_no_of_seats) VALUES (?, ?, ?, ?)';
  
  db.query(query, [userId, dining_area_id, table_name, table_no_of_seats], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error while inserting dining area data', details: err.message });
    }

    // Retrieve the user's email
    const userQuery = 'SELECT email FROM users WHERE id = ?';
    db.query(userQuery, [userId], (err, userResult) => {
      if (err || userResult.length === 0) {
        return res.status(500).json({ error: 'Database error while retrieving user email' ,table_id: result.insertId });
      }

      const userEmail = userResult[0].email;

      // Send email to user
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
        subject: 'Your Restaurant Listing Request Has Been Submitted to Dine Right',
        text: `Dear Restaurant Owner/Manager,

Thank you for registering with Dine Right! We are pleased to inform you that your dining area table "${table_name}" with ${table_no_of_seats} seats has been successfully added to our system, and your listing request is now under review.

What Happens Next:
Once approved, your restaurant will be live on the Dine Right website and mobile app, allowing diners to easily find and book a table.

Access Your Dashboard:
You can log in to your Restaurant Panel Dashboard using the link below:
[Dashboard Login Link]

Important Information:
Approval Notification: You will receive an email once your listing is approved and live.
Terms and Conditions: Please take a moment to review our terms and conditions here: [Terms and Conditions Link].

If you have any questions or need assistance, please feel free to contact our support team at [Support Email] or [Support Phone Number].

Thank you for choosing Dine Right. We look forward to helping you reach more diners and succeed with your restaurant.

Best regards,
The Dine Right Team
[Website Link] | [Phone Number]`
      };

      transporter.sendMail(mailOptions, (emailError, info) => {
        if (emailError) {
          console.error('Error sending email:', emailError);
          return res.status(500).json({ error: 'Error sending email', details: emailError.message });
        }

        res.status(200).json({ message: 'Dining table data inserted successfully and email sent to user.' });
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
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.status(200).json({ message: 'Login successful', token  });
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
exports.getUsersInfo = (req, res) => {
  const query = 'SELECT * FROM users WHERE status = ?';
  const status = 'Activated';

  db.query(query, [status], (err, results) => {
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


exports.loginWithOtp = (req, res) => {
  const { email } = req.body;

  // Step 1: Query to check if the email exists
  const query = `SELECT * FROM users WHERE email=?`;
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('Database error:', err); // Log the error for debugging
      return res.status(500).json({ error: 'Database error during email check', details: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    const user = results[0];

    // Step 2: Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit OTP
    console.log('Generated OTP:', otp); // Log OTP for debugging

    // Step 3: Send OTP via email
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
        return res.status(500).json({ error: 'Error sending OTP', details: error.message });
      }

      // Step 4: Save OTP to the database for future verification
      const otpQuery = `UPDATE users SET otp=? WHERE email=?`;
      db.query(otpQuery, [otp, email], (err, result) => {
        if (err) {
          console.error('Database error during OTP save:', err); // Log error
          return res.status(500).json({ error: 'Database error while saving OTP', details: err.message });
        }

        // Step 5: Send response after successful OTP generation and email
        res.status(200).json({ message: 'OTP sent to email successfully. Please verify OTP to complete login.' });
      });
    });
  });
};

// OTP verification function
exports.verifyLoginOtp = (req, res) => {
  const { email, otp } = req.body;

  // Step 1: Query to check if the provided OTP matches the one in the database
  const query = `SELECT * FROM users WHERE email=? AND otp=?`;
  db.query(query, [email, otp], (err, results) => {
    if (err) {
      console.error('Database error during OTP check:', err); // Log error
      return res.status(500).json({ error: 'Database error during OTP verification', details: err.message });
    }

    if (results.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    const user = results[0];

    // Step 2: OTP is valid, create JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Clear OTP after successful verification
    const clearOtpQuery = `UPDATE users SET otp=NULL WHERE email=?`;
    db.query(clearOtpQuery, [email], (err, result) => {
      if (err) {
        console.error('Database error during OTP clearing:', err); // Log error
        return res.status(500).json({ error: 'Database error while clearing OTP', details: err.message });
      }

      // Step 3: Send success response with token
      res.status(200).json({ message: 'Login successful', token });
    });
  });
};

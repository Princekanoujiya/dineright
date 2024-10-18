const db = require('../config');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

exports.createOrUpdateCustomer = (req, res) => {
  const { customer_id, customer_name, customer_email } = req.body;
  if (!customer_name || !customer_email) {
    return res.status(200).json({ error_msg: "Customer name and email are required", response: false });
  }
  // Check if the email is unique before insert or update
  const emailCheckQuery = 'SELECT * FROM customers WHERE customer_email = ? AND customer_id != ?';
  db.query(emailCheckQuery, [customer_email, customer_id || 0], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message, response: false });
    }

    if (result.length > 0) {
      return res.status(200).json({ error_msg: "Email is already in use", response: false });
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
          return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message, response: false });
        }
        console.log('OTP sent to email:', email);
        res.status(200).json({
          success_msg: 'Customer processed successfully and OTP sent to email',
          customer_id: customerId,
          response: true
        });
      });
    };

    const otp = Math.floor(1000 + Math.random() * 9000);
    console.log('OTP:', otp);
    if (customer_id) {
      // Update existing customer
      const updateQuery = 'UPDATE customers SET customer_name = ?, customer_email = ?, otp = ? WHERE customer_id = ?';
      db.query(updateQuery, [customer_name, customer_email, otp, customer_id], (err, result) => {
        if (err) return res.status(200).json({ error_msg: err.message, response: false });
        if (result.affectedRows === 0) {
          return res.status(200).json({ error_msg: "Customer not found", response: false });
        }
        // Send OTP after updating
        sendOtpEmail(customer_email, otp, customer_id);
      });
    } else {
      // Insert new customer
      const insertQuery = 'INSERT INTO customers (customer_name, customer_email, otp) VALUES (?, ?, ?)';
      db.query(insertQuery, [customer_name, customer_email, otp], (err, result) => {
        if (err) return res.status(200).json({ error_msg: err.message, response: false });
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
    return res.status(200).json({ error_msg: "Customer ID and OTP are required", response: false });
  }
  const otpCheckQuery = 'SELECT * FROM customers WHERE customer_id = ? AND otp = ?';
  db.query(otpCheckQuery, [customer_id, otp], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message, response: false });
    }
    if (result.length === 0) {
      return res.status(200).json({ error_msg: "Invalid OTP or Customer ID", response: false });
    }
    const customer = result[0];

    const verifyCustomerQuery = 'UPDATE customers SET otp = NULL WHERE customer_id = ?';
    db.query(verifyCustomerQuery, [customer_id], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: err.message, response: false });
      }

      if (result.affectedRows === 0) {
        return res.status(200).json({ error_msg: "Customer not found", response: false });
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
        response: true,
      });
    });
  });
};
exports.getAllCustomers = (req, res) => {
  const selectQuery = 'SELECT * FROM customers WHERE is_deleted=0';

  db.query(selectQuery, (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message, response: false });
    }

    // Store the results in a variable
    const customers = results;

    // Send the response with customers and success message
    res.status(200).json({
      customers: customers,
      success_msg: 'Customers retrieved successfully',
      response: true,
    });
  });
};

exports.getCustomerInfo = (req, res) => {
  const { customer_id } = req.params;

  // Query to fetch user information
  const query = 'SELECT * FROM customers WHERE customer_id = ?';
  db.query(query, [customer_id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'Customer not found', response: false });
    }

    res.status(200).json({ user: results[0], response: true, success_msg: 'Customer found successfully' });
  });
};
exports.loginWithEmail = (req, res) => {
  const { customer_email } = req.body;

  // Check if the customer_email is provided
  if (!customer_email) {
    return res.status(200).json({ error_msg: "Customer email is required", response: false });
  }

  // Query to check if the email exists in the database
  const emailCheckQuery = 'SELECT * FROM customers WHERE customer_email = ?';
  db.query(emailCheckQuery, [customer_email], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message, response: false });
    }

    if (result.length === 0) {
      return res.status(200).json({ error_msg: "Customer with this email does not exist", response: false });
    }

    const customer = result[0];

    // Generate a new OTP
    const otp = Math.floor(1000 + Math.random() * 9000);

    // Update the OTP in the database
    const updateOtpQuery = 'UPDATE customers SET otp = ? WHERE customer_id = ?';
    db.query(updateOtpQuery, [otp, customer.customer_id], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: err.message, response: false });
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
            return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message, response: false });
          }
          console.log('OTP sent to email:', email);
          res.status(200).json({ success_msg: 'OTP sent successfully to your email', customer_id: customer.customer_id, response: true });
        });
      };

      // Send the OTP email
      sendOtpEmail(customer_email, otp);
    });
  });
};
exports.resendOtp = (req, res) => {
  const { customer_id } = req.body;
  if (!customer_id) {
    return res.status(200).json({ error_msg: "Customer ID is required", response: false });
  }
  const idCheckQuery = 'SELECT * FROM customers WHERE customer_id = ?';
  db.query(idCheckQuery, [customer_id], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: err.message, response: false });
    }
    if (result.length === 0) {
      return res.status(200).json({ error_msg: "Customer with this ID does not exist", response: false });
    }
    const customer = result[0];
    const otp = Math.floor(1000 + Math.random() * 9000);
    const updateOtpQuery = 'UPDATE customers SET otp = ? WHERE customer_id = ?';
    db.query(updateOtpQuery, [otp, customer.customer_id], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: err.message, response: false });
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
            return res.status(200).json({ error_msg: 'Error sending OTP', details: error.message, response: false });
          }
          console.log('OTP resent to email:', customer.customer_email);
          res.status(200).json({ success_msg: 'OTP resent successfully to your email', customer_id: customer.customer_id, response: true });
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

// Get all restaurants search by name
// exports.searchAllRestorantByname = async (req, res) => {
//   const { name, city_id, type_ids, cuisines_ids, city_name } = req.body; // Get the search term from the query parameters

//   try {
//     // Base SQL query with joins to `selected_restorant_types`, `selected_cuisines`, and `cities` for city_name search
//     let selectQuery = `
//       SELECT u.id, u.username, u.email, u.restaurantName, u.restaurantAddress, c.city_name, u.phone
//       FROM users u
//       LEFT JOIN selected_restaurant_types srt ON u.id = srt.userId
//       LEFT JOIN selected_cuisines sc ON u.id = sc.userId
//       LEFT JOIN cities c ON u.city_id = c.city_id
//       WHERE u.is_deleted = 0 
//       AND u.status = 'Activated'
//     `;

//     // Array to hold query parameters
//     let queryParams = [];

//     // Dynamically add conditions based on provided query parameters
//     if (name) {
//       selectQuery += ` AND u.restaurantName LIKE ?`;
//       queryParams.push(`%${name}%`);
//     }

//     if (city_id) {
//       selectQuery += ` AND u.city_id = ?`;
//       queryParams.push(city_id);
//     }

//     if (city_name) {
//       selectQuery += ` AND c.city_name LIKE ?`;
//       queryParams.push(`%${city_name}%`);
//     }

//     if (type_ids && type_ids.length > 0) {
//       selectQuery += ` AND srt.restaurant_type_id IN (?)`;
//       queryParams.push(type_ids);
//     }

//     if (cuisines_ids && cuisines_ids.length > 0) {
//       selectQuery += ` AND sc.cuisine_id IN (?)`;
//       queryParams.push(cuisines_ids);
//     }

//     // Group results to avoid duplicate rows due to joins
//     selectQuery += ` GROUP BY u.id`;

//     // Execute the main query
//     const [results] = await db.promise().query(selectQuery, queryParams);

//     // Process each result and fetch the first banner image
//     let restorantArray = await Promise.all(results.map(async (result) => {
//       const userId = result.id; // Use the 'id' from the initial query result

//       // Fetch the first related banner image
//       const [bannerImages] = await db.promise().query(`SELECT banner_image FROM banner_images WHERE userId = ? LIMIT 1`, [userId]);

//       // If a banner image exists, prepend BASE_URL
//       if (bannerImages.length > 0) {
//         result.banner_image = `${process.env.BASE_URL}${bannerImages[0].banner_image}`;
//       } else {
//         result.banner_image = null;
//       }
//       result.rating = 4;
//       return result; 
//     }));

//     // Send the response with the final array of restaurants
//     res.status(200).json({
//       success_msg: "Data fetched successfully",
//       response: true,
//       data: restorantArray
//     });

//   } catch (err) {
//     // Handle any errors that occur during the query execution
//     return res.status(500).json({ error_msg: err.message, response: false });
//   }
// };

exports.searchAllRestorantByname = async (req, res) => {
  const { name, city_id, type_ids, cuisines_ids, city_name } = req.body; // Get the search term from the query parameters

  try {
    // Base SQL query with joins to `selected_restorant_types`, `selected_cuisines`, and `cities` for city_name search
    let selectQuery = `
      SELECT u.id, u.username, u.email, u.restaurantName, u.restaurantAddress, c.city_name, u.phone
      FROM users u
      LEFT JOIN selected_restaurant_types srt ON u.id = srt.userId
      LEFT JOIN selected_cuisines sc ON u.id = sc.userId
      LEFT JOIN cities c ON u.city_id = c.city_id
      WHERE u.is_deleted = 0 
      AND u.status = 'Activated'
    `;

    // Array to hold query parameters
    let queryParams = [];

    // Dynamically add conditions based on provided query parameters
    if (name) {
      selectQuery += ` AND u.restaurantName LIKE ?`;
      queryParams.push(`%${name}%`);
    }

    if (city_id) {
      selectQuery += ` AND u.city_id = ?`;
      queryParams.push(city_id);
    }

    if (city_name) {
      selectQuery += ` AND c.city_name LIKE ?`;
      queryParams.push(`%${city_name}%`);
    }

    if (type_ids && type_ids.length > 0) {
      selectQuery += ` AND srt.restaurant_type_id IN (?)`;
      queryParams.push(type_ids);
    }

    if (cuisines_ids && cuisines_ids.length > 0) {
      selectQuery += ` AND sc.cuisine_id IN (?)`;
      queryParams.push(cuisines_ids);
    }

    // Group results to avoid duplicate rows due to joins
    selectQuery += ` GROUP BY u.id`;

    // Execute the main query
    const [results] = await db.promise().query(selectQuery, queryParams);

    // Process each result, fetch the first banner image and timing data
    let restorantArray = await Promise.all(results.map(async (result) => {
      const userId = result.id; // Use the 'id' from the initial query result

      // Fetch the first related banner image
      const [bannerImages] = await db.promise().query(`SELECT banner_image FROM banner_images WHERE userId = ? LIMIT 1`, [userId]);

      // If a banner image exists, prepend BASE_URL
      if (bannerImages.length > 0) {
        result.banner_image = `${process.env.BASE_URL}${bannerImages[0].banner_image}`;
      } else {
        result.banner_image = null;
      }

      // Set static rating
      result.rating = 4;

      // Fetch timing data for this restaurant (userId)
      const [timingData] = await db.promise().query(`
        SELECT st.day_id, dl.day_name, st.start_time, st.end_time, st.status 
        FROM service_time st
        JOIN days_listing dl ON st.day_id = dl.day_id
        WHERE st.userId = ?
      `, [userId]);

      // Add timing data to the result
      result.timingData = timingData;

      return result;
    }));

    // Send the response with the final array of restaurants and timing data
    res.status(200).json({
      success_msg: "Data fetched successfully",
      response: true,
      data: restorantArray
    });

  } catch (err) {
    // Handle any errors that occur during the query execution
    return res.status(500).json({ error_msg: err.message, response: false });
  }
};



exports.getUserProfileDetails = (req, res) => {
  const customer_id =req.customer_id;

  // Query to fetch user profile details
  const userProfileQuery = 'SELECT customer_name, customer_email, customer_profile_image FROM customers WHERE customer_id = ?';

  db.query(userProfileQuery, [customer_id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(200).json({ 
        error_msg: 'Database error while fetching user details', 
        details: err.message, 
        response: false 
      });
    }

    if (results.length === 0) {
      return res.status(200).json({ 
        error_msg: 'Customer not found', 
        response: false 
      });
    }

    let userProfileDetails = results[0];
    
    // Prepend BASE_URL to customer_profile_image if it exists
    if (userProfileDetails.customer_profile_image) {
      userProfileDetails.customer_profile_image = process.env.BASE_URL + userProfileDetails.customer_profile_image;
    }

    // Query to fetch userId from bookings table
    const bookingQuery = 'SELECT userId FROM bookings WHERE customer_id = ?';
    
    db.query(bookingQuery, [customer_id], (bookingErr, bookingResults) => {
      if (bookingErr) {
        console.error('Database error:', bookingErr);
        return res.status(200).json({ 
          error_msg: 'Database error while fetching bookings', 
          details: bookingErr.message, 
          response: false 
        });
      }

      // If no bookings are found, set visitedrestaurant to an empty array
      let visitedrestaurant = bookingResults.length > 0 ? bookingResults.map(row => row.userId) : [];

      // Count occurrences of each userId
      let visitedCount = visitedrestaurant.reduce((acc, userId) => {
        acc[userId] = (acc[userId] || 0) + 1;
        return acc;
      }, {});

      let userIds = Object.keys(visitedCount); // Get all unique userIds
      
      // If no userIds found, return response
      if (userIds.length === 0) {
        return res.status(200).json({
          success_msg: 'Customer details fetched successfully',
          customer_id,
          userProfileDetails,
          visitedrestaurant: [],
          response: true
        });
      }

      // Query to fetch user details from users table based on the userIds
      const usersQuery = 'SELECT id, restaurantName, restaurantAddress, resataurantDescription FROM users WHERE id IN (?)';

      db.query(usersQuery, [userIds], (usersErr, usersResults) => {
        if (usersErr) {
          console.error('Database error:', usersErr);
          return res.status(200).json({ 
            error_msg: 'Database error while fetching users', 
            details: usersErr.message, 
            response: false 
          });
        }

        // Map usersResults to include the count of visits
        let visitedrestaurantDetails = usersResults.map(user => ({
          userId: user.id,
          restaurantName: user.restaurantName,
          restaurantAddress: user.restaurantAddress,
          resataurantDescription: user.resataurantDescription,
          visitedCount: visitedCount[user.id]
        }));

        // Return success response with user details and visited restaurant details
        res.status(200).json({ 
          success_msg: 'Customer details fetched successfully', 
          customer_id, 
          userProfileDetails, 
          visitedrestaurant: visitedrestaurantDetails, 
          response: true 
        });
      });
    });
  });
};



// Configure multer to save the uploaded images in the appropriate directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const customer_id = req.customer_id;
    const dir = `./uploads/user_profiles/${customer_id}`;

    // Check if the directory exists, if not, create it
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir); // Save the file in the directory
  },
  filename: (req, file, cb) => {
    cb(null, `customer_profile_image${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage }).single('customer_profile_image');

// Update user profile details
exports.updateUserProfileDetails = (req, res) => {
  const customer_id = req.customer_id;

  // Handle file upload using multer
  upload(req, res, (err) => {
    if (err) {
      console.error('Error during file upload:', err);
      return res.status(200).json({ error_msg: 'Error uploading file', details: err.message, response: false });
    }

    // If no file is uploaded, return an error
    if (!req.file) {
      return res.status(200).json({ error_msg: 'No file uploaded', response: false });
    }

    const { customer_name, customer_email } = req.body;
    const customer_profile_image = `/uploads/user_profiles/${customer_id}/${req.file.filename}`; 

    // Validate that required fields are provided
    if (!customer_name || !customer_email) {
      return res.status(200).json({ error_msg: 'All required fields must be filled', response: false });
    }

    const updateQuery = `
      UPDATE customers 
      SET customer_name = ?, customer_email = ?, customer_profile_image = ?
      WHERE customer_id = ?
    `;

    const values = [
      customer_name,
      customer_email,
      customer_profile_image, 
      customer_id
    ];

    // Execute the query to update the profile
    db.query(updateQuery, values, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error_msg: 'Database error while updating profile details', details: err.message, response: false });
      }

      // If no rows were updated, return an error
      if (result.affectedRows === 0) {
        return res.status(404).json({ error_msg: 'User not found or no changes made', response: false });
      }

      res.status(200).json({ success_msg: 'User profile details updated successfully', response: true });
    });
  });
};



const db = require('../config');
const nodemailer = require('nodemailer');

exports.enquiry = (req, res) => {
  const { enquiry_restaurant_name, enquiry_email, enquiry_phone, enquiry_message } = req.body;

  // Validate required fields
  if (!enquiry_restaurant_name) {
    return res.status(200).json({ error_msg: "Restaurant name is required" ,response:false});
  }
  if (!enquiry_email) {
    return res.status(200).json({ error_msg: "Email is required" ,response:false});
  }
  if (!enquiry_phone) {
    return res.status(200).json({ error_msg: "Phone is required",response:false });
  }
  if (!enquiry_message) {
    return res.status(200).json({ error_msg: "Message is required" ,response:false});
  }

  // Create Nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_SERVICE,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Function to send email
  const sendMail = (to, subject, message) => {
    const mailOptions = {
      from: `DineRight <${process.env.EMAIL_SERVICE}>`,
      to: to,
      subject: subject,
      text: message
    };

    return transporter.sendMail(mailOptions);
  };

  // Check if email is unique (for insert operations only)
  const checkEmailQuery = 'SELECT * FROM enquiry WHERE enquiry_email = ?';

  db.query(checkEmailQuery, [enquiry_email], (err, rows) => {
    if (err) return res.status(200).json({ error_msg: err.message ,response:false});

    // If email already exists and it's not an update request
    if (rows.length > 0) {
      return res.status(200).json({ error_msg: "Email already exists. Please use a different email." ,response:false});
    }

    // Insert query if enquiry_id is not provided
    const insertQuery = 'INSERT INTO enquiry (enquiry_restaurant_name, enquiry_email, enquiry_phone, enquiry_message) VALUES (?, ?, ?, ?)';
    db.query(insertQuery, [enquiry_restaurant_name, enquiry_email, enquiry_phone, enquiry_message], (err, result) => {
      if (err) return res.status(200).json({ error_msg: err.message ,response:false});

      const insertedId = result.insertId;

      // Compose detailed email message
      const emailContent = `
        New Enquiry Details:
        
        - Restaurant Name: ${enquiry_restaurant_name}
        - Email: ${enquiry_email}
        - Phone: ${enquiry_phone}
        - Message: ${enquiry_message}
      `;

      // Send confirmation email to the user
      sendMail(enquiry_email, 'Enquiry Created', 'Your enquiry has been created successfully.')
        .then(() => sendMail('akansha@techflux.in', 'New Enquiry Created', emailContent))
        .then(() => {
          res.status(200).json({ success_msg: "Enquiry created successfully", enquiry_id: insertedId ,response:true});
        })
        .catch(emailErr => {
          res.status(200).json({ error_msg: `Enquiry created, but failed to send emails. ${emailErr.message}` });
        });
    });
  });
};

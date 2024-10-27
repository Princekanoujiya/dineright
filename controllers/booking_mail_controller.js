const { response } = require('express');
const nodemailer = require('nodemailer');
const db = require('../config');


// Function to create booking message
function createSimpleBookingMessage(data) {
  const {
    booking_id,
    booking_date,
    booking_time,
    booking_no_of_guest,
    payment_mod,
    customer_name,
    restaurantName,
    restaurantAddress,
    email,
    billing_amount,
    items,
    booking_status,
    seatingDetails
  } = data;

  // Create an HTML string for the items in table format
  const itemsHTML = items.map(item => {
    const totalPrice = item.master_item_price * item.product_quantity; // Calculate total price
    return `
      <tr>
        <td>${item.master_item_name}</td>
        <td>${item.product_quantity}</td>
        <td>${formatCurrency(item.master_item_price)}</td>
        <td>${formatCurrency(totalPrice)}</td>
      </tr>
    `;
  }).join('');

  // Create an HTML string for the seating details
  const seatingHTML = seatingDetails.map(area => `
    <h4>${area.dining_area_type}</h4>
    <p>Tables: ${area.tables.join(', ')}</p>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.6;
        }
        .container {
            width: 80%;
            margin: auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 10px;
            background-color: #f9f9f9;
        }
        h1 {
            color: #4CAF50;
            text-align: center;
        }
        .details {
            margin-top: 20px;
        }
        .details p {
            margin: 5px 0;
        }
        .status {
            background-color: #ffd700; /* Highlight color */
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
            text-align: center;
        }
        .menu, .payment {
            margin-top: 20px;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
        }
        .footer p {
            font-size: 0.9em;
            color: #777;
        }
        .billing {
            font-weight: bold;
            font-size: 1.2em;
            color: #d9534f; /* Red color for billing amount */
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        table, th, td {
            border: 1px solid #ddd;
        }
        th, td {
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 Congratulations on Your Booking! 🎉</h1>
        <p>Dear <strong>${customer_name}</strong>,</p>
        <p>Thank you for choosing <strong>${restaurantName}</strong>! Your table is successfully booked. Here are the details of your reservation:</p>

        <div class="details">
            <h3>Booking Details:</h3>
            <p><strong>Order ID:</strong> Order-${booking_id}</p>
            <p><strong>Restaurant Name:</strong> ${restaurantName}</p>
            <p><strong>Restaurant Address:</strong> ${restaurantAddress}</p>
            <p><strong>Date:</strong> ${formatDate(booking_date)}</p>
            <p><strong>Booking Time:</strong> ${booking_time}</p>
            <p><strong>Number of Guests:</strong> ${booking_no_of_guest}</p>
            <div class="status"><strong>Booking Status:</strong> ${booking_status}</div>
        </div>

        <div class="details">
            <h3>Billing Details:</h3>
            <table>
                <thead>
                    <tr>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align: right;"><strong>Billing Amount:</strong></td>
                        <td class="billing">${formatCurrency(billing_amount)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div class="details">
            <h3>Seating Details:</h3>
            ${seatingHTML}
        </div>

        <div class="payment">
            <h3>Payment Information:</h3>
            <p><strong>Payment Method:</strong> ${payment_mod}</p>
        </div>

        <div class="footer">
            <p>If you have any special requests or need assistance, feel free to contact us at ${email}.</p>
            <p>We look forward to hosting you!</p>
            <p>Warm regards,<br><strong>DineRights Team</strong></p>
        </div>
    </div>
</body>
</html>
`;
}

// Helper function to format currency
function formatCurrency(amount) {
  return `₹${parseFloat(amount).toFixed(2)}`;
}

// Helper function to format date
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}



const sendEmail = (recipients, message) => {
  return new Promise((resolve, reject) => {
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
      from: '"DineRights" <' + process.env.EMAIL_SERVICE + '>', // Sender name
      to: recipients.join(','), // Join recipients into a single string
      subject: 'New Booking for DineRights',
      html: message, // Using HTML email
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        reject(error);
      } else {
        console.log('Email sent to:', recipients);
        resolve(info);
      }
    });
  });
};

// Updated sendBookingEmail without using res
exports.sendBookingEmail = async (bookingId) => {
  try {
    // booking query
    const bookingQuery = `SELECT * FROM bookings WHERE booking_id = ?`;
    const [rows] = await db.promise().query(bookingQuery, [bookingId]);

    if (rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = rows[0];
    const {
      booking_id,
      userId,
      customer_id,
      booking_date,
      booking_time,
      booking_no_of_guest,
      payment_mod,
      billing_amount,
      booking_status
    } = booking;

    // booking_connected_products
    const bookingItemsQuery = `
    SELECT mi.*, bcp.product_quantity
    FROM booking_connected_products bcp
    JOIN master_items mi ON mi.master_item_id = bcp.master_item_id
    WHERE bcp.booking_id = ?`;
    const [bookingItems] = await db.promise().query(bookingItemsQuery, [bookingId]);

    if (bookingItems.length === 0) {
      throw new Error('Booking Items not found');
    }

    // restaurant query
    const restoQuery = `SELECT * FROM users WHERE id = ?`;
    const [users] = await db.promise().query(restoQuery, [userId]);

    if (users.length === 0) {
      throw new Error('Restaurant not found');
    }

    const resto = users[0];
    const { email, restaurantName, restaurantAddress, commission } = resto;

    const commition_amount = billing_amount * (commission / 100);
    const payout_balance = payment_mod === 'online' ? commition_amount : -commition_amount;

    // commition
    const transactionData = { userId, booking_id, payment_mod, billing_amount, commition_amount, payout_balance, description: '', status: 'completed' };
    await insertCommitionTransaction(transactionData);

    // customer query
    const customerQuery = `SELECT * FROM customers WHERE customer_id = ?`;
    const [customers] = await db.promise().query(customerQuery, [customer_id]);

    if (customers.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = customers[0];
    const { customer_name, customer_email } = customer;

    // superadmin query
    const superAdminQuery = `SELECT * FROM superadmin_login`;
    const [superAdmin] = await db.promise().query(superAdminQuery, []);

    if (superAdmin.length === 0) {
      throw new Error('SuperAdmin not found');
    }

    const superAdminEmail = superAdmin[0].superadmin_email;

    // allocation tables query
    const allocationTableQuery = `
      SELECT da.dining_area_type, GROUP_CONCAT(atbl.table_name SEPARATOR ', ') as tables
      FROM allocation_tables at
      JOIN dining_areas da ON da.dining_area_id = at.dining_area_id
      JOIN all_tables atbl ON atbl.table_id = at.table_id
      WHERE at.booking_id = ?
      GROUP BY da.dining_area_type`;
    const [allocationTables] = await db.promise().query(allocationTableQuery, [bookingId]);

    const seatingDetails = allocationTables.map(area => ({
      dining_area_type: area.dining_area_type,
      tables: area.tables.split(', ') // Split table names back into an array
    }));

    // Data sanitization
    const data = {
      booking_id,
      booking_date,
      booking_time,
      booking_no_of_guest,
      payment_mod,
      restaurantName,
      restaurantAddress,
      customer_name,
      customer_email,
      email,
      billing_amount,
      booking_status,
      items: bookingItems,
      seatingDetails
    };

    const sanitizeData = (dataObj) => {
      return Object.fromEntries(
        Object.entries(dataObj).map(([key, value]) => [key, value ?? ''])
      );
    };

    const sanitizedData = sanitizeData(data);

    // Create email message
    const message = createSimpleBookingMessage(sanitizedData);

    // Recipients (customer, restaurant, and super admin)
    const recipients = [customer_email, email, superAdminEmail];
    await sendEmail(recipients, message);

  } catch (error) {
    console.error('Error sending booking email:', error);
  }
};





// commition function
async function insertCommitionTransaction(transactionData) {
  const { userId, booking_id, payment_mod, billing_amount, commition_amount, payout_balance, description, status } = transactionData;

  const query = `
    INSERT INTO commition_transactions 
    (userId, booking_id, payment_mod, billing_amount, commition_amount, payout_balance, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

  try {
    const [result] = await db.promise().query(query, [userId, booking_id, payment_mod, billing_amount, commition_amount, payout_balance, description, status]);
    return { message: `Insert successful, ID:, ${result.insertId}` }
  } catch (err) {
    console.error('Insert failed:', err.message);
  }
}

const { response } = require('express');
const db = require('../../config');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');

// get my bookings
exports.getMyBookings = async (req, res) => {
  try {
    const customer_id = req.customer_id;

    const bookingQuery = `SELECT booking_id, booking_name, booking_email, booking_no_of_guest, booking_date, booking_time, billing_amount, payment_mod, payment_status, booking_status, userId, created_at, updated_at FROM bookings WHERE customer_id = ?`;
    const [bookings] = await db.promise().query(bookingQuery, [customer_id]);

    let bookingArray = [];
    for (const booking of bookings) {

      const restaurantQuery = `SELECT id, email, restaurantName, restaurantAddress, resataurantDescription FROM users WHERE id = ?`;
      const [restaurants] = await db.promise().query(restaurantQuery, [booking.userId]);

      booking.restaurant = restaurants.length > 0 ? restaurants[0] : null;

      const bookingItemQuery = `SELECT mi.master_item_id, bcp.product_quantity, mi.master_item_name, mi.master_item_image, mi.master_item_price, mi.master_item_description 
        FROM booking_connected_products bcp
        JOIN master_items mi ON mi.master_item_id = bcp.master_item_id
        WHERE bcp.booking_id = ?`;
      const [bookingItems] = await db.promise().query(bookingItemQuery, [booking.booking_id]);

      // Create a new array with updated master_item_image
      const updatedItems = bookingItems.map(item => {
        return {
          ...item, // Spread the existing properties of the item
          master_item_image: process.env.BASE_URL + item.master_item_image // Update the master_item_image field
        };
      });

      // cancelbutton
      const bookingDate = moment.utc(booking.booking_date).tz('Asia/Kolkata').format('YYYY-MM-DD');

      const timezone = 'Asia/Kolkata'; // Change to your desired timezone
      // const bookingDateTime = moment.tz(`${bookingDate} ${booking.booking_time}`, timezone).toISOString();
      const bookingDateTime = `${bookingDate}T${booking.booking_time}.000Z`;
      const currentDateTime = moment.tz(timezone).toISOString();

      // Subtract 2 hours from the booking time
      const adjustedBookingDateTime = moment.tz(`${bookingDate} ${booking.booking_time}`, timezone).subtract(2, 'hours').toISOString();

      let cancel_button = adjustedBookingDateTime > currentDateTime ? true : false;

      if (booking.booking_status === 'inprogress' || booking.booking_status === 'completed' || booking.booking_status === 'cancelled') {
        cancel_button = false
      }

      booking.cancel_button = cancel_button;

      booking.booking_items = updatedItems;
      bookingArray.push(booking);
    }

    return res.status(200).json(bookingArray);

  } catch (err) {
    res.status(500).json({ error_msg: err.message, response: false });
  }
};

// ---------------------------------------------------------------------------
// Helper function to convert incoming Indian time to UTC
const convertToUTC = (date, time) => {
  // Create a JavaScript Date object in IST (Indian Standard Time)
  const istDateTime = new Date(`${date}T${time}:00+00:00`); // Indian time (UTC+5:30)

  // Convert the IST Date object to UTC using toISOString()
  const utcDateTime = new Date(istDateTime.toISOString());

  // Extract the UTC time in HH:MM:SS format
  const utcTime = utcDateTime.toISOString().slice(11, 19);

  // Get the day of the week in UTC (0 for Sunday, 1 for Monday, etc.)
  const dayOfWeek = utcDateTime.getUTCDay();

  // Return the converted UTC time and day index (adjusted to custom ID)
  return {
    utcTime,
    customDayId: dayOfWeek === 0 ? 7 : dayOfWeek // Convert 0 (Sunday) to 7 in custom ID
  };
};

// Helper function to fetch service times from the database
const getServiceTimes = async (userId, customDayId, utcTime, db) => {
  const servicetimeQuery = `
    SELECT * 
    FROM service_time 
    WHERE userId = ? 
      AND status = 'open' 
      AND day_id = ? 
      AND (
        (start_time <= ? AND end_time > ?) OR            
        (start_time = ? AND end_time > ?) OR                
        (start_time <= ? AND end_time < start_time) OR     
        (? < end_time AND end_time < start_time)            
      )
  `;

  const [serviTimes] = await db.promise().query(servicetimeQuery, [
    userId,
    customDayId,
    utcTime, utcTime, // Case 1
    utcTime, utcTime, // Case 2
    utcTime,          // Case 3
    utcTime           // Case 4
  ]);

  return serviTimes;
};

// Main function to check restaurant service time availability
const checkServiceAvailability = async (date, time, userId, db) => {
  // Convert incoming Indian time to UTC
  const { utcTime, customDayId } = convertToUTC(date, time);

  // Fetch service times from the database
  const serviTimes = await getServiceTimes(userId, customDayId, utcTime, db);

  // Determine if service is available based on the fetched results
  const isAvailable = serviTimes.length > 0;

  // Return result and the matched service times
  return { isAvailable, serviTimes };
};

// Route handler function
exports.getServiceAvailableOrNot = async (req, res) => {
  try {
    const { date, time, userId } = req.body;

    // Assuming `db` is an imported or initialized database connection
    const check = await checkServiceAvailability(date, time, userId, db);

    res.status(200).json(check);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// get bookings by restaurant id
exports.getMyBookingsByRestaurantId = async (req, res) => {
  try {
    const { userId } = req.params;
    const customer_id = req.customer_id;

    const bookingQuery = `SELECT booking_id, booking_name, booking_email, booking_no_of_guest, booking_date, booking_time, billing_amount, payment_mod, payment_status, booking_status, userId, created_at, updated_at FROM bookings WHERE customer_id = ? AND userId = ?`;
    const [bookings] = await db.promise().query(bookingQuery, [customer_id, userId]);

    let bookingArray = [];
    for (const booking of bookings) {

      const restaurantQuery = `SELECT id, email, restaurantName, restaurantAddress, resataurantDescription FROM users WHERE id = ?`;
      const [restaurants] = await db.promise().query(restaurantQuery, [booking.userId]);

      booking.restaurant = restaurants.length > 0 ? restaurants[0] : null;

      const bookingItemQuery = `SELECT mi.master_item_id, bcp.product_quantity, mi.master_item_name, mi.master_item_image, mi.master_item_price, mi.master_item_description 
        FROM booking_connected_products bcp
        JOIN master_items mi ON mi.master_item_id = bcp.master_item_id
        WHERE bcp.booking_id = ?`;
      const [bookingItems] = await db.promise().query(bookingItemQuery, [booking.booking_id]);

      // Create a new array with updated master_item_image
      const updatedItems = bookingItems.map(item => {
        return {
          ...item, // Spread the existing properties of the item
          master_item_image: process.env.BASE_URL + item.master_item_image // Update the master_item_image field
        };
      });

      booking.booking_items = updatedItems;
      bookingArray.push(booking);
    }

    return res.status(200).json(bookingArray);

  } catch (err) {
    res.status(500).json({ error_msg: err.message, response: false });
  }
};

// get booking slots
exports.getMyBookingSlots = async (req, res) => {
  try {
    const { userId, booking_date } = req.body;

    // Validate the required fields
    if (!userId || !booking_date) {
      return res.status(400).json({ error_msg: "User ID and booking date are required", response: false });
    }

    // Query to fetch bookings for the provided date and restaurant ID
    const bookingQuery = `
      SELECT * 
      FROM bookings 
      WHERE booking_date = ? 
        AND userId = ?
        AND booking_status NOT IN ('completed')
    `;
    const [bookings] = await db.promise().query(bookingQuery, [booking_date, userId]);

    // Prepare an array to store results with allocated tables
    let bookingArray = [];
    for (const booking of bookings) {
      // Fetch allocated tables for each booking
      const allocationTableQuery = `
        SELECT booking_date, start_time, end_time, slot_time, table_status 
        FROM allocation_tables 
        WHERE booking_id = ?
        AND table_status = 'allocated'
      `;
      const [allocationTables] = await db.promise().query(allocationTableQuery, [booking.booking_id]);

      for (const table of allocationTables) {
        bookingArray.push(table)
      }
    }

    // Return the response with updated booking details
    return res.status(200).json({
      success_msg: "Booking slots fetched successfully",
      bookings: bookingArray,
      response: true
    });
  } catch (err) {
    // Return error message in case of any failure
    res.status(500).json({ error_msg: err.message, response: false });
  }
};

// booking cancel
exports.bookingCancel = async (req, res) => {
  try {
    const { booking_id } = req.params;

    const bookingQuery = `SELECT *
    FROM bookings b
    JOIN users u ON u.id = b.userId
    WHERE b.booking_id = ?`
    const [existingBookings] = await db.promise().query(bookingQuery, [booking_id]);

    // return res.json(existingBookings);

    if(existingBookings.length === 0){
      return res.status(200).json({response: false, message: 'booking not found'});
    }

    const booking = existingBookings[0];

    const updateQuery = `UPDATE bookings SET booking_status = 'cancelled' WHERE booking_id = ?`;
    await db.promise().query(updateQuery, [booking_id]);

    const updateTableQuery = `UPDATE allocation_tables SET table_status = 'released' WHERE booking_id = ?`;
    await db.promise().query(updateTableQuery, [booking_id]);

    const formattedDate = moment(booking.booking_date).tz('Asia/Kolkata').format('DD-MM-YYYY');
    const formattedTime = moment(booking.booking_time, 'HH:mm:ss').tz('Asia/Kolkata').format('hh:mm A');

    const data ={ 
      customerName: booking.booking_name,
      restaurantName: booking.restaurantName, 
      orderId: booking.booking_id, 
      restaurantAddress: booking.	restaurantAddress, 
      bookingDate: formattedDate, 
      bookingTime: formattedTime, 
      guestCount: booking.booking_no_of_guest, 
      paymentStatus: booking.payment_status, 
      paymentMethod: booking.payment_mod,
      restaurantEmail: booking.email,
    }

    const message = generateCancellationMessageHTML(data);

    // Recipients
    const recipients = [booking.booking_email, booking.email];
    await sendEmail(recipients, message);

    res.status(200).json({ message: 'Table cancel Successfully', response: true })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
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
      subject: 'Booking Cancel for DineRights',
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


function generateCancellationMessageHTML(data) {
  const {
    customerName,
    restaurantName,
    orderId,
    restaurantAddress,
    bookingDate,
    bookingTime,
    guestCount,
    paymentStatus,
    paymentMethod,
    restaurantEmail,
  } = data;

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #d9534f;">Booking Cancellation</h2>
       
        <p>Dear <strong>${customerName}</strong>,</p>
        <p>Your booking at <strong>${restaurantName}</strong> has been successfully cancelled. Below are the details of your cancelled reservation:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Order ID:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${orderId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Restaurant Name:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${restaurantName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Restaurant Address:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${restaurantAddress}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${bookingDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Booking Time:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${bookingTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Number of Guests:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${guestCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Payment Status:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${paymentStatus}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Payment Method:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${paymentMethod}</td>
          </tr>
        </table>
        <p>If you have any questions or need further assistance, feel free to contact us at <a href="mailto:${restaurantEmail}" style="color: #007bff;">${restaurantEmail}</a>.</p>
        <p>Thank you for considering <strong>${restaurantName}</strong>. We hope to serve you again in the future!</p>
      </body>
    </html>
  `;
}



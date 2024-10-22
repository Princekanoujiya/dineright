const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/config');
const db = require('../config');
const { sendBookingEmail } = require('../controllers/booking_mail_controller');

const razorpayInstance = new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET
});

// get razorpay key
exports.getRazorpayKey = async (req, res, next) => {
    try {
        console.log({ key: config.RAZORPAY_KEY_ID })
        return res.status(200).json({ key: config.RAZORPAY_KEY_ID });
    } catch (error) {
        return res.status(200).json(error);
    }
};

// Create Order
exports.razorPayCreateOrder = async (data) => {
    try {
        const { amount, name, email, phone } = data;
        const options = {
            amount: Number(amount * 100),
            currency: 'INR',
            receipt: email,
        };

        // Wrap Razorpay API call in a Promise
        const order = await new Promise((resolve, reject) => {
            razorpayInstance.orders.create(options, (err, order) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(order);
                }
            });
        });

        const return_data = {
            msg: 'Order Created',
            key: config.RAZORPAY_KEY_ID,
            amount: order.amount,
            currency: "INR",
            customer_id: "",
            business_name: "Dineright",
            business_logo: `${process.env.BASE_URL}/images/logo 001-03.png`,
            callback_url: `${process.env.BASE_URL}/api/auth/verify_payment`,
            product_description: "Product Description or productId:",
            customer_detail: {
                name: name,
                email: email,
                contact: phone,
            },
            razorpayModalTheme: "#ffc042",
            //background: linear-gradient(90deg, #141E30 0%, #243B55 100%);
            notes: {
                "address": "Razorpay Corporate Office"
            },
        };

        return { ...return_data, ...order }

    } catch (error) {
        console.log(error.message);
        return { success: false, message: 'Something went wrong!' }
    }
};


// payment verification
exports.razorpayVerifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log('Verify Payment:', req.body);

    // Create the expected signature using HMAC and secret key
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", config.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      if (razorpay_order_id) {

        // Fetch the booking ID associated with the razorpay_order_id
        const selectBookingIdQuery = `SELECT booking_id FROM bookings WHERE razorpay_order_id = ?`;

        const bookingId = await new Promise((resolve, reject) => {
            db.query(selectBookingIdQuery, [razorpay_order_id], (err, rows) => {
              if (err) {
                console.error("Error retrieving booking ID:", err);
                return reject(err);
              }
              if (rows.length > 0) {
                resolve(rows[0].booking_id); // Assuming rows[0].booking_id contains the booking ID
              } else {
                reject(new Error("No booking found for the provided razorpay_order_id"));
              }
            });
          });

        // Update the booking status to 'confirmed'
        const updateBookingStatusQuery = `UPDATE bookings SET razorpay_payment_id = ?, payment_status = 'paid', razorpay_status = 'success', booking_status = 'confirmed' WHERE booking_id = ?`;

        const bookingData = await new Promise((resolve, reject) => {
          db.query(updateBookingStatusQuery, [razorpay_payment_id, bookingId], (err, result) => {
            if (err) {
              console.error("Error updating booking status:", err);
              return reject(err);
            }
            resolve(result);
          });
        });

        // Update the allocate table status to 'allocated' for all rows matching the booking_id
        const updateItemsStatusQuery = `UPDATE allocation_tables SET table_status = 'allocated' WHERE booking_id = ?`;

        await new Promise((resolve, reject) => {
          db.query(updateItemsStatusQuery, [bookingId], (err, result) => {
            if (err) {
              console.error("Error updating table allocation:", err);
              return reject(err);
            }
            resolve(result);
          });
        });

        console.log('Booking status and table allocation updated successfully.');

        // send mail
      await sendBookingEmail(bookingId);
      }

      // Payment success - redirect to thank-you page
      res.redirect(
        `${process.env.WEBSITE_BASE_URL}/thank-you/?reference=${razorpay_payment_id}&payment_success=true`
      );
    } else {
      // If signature verification fails
      res.status(400).json({
        success: false,
        message: "Invalid payment signature. Verification failed."
      });
    }

  } catch (error) {
    console.error("Error during payment verification:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

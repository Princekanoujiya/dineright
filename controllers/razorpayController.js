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
        const selectBookingIdQuery = `SELECT * FROM bookings WHERE razorpay_order_id = ?`;

        const booking = await new Promise((resolve, reject) => {
            db.query(selectBookingIdQuery, [razorpay_order_id], (err, rows) => {
              if (err) {
                console.error("Error retrieving booking ID:", err);
                return reject(err);
              }
              if (rows.length > 0) {
                resolve(rows[0]); // Assuming rows[0].booking_id contains the booking ID
              } else {
                reject(new Error("No booking found for the provided razorpay_order_id"));
              }
            });
          });

        // Update the booking status to 'confirmed'
        const updateBookingStatusQuery = `UPDATE bookings SET razorpay_payment_id = ?, payment_status = 'paid', razorpay_status = 'success', booking_status = 'upcoming' WHERE booking_id = ?`;

        const bookingData = await new Promise((resolve, reject) => {
          db.query(updateBookingStatusQuery, [razorpay_payment_id, booking.booking_id], (err, result) => {
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
          db.query(updateItemsStatusQuery, [booking.booking_id], (err, result) => {
            if (err) {
              console.error("Error updating table allocation:", err);
              return reject(err);
            }
            resolve(result);
          });
        });

        console.log('Booking status and table allocation updated successfully.');

      // rewards add
      const rewardQuery = `INSERT INTO rewards (customer_id, booking_id, reward_points, reward_type) VALUES (?, ?, ?, ?)`;
      const [rewardResult] = await db.promise().query(rewardQuery, [booking.customer_id, booking.booking_id, booking.billing_amount, 'online booking']);

        // send mail
      await sendBookingEmail(booking.booking_id);
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


// Get Razorpay Payment Details by Payment ID with Order ID and Success/Failed Response
exports.getRazorpayPaymentById = async (req, res) => {
  try {
      const { paymentId } = req.params;

      // Fetch payment details from Razorpay using paymentId
      const paymentDetails = await razorpayInstance.payments.fetch(paymentId);

      if (!paymentDetails) {
          return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      // Determine payment status
      let paymentStatus;
      switch (paymentDetails.status) {
          case 'captured':
              paymentStatus = 'Payment successful';
              break;
          case 'failed':
              paymentStatus = 'Payment failed';
              break;
          case 'authorized':
              paymentStatus = 'Payment authorized but not captured';
              break;
          case 'refunded':
              paymentStatus = 'Payment refunded';
              break;
          default:
              paymentStatus = 'Payment status unknown';
      }

      return res.status(200).json({
          success: true,
          message: paymentStatus,
          paymentDetails: {
              id: paymentDetails.id,
              order_id: paymentDetails.order_id, // Added Order ID
              amount: paymentDetails.amount / 100, // Convert to INR if amount is in paise
              currency: paymentDetails.currency,
              status: paymentDetails.status,
              method: paymentDetails.method,
              description: paymentDetails.description,
              created_at: new Date(paymentDetails.created_at * 1000).toLocaleString(), // Convert timestamp to readable format
              captured: paymentDetails.captured,
              card_id: paymentDetails.card_id,
              bank: paymentDetails.bank,
              wallet: paymentDetails.wallet,
              vpa: paymentDetails.vpa,
              email: paymentDetails.email,
              contact: paymentDetails.contact,
              error_code: paymentDetails.error_code || null,
              error_description: paymentDetails.error_description || null,
          }
      });
  } catch (error) {
      console.error("Error fetching payment details by payment ID:", error.message);
      return res.status(500).json({ success: false, message: 'Error fetching payment details', error: error.message });
  }
};


// Create Order - unpaid commission
exports.razorPayCreateOrderUnpaidCommission = async (data) => {
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
          callback_url: `${process.env.BASE_URL}/api/auth/verify_payment/commission`,
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


// Payment verification - unpaid commission
exports.razorpayVerifyPaymentUnpaidCommission = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Create the expected signature using HMAC and secret key
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", config.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic && razorpay_order_id) {
      // Get the userId from commission_deposit based on the order ID
      const userIdQuery = `SELECT userId FROM commission_deposit WHERE razorpay_order_id = ?`;
      const userIdResult = await new Promise((resolve, reject) => {
        db.query(userIdQuery, [razorpay_order_id], (err, result) => {
          if (err) {
            console.error("Error fetching userId from commission_deposit:", err);
            return reject(err);
          }
          resolve(result);
        });
      });

      // Ensure userId is fetched correctly
      if (!userIdResult || userIdResult.length === 0) {
        return res.status(404).json({ success: false, message: "User not found for the given order ID" });
      }
      const userId = userIdResult[0].userId;

      // Update the commission_deposit status to success
      const updateCommissionDepositQuery = `UPDATE commission_deposit SET razorpay_payment_id = ?, razorpay_status = 'success' WHERE razorpay_order_id = ?`;
      await new Promise((resolve, reject) => {
        db.query(updateCommissionDepositQuery, [razorpay_payment_id, razorpay_order_id], (err, result) => {
          if (err) {
            console.error("Error updating commission_deposit status:", err);
            return reject(err);
          }
          resolve(result);
        });
      });

      // Update the commission_transactions to mark as paid (is_payout = 1)
      const updateCommissionTransactionsQuery = `UPDATE commission_transactions SET is_payout = 1 WHERE userId = ? AND payment_mod = 'cod'`;
      await new Promise((resolve, reject) => {
        db.query(updateCommissionTransactionsQuery, [userId], (err, result) => {
          if (err) {
            console.error("Error updating commission_transactions status:", err);
            return reject(err);
          }
          resolve(result);
        });
      });

      // Payment success - redirect to thank-you page
      return res.redirect(
        `${process.env.WEBSITE_BASE_URL}/thank-you/?reference=${razorpay_payment_id}&payment_success=true`
      );
    } else {
      // If signature verification fails, update commission_deposit to 'failed'
      if (razorpay_order_id) {
        const updateCommissionDepositQuery = `UPDATE commission_deposit SET razorpay_status = 'failed' WHERE razorpay_order_id = ?`;
        await new Promise((resolve, reject) => {
          db.query(updateCommissionDepositQuery, [razorpay_order_id], (err, result) => {
            if (err) {
              console.error("Error updating commission_deposit status to 'failed':", err);
              return reject(err);
            }
            resolve(result);
          });
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature. Verification failed."
      });
    }
  } catch (error) {
    console.error("Error during payment verification:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred during payment verification. Please try again later.",
      details: error.message
    });
  }
};

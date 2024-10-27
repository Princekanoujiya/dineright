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
        const updateBookingStatusQuery = `UPDATE bookings SET razorpay_payment_id = ?, payment_status = 'paid', razorpay_status = 'success', booking_status = 'upcomming' WHERE booking_id = ?`;

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


// all payments
// Fetch all Razorpay Payments
exports.getAllRazorpayPayments = async (req, res) => {
  try {
      // Fetch all payments from Razorpay
      const payments = await razorpayInstance.payments.all({
          from: req.query.from || '', // Optional: Starting date for payment records
          to: req.query.to || '',     // Optional: Ending date for payment records
          count: req.query.count || 10 // Optional: Limit on the number of payments
      });

      return res.status(200).json({ success: true, data: payments });
  } catch (error) {
      console.error("Error fetching Razorpay payments:", error.message);
      return res.status(500).json({ success: false, message: 'Error fetching payments', error: error.message });
  }
};
// GET /api/razorpay/payments?from=2023-10-01&to=2023-10-31&count=50


// Get Razorpay Payment Details by Order ID
exports.getRazorpayPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Fetch order details from Razorpay using orderId
    const orderDetails = await razorpayInstance.orders.fetch(orderId);

    if (!orderDetails) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Fetch payments associated with the order ID
    const paymentsResponse = await razorpayInstance.payments.all({ order_id: orderId });

    if (!paymentsResponse || !paymentsResponse.items.length) {
      return res.status(404).json({ success: false, message: 'No payments found for this order' });
    }

    // Determine the success status of each payment
    const payments = paymentsResponse.items.map(payment => {
      let statusMessage;
      switch (payment.status) {
        case 'captured':
          statusMessage = 'Payment successful';
          break;
        case 'failed':
          statusMessage = 'Payment failed';
          break;
        case 'authorized':
          statusMessage = 'Payment authorized but not captured';
          break;
        case 'refunded':
          statusMessage = 'Payment refunded';
          break;
        default:
          statusMessage = 'Payment status unknown';
      }

      return {
        id: payment.id,
        amount: payment.amount / 100, // Convert to INR
        currency: payment.currency,
        status: payment.status,
        statusMessage,
        method: payment.method,
        created_at: new Date(payment.created_at * 1000).toLocaleString(), // Convert timestamp to readable format
        captured: payment.captured,
        card_id: payment.card_id,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
        email: payment.email,
        contact: payment.contact,
        error_code: payment.error_code || null,
        error_description: payment.error_description || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        orderDetails,
        payments,
      }
    });
  } catch (error) {
    console.error("Error fetching payment details:", error.message);
    return res.status(500).json({ success: false, message: 'Error fetching payment details', error: error.message });
  }
};

// GET /api/razorpay/payments/order_LqzNXk8Z0wS5xl


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


// router.get('/payments/details/:paymentId', razorpayController.getRazorpayPaymentById);

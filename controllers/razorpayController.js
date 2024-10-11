const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/config');

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
        return res.status(500).json(error);
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
            amount: order.amount,
            currency: "INR",
            customer_id: "",
            business_name: "Dineright",
            business_logo: `${process.env.BASE_URL}/images/logo 001-03.png`,
            callback_url: `${process.env.BASE_URL}/api/auth//verify_payment`,
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

// Verify Payment
exports.razorpayVerifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac("sha256", razorpayConfig.keySecret)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
        // your logic

            // payment success redirect url
            res.redirect(
                `${process.env.WEBSITE_BASE_URL}/?reference=${razorpay_payment_id}&payment_success=true`
            );

        } else {
            res.status(400).json({
                success: false,
            });
        }

    } catch (error) {
        return res.status(500).json(error.message);
    }
};
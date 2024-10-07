const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/config');

const razorpayInstance = new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET
});

// Create Order
exports.createOrder = async (req, res) => {
    try {
        const options = {
            amount: req.body.amount * 100, // amount in the smallest currency unit (paise)
            currency: "INR",
            receipt: req.body.receipt
        };

        const order = await razorpayInstance.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: "Error creating order", error });
    }
};

// Verify Payment
exports.verifyPayment = (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const generated_signature = crypto.createHmac('sha256', config.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');

    if (generated_signature === razorpay_signature) {
        res.status(200).json({ message: "Payment verified successfully" });
    } else {
        res.status(400).json({ message: "Payment verification failed" });
    }
};


// const jwt = require('jsonwebtoken');

// exports.verifyToken = (req, res, next) => {
//     const token = req.header('Authorization');
//     if (!token) return res.status(401).json({ message: "Access Denied" });

//     try {
//         const verified = jwt.verify(token, process.env.JWT_SECRET);
//         req.user = verified;
//         next();
//     } catch (err) {
//         res.status(400).json({ message: "Invalid Token" });
//     }
// };


// {
//     "razorpay_order_id": "order_P5noVF1BLazq9e",    
//     "razorpay_payment_id": "pay_H1G92zXpj4Q",
//     "razorpay_signature": "generated_signature"
// }

// {
//     "amount": 500, 
//     "receipt": "receipt_1"
//   }
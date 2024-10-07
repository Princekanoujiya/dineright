const express = require('express');
const router = express.Router();
const razorpayInstance = require('../config/razorpay'); // Adjust based on your file structure
const crypto = require('crypto');

// Create an order
router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency } = req.body;
        const options = {
            amount: amount * 100,  // Amount in paise
            currency: currency,
            receipt: `receipt_${Math.floor(Math.random() * 10000)}`, // Custom receipt id
            payment_capture: 1
        };
        const order = await razorpayInstance.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create Razorpay order' });
    }
});

// Verify payment signature
router.post('/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (generated_signature === razorpay_signature) {
        res.json({ status: 'success' });
    } else {
        res.status(400).json({ error: 'Invalid signature' });
    }
});

module.exports = router;

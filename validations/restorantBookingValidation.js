const { body, validationResult } = require('express-validator');

// Validation rules for the updateBookingPayment API
exports.validateBookingPayment = [
  // Booking ID must be a positive integer and required
  body('booking_id')
    .exists({ checkFalsy: true }).withMessage('Booking ID is required')
    .isInt({ gt: 0 }).withMessage('Booking ID must be a positive integer'),

  // Booking status must be 'completed' or 'cancelled' and required
  body('booking_status')
    .exists({ checkFalsy: true }).withMessage('Booking status is required')
    .isIn(['completed', 'cancelled']).withMessage('Booking status must be "completed" or "cancelled"'),

  // Custom middleware to check validation result
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

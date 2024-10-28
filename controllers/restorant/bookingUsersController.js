const db = require('../../config');

exports.getBookingUsers = async (req, res) => {
    try {
        const userId = req.userId;
        
        // Use a JOIN to fetch customers directly related to bookings for the given userId
        const bookingQuery = `
            SELECT c.customer_id, c.customer_name, c.customer_email, c.customer_profile_image, b.booking_date
            FROM bookings b
            JOIN customers c ON b.customer_id = c.customer_id
            WHERE b.userId = ? AND c.is_deleted = 0
        `;

        const [bookingResult] = await db.promise().query(bookingQuery, [userId]);

        // Update each customer's profile image URL by appending the base URL
        const updatedBookingResult = bookingResult.map(customer => ({
            ...customer,
            customer_profile_image: customer.customer_profile_image 
                ? `${process.env.BASE_URL}${customer.customer_profile_image}`
                : null // Handle null or empty image paths gracefully
        }));

        // Return the fetched customer data
        res.status(200).json(updatedBookingResult);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

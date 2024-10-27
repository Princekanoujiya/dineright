const db = require('../../config');

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

        booking.booking_items = updatedItems;
        bookingArray.push(booking);
        }

        // booking_id, booking_name, booking_email, booking_no_of_guest, booking_date, booking_time, billing_amount, payment_mod, payment_status, booking_status, created_at, updated_at

        // master_item_id, product_quantity, master_item_name, master_item_image, master_item_price, master_item_description

        // id, email, restaurantName, restaurantAddress, resataurantDescription

        

    return res.status(200).json(bookingArray);

    } catch (err) {
        res.status(500).json({ error_msg: err.message, response: false });
    }
};
const db = require('../../config');

// get all bookings
exports.getAllBookings = (req, res) => {

  const userId = req.userId;

  // Query to fetch allocated tables for a specific user
  const bookingQuery = `SELECT * FROM bookings WHERE userId = ?`;

  db.query(bookingQuery, [userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching bookings', details: err.message });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'No bookings found for this user' });
    }

    // Return the fetched data
    res.status(200).json({ data: result });
  });
};

// Get one booking by booking_id
exports.getOneBooking = (req, res) => {
  const userId = req.userId;
  const bookingId = req.params.booking_id;

  // Check if bookingId is provided
  if (!bookingId) {
    return res.status(400).json({ message: 'bookingId is required' });
  }

  // Query to fetch the booking and allocated tables
  const bookingQuery = `SELECT * FROM bookings WHERE userId = ? AND booking_id = ?`;

  db.query(bookingQuery, [userId, bookingId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching booking details', details: err.message });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'No booking or allocated tables found for this booking_id' });
    }

    // Return the fetched booking and allocated table details
    res.status(200).json({ data: result[0] });
  });
};

// -----------------------------------------------------------------------------------------------------------------
// Fetch booking details, table allocations, and menu items grouped by booking_id
exports.getBookingDetails = async (req, res) => {
  try {
    const { booking_id } = req.params;
    const userId = req.userId;

    // Fetch the booking details for the given booking_id and userId
    const bookingQuery = `SELECT * FROM bookings WHERE booking_id = ? AND userId = ?`;
    const [bookings] = await db.promise().query(bookingQuery, [booking_id, userId]);

    // If no bookings found, return 404
    if (bookings.length === 0) {
      return res.status(404).json({ error: 'No booking details found for this booking_id and userId.' });
    }

    // Fetch allocation tables and booking connected products in parallel for the booking
    const bookingData = await Promise.all(
      bookings.map(async (booking) => {
        // Fetch allocation tables for the booking
        const allocationTablesQuery = `SELECT * FROM allocation_tables WHERE booking_id = ?`;
        const [allocationTables] = await db.promise().query(allocationTablesQuery, [booking.booking_id]);
        booking.allocation_tables = allocationTables;

        // Fetch connected booking products
        const bookingItemsQuery = `SELECT * FROM booking_connected_products WHERE booking_id = ?`;
        const [bookingConnectedProducts] = await db.promise().query(bookingItemsQuery, [booking.booking_id]);

        // Fetch the master item details for each connected product
        const masterItems = await Promise.all(
          bookingConnectedProducts.map(async (connectedProduct) => {
            const masterItemsQuery = `SELECT * FROM master_items WHERE master_item_id = ?`;
            const [masterItem] = await db.promise().query(masterItemsQuery, [connectedProduct.master_item_id]);
            return masterItem[0]; // Assuming there's only one result per master_item_id
          })
        );

        // Attach the booking items to the booking object
        booking.booking_items = masterItems;

        return booking;
      })
    );

    return res.status(200).json(bookingData);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch booking details', details: err.message });
  }
};


// get all cancelled bookings
exports.getAllCancelledBookings = (req, res) => {

  // Query to fetch allocated tables for a specific user
  const bookingQuery = `SELECT * FROM bookings WHERE booking_status = 'cancelled'`;

  db.query(bookingQuery, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching cancel bookings', details: err.message });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'No Cancel bookings found' });
    }

    // Return the fetched data
    res.status(200).json({ data: result });
  });
};

exports.refundStatusChange = async (req, res) => {
  try {
    const { booking_id, refund_amount, refund_status, refund_transaction_id } = req.body;

    const updateQuery = `UPDATE bookings SET refund_status = ?, refund_amount = ?, refund_transaction_id = ? WHERE booking_id = ?`;
    await db.promise().query(updateQuery, [refund_status, refund_amount, refund_transaction_id, booking_id]);
    

    res.status(200).json({ message: 'Refund status Changed Successfully', response: true });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}


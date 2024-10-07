const db = require('../config');

exports.insertOrUpdateBookingTable = (req, res) => {
  const { userId, booking_date, booking_time, booking_no_of_guest } = req.body;
  const customer_id = req.customer_id; // Get customer_id from the verified token middleware

  if (req.body.booking_id) {
    // Update existing booking
    const updateQuery = `
        UPDATE bookings 
        SET userId = ?, customer_id = ?, booking_date = ?, booking_time = ?, booking_no_of_guest = ?
        WHERE booking_id = ?
    `;
    db.query(updateQuery, [userId, customer_id, booking_date, booking_time, booking_no_of_guest, req.body.booking_id], (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Failed to update booking", details: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error_msg: "Booking not found" });
      }
      return res.json({ success_msg: "Booking updated successfully", booking_id: req.body.booking_id });
    });
  } else {
    // Insert new booking
    const insertQuery = `
        INSERT INTO bookings (userId, customer_id, booking_date, booking_time, booking_no_of_guest) 
        VALUES (?, ?, ?, ?, ?)
    `;
    db.query(insertQuery, [userId, customer_id, booking_date, booking_time, booking_no_of_guest], (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Failed to create booking", details: err.message });
      }
      return res.status(201).json({ success_msg: "Booking created successfully", booking_id: result.insertId });
    });
  }
};
exports.getMasterCard = (req, res) => {
  const { userId } = req.body; 

  const getQuery = `
    SELECT mi.master_item_id, mi.master_item_name, mi.master_item_price, 
           mi.master_item_description, mi.master_item_image, bil.menu_id
    FROM master_items mi
    LEFT JOIN menu_item_linking bil 
      ON mi.master_item_id = bil.master_item_id AND bil.userId = ?
    WHERE bil.menu_id IS NOT NULL AND bil.is_deleted = 0
    `;

  db.query(getQuery, [userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching Menu items', details: err.message });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'No items found for this user' });
    }

    res.status(200).json({ data: result });
  });
};
exports.getMasterBeverage = (req, res) => {
  const { userId } = req.body;  // Get userId from request body instead of token

  const getQuery = `
    SELECT mi.master_item_id, mi.master_item_name, mi.master_item_price, 
           mi.master_item_description, mi.master_item_image, bil.beverage_id
    FROM master_items mi
    LEFT JOIN beverages_item_linking bil 
      ON mi.master_item_id = bil.master_item_id AND bil.userId = ?
    WHERE bil.beverage_id IS NOT NULL AND bil.is_deleted = 0
  `;

  db.query(getQuery, [userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching beverage items', details: err.message });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'No items found for this user' });
    }

    res.status(200).json({ data: result });
  });
};




// exports.book_product = (req, res) => {
//   const { userId, booking_date, booking_time, booking_no_of_guest } = req.body;
//   const customer_id = req.customer_id; // Get customer_id from the verified token middleware

//   if (req.body.booking_id) {
//     // Update existing booking
//     const updateQuery = `
//         UPDATE bookings 
//         SET userId = ?, customer_id = ?, booking_date = ?, booking_time = ?, booking_no_of_guest = ?
//         WHERE booking_id = ?
//     `;
//     db.query(updateQuery, [userId, customer_id, booking_date, booking_time, booking_no_of_guest, req.body.booking_id], (err, result) => {
//       if (err) {
//         return res.status(500).json({ error: "Failed to update booking", details: err.message });
//       }
//       if (result.affectedRows === 0) {
//         return res.status(404).json({ error_msg: "Booking not found" });
//       }
//       return res.json({ success_msg: "Booking updated successfully", booking_id: req.body.booking_id });
//     });
//   } else {
//     // Insert new booking
//     const insertQuery = `
//         INSERT INTO bookings (userId, customer_id, booking_date, booking_time, booking_no_of_guest) 
//         VALUES (?, ?, ?, ?, ?)
//     `;
//     db.query(insertQuery, [userId, customer_id, booking_date, booking_time, booking_no_of_guest], (err, result) => {
//       if (err) {
//         return res.status(500).json({ error: "Failed to create booking", details: err.message });
//       }
//       return res.status(201).json({ success_msg: "Booking created successfully", booking_id: result.insertId });
//     });
//   }
// };



// Function to insert connected products


// Function to create or update a booking
exports.book_product = (req, res) => {
  const { userId, booking_date, booking_time, booking_no_of_guest, items } = req.body;
  const customer_id = req.customer_id; // Get customer_id from the verified token middleware

  if (req.body.booking_id) {
    // Update existing booking
    const updateQuery = `
        UPDATE bookings 
        SET userId = ?, customer_id = ?, booking_date = ?, booking_time = ?, booking_no_of_guest = ?
        WHERE booking_id = ?
    `;
    db.query(updateQuery, [userId, customer_id, booking_date, booking_time, booking_no_of_guest, req.body.booking_id], (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Failed to update booking", details: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error_msg: "Booking not found" });
      }
      // Proceed to update connected products
      updateConnectedProducts(req.body.booking_id, items, res);
    });
  } else {
    // Insert new booking
    const insertQuery = `
        INSERT INTO bookings (userId, customer_id, booking_date, booking_time, booking_no_of_guest) 
        VALUES (?, ?, ?, ?, ?)
    `;
    db.query(insertQuery, [userId, customer_id, booking_date, booking_time, booking_no_of_guest], (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Failed to create booking", details: err.message });
      }
      const bookingId = result.insertId;
      // Insert connected products
      insertConnectedProducts(bookingId, items, res);
    });
  }
};

// Function to insert connected products
const insertConnectedProducts = (bookingId, items, res) => {
  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items provided for booking." });
  }

  const insertQuery = `
      INSERT INTO booking_connected_products (booking_id, master_item_id, product_quantity)
      VALUES ?
  `;

  // Prepare values for batch insert
  const values = items.map(item => [bookingId, item.master_item_id, item.product_quantity]);

  db.query(insertQuery, [values], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to insert connected products", details: err.message });
    }
    res.status(200).json({
      success_msg: "Booking and connected products created successfully",
      total_items: items.length, // Total number of items inserted
      booking_id: bookingId,
      connected_product_ids: result.insertId // First inserted booking_connected_product_id
    });
  });
};

// Function to update connected products
const updateConnectedProducts = (bookingId, items, res) => {
  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items provided for booking." });
  }

  // Delete existing connected products for this booking
  const deleteQuery = `
      DELETE FROM booking_connected_products WHERE booking_id = ?
  `;
  
  db.query(deleteQuery, [bookingId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to delete old connected products", details: err.message });
    }
    // Insert new connected products
    insertConnectedProducts(bookingId, items, res);
  });
};

// Function to delete connected products for a given booking_id
exports.deleteConnectedProducts = (req, res) => {
  const bookingId = req.params.booking_id; // Assuming booking_id is passed as a route parameter

  if (!bookingId) {
    return res.status(400).json({ error: "Booking ID is required" });
  }

  // Delete query for connected products
  const deleteQuery = `
      DELETE FROM booking_connected_products WHERE booking_id = ?
  `;

  db.query(deleteQuery, [bookingId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to delete connected products", details: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error_msg: "No connected products found for this booking" });
    }

    res.status(200).json({
      success_msg: "Connected products deleted successfully",
      total_deleted: result.affectedRows,  // Number of rows deleted
      booking_id: bookingId
    });
  });
};






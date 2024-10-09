const db = require('../config');


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


// book table and order items
exports.book_product = (req, res) => {
  const { userId, booking_date, booking_time, booking_no_of_guest, items } = req.body;

//   const bookingFetchQuery = `
//   SELECT * FROM bookings 
//   WHERE booking_date = ? AND booking_time < ?
// `;

// db.query(bookingFetchQuery, [booking_date, booking_time], (err, getBookingResults) => {
//   if (err) {
//     return res.status(500).json({ error: "Failed to fetch bookings", details: err.message });
//   }

//    res.json(getBookingResults);
// });


  const selectedDiningAreaQuery = `SELECT * FROM selected_dining_areas WHERE userId = ?`;

  db.query(selectedDiningAreaQuery, [userId], (err, SelectedDiningAreaResult) => {
    if (err) {
      return res.status(500).json({ error: "Failed to retrieve dining areas", details: err.message });
    }

    if (SelectedDiningAreaResult.length === 0) {
      return res.status(404).json({ message: 'No dining areas found for this user.' });
    }

    // Iterate over the selected dining areas
    let bookingCompleted = false; // Flag to track if booking is completed

    for (const diningArea of SelectedDiningAreaResult) {
      const selectQuery = `
        SELECT * 
        FROM dining_areas AS d
        LEFT JOIN all_tables AS a 
        ON d.dining_area_id = a.dining_area_id 
        WHERE d.dining_area_id = ? AND a.userId = ?
      `;

      // Execute the query
      db.query(selectQuery, [diningArea.dining_area_id, userId], (err, results) => {
        if (err) {
          return res.status(500).json({ error: "Failed to retrieve available tables", details: err.message });
        }

        if (results.length === 0) {
          return res.status(404).json({ message: 'No available tables found for this dining area.' });
        }

        // Calculate the total number of available seats
        let totalSeats = 0;
        results.forEach(table => {
          totalSeats += table.table_no_of_seats; // Summing up available seats
        });

        // Check if the number of guests is less than or equal to total available seats
        if (booking_no_of_guest <= totalSeats && !bookingCompleted) {
          bookingCompleted = true; // Mark booking as completed for this dining area

          const insertBooking = `
            INSERT INTO bookings (userId, customer_id, booking_date, booking_time, booking_no_of_guest) 
            VALUES (?, ?, ?, ?, ?)
          `;

          const customer_id = req.customer_id || null; // Use customer_id from req or null if not present

          db.query(insertBooking, [userId, customer_id, booking_date, booking_time, booking_no_of_guest], (err, bookingResult) => {
            if (err) {
              return res.status(500).json({ error: "Failed to create booking", details: err.message });
            }

            const bookingId = bookingResult.insertId;

            // Insert connected products
            insertConnectedProducts(bookingId, items, booking_no_of_guest, res);
          });
        } else if (!bookingCompleted) {
          // If booking couldn't be completed due to insufficient seats
          return res.status(400).json({
            message: `Not enough available seats for the number of guests. Available seats: ${totalSeats}.`
          });
        }
      });
    }
  });
};

// Function to insert connected products
const insertConnectedProducts = (bookingId, items, booking_no_of_guest, res) => {
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

    // Calculate total item cost after inserting connected products
    let itemCost = 0;
    const itemValues = items.map(item => item.master_item_id); // Get an array of master_item_ids

    const itemsQuery = `SELECT * FROM master_items WHERE master_item_id IN (?)`;

    db.query(itemsQuery, [itemValues], (err, itemResult) => {
      if (err) {
        return res.status(500).json({ error: "Failed to fetch item details", details: err.message });
      }

      // Calculate the total cost based on item quantity and price
      itemResult.forEach(item => {
        const orderedItem = items.find(i => i.master_item_id === item.master_item_id); // Find corresponding item in request
        if (orderedItem) {
          itemCost += parseInt(orderedItem.product_quantity) * parseFloat(item.master_item_price);
        }
      });

      // Respond with success after cost calculation
      res.status(200).json({
        success_msg: `Your booking has been confirmed! We look forward to hosting your group of ${booking_no_of_guest} guests.`,
        total_items: items.length, // Total number of items inserted
        booking_id: bookingId,
        cost: itemCost, // Total calculated cost
      });
    });
  });
};


// const insertConnectedProducts = (bookingId, items, booking_no_of_guest, res) => {
//   if (!items || items.length === 0) {
//     return res.status(400).json({ error: "No items provided for booking." });
//   }

//   const insertQuery = `
//     INSERT INTO booking_connected_products (booking_id, master_item_id, product_quantity)
//     VALUES ?
//   `;

//   // Prepare values for batch insert
//   const values = items.map(item => [bookingId, item.master_item_id, item.product_quantity]);

//   db.query(insertQuery, [values], (err, result) => {
//     if (err) {
//       return res.status(500).json({ error: "Failed to insert connected products", details: err.message });
//     }


//     // cost
//     let itemCost = 0;
//     const itemValues = items.map(item => [item.master_item_id]);

//     const itemsQuery = `SELECT * FROM master_items WHERE master_item_id IN (?)`;

//       db.query(itemsQuery, [itemValues], (err, itemResult) => {
//         if (err) {
//           return res.status(500).json({ error: "Failed to fetch items", details: err.message });
//         }

//         // res.json(itemResult)

//         for(const item of itemResult){

//           const getItem = items.find(i => i.master_item_id === item.master_item_id);
//           itemCost = itemCost + (parseInt(getItem.product_quantity) * parseFloat(item.master_item_price));
//         }

//       });

//     res.status(200).json({
//       success_msg: `Your booking has been confirmed! We look forward to hosting your group of ${booking_no_of_guest} guests.`,
//       total_items: items.length, // Total number of items inserted
//       booking_id: bookingId,
//       cost: itemCost,
//     });
//   });
// };


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






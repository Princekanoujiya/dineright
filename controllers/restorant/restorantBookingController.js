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

// ----------------------------------------------------------------------------------------------------------------------

// Get all dining areas and their allocated tables
exports.getAllDiningAreaAndAllocatedTables = (req, res) => {
  const userId = req.userId;
  const bookingDate = req.body.booking_date;

  if (!bookingDate) {
    return res.status(400).json({ message: 'booking_date is required' })
  }

  // Query to fetch all dining areas for the specific user
  const diningAreaQuery = `
    SELECT * FROM selected_dining_areas sda 
    LEFT JOIN dining_areas da ON sda.dining_area_id = da.dining_area_id  
    WHERE sda.userId = ?
  ;`

  db.query(diningAreaQuery, [userId], (err, diningAreas) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching dining areas', details: err.message });
    }

    if (diningAreas.length === 0) {
      return res.status(200).json({ data: [] }); // Return empty array if no dining areas found
    }

    // Result container for dining areas with their allocated tables and capacities
    const resultData = [];

    // Counter to track async operations
    let areasProcessed = 0;

    // Loop through each dining area to fetch its allocated tables and capacity
    diningAreas.forEach((diningArea) => {
      const allocatedTablesQuery = `SELECT * FROM allocation_tables WHERE dining_area_id = ? AND booking_date = ?`;
      const capacityQuery = `SELECT SUM(table_no_of_seats) AS total_capacity FROM all_tables WHERE dining_area_id = ? AND userId = ?`;

      // Fetch allocated tables
      db.query(allocatedTablesQuery, [diningArea.dining_area_id, bookingDate], (err, allocatedTables) => {
        if (err) {
          return res.status(500).json({ error: 'Database error fetching allocated tables', details: err.message });
        }

        // Fetch dining area capacity
        db.query(capacityQuery, [diningArea.dining_area_id, userId], (err, capacityResult) => {
          if (err) {
            return res.status(500).json({ error: 'Database error fetching dining area capacity', details: err.message });
          }

          // Get total capacity from the result
          const totalCapacity = capacityResult[0]?.total_capacity || 0;

          // Add dining area with allocated tables and capacity to the result
          resultData.push({
            dining_area: {
              dining_area_id: diningArea.dining_area_id,
              dining_area_name: diningArea.dining_area_type,  // Assuming you have a name for dining area
              total_capacity: totalCapacity, // Total capacity of the dining area
              allocated_tables: allocatedTables || []  // Allocated tables or empty array if none
            }
          });

          // Check if all areas have been processed
          areasProcessed++;
          if (areasProcessed === diningAreas.length) {
            // All dining areas processed, return the result
            res.status(200).json({ data: resultData });
          }
        });
      });
    });
  });
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Endpoint for inserting a new booking
exports.newBookingInsert = async (req, res) => {
  const {
    booking_name,
    booking_email,
    booking_no_of_guest,
    booking_date,
    booking_time,
    dining_area_id,
    booking_comment,
    table_ids, // Array of table IDs for multiple tables
    items, // Array of items IDs for multiple items
    start_time,
  } = req.body;

  const userId = req.userId; // Assuming userId is obtained from authentication

  // Insert booking query
  const insertBookingQuery = `
    INSERT INTO bookings (userId, booking_name, booking_email, booking_no_of_guest, booking_date, booking_time, booking_comment, payment_mod, booking_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const booking_status = 'confirmed';

  try {
    // check no of guest
    if (booking_no_of_guest > 10) {
      return res.status(400).json({
        message: 'We’re sorry, but we can only accommodate a maximum of 10 guests for this booking. Please consider splitting your group into smaller bookings.'
      });
    }

    // Default time in minutes
    let slotTime = await getRestroSpendingTime(userId, booking_no_of_guest);

    // Calculate the end time
    const endTime = addMinutesToTime(booking_time, slotTime);
    const payment_mod = 'cod';

    // Insert booking
    const bookingResult = await new Promise((resolve, reject) => {
      db.query(insertBookingQuery, [userId, booking_name, booking_email, booking_no_of_guest, booking_date, booking_time, booking_comment, payment_mod, booking_status], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    const bookingId = bookingResult.insertId;

    // Insert connected items
    const connectedItems = await insertConnectedProducts(bookingId, items);

    const table_status = 'allocated';

    // Insert allocation for multiple tables
    const allocationData = await insertTableAllocations(bookingId, dining_area_id, table_ids, booking_date, start_time, endTime, slotTime, booking_no_of_guest, userId, table_status);

    // Respond with success message or relevant data
    res.json({
      message: "Booking inserted successfully",
      bookingId: bookingId,
      bookingItems: connectedItems,
      allocationData,
    });
  } catch (error) {
    console.error("Error inserting booking:", error);
    res.status(500).json({ error: 'Database error insert booking', details: error.message });
  }
};

// Function to insert multiple table allocations
const insertTableAllocations = (bookingId, dining_area_id, table_ids, booking_date, start_time, endTime, slot_time, no_of_guest, userId, table_status) => {
  return new Promise((resolve, reject) => {
    // Prepare allocation query for each table
    const allocationTableQuery = `
      INSERT INTO allocation_tables (booking_id, dining_area_id, table_id, booking_date, start_time, end_time, slot_time, no_of_guest, userId, table_status)
      VALUES ?
    `;

    // Prepare values for batch insert
    const values = table_ids.map(table_id => [
      bookingId,
      dining_area_id,
      table_id,
      booking_date,
      start_time,
      endTime,
      slot_time,
      no_of_guest,
      userId,
      table_status
    ]);

    // Execute the batch insert and return inserted rows
    db.query(allocationTableQuery, [values], (err, result) => {
      if (err) return reject(err);

      // Fetch the allocated tables info (for example, fetching back the allocation data)
      const fetchAllocatedTablesQuery = `SELECT allocation_id, table_id FROM allocation_tables WHERE booking_id = ?`;

      // Fetch the allocated table details after inserting
      db.query(fetchAllocatedTablesQuery, [bookingId], (err, tables) => {
        if (err) return reject(err);
        resolve(tables); // Return the allocated tables details
      });
    });
  });
};

// Function to insert connected products (unchanged)
const insertConnectedProducts = async (bookingId, items) => {
  try {
    if (!items || items.length === 0) {
      throw { status: 400, message: "No items provided for booking." };
    }

    const insertQuery = `
      INSERT INTO booking_connected_products (booking_id, master_item_id, product_quantity)
      VALUES ?
    `;

    const values = items.map(item => [bookingId, item.master_item_id, item.product_quantity]);

    const result = await new Promise((resolve, reject) => {
      db.query(insertQuery, [values], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return {
      message: `You have booked ${items.length} items. Thank you for choosing our service!`,
      total_items: items.length,
    };
  } catch (error) {
    throw { status: 500, message: "Failed to insert connected products", details: error.message };
  }
};

// get restorant spending time
function getRestroSpendingTime(userId, booking_no_of_guest) {
  return new Promise((resolve, reject) => {
    const restroTimeDurationQuery = `SELECT * FROM restro_guest_time_duration WHERE userId = ? AND restro_guest = ? LIMIT 1`;

    db.query(restroTimeDurationQuery, [userId, booking_no_of_guest], (err, result) => {
      if (err) {
        return reject("Failed to fetch time duration: " + err.message);  // Reject promise on error
      }

      if (result.length === 0) {
        return reject("No time duration found for the specified user and guest count.");  // Reject if no result
      }

      // Check if restro_spending_time is null
      const restroSpendingTime = result[0].restro_spending_time;
      if (restroSpendingTime === null) {
        return reject("Restro spending time is null for the specified user and guest count.");  // Reject if spending time is null
      }

      // Resolve with the spending time
      resolve(restroSpendingTime);  // Resolve the promise with the result
    });
  });
};


// time slot - get end time
function addMinutesToTime(booking_time, minutesToAdd) {
  // Split the booking_time into hours and minutes
  let [hours, minutes] = booking_time.split(':').map(Number);

  // Create a new Date object for today and set the hours and minutes
  let bookingDate = new Date();
  bookingDate.setHours(hours);
  bookingDate.setMinutes(minutes);

  // Add the specified number of minutes
  bookingDate.setMinutes(bookingDate.getMinutes() + minutesToAdd);

  // Format the new time back to "HH:mm"
  let newHours = bookingDate.getHours().toString().padStart(2, '0');
  let newMinutes = bookingDate.getMinutes().toString().padStart(2, '0');

  return `${newHours}:${newMinutes}`;
}

// ------------------------------------------------------------------------------------------------------------------

// Update booking payment status, received price, and billing amount
exports.updateBookingPayment = async (req, res) => {
  try {
    const userId = req.userId;
    const { booking_id, booking_status } = req.body;

    if (!booking_id) {
      return res.status(400).json({ message: 'booking_id is required' });
    }

    if (!booking_status || (booking_status !== 'completed' && booking_status !== 'cancelled')) {
      return res.status(400).json({ message: 'booking_status is required and must be either completed or cancelled' });
    }

    // Query to fetch allocated tables for a specific user
    const bookingQuery = `SELECT * FROM bookings WHERE userId = ? AND booking_id = ?`;
    const [bookingResult] = await db.promise().query(bookingQuery, [userId, booking_id]);

    if (bookingResult.length === 0) {
      return res.status(404).json({ error: 'No booking found for this user' });
    }

    // Proceed to update the payment status and booking status
    const updateQuery = `UPDATE bookings SET payment_status = ?, booking_status = ? WHERE booking_id = ? AND userId = ?`;
    const payment_status = 'paid';

    await db.promise().query(updateQuery, [payment_status, booking_status, booking_id, userId]);

    // Call function to update table allocations
    await updateTableAllocations(booking_id, userId);

    return res.status(200).json({ message: `Order ${booking_status} successfully` });
  } catch (err) {
    return res.status(500).json({ error: 'An error occurred', details: err.message });
  }
};

// Function to update multiple table allocations
const updateTableAllocations = (booking_id, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const table_status = 'released'; // Example status for tables

      // Prepare query to update table allocations
      const allocationTableQuery = `UPDATE allocation_tables SET table_status = ? WHERE booking_id = ? AND userId = ?`;

      // Execute the update query
      const [result] = await db.promise().query(allocationTableQuery, [table_status, booking_id, userId]);

      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
};

// --------------------------------------------------------------------------------------------------------------------
// Fetch menu items grouped by menu
exports.getMenuItemsGroupedByMenu = async (req, res) => {
  try {
    // SQL query to fetch menu items grouped by their corresponding menus
    const query = `
      SELECT menus.menu_name, menu_items.item_name, menu_items.price
      FROM menus
      JOIN menu_items ON menus.menu_id = menu_items.menu_id
      ORDER BY menus.menu_name;
    `;

    // Execute the query using a promise-based approach
    const [menuItems] = await db.promise().query(query);

    // Group the result by menu name
    const groupedMenuItems = menuItems.reduce((grouped, item) => {
      const { menu_name, item_name, price } = item;

      // If the menu name doesn't exist in the result, initialize it
      if (!grouped[menu_name]) {
        grouped[menu_name] = [];
      }

      // Push the item into the appropriate menu group
      grouped[menu_name].push({
        item_name,
        price,
      });

      return grouped;
    }, {});

    // Respond with the grouped menu items
    return res.status(200).json(groupedMenuItems);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch menu items', details: err.message });
  }
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












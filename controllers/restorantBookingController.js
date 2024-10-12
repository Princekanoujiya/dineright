const db = require('../config');

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
    INSERT INTO bookings (booking_name, booking_email, booking_no_of_guest, booking_date, booking_time, booking_comment, booking_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
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

    // Insert booking
    const bookingResult = await new Promise((resolve, reject) => {
      db.query(insertBookingQuery, [booking_name, booking_email, booking_no_of_guest, booking_date, booking_time, booking_comment, booking_status], (err, result) => {
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












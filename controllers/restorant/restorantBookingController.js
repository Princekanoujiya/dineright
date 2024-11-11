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
exports.getAllDiningAreaAndAllocatedTables = async (req, res) => {
  const userId = req.userId;
  const bookingDate = req.query.booking_date;

  if (!bookingDate) {
    return res.status(400).json({ message: 'booking_date is required' });
  }

  try {
    // Fetch all bookings for the user, sorted by booking date or ID
    const bookingQuery = `SELECT * FROM bookings WHERE userId = ? ORDER BY booking_date ASC`;
    const [bookings] = await db.promise().query(bookingQuery, [userId]);

    let diningAreaArray = [];

    for (const booking of bookings) {
      // Fetch allocated tables for each booking, sorted by table name or ID
      const allocatedTablesQuery = `
      SELECT 
        at.table_id, 
        at.dining_area_id, 
        at.table_name, 
        alct.no_of_guest, 
        alct.customer_id, 
        alct.start_time, 
        alct.slot_time
      FROM allocation_tables alct
      JOIN all_tables at ON at.table_id = alct.table_id
      WHERE alct.booking_id = ? 
        AND alct.booking_date = ? 
        AND alct.table_status = 'allocated' 
        AND at.userId = ? 
        AND at.is_deleted = 0
      ORDER BY at.table_name ASC`;

      const [allocatedTables] = await db.promise().query(allocatedTablesQuery, [booking.booking_id, bookingDate, userId]);

      // Fetch connected products for each booking, sorted by item name
      const bookingItemsQuery = `
      SELECT 
        mi.master_item_id, 
        mi.master_item_name,
        mi.master_item_image,
        bcp.product_quantity, 
        CONCAT(?, mi.master_item_image) AS master_item_image, 
        mi.master_item_price, 
        mi.master_item_description 
      FROM booking_connected_products bcp
      JOIN master_items mi ON mi.master_item_id = bcp.master_item_id
      WHERE bcp.booking_id = ?
      ORDER BY mi.master_item_name ASC`;

      const [bookingItems] = await db.promise().query(bookingItemsQuery, [process.env.BASE_URL, booking.booking_id]);

      // customer details
      const getCustomer = `SELECT * FROM customers WHERE customer_id = ?`;
      const [customers] = await db.promise().query(getCustomer, [booking.customer_id]);

      // Ensure the customer exists before accessing the profile image
      const customer_profile_image = customers.length > 0 ? process.env.BASE_URL + customers[0].customer_profile_image : null;

      // Map over the master item image to prepend BASE_URL to each file
      const updated_bookingItems = bookingItems.map(item => ({
        ...item,
        master_item_image: process.env.BASE_URL + item.master_item_image,
      }));


      // Append booking and item details to each table
      for (const table of allocatedTables) {
        table.booking_status = booking.booking_status;
        table.details = {
          booking_name: booking.booking_name,
          booking_email: booking.booking_email,
          customer_profile_image: customer_profile_image,
          menu: updated_bookingItems,
          billing_amount: booking.billing_amount,
          payment_status: booking.payment_status
        };
        diningAreaArray.push(table);
      }
    }

    res.json(diningAreaArray);
  } catch (error) {
    console.error('Error fetching dining areas and tables:', error);
    res.status(500).json({ message: 'Error fetching dining areas and tables', error });
  }
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

  const booking_status = 'upcomming';

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

// get Table available or not
exports.getTableAvailableOrNot = async (req, res) => {
  const { booking_no_of_guest, booking_date, booking_time, userId } = req.body;

  try {
    console.log(req.body);

    const serviceCheck = await getRestorauntServiceTimeAvaibility(booking_date, booking_time, userId, db);

    console.log('serviceCheck', serviceCheck)

    if (serviceCheck.isAvailable === false) {
      return res.status(200).json({ message: serviceCheck.message, response: false })
    }

    // Query to get the dining areas for the user
    const diningAreaQuery = `
      SELECT da.dining_area_id, da.dining_area_type
      FROM selected_dining_areas sda
      JOIN dining_areas da ON da.dining_area_id = sda.dining_area_id
      WHERE sda.userId = ?
    `;

    // Query to calculate total capacity of tables in a dining area
    const capacityQuery = `SELECT SUM(table_no_of_seats) AS total_capacity FROM all_tables WHERE dining_area_id = ? AND userId = ?`;

    // Query to get all allocated tables during the selected time and date
    const allocatedTablesQuery = `
      SELECT * FROM allocation_tables 
      WHERE table_status = 'allocated' 
      AND userId = ? 
      AND booking_date = ? 
      AND (start_time <= ? AND end_time > ?)
    `;

    // Query to get all available tables for the user
    const allTablesQuery = `SELECT * FROM all_tables WHERE userId = ? AND is_deleted = 0`;

    // Fetch dining areas associated with the user
    const [diningAreas] = await db.promise().query(diningAreaQuery, [userId]);

    let sufficientCapacity = false;
    let availableTables = [];

    for (const diningArea of diningAreas) {
      const [capacityResult] = await db.promise().query(capacityQuery, [diningArea.dining_area_id, userId]);

      // Get the total capacity for the dining area
      const totalCapacity = capacityResult[0]?.total_capacity || 0;

      // Check if the dining area has enough capacity
      if (totalCapacity >= booking_no_of_guest) {
        sufficientCapacity = true;
      }

      // Fetch all tables for the user
      const [allTables] = await db.promise().query(allTablesQuery, [userId]);

      for (const table of allTables) {
        const [allocatedTables] = await db.promise().query(allocatedTablesQuery, [
          userId,
          booking_date,
          booking_time,
          booking_time
        ]);

        // Check if the table is already allocated
        const isAllocated = allocatedTables.some(t => t.table_id === table.table_id);

        // If not allocated, add to the available list
        if (!isAllocated) {
          availableTables.push(table);
        }
      }
    }

    // If no dining areas have sufficient capacity
    if (!sufficientCapacity) {
      return res.json({ message: 'Sorry, no tables are available for the selected number of guests.', response: false });
    }

    // Calculate the total seating capacity of available tables
    const totalGuestsAvailable = availableTables.reduce((total, table) => total + table.table_no_of_seats, 0);

    if (totalGuestsAvailable < booking_no_of_guest) {
      return res.json({ message: 'Unfortunately, we do not have enough available tables for your reservation.', response: false });
    }

    // If sufficient tables are available
    return res.json({ message: 'Great news! We have enough tables available for your booking.', response: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Oops! Something went wrong while checking table availability. Please try again later.', error });
  }
};


// Customer spending Time get
async function getDefaultSpendingTime(db, booking_no_of_guest, userId) {
  let defaultSpendingTime = 180;

  // Query to get spending time for the specific number of guests and user ID
  const spendingTimeQuery = `SELECT restro_spending_time FROM restro_guest_time_duration WHERE restro_guest = ? AND userId = ?`;

  // Query to get all spending times for the specific user ID
  const allSpendingTimeQuery = `SELECT restro_spending_time FROM restro_guest_time_duration WHERE userId = ?`;

  try {
    // Execute the first query to find spending time for the specified number of guests
    const [spendingTime] = await db.promise().query(spendingTimeQuery, [booking_no_of_guest, userId]);

    if (spendingTime.length > 0) {
      // If specific spending time is found, use it
      defaultSpendingTime = spendingTime[0].restro_spending_time;
    } else {
      // If no specific spending time is found, query for all spending times for the user
      const [allSpendingTime] = await db.promise().query(allSpendingTimeQuery, [userId]);

      if (allSpendingTime.length > 0) {
        // Extract the restro_spending_time values and find the maximum
        const allTimes = allSpendingTime.map(row => row.restro_spending_time);
        defaultSpendingTime = Math.max(...allTimes);
      }
      // If no spending times are found, defaultSpendingTime remains 180
    }
  } catch (error) {
    console.error('Error fetching spending time:', error);
  }

  return defaultSpendingTime;
}

// get restaurant time avaibility
exports.getRestorauntServiceTimeAvaibility = async (req, res) => {
  try {
    const customer_id = req.customer_id;
    const { date, time, userId } = req.body;

    console.log(req.body);

    // Combine date and time into a JavaScript Date object in the UTC time zone
    const combinedDateTimeUTC = new Date(`${date}T${time}:00.000Z`);

    // Convert the combined UTC date and time into a time string formatted for comparison in SQL (HH:MM:SS)
    const utcTime = combinedDateTimeUTC.toISOString().slice(11, 19); // Extracts 'HH:MM:SS'

    // Get the day of the week as an index (0 for Sunday, 1 for Monday, etc.) in UTC
    const dayOfWeek = combinedDateTimeUTC.getUTCDay();

    // Convert JavaScript's getUTCDay() result (0-6) to your custom day_id (1-7)
    const customDayId = dayOfWeek === 0 ? 7 : dayOfWeek; // 0 for Sunday should map to 7 in your custom IDs

    // SQL query to fetch service times based on userId, status, and day_id
    const servicetimeQuery = `
      SELECT * 
      FROM service_time 
      WHERE userId = ? 
        AND status = 'open' 
        AND day_id = ? 
        AND (
          (start_time <= ? AND end_time > ?) OR            
          (start_time = ? AND end_time > ?) OR                
          (start_time <= ? AND end_time < start_time) OR     
          (? < end_time AND end_time < start_time)            
        )
    `;

    const [serviTimes] = await db.promise().query(servicetimeQuery, [
      userId,
      customDayId,
      utcTime, utcTime, // Case 1
      utcTime, utcTime, // Case 2
      utcTime,          // Case 3
      utcTime           // Case 4
    ]);

    // If no service times are found, return an appropriate message
    if (serviTimes.length === 0) {
      return res.status(200).json({ message: "Service not available during the selected time" });
    }

    // Respond with the fetched service times if available
    return res.status(200).json({ message: "Service available", serviTimes });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


// get restaurant time avaibility
const getRestorauntServiceTimeAvaibility = async (date, time, userId, db) => {
  try {

    // Combine date and time into a JavaScript Date object in the UTC time zone
    const combinedDateTimeUTC = new Date(`${date}T${time}:00.000Z`);

    // Convert the combined UTC date and time into a time string formatted for comparison in SQL (HH:MM:SS)
    const utcTime = combinedDateTimeUTC.toISOString().slice(11, 19); // Extracts 'HH:MM:SS'

    // Get the day of the week as an index (0 for Sunday, 1 for Monday, etc.) in UTC
    const dayOfWeek = combinedDateTimeUTC.getUTCDay();

    // Convert JavaScript's getUTCDay() result (0-6) to your custom day_id (1-7)
    const customDayId = dayOfWeek === 0 ? 7 : dayOfWeek; // 0 for Sunday should map to 7 in your custom IDs

    // SQL query to fetch service times based on userId, status, and day_id
    const servicetimeQuery = `
      SELECT * 
      FROM service_time 
      WHERE userId = ? 
        AND status = 'open' 
        AND day_id = ? 
        AND (
          (start_time <= ? AND end_time > ?) OR            
          (start_time = ? AND end_time > ?) OR                
          (start_time <= ? AND end_time < start_time) OR     
          (? < end_time AND end_time < start_time)            
        )
    `;

    const [serviTimes] = await db.promise().query(servicetimeQuery, [
      userId,
      customDayId,
      utcTime, utcTime, // Case 1
      utcTime, utcTime, // Case 2
      utcTime,          // Case 3
      utcTime           // Case 4
    ]);

    // If no service times are found, return an appropriate message
    if (serviTimes.length === 0) {
      return { message: "Service not available during the selected time", isAvailable: false };
    }

    // Respond with the fetched service times if available
    return { message: "Service available", isAvailable: true, serviTimes };

  } catch (error) {
    return { message: error.message };
  }
};

























const db = require('../config');
const { razorPayCreateOrder } = require('./razorpayController');


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

// 
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

// Function that wraps the db.query inside a Promise
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

// External function to retrieve selected dining areas (now using async/await)
const getSelectedDiningArea = (userId) => {
  return new Promise((resolve, reject) => {
    const selectedDiningAreaQuery = `SELECT * FROM selected_dining_areas WHERE userId = ?`;

    // Execute the query to retrieve selected dining areas
    db.query(selectedDiningAreaQuery, [userId], (err, result) => {
      if (err) {
        return reject(err);  // Reject the promise with an error
      }

      if (result.length === 0) {
        return resolve({ message: 'No dining areas found for this user.' });  // Resolve with message if no areas found
      }

      resolve(result);  // Resolve with the result
    });
  });
};


// External function to retrieve selected dining areas (now using async/await)
const getTables = (diningAreaId, userId) => {
  return new Promise((resolve, reject) => {
    const selectedDiningAreaQuery = `SELECT * FROM all_tables WHERE dining_area_id = ? AND userId = ?`;

    // Execute the query to retrieve selected dining areas
    db.query(selectedDiningAreaQuery, [diningAreaId, userId], (err, result) => {
      if (err) {
        return reject(err);  // Reject the promise with an error
      }

      if (result.length === 0) {
        return resolve({ message: 'No dining areas found for this user.' });  // Resolve with message if no areas found
      }

      resolve(result);  // Resolve with the result
    });
  });
};

// calculate booking Items price
async function calculateTotalItemCost(items) {
  try {
    let itemCost = 0;
    const itemValues = items.map(item => item.master_item_id);

    // SQL query to fetch items by their master_item_id
    const itemsQuery = `SELECT * FROM master_items WHERE master_item_id IN (?)`;

    // Promisify db.query to use it with async/await
    const fetchItems = (query, values) => {
      return new Promise((resolve, reject) => {
        db.query(query, [values], (err, result) => {
          if (err) {
            return reject({ status: 500, message: "Failed to fetch item details", details: err.message });
          }
          resolve(result);
        });
      });
    };

    // Fetch item details from the database
    const itemResult = await fetchItems(itemsQuery, itemValues);

    // Calculate total cost
    itemResult.forEach(item => {
      const orderedItem = items.find(i => i.master_item_id === item.master_item_id);
      if (orderedItem) {
        itemCost += parseInt(orderedItem.product_quantity) * parseFloat(item.master_item_price);
      }
    });

    // Log or return the calculated item cost
    console.log("Total Item Cost: ", itemCost);
    return itemCost;

  } catch (error) {
    console.error("Error calculating item cost:", error);
    throw error;
  }
}

// book product
exports.book_product = async (req, res) => {
  const { userId, booking_date, booking_time, booking_no_of_guest, payment_mod, items } = req.body;
  const customer_id = req.customer_id; // this is coming from auth

  try {
    // check body data
    if (!userId || userId === '' || userId === undefined) {
      return res.status(400).json({ message: 'userId required' })
    }
    if (!booking_date || booking_date === '' || booking_date === undefined) {
      return res.status(400).json({ message: 'booking_date required' })
    }
    if (!booking_time || booking_time === '' || booking_time === undefined) {
      return res.status(400).json({ message: 'booking_time required' })
    }
    if (!booking_no_of_guest || booking_no_of_guest === '' || booking_no_of_guest === undefined) {
      return res.status(400).json({ message: 'booking_no_of_guest required' })
    }
    if (!payment_mod || payment_mod === '' || payment_mod === undefined) {
      return res.status(400).json({ message: 'Payment_mod required' })
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'items required' })
    }

    let defaultSpendingTime = 180;
    // Query to get spending time based on the number of guests and user ID
    const spendingTimeQuery = `SELECT restro_spending_time FROM restro_guest_time_duration WHERE restro_guest = ? AND userId = ?`;

    // Query to get all spending times for a specific user ID
    const allSpendingTimeQuery = `SELECT restro_spending_time FROM restro_guest_time_duration WHERE userId = ?`;

    // First query to find spending time for the specified number of guests
    const [spendingTime] = await db.promise().query(spendingTimeQuery, [booking_no_of_guest, userId]);

    if (spendingTime.length > 0) {
      // If specific spending time is found, use it
      defaultSpendingTime = spendingTime[0].restro_spending_time;
    } else {
      // If no specific spending time is found, query for all spending times
      const [allSpendingTime] = await db.promise().query(allSpendingTimeQuery, [userId]);

      if (allSpendingTime.length > 0) {
        // Extract the `restro_spending_time` values and find the maximum
        const allTimes = allSpendingTime.map(row => row.restro_spending_time);
        defaultSpendingTime = Math.max(...allTimes);
      } else {
        // If no data is found, set default to 180
        defaultSpendingTime = 180;
      }
    }

    const restroSpendingTime = defaultSpendingTime;

    // Calculate the end time
    const endTime = addMinutesToTime(booking_time, defaultSpendingTime);

    // Get restaurant dining areas
    const diningAreas = await getSelectedDiningArea(userId);
    let availableTables = [];

    // Iterate through dining areas and find available tables
    for (const diningArea of diningAreas) {
      const tables = await getTables(diningArea.dining_area_id, userId);

      // Check each table's allocation asynchronously
      const tableDataPromises = tables.map((table) => {
        return new Promise((resolve, reject) => {
          const allocatedTablesQuery = `SELECT * FROM allocation_tables WHERE table_status = 'allocated' AND booking_date = ? AND (start_time <= ? AND end_time > ?)`;

          // Query to check for allocated tables
          db.query(allocatedTablesQuery, [booking_date, booking_time, booking_time], (err, result) => {
            if (err) {
              return reject(err); // Handle the error by rejecting the promise
            }

            // Check if the current table is not allocated by comparing it with the result
            const isTableAllocated = result.some((allocatedTable) => allocatedTable.table_id === table.table_id);
            resolve(isTableAllocated ? null : table); // Resolve with table or null
          });
        });
      });

      // Wait for all table queries to finish and filter out null values
      const availableDiningAreaTables = (await Promise.all(tableDataPromises)).filter((table) => table !== null);
      availableTables = availableTables.concat(availableDiningAreaTables);
    }

    // Calculate the total number of seats
    const totalSeats = availableTables.reduce((total, table) => total + table.table_no_of_seats, 0);

    if (totalSeats < booking_no_of_guest) {
      return res.status(400).json({ message: 'Oops! It looks like all tables are currently occupied. Would you like to join our waiting list?' });
    }

    const billingAmount = await calculateTotalItemCost(items);

    // Insert new booking
    const bookingQuery = `
      INSERT INTO bookings (userId, customer_id, booking_name, booking_email, booking_date, booking_time, booking_no_of_guest, billing_amount, payment_mod) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const bookingResult = await new Promise((resolve, reject) => {
      db.query(bookingQuery, [userId, customer_id, req.customer_name, req.customer_email, booking_date, booking_time, booking_no_of_guest, billingAmount, payment_mod], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    const bookingId = bookingResult.insertId;

    // Call this in your booking function where you insert connected products
    const bookingItems = await insertConnectedProducts(bookingId, items, booking_no_of_guest, res);


    // Allocate tables for the booking
    let allocationData = [];
    let bookingSeats = booking_no_of_guest;
    const sortedTables = availableTables.sort((a, b) => a.table_no_of_seats - b.table_no_of_seats);

    for (const table of sortedTables) {
      if (bookingSeats > 0) {
        const currentTableSeats = table.table_no_of_seats;

        try {
          const table_id = table.table_id;  // Get the corresponding table
          const dining_area_id = table.dining_area_id;  // Get the dining area
          const start_time = booking_time;
          const slot_time = restroSpendingTime;

          const allocationTableQuery = `
            INSERT INTO allocation_tables (booking_id, dining_area_id, table_id, booking_date, start_time, end_time, slot_time, no_of_guest, notes, customer_id, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          // Insert allocation
          const allocationResult = await new Promise((resolve, reject) => {
            db.query(allocationTableQuery, [bookingId, dining_area_id, table_id, booking_date, start_time, endTime, slot_time, currentTableSeats, "", customer_id, userId], (err, result) => {
              if (err) return reject(err);
              resolve(result);
            });
          });

          // Push the allocation data into the array
          allocationData.push({
            allocation_id: allocationResult.insertId,
            table_id: table_id
          });

          // Decrease the remaining bookingSeats
          bookingSeats -= currentTableSeats;

        } catch (err) {
          return res.status(500).json({ error: err.message });
        }
      }
    }

    // Check if all required seats are allocated
    if (bookingSeats > 0) {
      return res.status(400).json({ message: 'Not enough seating available for the entire booking.' });
    }

    // payment mod
    if (payment_mod === 'online') {
      // razorpay order create
      const razorpayOrderData = {
        amount: billingAmount,
        name: req.customer_name,
        phone: '',
        email: req.customer_email,
      }
      const razorpayOrderResult = await razorPayCreateOrder(razorpayOrderData);

      // Update the booking status to 'confirmed'
      const updateBookingStatusQuery = `UPDATE bookings SET razorpay_order_id = ? WHERE booking_id = ?`;

      await new Promise((resolve, reject) => {
        db.query(updateBookingStatusQuery, [razorpayOrderResult.id, bookingId], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

      return res.status(200).json({ message: 'Your order has been successfully placed!', bookingItems, allocationData, order: razorpayOrderResult });

    } else if (payment_mod === 'cod') {
      // Update the booking status to 'confirmed'
      const updateBookingStatusQuery = `UPDATE bookings SET booking_status = 'confirmed' WHERE booking_id = ?`;

      await new Promise((resolve, reject) => {
        db.query(updateBookingStatusQuery, [bookingId], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

      // Update the allocate table status to 'allocated' for all rows matching the booking_id
      const updateItemsStatusQuery = `UPDATE allocation_tables SET table_status = 'allocated' WHERE booking_id = ?`;

      await new Promise((resolve, reject) => {
        db.query(updateItemsStatusQuery, [bookingId], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

      await new Promise((resolve, reject) => {
        db.query(updateItemsStatusQuery, [bookingId], (err, result) => {
          if (err) return reject(err);
          resolve(result); // This will update all rows where booking_id matches
        });
      });

      return res.status(200).json({ message: 'Your order has been successfully placed!', bookingItems, allocationData });
    } else {
      return res.json({ message: 'Payment mod required' })
    }

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


// Function to insert connected products
const insertConnectedProducts = (bookingId, items, booking_no_of_guest) => {
  return new Promise((resolve, reject) => {
    // Check if items are valid
    if (!items || items.length === 0) {
      return reject({ status: 400, message: "No items provided for booking." });
    }

    const insertQuery = `
      INSERT INTO booking_connected_products (booking_id, master_item_id, product_quantity)
      VALUES ?
    `;

    // Prepare values for batch insert
    const values = items.map(item => [bookingId, item.master_item_id, item.product_quantity]);

    // Execute the insert query
    db.query(insertQuery, [values], (err, result) => {
      if (err) {
        return reject({ status: 500, message: "Failed to insert connected products", details: err.message });
      }

      resolve({
        message: `You have booked ${items.length} items. Thank you for choosing our service!`,
        total_items: items.length,
      });
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






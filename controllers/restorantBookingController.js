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

  if(!bookingDate){
    return res.status(400).json({message: 'booking_date is required'})
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



// Async function to fetch dining area capacity
async function diningAreaCapacity(diningAreaId, userId) {
  return new Promise((resolve, reject) => {
    // Query to fetch all tables for the given dining area and user
    const allTablesQuery = `SELECT table_no_of_seats FROM all_tables WHERE dining_area_id = ? AND userId = ?`;

    db.query(allTablesQuery, [diningAreaId, userId], (err, tables) => {
      if (err) {
        return reject({ error: 'Database error fetching allocated tables', details: err.message });
      }

      // Sum up the seating capacity for all tables in the dining area
      const totalCapacity = tables.reduce((total, table) => total + table.table_no_of_seats, 0);

      // Resolve the promise with the total capacity
      resolve(totalCapacity);
    });
  });
}











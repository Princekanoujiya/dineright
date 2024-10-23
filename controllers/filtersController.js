const db = require('../config');

exports.getRestaurantType = (req, res) => {
  const query = `
    SELECT * FROM restaurant_types
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: "Failed to retrieve restaurant types", details: err.message ,response:false});
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: "No restaurant types found" ,response:false});
    }

    res.status(200).json({ success_msg: true, data: results ,response:true});
  });
};

exports.getCuisines = (req, res) => {
  const query = `
    SELECT * FROM cuisines
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: "Failed to retrieve cuisines", details: err.message ,response:false});
    }

    if (results.length === 0) {
      return res.status(200).json({ error_msg: "No cuisines found",response:false });
    }

    res.status(200).json({ success_msg: true, data: results,response:true });
  });
};

// exports.getUserIdsByFilters = (req, res) => {
//   const { cuisine_ids, restaurant_type_ids } = req.body;

//   if (!cuisine_ids || !restaurant_type_ids) {
//     return res.status(200).json({ error_msg: "Both cuisine_ids and restaurant_type_ids are required" });
//   }

//   // Query to select userId based on multiple cuisine_ids
//   const cuisineQuery = `
//     SELECT DISTINCT userId 
//     FROM selected_cuisines 
//     WHERE cuisine_id IN (${cuisine_ids.map(() => '?').join(',')})
//   `;

//   // Query to select userId based on multiple restaurant_type_ids
//   const restaurantTypeQuery = `
//     SELECT DISTINCT userId 
//     FROM selected_restaurant_types 
//     WHERE restaurant_type_id IN (${restaurant_type_ids.map(() => '?').join(',')})
//   `;

//   // Execute both queries
//   db.query(cuisineQuery, cuisine_ids, (err, cuisineResults) => {
//     if (err) {
//       return res.status(500).json({
//         error_msg: "Failed to retrieve userIds from selected_cuisines",
//         details: err.message,
//       });
//     }

//     db.query(restaurantTypeQuery, restaurant_type_ids, (err, restaurantTypeResults) => {
//       if (err) {
//         return res.status(500).json({
//           error_msg: "Failed to retrieve userIds from selected_restaurant_types",
//           details: err.message,
//           response:false,
//         });
//       }

//       // Combine userIds from both results
//       const cuisineUserIds = cuisineResults.map(row => row.userId);
//       const restaurantTypeUserIds = restaurantTypeResults.map(row => row.userId);

//       // Find the intersection of userIds from both cuisine and restaurant types (if needed)
//       const commonUserIds = cuisineUserIds.filter(userId => restaurantTypeUserIds.includes(userId));

//       if (commonUserIds.length === 0) {
//         return res.status(404).json({ error_msg: "No matching users found for the given filters" });
//       }

//       // Return the common userIds
//       res.status(200).json({ success_msg: true, data: commonUserIds ,response:true});
//     });
//   });
// };

exports.getUserIdsByFilters = (req, res) => {
  const { cuisine_ids, restaurant_type_ids } = req.body;

  if (!cuisine_ids || !restaurant_type_ids) {
    return res.status(200).json({ error_msg: "Both cuisine_ids and restaurant_type_ids are required",response:false });
  }

  // Query to select userId based on multiple cuisine_ids
  const cuisineQuery = `
    SELECT DISTINCT userId 
    FROM selected_cuisines 
    WHERE cuisine_id IN (${cuisine_ids.map(() => '?').join(',')})
  `;

  // Query to select userId based on multiple restaurant_type_ids
  const restaurantTypeQuery = `
    SELECT DISTINCT userId 
    FROM selected_restaurant_types 
    WHERE restaurant_type_id IN (${restaurant_type_ids.map(() => '?').join(',')})
  `;

  // Execute both queries
  db.query(cuisineQuery, cuisine_ids, (err, cuisineResults) => {
    if (err) {
      return res.status(500).json({
        error_msg: "Failed to retrieve userIds from selected_cuisines",
        details: err.message,
      });
    }

    db.query(restaurantTypeQuery, restaurant_type_ids, (err, restaurantTypeResults) => {
      if (err) {
        return res.status(500).json({
          error_msg: "Failed to retrieve userIds from selected_restaurant_types",
          details: err.message,
          response: false,
        });
      }

      // Combine userIds from both results
      const cuisineUserIds = cuisineResults.map(row => row.userId);
      const restaurantTypeUserIds = restaurantTypeResults.map(row => row.userId);

      // Find the intersection of userIds from both cuisine and restaurant types
      const commonUserIds = cuisineUserIds.filter(userId => restaurantTypeUserIds.includes(userId));

      if (commonUserIds.length === 0) {
        return res.status(404).json({ error_msg: "No matching users found for the given filters",response:false });
      }

      // Query to fetch all data from users based on common userIds
      const usersQuery = `
        SELECT * 
        FROM users 
        WHERE id IN (${commonUserIds.map(() => '?').join(',')})
      `;

      db.query(usersQuery, commonUserIds, (err, usersResults) => {
        if (err) {
          return res.status(500).json({
            error_msg: "Failed to retrieve user data from users table",
            details: err.message,
            response: false,
          });
        }

        // Return the users data
        res.status(200).json({ success_msg: true, data: usersResults, response: true });
      });
    });
  });
};



const db = require('../config');

exports.getRestaurantType = (req, res) => {
  const query = `
    SELECT * FROM restaurant_types
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Failed to retrieve restaurant types", details: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "No restaurant types found" });
    }

    res.status(200).json({ success: true, data: results });
  });
};
exports.getCuisines = (req, res) => {
  const query = `
    SELECT * FROM cuisines
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Failed to retrieve cuisines", details: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "No cuisines found" });
    }

    res.status(200).json({ success: true, data: results });
  });
};




  
  
  
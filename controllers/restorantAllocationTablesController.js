const db = require('../config');


exports.getAllocatedTables = (req, res) => {
  const { userId } = req.body;

  const query = `SELECT * FROM allocation_tables `

//   const query = `
//     SELECT mi.master_item_id, mi.master_item_name, mi.master_item_price, 
//            mi.master_item_description, mi.master_item_image, bil.menu_id
//     FROM master_items mi
//     LEFT JOIN menu_item_linking bil 
//       ON mi.master_item_id = bil.master_item_id AND bil.userId = ?
//     WHERE bil.menu_id IS NOT NULL AND bil.is_deleted = 0
//     `;

  db.query(getQuery, [userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error fetching Menu items', details: err.message ,response:false});
    }

    if (result.length === 0) {
      return res.status(200).json({ error_msg: 'No items found for this user' ,response:false});
    }

    res.status(200).json({ data: result ,response:true,success_msg:true});
  });
};






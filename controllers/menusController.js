const db = require('../config');

exports.createOrUpdateMenu = (req, res) => {
  const { menu_id, menu_name } = req.body;

  // Validate menu_name
  if (!menu_name) {
    return res.status(200).json({ error_msg: "Menu name is required" ,response:false});
  }

  if (menu_id) {
    // If menu_id is provided, update the existing menu
    const updateQuery = 'UPDATE menus SET menu_name = ? WHERE menu_id = ?';
    db.query(updateQuery, [menu_name, menu_id], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: "Failed to update menu", details: err.message,response:false });
      }
      if (result.affectedRows === 0) {
        return res.status(200).json({ error_msg: "Menu not found" ,response:false});
      }
      return res.json({ success_msg: "Menu updated successfully", menu_id ,response:true});
    });
  } else {
    // If menu_id is not provided, create a new menu
    const insertQuery = 'INSERT INTO menus (menu_name) VALUES (?)';
    db.query(insertQuery, [menu_name], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: "Failed to create menu", details: err.message ,response:false});
      }
      return res.status(201).json({ success_msg: "Menu created successfully", menu_id: result.insertId ,response:true});
    });
  }
};
exports.getMenu = (req, res) => {
  const { menu_id } = req.params;

  if (!menu_id) {
    // If no menu_id is provided, return all menus
    const query = 'SELECT * FROM menus WHERE is_deleted = 0';
    db.query(query, (err, results) => {
      if (err) return res.status(200).json({ error_msg: err.message ,response:false});
      res.json(results);
    });
  } else {
    // If menu_id is provided, return specific menu
    const query = 'SELECT * FROM menus WHERE menu_id = ? AND is_deleted = 0';
    db.query(query, [menu_id], (err, result) => {
      if (err) return res.status(200).json({ error_msg: err.message ,response:false});
      if (result.length === 0) {
        return res.status(200).json({ error_msg: "Menu not found" ,response:false});
      }
      res.json(result[0]);
    });
  }
};
exports.DeleteMenu = (req, res) => {
    const { menu_id } = req.params;
  
    // Validate course_id
    if (!menu_id) {
      return res.status(200).json({ error_msg: "Menu ID is required" ,response:false});
    }
  
    const DeleteQuery = 'UPDATE menus SET is_deleted = 1 WHERE menu_id = ?';
    db.query(DeleteQuery, [menu_id], (err, result) => {
      if (err) return res.status(200).json({ error_msg: err.message,response:false });
      if (result.affectedRows === 0) {
        return res.status(200).json({ error_msg: "Menu not found",response:false });
      }
      res.json({ success_msg: "Menu Deleted successfully" , menu_id,response:true});
    });
};
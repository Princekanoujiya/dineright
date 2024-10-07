const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for image upload, storing images in 'uploads/menu_items/menu_id/'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = `uploads/menu_items/${req.body.menu_id}`;
    // Create the directory if it does not exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage }).single('menu_item_image');

// Insert or Update a menu item
exports.createOrUpdateMenuItem = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ error: 'Multer error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Error uploading file', details: err.message });
    }

    const { menu_item_id, menu_id, menu_item_name, menu_item_price, menu_item_description } = req.body;
    const menu_item_image = req.file ? req.file.filename : null;

    if (menu_item_id) {
      // Update menu item if menu_item_id is provided
      const updateQuery = `UPDATE menu_items 
                           SET menu_item_name = ?, menu_item_price = ?, menu_item_description = ?, menu_item_image = ? 
                           WHERE menu_item_id = ?`;
      db.query(updateQuery, [menu_item_name, menu_item_price, menu_item_description, menu_item_image, menu_item_id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error during update', details: err.message });
        if (result.affectedRows === 0) {
          return res.status(404).json({ error_msg: "Menu item not found" });
        }
        res.status(200).json({ message: 'Menu item updated successfully', menu_item_id });
      });
    } else {
      // Insert new menu item if menu_item_id is not provided
      const insertQuery = `INSERT INTO menu_items (menu_id, menu_item_name, menu_item_price, menu_item_description, menu_item_image) 
                           VALUES (?, ?, ?, ?, ?)`;
      db.query(insertQuery, [menu_id, menu_item_name, menu_item_price, menu_item_description, menu_item_image], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error during insertion', details: err.message });
        res.status(201).json({ message: 'Menu item created successfully', menu_item_id: result.insertId });
      });
    }
  });
};

// Get menu item(s)
exports.getMenuItem = (req, res) => {
  const { menu_item_id } = req.params;

  if (!menu_item_id) {
    // If no menu_id is provided, return all menus
    const query = 'SELECT * FROM menu_items ';
    db.query(query, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
  } else {
    // If menu_id is provided, return specific menu
    const query = 'SELECT * FROM menu_items WHERE menu_item_id = ? ';
    db.query(query, [menu_item_id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.length === 0) {
        return res.status(404).json({ error_msg: "Menu not found" });
      }
      res.json(result[0]);
    });
  }
};
// Delete a menu item
exports.deleteMenuItem = (req, res) => {
  const { menu_item_id } = req.params;

  if (!menu_item_id) {
    return res.status(400).json({ error_msg: "Menu item ID is required" });
  }

  // First, fetch the menu item to check if it exists and get the image path
  const selectQuery = 'SELECT menu_item_image FROM menu_items WHERE menu_item_id = ?';
  db.query(selectQuery, [menu_item_id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error during selection', details: err.message });

    if (result.length === 0) {
      return res.status(404).json({ error_msg: "Menu item not found" });
    }

    const imagePath = `uploads/menu_items/${menu_item_id}/${result[0].menu_item_image}`;

    // Delete the menu item from the database
    const deleteQuery = 'DELETE FROM menu_items WHERE menu_item_id = ?';
    db.query(deleteQuery, [menu_item_id], (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error during deletion', details: err.message });

      // Check if any rows were affected (i.e., the item was deleted)
      if (result.affectedRows === 0) {
        return res.status(404).json({ error_msg: "Menu item not found" });
      }

      // Optionally, delete the image file from the server if it exists
      fs.unlink(imagePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          // Ignore error if file doesn't exist, but log any other error
          console.error(`Failed to delete image file: ${imagePath}`, err);
        }
      });
      res.json({ success_msg: "Menu item deleted successfully" });
    });
  });
};
// Soft delete a menu item (mark as deleted by updating 'is_deleted' field)
exports.softDeleteMenuItem = (req, res) => {
  const { menu_item_id } = req.params;

  if (!menu_item_id) {
    return res.status(400).json({ error_msg: "Menu item ID is required" });
  }

  // Check if the menu item exists
  const selectQuery = 'SELECT * FROM menu_items WHERE menu_item_id = ? AND is_deleted = 0';
  db.query(selectQuery, [menu_item_id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error during selection', details: err.message });

    if (result.length === 0) {
      return res.status(404).json({ error_msg: "Menu item not found or already deleted" });
    }

    // Soft delete: update the 'is_deleted' field to 1
    const updateQuery = 'UPDATE menu_items SET is_deleted = 1 WHERE menu_item_id = ?';
    db.query(updateQuery, [menu_item_id], (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error during update', details: err.message });

      res.json({ success_msg: "Menu item soft deleted successfully" });
    });
  });
};

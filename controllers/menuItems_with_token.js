const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { response } = require('express');

// Multer setup for image upload, storing images in 'uploads/menu_items/userId/'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = `uploads/menu_items_with_token/${req.userId}`;
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
exports.insertOrUpdateMenuItem = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(200).json({ error_msg: 'Multer error', details: err.message, response: false });
    } else if (err) {
      return res.status(200).json({ error_msg: 'Error uploading file', details: err.message, response: false });
    }

    const { menu_item_id, course_menu_linking_id, menu_item_name, menu_item_price, menu_item_description } = req.body;
    const menu_item_image = req.file ? req.file.filename : null;
    const userId = req.userId;

    if (menu_item_id) {
      // Update operation
      const updateQuery = `
        UPDATE menu_items 
        SET course_menu_linking_id = ?, menu_item_name = ?, menu_item_price = ?, menu_item_description = ?, menu_item_image = ?
        WHERE menu_item_id = ? AND userId = ?`;

      // Fetch the existing image before updating (to delete if necessary)
      const getImageQuery = 'SELECT menu_item_image FROM menu_items WHERE menu_item_id = ?';
      db.query(getImageQuery, [menu_item_id], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error fetching existing image', details: err.message, response: false });
        }

        const oldImage = result[0]?.menu_item_image;

        db.query(updateQuery, [course_menu_linking_id, menu_item_name, menu_item_price, menu_item_description, menu_item_image || oldImage, menu_item_id, userId], (err) => {
          if (err) {
            return res.status(200).json({ error_msg: 'Database error during update', details: err.message, response: false });
          }

          // If a new image is uploaded, delete the old image
          if (req.file && oldImage && oldImage !== menu_item_image) {
            const oldImagePath = `uploads/menu_items_with_token/${userId}/${oldImage}`;
            fs.unlink(oldImagePath, (err) => {
              if (err) {
                console.warn('Warning: Failed to delete old image', err.message);
              }
            });
          }

          res.status(200).json({ success_msg: 'Menu item updated successfully', menu_item_id, response: true });
        });
      });

    } else {
      // Insert operation
      const insertQuery = `
        INSERT INTO menu_items (userId, course_menu_linking_id, menu_item_name, menu_item_price, menu_item_description, menu_item_image) 
        VALUES (?, ?, ?, ?, ?, ?)`;

      db.query(insertQuery, [userId, course_menu_linking_id, menu_item_name, menu_item_price, menu_item_description, menu_item_image], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
        }

        const newMenuItemId = result.insertId;
        res.status(201).json({ success_msg: 'Menu item created successfully', menu_item_id: newMenuItemId, response: true });
      });
    }
  });
};

exports.getMenuItems = (req, res) => {
  const userId = req.userId; // Assuming `req.userId` is set from the authentication middleware

  // Log the userId being used in the query for debugging
  console.log("Request userId:", userId);

  const query = `SELECT * FROM menu_items WHERE userId = ?`;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Database error_msg:", err); // Log the error details
      return res.status(200).json({ error_msg: 'Database error during retrieval', details: err.message, response: false });
    }

    // Log the results to verify what the database returns
    console.log("Query results:", results);

    if (results.length === 0) {
      console.log("No menu items found for this user");
      return res.status(200).json({ error_msg: 'No menu items found for this user', response: false });
    }

    // If results are found, log and return all menu items
    console.log("Menu items found:", results);
    res.status(200).json({ menu_items: results, response: true, success_msg: true });
  });
};

exports.getMenuItemsbyId = async (req, res) => {
  try {
    const userId = req.userId;
    const { menuId } = req.params; // Correct destructuring

    const menuQuery = `SELECT * FROM menus WHERE menu_id = ?`;
    const [menuResults] = await db.promise().query(menuQuery, [menuId]); // Get the first element from the array

    if (menuResults.length === 0) {
      return res.status(404).json({ message: "Menu not found" }); // Handle no menu found
    }

    const menu = menuResults[0]; // Extract the first menu item from the array

    const menuItemQuery = `SELECT mi.* FROM menu_item_linking mil
      JOIN master_items mi ON mil.master_item_id = mi.master_item_id AND mil.userId = mi.userId
      WHERE mil.menu_id = ? AND mil.userId = ? AND mil.is_deleted = 0`;
      
    const [menuItems] = await db.promise().query(menuItemQuery, [menuId, userId]);

    // Update master_item_image for each menu item
    const updatedMenuItems = menuItems.map(item => ({
      ...item,
      master_item_image: process.env.BASE_URL + item.master_item_image
    }));

    // Attach the menu items to the menu object
    menu.menu_items = updatedMenuItems;

    res.status(200).json(menu); // Send the menu data

  } catch (error) {
    res.status(500).json({ error: error.message }); // Send the error message for better debugging
  }
};



exports.deleteMenuItem = (req, res) => {
  const { menu_item_id } = req.params;

  // First, check if the menu_item_id exists
  const checkQuery = `SELECT * FROM menu_items WHERE menu_item_id = ? AND userId = ?`;
  db.query(checkQuery, [menu_item_id, req.userId], (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error during check', details: err.message, response: false });
    }
    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'Menu item not found', response: false });
    }

    // Update the is_deleted flag to 1 instead of deleting the record
    const updateQuery = `UPDATE menu_items SET is_deleted = 1 WHERE menu_item_id = ? AND userId = ?`;
    db.query(updateQuery, [menu_item_id, req.userId], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error during update', details: err.message, response: false });
      }
      if (result.affectedRows === 0) {
        return res.status(200).json({ error_msg: 'Menu item not found or not updated', response: false });
      }
      res.status(200).json({ success_msg: 'Menu item marked as deleted successfully', response: true });
    });
  });
};

exports.getActiveMenuItems = (req, res) => {
  const query = `SELECT * FROM menu_items WHERE AND userId = ?`;

  db.query(query, [req.userId], (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error during retrieval', details: err.message, response: false });
    }
    res.status(200).json(results);
  });
};




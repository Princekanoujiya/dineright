const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


exports.getCourseMenu = (req, res) => {
  const query = `
    SELECT menus.menu_id, menus.menu_name, courses.course_name, course_menu_static_linking.*
    FROM course_menu_static_linking
    JOIN menus ON course_menu_static_linking.menu_id = menus.menu_id
    JOIN courses ON course_menu_static_linking.course_id = courses.course_id
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};



exports.getCourseMenuGroupByCourseId = (req, res) => {
  const query = `
    SELECT menus.menu_id, menus.menu_name, courses.course_id, courses.course_name
    FROM course_menu_static_linking
    JOIN menus ON course_menu_static_linking.menu_id = menus.menu_id
    JOIN courses ON course_menu_static_linking.course_id = courses.course_id
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Group results by course_id
    const groupedByCourseId = results.reduce((acc, item) => {
      // Check if the course_id already exists in the accumulator
      if (!acc[item.course_id]) {
        // If not, create a new entry for this course_id
        acc[item.course_id] = {
          course_id: item.course_id,
          course_name: item.course_name,
          menus: []
        };
      }

      // Push the current item (menu details) into the 'menus' array of the relevant course_id
      acc[item.course_id].menus.push({
        menu_id: item.menu_id,
        menu_name: item.menu_name,
        id: item.id
      });

      return acc;
    }, {});

    // Convert the result back to an array if you need it in array format
    const resultArray = Object.values(groupedByCourseId);

    // Send the response as grouped data
    res.json(resultArray);
  });
};




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
  
  const upload = multer({ storage: storage }).single('master_item_image');
  
  // Insert or Update a menu item
  exports.insertMasterMenuItem = (req, res) => {
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(500).json({ error: 'Multer error', details: err.message });
      } else if (err) {
        return res.status(500).json({ error: 'Error uploading file', details: err.message });
      }
  
      const { master_item_id, master_item_name, master_item_price, master_item_description, menu_id } = req.body; // Add menu_id from req.body
      const master_item_image = req.file ? req.file.filename : null;
      const userId = req.userId;
  
      if (master_item_id) {
        // Update operation
        const updateQuery = `
          UPDATE master_items 
          SET master_item_name = ?, master_item_price = ?, master_item_description = ?, master_item_image = ?
          WHERE master_item_id = ? AND userId = ?`;
  
        // Fetch the existing image before updating (to delete if necessary)
        const getImageQuery = 'SELECT master_item_image FROM master_items WHERE master_item_id = ?';
        db.query(getImageQuery, [master_item_id], (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Database error fetching existing image', details: err.message });
          }
  
          const oldImage = result[0]?.master_item_image;
  
          db.query(updateQuery, [master_item_name, master_item_price, master_item_description, master_item_image || oldImage, master_item_id, userId], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Database error during update', details: err.message });
            }
  
            // If a new image is uploaded, delete the old image
            if (req.file && oldImage && oldImage !== master_item_image) {
              const oldImagePath = `uploads/menu_items_with_token/${userId}/${oldImage}`;
              fs.unlink(oldImagePath, (err) => {
                if (err) {
                  console.warn('Warning: Failed to delete old image', err.message);
                }
              });
            }
  
            // After updating, insert or update the record in the menu_item_linking table
            const linkQuery = `
              INSERT INTO menu_item_linking (userId, master_item_id, menu_id) 
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE master_item_id = ?, menu_id = ?`; // Update both master_item_id and menu_id
  
            db.query(linkQuery, [userId, master_item_id, menu_id, master_item_id, menu_id], (err) => {
              if (err) {
                return res.status(500).json({ error: 'Database error linking menu item', details: err.message });
              }
  
              res.status(200).json({ message: 'Menu item updated successfully', master_item_id });
            });
          });
        });
  
      } else {
        // Insert operation
        const insertQuery = `
          INSERT INTO master_items (userId, master_item_name, master_item_price, master_item_description, master_item_image) 
          VALUES (?, ?, ?, ?, ?)`;
  
        db.query(insertQuery, [userId, master_item_name, master_item_price, master_item_description, master_item_image], (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Database error during insertion', details: err.message });
          }
  
          const newMasterItemId = result.insertId;
  
          // After inserting, insert into the menu_item_linking table with the menu_id
          const linkQuery = `
            INSERT INTO menu_item_linking (userId, master_item_id, menu_id) 
            VALUES (?, ?, ?)`;
  
          db.query(linkQuery, [userId, newMasterItemId, menu_id], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Database error linking menu item', details: err.message });
            }
  
            res.status(201).json({ message: 'Menu item created successfully', master_item_id: newMasterItemId });
          });
        });
      }
    });
  };
  exports.getMasterMenuItems = (req, res) => {
    const userId = req.userId;
  
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
  exports.deleteMasterMenuItem = (req, res) => {
    const { master_item_id, menu_id } = req.body; // Expect both master_item_id and menu_id from the request body
    const userId = req.userId;
  
    console.log(`Deleting menu item with master_item_id: ${master_item_id}, menu_id: ${menu_id}, userId: ${userId}`);
  
    // Check if the item exists and is not already deleted
    const checkQuery = `
      SELECT is_deleted 
      FROM menu_item_linking 
      WHERE master_item_id = ? AND menu_id = ? AND userId = ?`;
  
    db.query(checkQuery, [master_item_id, menu_id, userId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error checking item', details: err.message });
      }
  
      console.log('Result from check query:', result);
  
      if (result.length === 0) {
        return res.status(404).json({ error: 'Menu item not found' });
      }
  
      if (result[0].is_deleted === 1) {
        return res.status(400).json({ error: 'Menu item already deleted' });
      }
  
      // Proceed with the soft delete
      const updateQuery = `
        UPDATE menu_item_linking 
        SET is_deleted = 1
        WHERE master_item_id = ? AND menu_id = ? AND userId = ?`;
  
      db.query(updateQuery, [master_item_id, menu_id, userId], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error updating is_deleted flag', details: err.message });
        }
  
        res.status(200).json({ message: 'Menu item deleted successfully', master_item_id });
      });
    });
  };
  
  
  
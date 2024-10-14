const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { response } = require('express');


exports.getCourseMenu = (req, res) => {
  const query = `
    SELECT menus.menu_id, menus.menu_name, courses.course_name, course_menu_static_linking.*
    FROM course_menu_static_linking
    JOIN menus ON course_menu_static_linking.menu_id = menus.menu_id
    JOIN courses ON course_menu_static_linking.course_id = courses.course_id
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(200).json({ error_msg: err.message, response: false });
    res.json(results);
  });
};


// exports.getCourseMenuGroupByCourseId = async (req, res) => {
//   const query = `
//     SELECT m.menu_id, m.menu_name, c.course_id, c.course_name
//     FROM course_menu_static_linking cml
//     JOIN menus m ON cml.menu_id = m.menu_id
//     JOIN courses c ON cml.course_id = c.course_id
//   `;

//   db.query(query, (err, results) => {
//     if (err) {
//       return res.status(200).json({ error_msg: err.message, response: false });
//     }

//     // Group results by course_id
//     const groupedByCourseId = results.reduce((acc, item) => {
//       // Check if the course_id already exists in the accumulator
//       if (!acc[item.course_id]) {
//         // If not, create a new entry for this course_id
//         acc[item.course_id] = {
//           course_id: item.course_id,
//           course_name: item.course_name,
//           menus: []
//         };
//       }

//       // Push the current item (menu details) into the 'menus' array of the relevant course_id
//       acc[item.course_id].menus.push({
//         menu_id: item.menu_id,
//         menu_name: item.menu_name,
//       });

//       const menuItemsQuery = `SELECT * FROM menu_item_linking WHERE menu_id = ? AND userId = ?`;

//       for(const menu of acc[item.course_id].menus){

//         const menuItems = await db.promise().query(menuItemsQuery, [menu_id, userId]);

//         acc[item.course_id].menus.menu_items.push(menuItems)

//       }




//       return acc;
//     }, {});

//     // Convert the result back to an array if you need it in array format
//     const resultArray = Object.values(groupedByCourseId);

//     res.status(200).json({
//       success_msg: 'Course menu details retrieved successfully',
//       response: true,
//       data: resultArray
//     });
//   });
// };

// 2
exports.getCourseMenuGroupByCourseId = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `SELECT course_id, course_name FROM courses`;

    const [courses] = await db.promise().query(query); // Use promise-based query


    let courseArray = [];
    for (const course of courses) {

      const menuQuery = `
      SELECT  m.menu_id, m.menu_name
      FROM course_menu_static_linking cml
      JOIN menus m ON cml.menu_id = m.menu_id
      WHERE cml.course_id = ?
    `;

      const [menus] = await db.promise().query(menuQuery, [course.course_id]); // Use promise-based query


      // menu items
      let menuItemArray = [];
      for (const menu of menus) {

        const itemQuery = `
      SELECT  mi.*
      FROM menu_item_linking mil
      JOIN master_items mi ON mil.master_item_id = mi.master_item_id
      WHERE mil.menu_id = ?
    `;

        const [items] = await db.promise().query(itemQuery, [menu.menu_id, userId]); // Use promise-based query

        menu.menu_items = items;
        menuItemArray.push(menu);
      }

      course.menus = menus;

      courseArray.push(course);

    }



    res.status(200).json({
      success_msg: 'Course menu details retrieved successfully',
      response: true,
      data: courseArray
    });
  } catch (err) {
    res.status(500).json({ error_msg: err.message, response: false });
  }
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
      return res.status(200).json({ error_msg: 'Multer error', details: err.message, response: false });
    } else if (err) {
      return res.status(200).json({ error_msg: 'Error uploading file', details: err.message, response: false });
    }

    const { master_item_id, master_item_name, master_item_price, master_item_description, menu_id } = req.body; // Add menu_id from req.body
    const master_item_image = req.file ? `/uploads/menu_items_with_token/${req.userId}/${req.file.filename}` : null;
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
          return res.status(200).json({ error_msg: 'Database error fetching existing image', details: err.message });
        }

        const oldImage = result[0]?.master_item_image;

        db.query(updateQuery, [master_item_name, master_item_price, master_item_description, master_item_image || oldImage, master_item_id, userId], (err) => {
          if (err) {
            return res.status(200).json({ error_msg: 'Database error during update', details: err.message, response: false });
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
              return res.status(200).json({ error_msg: 'Database error linking menu item', details: err.message, response: false });
            }

            res.status(200).json({ success_msg: 'Menu item updated successfully', master_item_id, response: true });
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
          return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
        }

        const newMasterItemId = result.insertId;

        // After inserting, insert into the menu_item_linking table with the menu_id
        const linkQuery = `
            INSERT INTO menu_item_linking (userId, master_item_id, menu_id) 
            VALUES (?, ?, ?)`;

        db.query(linkQuery, [userId, newMasterItemId, menu_id], (err) => {
          if (err) {
            return res.status(200).json({ error_msg: 'Database error linking menu item', details: err.message, response: false });
          }

          res.status(201).json({ success_msg: 'Menu item created successfully', master_item_id: newMasterItemId, response: true });
        });
      });
    }
  });
};


exports.getMasterMenuItems = async (req, res) => {
  try {
    const userId = req.userId;

    const menusQuery = `SELECT * FROM menus`;

    const [menus] = await db.promise().query(menusQuery);

    let menuArray = [];
    for (const menu of menus) {

      const menuItemsQuery = `
    SELECT mi.* FROM menu_item_linking mil
     JOIN master_items mi ON mil.master_item_id = mi.master_item_id AND mil.userId = mi.userId
     WHERE mil.menu_id = ? AND mil.userId = ? 
     `;

      const [menuItems] = await db.promise().query(menuItemsQuery, [menu.menu_id, userId]);

      // Update master_item_image for each menu item
      const updatedMenuItems = menuItems.map(item => {
        return {
          ...item,
          master_item_image: process.env.BASE_URL + item.master_item_image
        };
      });

      menu.menu_items = updatedMenuItems;
      menuArray.push(menu);
    }

    res.status(200).json(menus)
  } catch (error) {
    res.status(500).json(error)
  }
};


exports.getAllMasterMenus = async (req, res) => {
  try {
    const menusQuery = 'SELECT menu_id, menu_name FROM menus';

    const [menus] = await db.promise().query(menusQuery);

    res.status(200).json({
      success: true,
      data: menus,
    });
  } catch (error) {
    console.error('Error fetching menus:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve menus',
      error: error.message, // Include more detail about the error for better debugging
    });
  }
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
      return res.status(200).json({ error_msg: 'Database error checking item', details: err.message, response: false });
    }

    console.log('Result from check query:', result);

    if (result.length === 0) {
      return res.status(200).json({ error_msg: 'Menu item not found', response: false });
    }

    if (result[0].is_deleted === 1) {
      return res.status(200).json({ error_msg: 'Menu item already deleted', response: false });
    }

    // Proceed with the soft delete
    const updateQuery = `
        UPDATE menu_item_linking 
        SET is_deleted = 1
        WHERE master_item_id = ? AND menu_id = ? AND userId = ?`;

    db.query(updateQuery, [master_item_id, menu_id, userId], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error updating is_deleted flag', details: err.message, response: false });
      }

      res.status(200).json({ success_msg: 'Menu item deleted successfully', master_item_id, response: true });
    });
  });
};



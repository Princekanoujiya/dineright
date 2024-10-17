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
// exports.getCourseMenuGroupByCourseId = async (req, res) => {
//   try {
//     const userId = req.userId;

//     const query = `SELECT course_id, course_name FROM courses WHERE course_status = 'Yes'`;
//     const [courses] = await db.promise().query(query);

//     let courseArray = [];
//     for (const course of courses) {

//       const menuQuery = `
//       SELECT m.menu_id, m.menu_name
//       FROM course_menu_static_linking cmsl
//       JOIN menus m ON cmsl.menu_id = m.menu_id
//       WHERE cmsl.course_id = ? AND m.is_deleted = 0
//     `;

//       const [menus] = await db.promise().query(menuQuery, [course.course_id]);

//       // menu items
//       let menuItemArray = [];
//       for (const menu of menus) {

//         const itemQuery = `
//       SELECT mi.*
//       FROM menu_item_linking mil
//       JOIN master_items mi ON mi.master_item_id = mil.master_item_id
//       WHERE mil.menu_id = ? AND mil.userId = ? AND mil.is_deleted = 0
//     `;

//         const [items] = await db.promise().query(itemQuery, [menu.menu_id, userId]);

//         // Assuming each item in 'items' has a 'master_item_image' property
//         if (items.length > 0) {
//           items.forEach(item => {
//             item.master_item_image = process.env.BASE_URL + item.master_item_image;
//           });
//         }



//         menu.menu_items = items;
//         menuItemArray.push(menu);
//       }

//       const beverage = await beverageAndItems(userId);

//       menuItemArray.push(beverage);

//       course.menus = menus;
//       courseArray.push(course);
//     }

//     res.status(200).json({
//       userId,
//       success_msg: 'Course menu details retrieved successfully',
//       response: true,
//       data: courseArray
//     });
//   } catch (err) {
//     res.status(500).json({ error_msg: err.message, response: false });
//   }
// };

// // function to get all beverage and items
// async function beverageAndItems(userId) {
//   // Query to get all beverages
//   const beverageQuery = `SELECT * FROM beverages`;

//   try {
//     // Get all beverages
//     const [beverages] = await db.promise().query(beverageQuery);

//     let beverageArray = [];

//     // Loop through each beverage and fetch its associated items
//     for (const beverage of beverages) {
//       const beverageItemQuery = `
//         SELECT mi.*
//         FROM beverages_item_linking bil
//         JOIN master_items mi ON mi.master_item_id = bil.master_item_id
//         WHERE bil.beverage_id = ? AND bil.userId = ? AND bil.is_deleted = 0
//       `;

//       // Fetch items linked to the current beverage
//       const [items] = await db.promise().query(beverageItemQuery, [beverage.beverage_id, userId]);

//       // Append the base URL to each item's image if available
//       if (items.length > 0) {
//         items.forEach(item => {
//           item.master_item_image = item.master_item_image ? process.env.BASE_URL + item.master_item_image : null;
//         });
//       }

//       // Attach the items to the beverage object
//       beverage.beverage_items = items;

//       // Push the modified beverage object into the array
//       beverageArray.push(beverage);
//     }

//     // Return the array of beverages with their associated items
//     return beverageArray;

//   } catch (err) {
//     console.error('Error fetching beverage items:', err.message);
//     throw new Error('Database error fetching beverage items');
//   }
// }

//course, menu, menu items and beverage
exports.getCourseMenuGroupByCourseId = async (req, res) => {
  try {
    const userId = req.userId;

    // Query to get all courses where course_status is 'Yes'
    const query = `SELECT course_id, course_name FROM courses WHERE course_status = 'Yes'`;
    const [courses] = await db.promise().query(query);

    let courseArray = [];

    // Loop through each course to get its associated menus
    for (const course of courses) {
      const menuQuery = `
        SELECT m.menu_id, m.menu_name
        FROM course_menu_static_linking cmsl
        JOIN menus m ON cmsl.menu_id = m.menu_id
        WHERE cmsl.course_id = ? AND m.is_deleted = 0
      `;

      const [menus] = await db.promise().query(menuQuery, [course.course_id]);

      let menuItemArray = [];

      // Loop through each menu to get its associated items
      for (const menu of menus) {
        const itemQuery = `
          SELECT mi.*
          FROM menu_item_linking mil
          JOIN master_items mi ON mi.master_item_id = mil.master_item_id
          WHERE mil.menu_id = ? AND mil.userId = ? AND mil.is_deleted = 0
        `;

        const [items] = await db.promise().query(itemQuery, [menu.menu_id, userId]);

        // Append base URL to each item's image if available
        if (items.length > 0) {
          items.forEach(item => {
            item.master_item_image = item.master_item_image ? process.env.BASE_URL + item.master_item_image : null;
          });
        }

        // Attach items to the menu object
        menu.menu_items = items;
        menuItemArray.push(menu);
      }

      // Attach menus (including beverages) to the course object
      course.menus = menuItemArray;

      // Add the course object to the final array
      courseArray.push(course);
    }

    // Send success response with course array
    res.status(200).json({
      userId,
      success_msg: 'Course menu details retrieved successfully',
      response: true,
      data: courseArray
    });

  } catch (err) {
    // Handle any errors that occur during execution
    res.status(500).json({ error_msg: err.message, response: false });
  }
};

// Function to get all beverages and their associated items
exports.getBeverageAndItems = async (req, res) => {
  try {
    const userId = req.userId; // Extract userId from the request (ensure req.user is available)

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Fetch all beverages
    const beverageQuery = `SELECT * FROM beverages`;
    const [beverages] = await db.promise().query(beverageQuery);

    let beverageArray = [];

    // Loop through each beverage to fetch associated items
    for (const beverage of beverages) {
      const beverageItemQuery = `
        SELECT mi.*
        FROM beverages_item_linking bil
        JOIN master_items mi ON mi.master_item_id = bil.master_item_id
        WHERE bil.beverage_id = ? AND bil.userId = ? AND bil.is_deleted = 0
      `;

      const [items] = await db.promise().query(beverageItemQuery, [beverage.beverage_id, userId]);

      // Append the base URL to each item's image if available
      items.forEach(item => {
        item.master_item_image = item.master_item_image ? process.env.BASE_URL + item.master_item_image : null;
      });

      // Attach items to the beverage object
      beverage.beverage_items = items;

      // Push the beverage object into the beverage array
      beverageArray.push(beverage);
    }

    const obj = {
      menu_id: 6,
      menu_name: "Beverages",
      created_at: "2024-09-27T06:07:00.000Z",
      updated_at: "2024-09-27T06:07:00.000Z",
      is_deleted: 0,
      menu_items: beverageArray,
    }


    // Send the array of beverages with their associated items as the response
    return res.json(obj);

  } catch (err) {
    console.error('Error fetching beverage items:', err.message);
    return res.status(500).json({ error: 'Database error fetching beverage items' });
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
      return res.status(400).json({ error_msg: 'Multer error', details: err.message, response: false });
    } else if (err) {
      return res.status(400).json({ error_msg: 'Error uploading file', details: err.message, response: false });
    }

    const { master_item_id, master_item_name, master_item_price, master_item_description, menu_id } = req.body;
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
          return res.status(500).json({ error_msg: 'Database error fetching existing image', details: err.message });
        }

        const oldImage = result[0]?.master_item_image;

        db.query(updateQuery, [master_item_name, master_item_price, master_item_description, master_item_image || oldImage, master_item_id, userId], (err) => {
          if (err) {
            return res.status(500).json({ error_msg: 'Database error during update', details: err.message, response: false });
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

          res.status(200).json({ success_msg: 'Menu item updated successfully', master_item_id, response: true });
        });
      });
    } else {
      // Insert operation
      const insertQuery = `
        INSERT INTO master_items (userId, master_item_name, master_item_price, master_item_description, master_item_image) 
        VALUES (?, ?, ?, ?, ?)`;

      db.query(insertQuery, [userId, master_item_name, master_item_price, master_item_description, master_item_image], (err, result) => {
        if (err) {
          return res.status(500).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
        }

        const newMasterItemId = result.insertId;

        // After inserting, insert into the menu_item_linking table with the menu_id
        const linkQuery = `
          INSERT INTO menu_item_linking (userId, master_item_id, menu_id) 
          VALUES (?, ?, ?)`;

        db.query(linkQuery, [userId, newMasterItemId, menu_id], (err) => {
          if (err) {
            return res.status(500).json({ error_msg: 'Database error linking menu item', details: err.message, response: false });
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
     WHERE mil.menu_id = ? AND mil.userId = ? AND is_deleted = 0
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
  const { master_item_id } = req.params; // Expect both master_item_id and menu_id from the request body
  const userId = req.userId;

  // Check if the item exists and is not already deleted
  const checkQuery = `
      SELECT is_deleted 
      FROM menu_item_linking 
      WHERE master_item_id = ? AND userId = ?`;

  db.query(checkQuery, [master_item_id, userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error checking item', details: err.message, response: false });
    }

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
        WHERE master_item_id = ? AND userId = ?`;

    db.query(updateQuery, [master_item_id, userId], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error updating is_deleted flag', details: err.message, response: false });
      }

      res.status(200).json({ success_msg: 'Menu item deleted successfully', master_item_id, response: true });
    });
  });
};


// getMasterMenuItemsDetails
exports.getMasterMenuItemsDetails = async (req, res) => {
  try {
    const { master_item_id } = req.params;
    const userId = req.userId;

    // Validation: Ensure required params are present
    if (!master_item_id || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
      });
    }

    const menuItemsQuery = `
      SELECT mil.menu_id, mi.* 
      FROM menu_item_linking mil
      JOIN master_items mi ON mil.master_item_id = mi.master_item_id AND mil.userId = mi.userId
      WHERE mil.master_item_id = ? AND mil.userId = ? AND mil.is_deleted = 0
    `;

    const [items] = await db.promise().query(menuItemsQuery, [master_item_id, userId]);

    if (items.length > 0) {
      items[0].master_item_image = process.env.BASE_URL + items[0].master_item_image;
    }

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('Error fetching item:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve item',
      error: error.message,
    });
  }
};

// getMasterBeverageItemsDetails
exports.getMasterBeverageItemsDetails = async (req, res) => {
  try {
    const { master_item_id } = req.params;
    const userId = req.userId;

    // Validation: Ensure required params are present
    if (!master_item_id || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
      });
    }

    const menuItemsQuery = `
      SELECT bil.beverage_id, mi.* 
      FROM beverages_item_linking bil
      JOIN master_items mi ON bil.master_item_id = mi.master_item_id AND bil.userId = mi.userId
      WHERE bil.master_item_id = ? AND bil.userId = ? AND bil.is_deleted = 0
    `;

    const [items] = await db.promise().query(menuItemsQuery, [master_item_id, userId]);

    if (items.length > 0) {
      items[0].master_item_image = process.env.BASE_URL + items[0].master_item_image;
    }

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('Error fetching item:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve item',
      error: error.message,
    });
  }
};



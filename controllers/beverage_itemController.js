const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = `uploads/menu_items_with_token/${req.userId}`;
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

// insert and update Baverage items
exports.insertMasterBeverageItem = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error_msg: 'Multer error', details: err.message, response: false });
    } else if (err) {
      return res.status(400).json({ error_msg: 'Error uploading file', details: err.message, response: false });
    }

    const { master_item_id, master_item_name, master_item_price, master_item_description, beverage_id } = req.body;
    const master_item_image = req.file ? `/uploads/menu_items_with_token/${req.userId}/${req.file.filename}` : null;
    const userId = req.userId;

    if (master_item_id) {
      // Update existing master item
      const updateQuery = `
        UPDATE master_items 
        SET master_item_name = ?, master_item_price = ?, master_item_description = ?, master_item_image = ?
        WHERE master_item_id = ? AND userId = ?`;

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

          // If a new image is uploaded, delete the old one
          if (req.file && oldImage && oldImage !== master_item_image) {
            const oldImagePath = `./uploads/menu_items_with_token/${userId}/${oldImage}`;
            fs.unlink(oldImagePath, (err) => {
              if (err) {
                console.warn('Warning: Failed to delete old image', err.message);
              }
            });
          }

          res.status(200).json({ success_msg: 'Beverage item updated successfully', master_item_id, response: true });
        });
      });

    } else {
      // Insert a new master item
      const insertQuery = `
        INSERT INTO master_items (userId, master_item_name, master_item_price, master_item_description, master_item_image) 
        VALUES (?, ?, ?, ?, ?)`;

      db.query(insertQuery, [userId, master_item_name, master_item_price, master_item_description, master_item_image], (err, result) => {
        if (err) {
          return res.status(500).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
        }

        const newMasterItemId = result.insertId;

        // Insert into beverages_item_linking table with beverage_id
        const linkQuery = `
          INSERT INTO beverages_item_linking (userId, master_item_id, beverage_id) 
          VALUES (?, ?, ?)`;

        db.query(linkQuery, [userId, newMasterItemId, beverage_id], (err) => {
          if (err) {
            return res.status(500).json({ error_msg: 'Database error linking beverage item', details: err.message, response: false });
          }

          res.status(201).json({ success_msg: 'Beverage item created successfully', master_item_id: newMasterItemId, response: true });
        });
      });
    }
  });
};


// get all Beverages
exports.getAllBeverages = async (req, res) => {
  try {
    const beverageQuery = `SELECT * FROM beverages`;

    const [beverages] = await db.promise().query(beverageQuery);

    if (beverages.length === 0) {
      return res.status(404).json({ message: 'No beverages found' });
    }

    res.status(200).json(beverages);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


// get all Beverages and beverageItems
exports.getMasterBeverageItems = async (req, res) => {
  try {
    const userId = req.userId;

    // Query all beverages
    const beverageQuery = `SELECT * FROM beverages`;
    const [beverages] = await db.promise().query(beverageQuery);

    let beverageArray = [];
    for (const beverage of beverages) {
      // Query menu items linked to the beverage
      const menuItemsQuery = `
        SELECT mi.* FROM beverages_item_linking bil
        JOIN master_items mi ON bil.master_item_id = mi.master_item_id AND bil.userId = mi.userId
        WHERE bil.beverage_id = ? AND bil.userId = ? AND is_deleted = 0
      `;

      const [beverageItems] = await db.promise().query(menuItemsQuery, [beverage.beverage_id, userId]);

      // Update master_item_image for each menu item
      const updatedBeverageItems = beverageItems.map(item => ({
        ...item,
        master_item_image: process.env.BASE_URL + item.master_item_image
      }));

      // Attach the beverage items to each beverage
      beverage.beverage_items = updatedBeverageItems;
      beverageArray.push(beverage);
    }

    // Send the array with beverages and their items
    res.status(200).json(beverageArray);
  } catch (error) {
    // Send an error response with detailed message
    res.status(500).json({ error: error.message });
  }
};

// get beverage_items by beverage_id
exports.getBeverageItemsbyId = async (req, res) => {
  try {
    const userId = req.userId;
    const { beverageId } = req.params; // Correct destructuring

    const beverageQuery = `SELECT * FROM beverages WHERE beverage_id = ?`;
    const [beverageResults] = await db.promise().query(beverageQuery, [beverageId]); // Get the first element from the array

    if (beverageResults.length === 0) {
      return res.status(404).json({ message: "Beverage not found" }); // Handle no menu found
    }

    const beverage = beverageResults[0]; // Extract the first menu item from the array

    const beverageItemsQuery = `SELECT mi.* FROM beverages_item_linking bil
      JOIN master_items mi ON bil.master_item_id = mi.master_item_id AND bil.userId = mi.userId
      WHERE bil.beverage_id = ? AND bil.userId = ? AND bil.is_deleted = 0`;
      
    const [beverageItems] = await db.promise().query(beverageItemsQuery, [beverageId, userId]);

    // Update master_item_image for each menu item
    const updatedBeverageItems = beverageItems.map(item => ({
      ...item,
      master_item_image: process.env.BASE_URL + item.master_item_image
    }));

    // Attach the beverage items to each beverage
    beverage.beverage_items = updatedBeverageItems;

    res.status(200).json(beverage); // Send the menu data

  } catch (error) {
    res.status(500).json({ error: error.message }); // Send the error message for better debugging
  }
};


exports.deleteMasterBeverageItem = (req, res) => {
  const { master_item_id } = req.params; // Expect both master_item_id and menu_id from the request body
  const userId = req.userId;

  // Check if the item exists and is not already deleted
  const checkQuery = `
    SELECT is_deleted 
    FROM beverages_item_linking 
    WHERE master_item_id = ? AND userId = ?`;

  db.query(checkQuery, [master_item_id, userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error checking item', details: err.message, respone: false });
    }

    console.log('Result from check query:', result);

    if (result.length === 0) {
      return res.status(200).json({ error_msg: 'Menu item not found', respone: false });
    }

    if (result[0].is_deleted === 1) {
      return res.status(200).json({ error_msg: 'Menu item already deleted', respone: false });
    }

    // Proceed with the soft delete
    const updateQuery = `
      UPDATE beverages_item_linking 
      SET is_deleted = 1
      WHERE master_item_id = ? AND userId = ?`;

    db.query(updateQuery, [master_item_id, userId], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error updating is_deleted flag', details: err.message, respone: false });
      }

      res.status(200).json({ success_msg: 'Menu item deleted successfully', master_item_id, respone: true });
    });
  });
};

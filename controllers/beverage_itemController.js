const db = require('../config');
const path = require('path');
const fs = require('fs');
const { uploadFile, updateFile } = require('../utils/multer/attachments');

// insert and update Baverage items
exports.insertMasterBeverageItem = async (req, res) => {
  const { master_item_id, master_item_name, master_item_price, master_item_description, beverage_id } = req.body;
  const userId = req.userId;

  try {
    if (master_item_id) {
      // Update existing master item
      let masterItemImage = null;

      // Fetch existing image path if a new file is uploaded
      if (req.file) {
        const getImageQuery = 'SELECT master_item_image FROM master_items WHERE master_item_id = ?';
        const [existingImageResult] = await db.promise().query(getImageQuery, [master_item_id]);

        const oldImage = existingImageResult.length > 0 ? existingImageResult[0].master_item_image : null;
        const uploadedFile = await updateFile(req.file, `menu_items_with_token/${userId}`, oldImage);
        masterItemImage = uploadedFile.newFileName;
      }

      // SQL query to update the item details
      const updateQuery = `
        UPDATE master_items 
        SET master_item_name = ?, master_item_price = ?, master_item_description = ?, master_item_image = COALESCE(?, master_item_image)
        WHERE master_item_id = ? AND userId = ?`;

      await db.promise().query(updateQuery, [
        master_item_name, 
        master_item_price, 
        master_item_description, 
        masterItemImage, 
        master_item_id, 
        userId
      ]);

      return res.status(200).json({ success_msg: 'Beverage item updated successfully', master_item_id, response: true });
    } else {
      // Insert a new master item
      let uploadedFile = null;
      if (req.file) {
        uploadedFile = await uploadFile(req.file, `menu_items_with_token/${userId}`);
      }

      const insertQuery = `
        INSERT INTO master_items (userId, master_item_name, master_item_price, master_item_description, master_item_image) 
        VALUES (?, ?, ?, ?, ?)`;

      const [insertResult] = await db.promise().query(insertQuery, [
        userId, 
        master_item_name, 
        master_item_price, 
        master_item_description, 
        uploadedFile ? uploadedFile.newFileName : null
      ]);

      const newMasterItemId = insertResult.insertId;

      // Insert into beverages_item_linking table with beverage_id
      const linkQuery = `
        INSERT INTO beverages_item_linking (userId, master_item_id, beverage_id) 
        VALUES (?, ?, ?)`;

      await db.promise().query(linkQuery, [userId, newMasterItemId, beverage_id]);

      return res.status(201).json({ success_msg: 'Beverage item created successfully', master_item_id: newMasterItemId, response: true });
    }
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error_msg: 'Database error occurred', details: err.message, response: false });
  }
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

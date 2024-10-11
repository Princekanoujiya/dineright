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


exports.insertMasterBeverageItem = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(200).json({ error_msg: 'Multer error', details: err.message ,respone:false});
    } else if (err) {
      return res.status(200).json({ error_msg: 'Error uploading file', details: err.message,respone:false });
    }

    const { master_item_id, master_item_name, master_item_price, master_item_description, beverage_id } = req.body;
    const master_item_image = req.file ? req.file.filename : null;
    const userId = req.userId;

    if (master_item_id) {
     
      const updateQuery = `
        UPDATE master_items 
        SET master_item_name = ?, master_item_price = ?, master_item_description = ?, master_item_image = ?
        WHERE master_item_id = ? AND userId = ?`;

      const getImageQuery = 'SELECT master_item_image FROM master_items WHERE master_item_id = ?';
      db.query(getImageQuery, [master_item_id], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error fetching existing image', details: err.message });
        }

        const oldImage = result[0]?.master_item_image;

        db.query(updateQuery, [master_item_name, master_item_price, master_item_description, master_item_image || oldImage, master_item_id, userId], (err) => {
          if (err) {
            return res.status(200).json({ error_msg: 'Database error during update', details: err.message ,respone:false});
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

          // After updating, insert or update the record in the beverages_item_linking table with beverage_id
          const linkQuery = `
            INSERT INTO beverages_item_linking (userId, master_item_id, beverage_id) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE master_item_id = ?, beverage_id = ?`;

          db.query(linkQuery, [userId, master_item_id, beverage_id, master_item_id, beverage_id], (err) => {
            if (err) {
              return res.status(200).json({ error_msg: 'Database error linking menu item', details: err.message,respone:false });
            }

            res.status(200).json({ success_msg: 'Beverage item updated successfully', master_item_id ,respone:true});
          });
        });
      });

    } else {
 
      const insertQuery = `
        INSERT INTO master_items (userId, master_item_name, master_item_price, master_item_description, master_item_image) 
        VALUES (?, ?, ?, ?, ?)`;

      db.query(insertQuery, [userId, master_item_name, master_item_price, master_item_description, master_item_image], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message,respone:false });
        }

        const newMasterItemId = result.insertId;

        // After inserting, insert into the beverages_item_linking table with beverage_id
        const linkQuery = `
          INSERT INTO beverages_item_linking (userId, master_item_id, beverage_id) 
          VALUES (?, ?, ?)`;

        db.query(linkQuery, [userId, newMasterItemId, beverage_id], (err) => {
          if (err) {
            return res.status(200).json({ error_msg: 'Database error linking menu item', details: err.message,respone:false });
          }

          res.status(201).json({ success_msg: 'Beverage item created successfully', master_item_id: newMasterItemId ,respone:true});
        });
      });
    }
  });
};

exports.getMasterBeverageItems = (req, res) => {
  const userId = req.userId;

  const getQuery = `
    SELECT mi.master_item_id, mi.master_item_name, mi.master_item_price, 
           mi.master_item_description, mi.master_item_image, bil.beverage_id
    FROM master_items mi
    LEFT JOIN beverages_item_linking bil 
      ON mi.master_item_id = bil.master_item_id AND bil.userId = ?
    WHERE bil.beverage_id IS NOT NULL AND bil.is_deleted = 0
   `;

  db.query(getQuery, [userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error fetching beverage items', details: err.message ,respone:false});
    }

    if (result.length === 0) {
      return res.status(200).json({ error_msg: 'No items found for this user',respone:false });
    }

    res.status(200).json({ data: result ,respone:true,success_msg:'success'});
  });
};

exports.deleteMasterBeverageItem = (req, res) => {
  const { master_item_id, beverage_id } = req.body; // Expect both master_item_id and menu_id from the request body
  const userId = req.userId;

  console.log(`Deleting menu item with master_item_id: ${master_item_id}, beverage_id: ${beverage_id}, userId: ${userId}`);

  // Check if the item exists and is not already deleted
  const checkQuery = `
    SELECT is_deleted 
    FROM beverages_item_linking 
    WHERE master_item_id = ? AND beverage_id = ? AND userId = ?`;

  db.query(checkQuery, [master_item_id, beverage_id, userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error checking item', details: err.message ,respone:false});
    }

    console.log('Result from check query:', result);

    if (result.length === 0) {
      return res.status(200).json({ error_msg: 'Menu item not found' ,respone:false});
    }

    if (result[0].is_deleted === 1) {
      return res.status(200).json({ error_msg: 'Menu item already deleted',respone:false });
    }

    // Proceed with the soft delete
    const updateQuery = `
      UPDATE beverages_item_linking 
      SET is_deleted = 1
      WHERE master_item_id = ? AND beverage_id = ? AND userId = ?`;

    db.query(updateQuery, [master_item_id, beverage_id, userId], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error updating is_deleted flag', details: err.message ,respone:false});
      }

      res.status(200).json({ success_msg: 'Menu item deleted successfully', master_item_id ,respone:tue});
    });
  });
};

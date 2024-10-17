const db = require('../../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer configuration for file uploads
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

// Change multer to accept both file and text fields
const upload = multer({ storage: storage }).single('master_item_image');

// Insert Menu and Beverage items
exports.insertMenuAndBeverageItems = async (req, res) => {
    // Call the upload middleware first to parse the incoming form data
    upload(req, res, async function (err) {
        if (err) {
            return res.status(500).json({ error_msg: 'Error uploading file', details: err.message });
        }

        const { menu_type, menu_id, master_item_name, master_item_price, master_item_description } = req.body;
        const master_item_image = req.file ? `/uploads/menu_items_with_token/${req.userId}/${req.file.filename}` : null;
        const userId = req.userId;

        console.log('insertMenuAndBeverageItems');
        console.log('body', req.body);

        try {
            // Insert into the master_items table
            const insertQuery = `
                INSERT INTO master_items (userId, master_item_name, master_item_price, master_item_description, master_item_image) 
                VALUES (?, ?, ?, ?, ?)
            `;
            const [result] = await db.promise().query(insertQuery, [userId, master_item_name, master_item_price, master_item_description, master_item_image]);

            const newMasterItemId = result.insertId; // Get the inserted item ID

            if (menu_type === 'menu') {
                // Insert into the menu_item_linking table
                const linkQuery = `
                    INSERT INTO menu_item_linking (userId, master_item_id, menu_id) 
                    VALUES (?, ?, ?)
                `;
                await db.promise().query(linkQuery, [userId, newMasterItemId, menu_id]);

                res.status(201).json({ success_msg: 'Menu item created successfully', master_item_id: newMasterItemId, response: true });

            } else if (menu_type === 'beverage') {
                // Insert into the beverages_item_linking table
                const beverage_id = menu_id;
                const linkQuery = `
                    INSERT INTO beverages_item_linking (userId, master_item_id, beverage_id) 
                    VALUES (?, ?, ?)
                `;
                await db.promise().query(linkQuery, [userId, newMasterItemId, beverage_id]);

                res.status(201).json({ success_msg: 'Beverage item created successfully', master_item_id: newMasterItemId, response: true });

            } else {
                res.status(400).json({ error_msg: 'Invalid menu type', response: false });
            }
        } catch (err) {
            res.status(500).json({ error_msg: 'Database error', details: err.message, response: false });
        }
    });
};


// Update Menu and Beverage items, with optional image removal
exports.updateMenuAndBeverageItems = async (req, res) => {
    // Call the upload middleware first to parse the incoming form data
    upload(req, res, async function (err) {
        if (err) {
            return res.status(500).json({ error_msg: 'Error uploading file', details: err.message });
        }

        const { master_item_id, menu_type, menu_id, master_item_name, master_item_price, master_item_description, remove_image } = req.body;
        const master_item_image = req.file ? `/uploads/menu_items_with_token/${req.userId}/${req.file.filename}` : null;
        const userId = req.userId;

        console.log('updateMenuAndBeverageItems');
        console.log('body', req.body);

        try {
            // Get the current image path from the database (to delete if needed)
            const [existingItem] = await db.promise().query(`SELECT master_item_image FROM master_items WHERE master_item_id = ? AND userId = ?`, [master_item_id, userId]);

            let imageToUpdate = existingItem[0].master_item_image;

            // If a new image is uploaded, update the path
            if (master_item_image) {
                imageToUpdate = master_item_image;
                // Optionally, delete the old image from the server if it's being replaced
                if (existingItem[0].master_item_image) {
                    const oldImagePath = path.join(__dirname, '..', '..', existingItem[0].master_item_image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath); // Delete the old image file
                    }
                }
            }

            // If remove_image is true, set image to null and delete the old image file
            if (remove_image === 'true' && !master_item_image) {
                imageToUpdate = null;
                if (existingItem[0].master_item_image) {
                    const oldImagePath = path.join(__dirname, '..', '..', existingItem[0].master_item_image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath); // Delete the old image file
                    }
                }
            }

            // Update the master_items table
            let updateQuery = `
                UPDATE master_items 
                SET master_item_name = ?, master_item_price = ?, master_item_description = ?, master_item_image = ?
                WHERE userId = ? AND master_item_id = ?
            `;
            const updateValues = [master_item_name, master_item_price, master_item_description, imageToUpdate, userId, master_item_id];

            await db.promise().query(updateQuery, updateValues);

            if (menu_type === 'menu') {
                // Update the menu_item_linking table
                const linkQuery = `
                    UPDATE menu_item_linking 
                    SET menu_id = ? 
                    WHERE userId = ? AND master_item_id = ?
                `;
                await db.promise().query(linkQuery, [menu_id, userId, master_item_id]);

                res.status(200).json({ success_msg: 'Menu item updated successfully', master_item_id, response: true });

            } else if (menu_type === 'beverage') {
                // Update the beverages_item_linking table
                const linkQuery = `
                    UPDATE beverages_item_linking 
                    SET beverage_id = ? 
                    WHERE userId = ? AND master_item_id = ?
                `;
                await db.promise().query(linkQuery, [menu_id, userId, master_item_id]);

                res.status(200).json({ success_msg: 'Beverage item updated successfully', master_item_id, response: true });

            } else {
                res.status(400).json({ error_msg: 'Invalid menu type', response: false });
            }
        } catch (err) {
            res.status(500).json({ error_msg: 'Database error', details: err.message, response: false });
        }
    });
};


const db = require('../../config');
const path = require('path');
const fs = require('fs');
const { uploadFile, updateFile } = require('../../utils/multer/attachments');

// Insert Menu and Beverage items
exports.insertMenuAndBeverageItems = async (req, res) => {
    const { menu_type, menu_id, master_item_name, master_item_price, master_item_description } = req.body;
    const userId = req.userId;

    try {
        let masterItemImage = null;

        // Handle file upload for master_item_image
        if (req.file) {
            const uploadedFile = await uploadFile(req.file, `menu_items_with_token/${userId}`);
            masterItemImage = uploadedFile.newFileName; // Ensure this is the correct property to access the filename
        }

        // Insert into the master_items table
        const insertQuery = `
            INSERT INTO master_items (userId, master_item_name, master_item_price, master_item_description, master_item_image) 
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await db.promise().query(insertQuery, [userId, master_item_name, master_item_price, master_item_description, masterItemImage]);

        const newMasterItemId = result.insertId; // Get the inserted item ID

        // Insert into the appropriate linking table based on menu_type
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
            const beverage_id = menu_id; // Assuming menu_id is the beverage ID in this context
            const linkQuery = `
                INSERT INTO beverages_item_linking (userId, master_item_id, beverage_id) 
                VALUES (?, ?, ?)
            `;
            await db.promise().query(linkQuery, [userId, newMasterItemId, beverage_id]);

            res.status(201).json({ success_msg: 'Beverage item created successfully', master_item_id: newMasterItemId, response: true });

        } else {
            // Return an error if menu_type is invalid
            return res.status(400).json({ error_msg: 'Invalid menu type', response: false });
        }
    } catch (err) {
        // Handle database errors gracefully
        console.error('Database error:', err); // Log the error for debugging
        res.status(500).json({ error_msg: 'Database error', details: err.message, response: false });
    }
};


// Update Menu and Beverage items, with optional image removal
exports.updateMenuAndBeverageItems = async (req, res) => {
    const { 
        master_item_id, 
        menu_type, 
        menu_id, 
        master_item_name, 
        master_item_price, 
        master_item_description, 
        remove_image 
    } = req.body;

    const userId = req.userId;

    try {
        let masterItemImage = null;

        // Validations
        if (!['menu', 'beverage'].includes(menu_type)) {
            return res.status(400).json({ error_msg: 'Invalid menu type', response: false });
        }

        // Check existing item
        const itemQuery = menu_type === 'menu' ? 
            `SELECT * FROM menu_item_linking WHERE master_item_id = ? AND userId = ? AND is_deleted = 0` : 
            `SELECT * FROM beverages_item_linking WHERE master_item_id = ? AND userId = ? AND is_deleted = 0`;

        const [existingItem] = await db.promise().query(itemQuery, [master_item_id, userId]);

        if (!existingItem.length) {
            return res.status(404).json({ error_msg: 'Item not found', response: false });
        }

        // Get the current image path from the database (to delete if needed)
        const [imageResult] = await db.promise().query(`SELECT master_item_image FROM master_items WHERE master_item_id = ? AND userId = ?`, [master_item_id, userId]);

        let oldImage = imageResult[0]?.master_item_image;

        // Handle file upload for master_item_image
        if (req.file) {
            const uploadedFile = await updateFile(req.file, `menu_items_with_token/${userId}`, oldImage);
            masterItemImage = uploadedFile.newFileName; // Ensure this is the correct property to access the filename
        } else if (remove_image) {
            // If remove_image is true, set masterItemImage to null for deletion
            masterItemImage = null;
        } else {
            // If no file is uploaded and no removal is requested, keep the old image
            masterItemImage = oldImage;
        }

        // Update the master_items table
        let updateQuery = `
            UPDATE master_items 
            SET 
                master_item_name = ?, 
                master_item_price = ?, 
                master_item_description = ?, 
                master_item_image = ? 
            WHERE userId = ? AND master_item_id = ?
        `;
        const updateValues = [master_item_name, master_item_price, master_item_description, masterItemImage, userId, master_item_id];

        await db.promise().query(updateQuery, updateValues);

        // Update the linking table based on menu_type
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
        }
    } catch (err) {
        res.status(500).json({ error_msg: 'Database error', details: err.message, response: false });
    }
};
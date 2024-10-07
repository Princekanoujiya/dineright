const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for image upload, storing images in 'uploads/banner_images/userId/'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = `uploads/banner_images/${req.userId}`;
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

const upload = multer({ storage: storage }).single('banner_image');

// Insert or Update a banner image
exports.insertOrUpdateBannerImage = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ error: 'Multer error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Error uploading file', details: err.message });
    }

    const banner_image = req.file ? req.file.filename : null;
    const userId = req.userId;
    const { banner_image_id } = req.body;

    if (!banner_image) {
      return res.status(400).json({ error: 'No banner image uploaded' });
    }

    if (banner_image_id) {
      // Update operation if banner_image_id is provided
      const updateQuery = `UPDATE banner_images 
                           SET banner_image = ? 
                           WHERE banner_image_id = ? AND userId = ?`;
      db.query(updateQuery, [banner_image, banner_image_id, userId], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error during update', details: err.message });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Banner image not found or user not authorized' });
        }
        res.status(200).json({ message: 'Banner image updated successfully', banner_image_id });
      });
    } else {
      // Insert operation if banner_image_id is not provided
      const insertQuery = `INSERT INTO banner_images (userId, banner_image) VALUES (?, ?)`;
      db.query(insertQuery, [userId, banner_image], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error during insertion', details: err.message });
        }
        res.status(201).json({ message: 'Banner image uploaded successfully', banner_image_id: result.insertId });
      });
    }
  });
};

// Get banner images for a user
exports.getBannerImages = (req, res) => {
  const userId = req.userId;
  const query = `SELECT * FROM banner_images WHERE userId = ?`;

  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error during retrieval', details: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'No banner images found for this user' });
    }
    res.status(200).json({ banner_images: results });
  });
};

// Delete a specific banner image
exports.deleteBannerImage = (req, res) => {
  const { banner_image_id } = req.params;
  const userId = req.userId;

  const selectQuery = `SELECT banner_image FROM banner_images WHERE banner_image_id = ? AND userId = ?`;
  const deleteQuery = `DELETE FROM banner_images WHERE banner_image_id = ? AND userId = ?`;

  // First, find the banner image to delete the file from the filesystem
  db.query(selectQuery, [banner_image_id, userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error during deletion', details: err.message });
    }
    if (result.length === 0) {
      return res.status(404).json({ message: 'Banner image not found or user not authorized' });
    }

    // Get the file path
    const filePath = `uploads/banner_images/${userId}/${result[0].banner_image}`;

    // Delete the file from the file system
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error deleting image file', details: err.message });
      }

      // Now delete the record from the database
      db.query(deleteQuery, [banner_image_id, userId], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error during deletion', details: err.message });
        }
        res.status(200).json({ message: 'Banner image deleted successfully' });
      });
    });
  });
};

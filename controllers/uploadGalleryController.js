const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for image/video upload, storing them in 'base_url/uploads/banner_gallery/userId/'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = `uploads/banner_gallery/${req.userId}`;
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

// Multer config for handling multiple files (both images and videos)
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|mp4|avi|mov/; // Allow image and video formats
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'));
    }
  }
}).array('files', 10);

// Insert or Update multiple gallery images/videos
exports.insertOrUpdateBannerGallery = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ error: 'Multer error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Error uploading files', details: err.message });
    }

    const files = req.files;
    const userId = req.userId;
    const { banner_gallery_id } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const fileNames = files.map(file => file.filename); // Get filenames of uploaded files

    if (banner_gallery_id) {
      // Update operation if banner_gallery_id is provided
      const updateQuery = `UPDATE banner_galleries
                           SET files = ?
                           WHERE banner_gallery_id = ? AND userId = ?`;

      db.query(updateQuery, [JSON.stringify(fileNames), banner_gallery_id, userId], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error during update', details: err.message });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Gallery not found or user not authorized' });
        }
        res.status(200).json({ message: 'Gallery updated successfully', banner_gallery_id });
      });
    } else {
      // Insert operation if banner_gallery_id is not provided
      const insertQuery = `INSERT INTO banner_galleries (userId, files) VALUES (?, ?)`;

      db.query(insertQuery, [userId, JSON.stringify(fileNames)], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error during insertion', details: err.message });
        }
        res.status(201).json({ message: 'Files uploaded and saved successfully', banner_gallery_id: result.insertId });
      });
    }
  });
};

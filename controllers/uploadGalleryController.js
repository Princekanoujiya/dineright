const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for multiple image and video uploads, storing in 'uploads/banner_gallery/userId/'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // const dir = `uploads/banner_gallery/${req.userId}`;
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


const upload = multer({ storage: storage }).array('files'); 

// Insert multiple images or videos
exports.insertOrUpdateBannerGallery = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(200).json({ error_msg: 'Multer error', details: err.message, response: false });
    } else if (err) {
      return res.status(200).json({ error_msg: 'Error uploading files', details: err.message, response: false });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(200).json({ error_msg: 'No files uploaded', response: false });
    }

    const userId = req.userId;
    const fileDetails = req.files.map(file => ({
      filePath: `/uploads/banner_gallery/${req.userId}/${file.filename}`,
      mimeType: file.mimetype
    }));

    // Prepare insert query for multiple files
    const insertQuery = `INSERT INTO banner_galleries (userId, files, file_type) VALUES ?`;
    const values = fileDetails.map(file => [userId, file.filePath, file.mimeType]);

    // Insert files into database
    db.query(insertQuery, [values], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
      }
      res.status(200).json({ success_msg: 'Files uploaded successfully', insertedCount: result.affectedRows, response: true });
    });
  });
};


exports.getBannerGallery = (req, res) => {
  const userId = req.userId;

  // Query to fetch non-deleted files
  const getQuery = `SELECT * FROM banner_galleries WHERE userId = ? AND is_deleted = 0`;
  db.query(getQuery, [userId], (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error during retrieval', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(200).json({ success_msg: 'No files found', response: true });
    }

    // Format each file URL
    const files = results.map(image => ({
      file_url: `${process.env.BASE_URL}${image.files}`,
      banner_gallery_id: image.banner_gallery_id,
      file_type: image.file_type,
    }));

    // Return all files as an array
    res.status(200).json({
      userId: userId,
      success_msg: 'Files retrieved successfully',
      files: files,
      response: true
    });
  });
};


// Delete banner gallery file (set is_deleted = 1)
exports.deleteBannerGallery = (req, res) => {
  const { banner_gallery_id } = req.body;
  if (!banner_gallery_id) {
    return res.status(200).json({ error_msg: 'No banner_gallery_id provided', response: false });
  }

  // Query to update is_deleted to 1
  const deleteQuery = `UPDATE banner_galleries SET is_deleted = 1 WHERE banner_gallery_id = ?`;
  db.query(deleteQuery, [banner_gallery_id], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error during deletion', details: err.message, response: false });
    }

    if (result.affectedRows === 0) {
      return res.status(200).json({ error_msg: 'No file found with the provided ID', response: false });
    }

    res.status(200).json({ success_msg: 'File deleted successfully (marked as deleted)', response: true });
  });
};


exports.getAllBannerGalleries = (req, res) => {
  // Query to fetch all non-deleted banner galleries
  const getQuery = `SELECT * FROM banner_galleries WHERE is_deleted = 0`;

  db.query(getQuery, (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error during retrieval', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(200).json({ success_msg: 'No files found', response: true });
    }

    // Grouping the results by `userId` with formatted structure
    const groupedByUserId = results.reduce((acc, item) => {
      if (!acc[item.userId]) {
        acc[item.userId] = {
          userId: item.userId,
          galleries: []
        };
      }

      acc[item.userId].galleries.push({
        banner_gallery_id: item.banner_gallery_id,
        file: process.env.BASE_URL + item.files,  
        file_type: item.file_type
      });

      return acc;
    }, {});

    res.status(200).json({ success_msg: 'Files retrieved successfully', data: Object.values(groupedByUserId), response: true });
  });
};

const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, `/uploads/banner_gallery/${req.userId}`);

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
    const filetypes = /jpeg|jpg|png|gif|mp4|avi|mov/; 
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'));
    }
  }
}).array('files');

// Insert or Update multiple gallery images/videos with unique IDs for each, storing full file paths
exports.insertOrUpdateBannerGallery = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(200).json({ error_msg:'Multer error', details: err.message ,response:false });
    } else if (err) {
      return res.status(200).json({ error_msg:'Error uploading files', details: err.message,response:false });
    }
    const files = req.files;
    const userId = req.userId;
    const { banner_gallery_id } = req.body;
    if (!files || files.length === 0) {
      return res.status(200).json({ error_msg:'No files uploaded',response:false });
    }
    // Generate file paths to store in the database
    const filePaths = files.map(file => `/uploads/banner_gallery/${userId}/${file.filename}`);
      // Insert multiple new gallery items with full paths
      const insertQuery = `INSERT INTO banner_galleries (userId, files) VALUES (?, ?)`;

      // Start a transaction to ensure either all records are inserted or none
      db.beginTransaction((err) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Error starting transaction', details: err.message, response: false });
        }

        const promises = files.map(file => {
          return new Promise((resolve, reject) => {
            const filePath = `/uploads/banner_gallery/${userId}/${file.filename}`;
            db.query(insertQuery, [userId, filePath], (err, result) => {
              if (err) return reject(err);
              resolve(result.insertId); 
            });
          });
        });

        // Execute all insert queries
        Promise.all(promises)
          .then(insertedIds => {
            db.commit((err) => {
              if (err) {
                return db.rollback(() => {
                  return res.status(200).json({ error_msg: 'Transaction failed', details: err.message, response: false });
                });
              }
              res.status(200).json({ success_msg: 'Files uploaded and saved successfully', insertedIds, response:true });
            });
          })
          .catch(err => {
            db.rollback(() => {
              return res.status(200).json({ error_msg: 'Error during file insertion', details: err.message, response: false });
            });
          });
      });
    
  });
};

// Delete a single gallery item and its associated file using banner_gallery_id from URL params
exports.deleteBannerGalleryItem = (req, res) => {
  const { banner_gallery_id } = req.params; // The ID of the gallery item to be deleted from the URL parameters
  const userId = req.userId;

  if (!banner_gallery_id) {
    return res.status(400).json({ error_msg: 'No gallery ID provided', response: false });
  }

  // Fetch the file path for the gallery item to be deleted
  const selectQuery = `SELECT files FROM banner_galleries WHERE userId = ? AND banner_gallery_id = ?`;
  db.query(selectQuery, [userId, banner_gallery_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error_msg: 'Error fetching gallery item', details: err.message, response: false });
    }

    if (results.length === 0) {
      return res.status(404).json({ error_msg: 'No gallery item found for the provided ID', response: false });
    }

    // Delete the file from the file system
    const filePath = results[0].files;
    const fullPath = path.join(__dirname, `..${filePath}`); // Get the full file path
    console.log('Full path to file:', fullPath);

    if (fs.existsSync(fullPath)) {
      fs.unlink(fullPath, (err) => {
        if (err) {
          return res.status(500).json({ error_msg: 'Error deleting file', details: err.message, response: false });
        }
        
        // Delete the record from the database
        const deleteQuery = `DELETE FROM banner_galleries WHERE userId = ? AND banner_gallery_id = ?`;
        db.query(deleteQuery, [userId, banner_gallery_id], (err, result) => {
          if (err) {
            return res.status(500).json({ error_msg: 'Error deleting gallery item from database', details: err.message, response: false });
          }

          res.status(200).json({ success_msg: 'Gallery item deleted successfully', response: true });
        });
      });
    } else {
      console.log('File not found, proceeding with database record deletion');

      // Proceed with database deletion even if the file doesn't exist
      const deleteQuery = `DELETE FROM banner_galleries WHERE userId = ? AND banner_gallery_id = ?`;
      db.query(deleteQuery, [userId, banner_gallery_id], (err, result) => {
        if (err) {
          return res.status(500).json({ error_msg: 'Error deleting gallery item from database', details: err.message, response: false });
        }

        res.status(200).json({ success_msg: 'File not found, but gallery item deleted from database', response: true });
      });
    }
  });
};


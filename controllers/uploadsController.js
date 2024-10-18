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
      return res.status(200).json({ error_msg:'Multer error', details: err.message ,response:false});
    } else if (err) {
      return res.status(200).json({ error_msg:'Error uploading file', details: err.message,response:false });
    }

    const banner_image = req.file ? `/uploads/banner_images/${req.userId}/${req.file.filename}` : null;
    const userId = req.userId;
    const { banner_image_id } = req.body;

    if (!banner_image) {
      return res.status(200).json({ error_msg:'No banner image uploaded' ,response:false});
    }

    if (banner_image_id) {
      // Update operation if banner_image_id is provided
      const updateQuery = `UPDATE banner_images 
                           SET banner_image = ? 
                           WHERE banner_image_id = ? AND userId = ?`;
      db.query(updateQuery, [banner_image, banner_image_id, userId], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg:'Database error during update', details: err.message ,response:false});
        }
        if (result.affectedRows === 0) {
          return res.status(200).json({ error_msg: 'Banner image not found or user not authorized',response:false });
        }
        res.status(200).json({ success_msg: 'Banner image updated successfully', banner_image_id,response:true });
      });
    } else {
      // Insert operation if banner_image_id is not provided
      const insertQuery = `INSERT INTO banner_images (userId, banner_image) VALUES (?, ?)`;
      db.query(insertQuery, [userId, banner_image], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg:'Database error during insertion', details: err.message,response:false });
        }
        res.status(200).json({ success_msg: 'Banner image uploaded successfully', banner_image_id: result.insertId,response:true });
      });
    }
  });
};

exports.getBannerImages = (req, res) => {
  const userId = req.userId; 
  const query = `SELECT * FROM banner_images WHERE userId = ?`; 

  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(200).json({ 
        error_msg: 'Database error during retrieval', 
        details: err.message,
        response: false 
      });
    }

    if (results.length === 0) {
      return res.status(200).json({ 
        error_msg: 'No banner images found for this user',
        response: false 
      });
    }

    // Get the first banner image from the results
    const image = results[0];
    const bannerImageUrl = `${process.env.BASE_URL}${image.banner_image}`; 

    res.status(200).json({
      banner_image: bannerImageUrl,
      userId: userId,
      banner_image_id:image.banner_image_id,
      success_msg: 'Banner image retrieved successfully',
      response: true
    });
  });
};



exports.deleteBannerImage = (req, res) => {
  const { banner_image_id } = req.params;
  const userId = req.userId;

  const selectQuery = `SELECT banner_image FROM banner_images WHERE banner_image_id = ? AND userId = ?`;
  const deleteQuery = `DELETE FROM banner_images WHERE banner_image_id = ? AND userId = ?`;

  // First, find the banner image to delete the file from the filesystem
  db.query(selectQuery, [banner_image_id, userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error_msg: 'Database error during deletion', details: err.message, response: false });
    }
    if (result.length === 0) {
      return res.status(404).json({ error_msg: 'Banner image not found or user not authorized', response: false });
    }

    // Construct the file path
    
    const filePath = path.join(__dirname, '..', result[0].banner_image);
    // Delete the file from the filesystem
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).json({ error_msg: 'Error deleting image file', details: err.message, response: false });
      }

      // Now delete the record from the database
      db.query(deleteQuery, [banner_image_id, userId], (err, result) => {
        if (err) {
          return res.status(500).json({ error_msg: 'Database error during deletion', details: err.message, response: false });
        }
        res.status(200).json({ success_msg: 'Banner image deleted permanently and record removed successfully', response: true });
      });
    });
  });
};
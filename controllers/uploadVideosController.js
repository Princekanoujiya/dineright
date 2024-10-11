const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = `uploads/banner_videos/${req.userId}`;
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

const upload = multer({ storage: storage }).single('banner_video');
// Insert or Update a banner video
exports.insertOrUpdateBannerVideo = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(200).json({ error_msg: 'Multer error', details: err.message ,response:false});
    } else if (err) {
      return res.status(200).json({ error_msg: 'Error uploading file', details: err.message ,response:false});
    }

    const banner_video = req.file ? req.file.filename : null;
    const userId = req.userId;
    const { banner_video_id } = req.body;

    if (!banner_video) {
      return res.status(400).json({ error_msg: 'No banner video uploaded',response:false });
    }

    if (banner_video_id) {
      // Update operation if banner_video_id is provided
      const updateQuery = `UPDATE banner_videos 
                           SET banner_video = ? 
                           WHERE banner_video_id = ? AND userId = ?`;
      db.query(updateQuery, [banner_video, banner_video_id, userId], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during update', details: err.message ,response:false});
        }
        if (result.affectedRows === 0) {
          return res.status(200).json({ success_msg: 'Banner video not found or user not authorized',response:true });
        }
        res.status(200).json({ success_msg: 'Banner video updated successfully', banner_video_id,response:true });
      });
    } else {
      // Insert operation if banner_video_id is not provided
      const insertQuery = `INSERT INTO banner_videos (userId, banner_video) VALUES (?, ?)`;
      db.query(insertQuery, [userId, banner_video], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message,response:false });
        }
        res.status(201).json({ success_msg: 'Banner video uploaded successfully', banner_video_id: result.insertId,response:true });
      });
    }
  });
};
// Get banner videos for a user
exports.getBannerVideos = (req, res) => {
    const userId = req.userId;
    const query = `SELECT * FROM banner_videos WHERE userId = ?`;
  
    db.query(query, [userId], (err, results) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error during retrieval', details: err.message,response:false });
      }
      if (results.length === 0) {
        return res.status(200).json({ error_msg: 'No banner videos found for this user',response:false });
      }
      res.status(200).json({ banner_videos: results ,success_msg: 'Banner video uploaded successfully',response:true});
    });
  };
// Delete a specific banner video
exports.deleteBannerVideo = (req, res) => {
    const { banner_video_id } = req.params;
    const userId = req.userId;
  
    const selectQuery = `SELECT banner_video FROM banner_videos WHERE banner_video_id = ? AND userId = ?`;
    const deleteQuery = `DELETE FROM banner_videos WHERE banner_video_id = ? AND userId = ?`;
  
    // First, find the banner video to delete the file from the filesystem
    db.query(selectQuery, [banner_video_id, userId], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error during deletion', details: err.message ,response:false});
      }
      if (result.length === 0) {
        return res.status(200).json({ error_msg: 'Banner video not found or user not authorized',response:false });
      }
  
      // Get the file path
      const filePath = `uploads/banner_videos/${userId}/${result[0].banner_video}`;
  
      // Delete the file from the file system
      fs.unlink(filePath, (err) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Error deleting video file', details: err.message ,response:false});
        }
  
        // Now delete the record from the database
        db.query(deleteQuery, [banner_video_id, userId], (err, result) => {
          if (err) {
            return res.status(200).json({ error_msg: 'Database error during deletion', details: err.message,response:false });
          }
          res.status(200).json({ success_msg: 'Banner video deleted successfully' ,response:true});
        });
      });
    });
  };
    
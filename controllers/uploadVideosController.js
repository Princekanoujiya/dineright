const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for video upload, storing videos in 'uploads/banner_videos/userId/'
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
      return res.status(500).json({ error: 'Multer error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Error uploading file', details: err.message });
    }

    const banner_video = req.file ? req.file.filename : null;
    const userId = req.userId;
    const { banner_video_id } = req.body;

    if (!banner_video) {
      return res.status(400).json({ error: 'No banner video uploaded' });
    }

    if (banner_video_id) {
      // Update operation if banner_video_id is provided
      const updateQuery = `UPDATE banner_videos 
                           SET banner_video = ? 
                           WHERE banner_video_id = ? AND userId = ?`;
      db.query(updateQuery, [banner_video, banner_video_id, userId], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error during update', details: err.message });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Banner video not found or user not authorized' });
        }
        res.status(200).json({ message: 'Banner video updated successfully', banner_video_id });
      });
    } else {
      // Insert operation if banner_video_id is not provided
      const insertQuery = `INSERT INTO banner_videos (userId, banner_video) VALUES (?, ?)`;
      db.query(insertQuery, [userId, banner_video], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error during insertion', details: err.message });
        }
        res.status(201).json({ message: 'Banner video uploaded successfully', banner_video_id: result.insertId });
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
        return res.status(500).json({ error: 'Database error during retrieval', details: err.message });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: 'No banner videos found for this user' });
      }
      res.status(200).json({ banner_videos: results });
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
        return res.status(500).json({ error: 'Database error during deletion', details: err.message });
      }
      if (result.length === 0) {
        return res.status(404).json({ message: 'Banner video not found or user not authorized' });
      }
  
      // Get the file path
      const filePath = `uploads/banner_videos/${userId}/${result[0].banner_video}`;
  
      // Delete the file from the file system
      fs.unlink(filePath, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Error deleting video file', details: err.message });
        }
  
        // Now delete the record from the database
        db.query(deleteQuery, [banner_video_id, userId], (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Database error during deletion', details: err.message });
          }
          res.status(200).json({ message: 'Banner video deleted successfully' });
        });
      });
    });
  };
    
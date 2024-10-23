const db = require('../config');
const path = require('path');
const fs = require('fs');
const { uploadFile, updateFile } = require('../utils/multer/attachments');

// Insert or Update a banner video
exports.insertOrUpdateBannerVideo = async (req, res) => {
  try {
    const userId = req.userId; // Assuming req.userId is set previously in the middleware
    const { banner_video_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ error_msg: 'No banner video uploaded', response: false });
    }

    // Check if updating an existing banner video
    if (banner_video_id) {
      // Fetch the existing video to delete if necessary
      const videoQuery = `SELECT banner_video FROM banner_videos WHERE banner_video_id = ? AND userId = ?`;
      const [videoResult] = await db.promise().query(videoQuery, [banner_video_id, userId]);

      if (videoResult.length === 0) {
        return res.status(404).json({ error_msg: 'Banner video not found or user not authorized', response: false });
      }

      const oldVideo = videoResult[0].banner_video;

      // Upload the new video and get the new file name
      const uploadedFile = await updateFile(req.file, `banner_videos/${userId}`, oldVideo);

      // Update the banner video in the database
      const updateQuery = `
        UPDATE banner_videos 
        SET banner_video = ? 
        WHERE banner_video_id = ? AND userId = ?`;
      const [updateResult] = await db.promise().query(updateQuery, [uploadedFile.newFileName, banner_video_id, userId]);

      if (updateResult.affectedRows === 0) {
        return res.status(404).json({ error_msg: 'Banner video not found or user not authorized', response: false });
      }

      return res.status(200).json({ success_msg: 'Banner video updated successfully', banner_video_id, response: true });

    } else {
      // Insert new banner video if banner_video_id is not provided
      const uploadedFile = await uploadFile(req.file, `banner_videos/${userId}`);

      const insertQuery = `
        INSERT INTO banner_videos (userId, banner_video) 
        VALUES (?, ?)`;
      const [insertResult] = await db.promise().query(insertQuery, [userId, uploadedFile.newFileName]);

      return res.status(201).json({ success_msg: 'Banner video uploaded successfully', banner_video_id: insertResult.insertId, response: true });
    }
  } catch (error) {
    console.error('Error inserting or updating banner video:', error);
    return res.status(500).json({ error_msg: 'Server error during insertion or update', details: error.message, response: false });
  }
};

// Get banner videos for a user
exports.getBannerVideos = (req, res) => {
  const userId = req.userId;
  const query = `SELECT * FROM banner_videos WHERE userId = ?`;

  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error during retrieval', details: err.message, response: false });
    }
    if (results.length === 0) {
      return res.status(200).json({ error_msg: 'No banner videos found for this user', response: false });
    }

    // Update the banner_video field to include the full URL
    const updatedResults = results.map(video => {
      video.banner_video = `${process.env.BASE_URL}${video.banner_video}`;
      return video;
    });

    // Send the response with the updated results
    res.status(200).json({
      banner_videos: updatedResults,
      success_msg: 'Banner videos retrieved successfully',
      response: true
    });
  });
};

exports.deleteBannerVideo = (req, res) => {
  const { banner_video_id } = req.params;
  const userId = req.userId;

  const selectQuery = `SELECT banner_video FROM banner_videos WHERE banner_video_id = ? AND userId = ?`;
  const deleteQuery = `DELETE FROM banner_videos WHERE banner_video_id = ? AND userId = ?`;

  // First, find the banner video to delete the file from the filesystem
  db.query(selectQuery, [banner_video_id, userId], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error during deletion', details: err.message, response: false });
    }
    if (result.length === 0) {
      return res.status(200).json({ error_msg: 'Banner video not found or user not authorized', response: false });
    }

    // Construct the full file path
    const filePath = path.join(__dirname, '..', result[0].banner_video);

    // Delete the file from the filesystem
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Error deleting video file', details: err.message, response: false });
      }

      // Now delete the record from the database
      db.query(deleteQuery, [banner_video_id, userId], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during deletion', details: err.message, response: false });
        }
        res.status(200).json({ success_msg: 'Banner video deleted successfully', response: true });
      });
    });
  });
};
const db = require('../config');
const path = require('path');
const fs = require('fs');
const { uploadFile, updateFile } = require('../utils/multer/attachments');

// // Insert multiple images or videos
// exports.insertOrUpdateBannerGallery = async (req, res) => {
//     if (!req.files || req.files.length === 0) {
//       return res.status(200).json({ error_msg: 'No files uploaded', response: false });
//     }

//     const userId = req.userId;
//     const fileDetails = await Promise.all(
//       req.files.map(async (file) => {
//         const uploadedFile = await uploadFile(file, `banner_gallery/${req.userId}`);
//         return {
//           filePath: uploadedFile.newFileName,
//           mimeType: file.mimetype
//         };
//       })
//     );    

//     // Prepare insert query for multiple files
//     const insertQuery = `INSERT INTO banner_galleries (userId, files, file_type) VALUES ?`;
//     const values = fileDetails.map(file => [userId, file.filePath, file.mimeType]);

//     // Insert files into database
//     db.query(insertQuery, [values], (err, result) => {
//       if (err) {
//         return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
//       }
//       res.status(200).json({ success_msg: 'Files uploaded successfully', insertedCount: result.affectedRows, response: true });
//     });
// };
// Insert multiple images or videos
exports.insertOrUpdateBannerGallery = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(200).json({ error_msg: 'No files uploaded', response: false });
    }

    const userId = req.userId;
    const fileDetails = await Promise.all(
      req.files.map(async (file) => {
        const uploadedFile = await uploadFile(file, `banner_gallery/${userId}`);
        return {
          filePath: uploadedFile.newFileName,
          mimeType: file.mimetype
        };
      })
    );

    // Prepare insert query for multiple files
    const insertQuery = `INSERT INTO banner_galleries (userId, files, file_type) VALUES ?`;
    const values = fileDetails.map(file => [userId, file.filePath, file.mimeType]);

    // Insert files into database
    db.query(insertQuery, [values], (err, result) => {
      if (err) {
        return res.status(500).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
      }
      res.status(200).json({ success_msg: 'Files uploaded successfully', insertedCount: result.affectedRows, response: true });
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error_msg: 'File upload failed', details: error.message, response: false });
  }
};

// Insert multiple images or videos
exports.insertOrUpdateBannerGalleryByUserId = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(200).json({ error_msg: 'No files uploaded', response: false });
    }

    const { userId } = req.body;
    const fileDetails = await Promise.all(
      req.files.map(async (file) => {
        const uploadedFile = await uploadFile(file, `banner_gallery/${userId}`);
        return {
          filePath: uploadedFile.newFileName,
          mimeType: file.mimetype
        };
      })
    );

    // Prepare insert query for multiple files
    const insertQuery = `INSERT INTO banner_galleries (userId, files, file_type) VALUES ?`;
    const values = fileDetails.map(file => [userId, file.filePath, file.mimeType]);

    // Insert files into database
    db.query(insertQuery, [values], (err, result) => {
      if (err) {
        return res.status(500).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
      }
      res.status(200).json({ success_msg: 'Files uploaded successfully', insertedCount: result.affectedRows, response: true });
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error_msg: 'File upload failed', details: error.message, response: false });
  }
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

exports.getBannerGalleryByUserId = (req, res) => {
  const { userId } = req.params

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

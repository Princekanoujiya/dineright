const db = require('../config');
const path = require('path');
const fs = require('fs');
const { uploadFile, updateFile } = require('../utils/multer/attachments');

// Insert or Update a banner image
// exports.insertOrUpdateBannerImage = async (req, res) => {

//   const userId = req.userId; // Assuming req.userId is set previously in the middleware

//   const { banner_image_id } = req.body;

//  let bannerImage = null;    

//  if (banner_image_id) {
//    // 
//    const imageQuery = `SELECT * FROM banner_images WHERE banner_image_id = ? AND userId = ?`;
//    const [image] = await db.promise().query(imageQuery, [banner_image_id, userId]);

//    const oldImage = image[0].banner_image;

//    const uploadedFile = await updateFile(req.file, `banner_images/${userId}`, oldImage);
//    bannerImage = uploadedFile.newFileName;

//    // Update operation if banner_image_id is provided
//    const updateQuery = `UPDATE banner_images SET banner_image = ? WHERE banner_image_id = ? AND userId = ?`;
//    db.query(updateQuery, [bannerImage, banner_image_id, userId], (err, result) => {
//      if (err) {
//        return res.status(200).json({ error_msg: 'Database error during update', details: err.message, response: false });
//      }
//      if (result.affectedRows === 0) {
//        return res.status(200).json({ error_msg: 'Banner image not found or user not authorized', response: false });
//      }
//      res.status(200).json({ success_msg: 'Banner image updated successfully', banner_image_id, response: true });
//    });
//  } else {
//   const uploadedFile = await updateFile(req.file, `banner_images/${userId}`, oldImage);
//    bannerImage = uploadedFile.newFileName;
//    // Insert operation if banner_image_id is not provided
//    const insertQuery = `INSERT INTO banner_images (userId, banner_image) VALUES (?, ?)`;
//    db.query(insertQuery, [userId, bannerImage], (err, result) => {
//      if (err) {
//        return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
//      }
//      res.status(200).json({ success_msg: 'Banner image uploaded successfully', banner_image_id: result.insertId, response: true });
//    });
//  }

// };
// Insert or Update a banner image
exports.insertOrUpdateBannerImage = async (req, res) => {
  try {
    const userId = req.userId; // Assuming req.userId is set previously in the middleware
    const { banner_image_id } = req.body;

    let bannerImage = null;

    // If banner_image_id is provided, perform the update operation
    if (banner_image_id) {
      // Fetch the existing image
      const imageQuery = `SELECT banner_image FROM banner_images WHERE banner_image_id = ? AND userId = ?`;
      const [image] = await db.promise().query(imageQuery, [banner_image_id, userId]);

      if (image.length === 0) {
        return res.status(404).json({ error_msg: 'Banner image not found or user not authorized', response: false });
      }

      const oldImage = image[0].banner_image;

      if (req.file) {
        // Upload the new image, replacing the old one if a file is uploaded
        const uploadedFile = await updateFile(req.file, `banner_images/${userId}`, oldImage);
        bannerImage = uploadedFile.newFileName || oldImage;

        // Update the banner image in the database
        const updateQuery = `UPDATE banner_images SET banner_image = ? WHERE banner_image_id = ? AND userId = ?`;
        const [result] = await db.promise().query(updateQuery, [bannerImage, banner_image_id, userId]);

        if (result.affectedRows === 0) {
          return res.status(404).json({ error_msg: 'Banner image not found or user not authorized', response: false });
        }
      }

      return res.status(200).json({ success_msg: 'Banner image updated successfully', banner_image_id, response: true });

    } else {
      // Insert a new banner image if banner_image_id is not provided
      const uploadedFile = await uploadFile(req.file, `banner_images/${userId}`);
      bannerImage = uploadedFile.newFileName;

      const insertQuery = `INSERT INTO banner_images (userId, banner_image) VALUES (?, ?)`;
      const [result] = await db.promise().query(insertQuery, [userId, bannerImage]);

      return res.status(201).json({ success_msg: 'Banner image uploaded successfully', banner_image_id: result.insertId, response: true });
    }
  } catch (error) {
    console.error('Error inserting or updating banner image:', error);
    return res.status(500).json({ error_msg: 'Server error during insertion or update', details: error.message, response: false });
  }
};


// get banner images
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
      banner_image_id: image.banner_image_id,
      success_msg: 'Banner image retrieved successfully',
      response: true
    });
  });
};

// delete banner image
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

// Insert or Update Banner Image by User ID
exports.insertOrUpdateBannerImageByUserId = async (req, res) => {
  try {
    const { banner_image_id, userId } = req.body;

    let bannerImage = null;

    // If banner_image_id is provided, perform the update operation
    if (banner_image_id) {
      // Fetch the existing image
      const imageQuery = `SELECT banner_image FROM banner_images WHERE banner_image_id = ? AND userId = ?`;
      const [image] = await db.promise().query(imageQuery, [banner_image_id, userId]);

      if (image.length === 0) {
        return res.status(404).json({ error_msg: 'Banner image not found or user not authorized', response: false });
      }

      const oldImage = image[0].banner_image;

      // Upload the new image, replacing the old one if a file is uploaded
      const uploadedFile = await updateFile(req.file, `banner_images/${userId}`, oldImage);
      bannerImage = uploadedFile.newFileName || oldImage;

      // Update the banner image in the database
      const updateQuery = `UPDATE banner_images SET banner_image = ? WHERE banner_image_id = ? AND userId = ?`;
      const [result] = await db.promise().query(updateQuery, [bannerImage, banner_image_id, userId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error_msg: 'Banner image not found or user not authorized', response: false });
      }

      return res.status(200).json({ success_msg: 'Banner image updated successfully', banner_image_id, response: true });

    } else {
      // Insert a new banner image if banner_image_id is not provided
      const uploadedFile = await uploadFile(req.file, `banner_images/${userId}`);
      bannerImage = uploadedFile.newFileName;

      const insertQuery = `INSERT INTO banner_images (userId, banner_image) VALUES (?, ?)`;
      const [result] = await db.promise().query(insertQuery, [userId, bannerImage]);

      return res.status(201).json({ success_msg: 'Banner image uploaded successfully', banner_image_id: result.insertId, response: true });
    }
  } catch (error) {
    console.error('Error inserting or updating banner image:', error);
    return res.status(500).json({ error_msg: 'Server error during insertion or update', details: error.message, response: false });
  }
};

// getBannerImagesByUserId
exports.getBannerImagesByUserId = (req, res) => {
  const { userId } = req.params;
  // Check if userId is provided and is a valid string
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return res.status(400).json({ message: 'Invalid or missing userId' });
  }

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
      banner_image_id: image.banner_image_id,
      success_msg: 'Banner image retrieved successfully',
      response: true
    });
  });
};

// deleteBannerImageByUserId
exports.deleteBannerImageByUserId = (req, res) => {
  const { banner_image_id, userId } = req.query;

  // Check if banner_image_id is provided and is a valid string
  if (!banner_image_id || typeof banner_image_id !== 'string' || banner_image_id.trim() === '') {
    return res.status(400).json({ message: 'Invalid or missing banner_image_id' });
  }

  // Check if userId is provided and is a valid string
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return res.status(400).json({ message: 'Invalid or missing userId' });
  }

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
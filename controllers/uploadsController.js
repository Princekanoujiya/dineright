const db = require('../config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Insert or Update a banner image
exports.insertOrUpdateBannerImage = async (req, res) => {

  const userId = req.userId; // Assuming req.userId is set previously in the middleware
  const banner_image = req.file ? req.file.filename : null; // Get only the filename
  const { banner_image_id } = req.body;

  if (!banner_image) {
    return res.status(200).json({ error_msg: 'No banner image uploaded', response: false });
  }

  // Define the directory path for the user's banner images, convert userId to a string
  const dirPath = path.join(__dirname, '../uploads', 'banner_images', String(userId));

  // Check if the directory exists, if not, create it
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true }); // Create directory recursively
      console.log(`Directory created at: ${dirPath}`); // Debugging statement
    }
  } catch (err) {
    return res.status(500).json({ error_msg: 'Failed to create directory', details: err.message, response: false });
  }

  // Move the uploaded file to the appropriate directory
  const tempPath = req.file.path; // The temporary path where multer saves the file
  const destPath = path.join(dirPath, banner_image); // Destination path for the uploaded file

  // Move the file from tempPath to destPath
  fs.rename(tempPath, destPath, (err) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Error moving file', details: err.message, response: false });
    }

    // Set the complete path for the banner image
    const fullBannerImagePath = `/uploads/banner_images/${userId}/${banner_image}`;
    

    if (banner_image_id) {
      // 
      const imageQuery = `SELECT * FROM banner_images WHERE banner_image_id = ? AND userId = ?`;
      // const [image] = await db.promise().query(imageQuery, [banner_image_id, userId]);

      // Update operation if banner_image_id is provided
      const updateQuery = `UPDATE banner_images SET banner_image = ? WHERE banner_image_id = ? AND userId = ?`;
      db.query(updateQuery, [fullBannerImagePath, banner_image_id, userId], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during update', details: err.message, response: false });
        }
        if (result.affectedRows === 0) {
          return res.status(200).json({ error_msg: 'Banner image not found or user not authorized', response: false });
        }
        res.status(200).json({ success_msg: 'Banner image updated successfully', banner_image_id, response: true });
      });
    } else {
      // Insert operation if banner_image_id is not provided
      const insertQuery = `INSERT INTO banner_images (userId, banner_image) VALUES (?, ?)`;
      db.query(insertQuery, [userId, fullBannerImagePath], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
        }
        res.status(200).json({ success_msg: 'Banner image uploaded successfully', banner_image_id: result.insertId, response: true });
      });
    }
  });

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

// Insert or Update a banner image by userId
exports.insertOrUpdateBannerImageByUserId = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(200).json({ error_msg: 'Multer error', details: err.message, response: false });
    } else if (err) {
      return res.status(200).json({ error_msg: 'Error uploading file', details: err.message, response: false });
    }

    const { banner_image_id, userId } = req.body;

    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ message: 'Invalid or missing userId' });
    }

    const banner_image = req.file ? req.file.filename : null; // Get only the filename

    if (!banner_image) {
      return res.status(200).json({ error_msg: 'No banner image uploaded', response: false });
    }

    // Define the directory path
    const dirPath = path.join(__dirname, 'uploads', 'banner_images', userId);

    // Check if the directory exists, if not, create it
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true }); // Create directory recursively
    }

    // Move the uploaded file to the appropriate directory
    const tempPath = req.file.path; // The temporary path where multer saves the file
    const destPath = path.join(dirPath, banner_image); // Destination path for the uploaded file

    // Move the file from tempPath to destPath
    fs.rename(tempPath, destPath, (err) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Error moving file', details: err.message, response: false });
      }

      // Now that we have ensured the file is in the right place, we can proceed with the database operation
      const uploadedImagePath = `/uploads/banner_images/${userId}/${banner_image}`;

      if (banner_image_id) {
        // Update operation if banner_image_id is provided
        const updateQuery = `UPDATE banner_images 
                             SET banner_image = ? 
                             WHERE banner_image_id = ? AND userId = ?`;
        db.query(updateQuery, [uploadedImagePath, banner_image_id, userId], (err, result) => {
          if (err) {
            // Remove the file if the update fails
            fs.unlink(destPath, (unlinkErr) => {
              if (unlinkErr) {
                console.error('Error removing file:', unlinkErr);
              }
            });
            return res.status(200).json({ error_msg: 'Database error during update', details: err.message, response: false });
          }
          if (result.affectedRows === 0) {
            // Remove the file if no rows were affected
            fs.unlink(destPath, (unlinkErr) => {
              if (unlinkErr) {
                console.error('Error removing file:', unlinkErr);
              }
            });
            return res.status(200).json({ error_msg: 'Banner image not found or user not authorized', response: false });
          }
          res.status(200).json({ success_msg: 'Banner image updated successfully', banner_image_id, response: true });
        });
      } else {
        // Insert operation if banner_image_id is not provided
        const insertQuery = `INSERT INTO banner_images (userId, banner_image) VALUES (?, ?)`;
        db.query(insertQuery, [userId, uploadedImagePath], (err, result) => {
          if (err) {
            // Remove the file if the insertion fails
            fs.unlink(destPath, (unlinkErr) => {
              if (unlinkErr) {
                console.error('Error removing file:', unlinkErr);
              }
            });
            return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
          }
          res.status(200).json({ success_msg: 'Banner image uploaded successfully', banner_image_id: result.insertId, response: true });
        });
      }
    });
  });
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
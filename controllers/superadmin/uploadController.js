const db = require('../../config');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/frontend/banner_section'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage }).single('banner_image'); 

exports.insertOrUpdateBannerSection = (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ error: "Multer error occurred during file upload", details: err.message });
    } else if (err) {
      return res.status(500).json({ error: "Unknown error occurred during file upload", details: err.message });
    }
    const { banner_description } = req.body;
    const banner_image = req.file ? req.file.filename : null;
    if (req.body.frontend_banner_section_id) {
      const updateQuery = 'UPDATE frontend_banner_section SET banner_description = ?, banner_image = ? WHERE frontend_banner_section_id = ?';
      db.query(updateQuery, [banner_description, banner_image, req.body.frontend_banner_section_id], (err, result) => {
        if (err) {
          return res.status(500).json({ error: "Failed to update frontend section", details: err.message });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ error_msg: "Frontend section not found" });
        }
        return res.json({ success_msg: "Frontend section updated successfully", frontend_banner_section_id: req.body.frontend_banner_section_id });
      });
    } else {
      const insertQuery = 'INSERT INTO frontend_banner_section (banner_description, banner_image) VALUES (?, ?)';
      db.query(insertQuery, [ banner_description, banner_image], (err, result) => {
        if (err) {
          return res.status(500).json({ error: "Failed to create frontend section", details: err.message });
        }
        return res.status(201).json({ success_msg: "Frontend section created successfully", frontend_banner_section_id: result.insertId });
      });
    }
  });
};
exports.getAllBannerSections = (req, res) => {
  const getAllQuery = 'SELECT * FROM frontend_banner_section';
  db.query(getAllQuery, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch frontend sections", details: err.message });
    }
    return res.json(results);
  });
};
exports.getBannerSectionById = (req, res) => {
  const { frontend_banner_section_id } = req.params;

  const getQuery = 'SELECT * FROM frontend_banner_section WHERE frontend_banner_section_id = ?';
  db.query(getQuery, [frontend_banner_section_id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch frontend section", details: err.message });
    }
    if (result.length === 0) {
      return res.status(404).json({ error_msg: "Frontend section not found" });
    }
    return res.json(result[0]);
  });
};
// exports.softDeleteBannerSection = (req, res) => {
//   const { frontend_banner_section_id } = req.params;

//   const softDeleteQuery = 'UPDATE frontend_banner_section SET is_deleted = 1 WHERE frontend_banner_section_id = ?';
//   db.query(softDeleteQuery, [frontend_banner_section_id], (err, result) => {
//     if (err) {
//       return res.status(500).json({ error: "Failed to soft delete frontend section", details: err.message });
//     }
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error_msg: "Frontend section not found" });
//     }
//     return res.json({ success_msg: "Frontend section marked as deleted successfully" });
//   });
// };

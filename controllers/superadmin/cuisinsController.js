const db = require('../../config');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/frontend/cuisine_section'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage }).single('cuisine_image'); 

exports.insertOrUpdateCuisineSection = (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(200).json({ error_msg: "Multer error occurred during file upload", details: err.message ,response:false});
    } else if (err) {
      return res.status(200).json({ error_msg: "Unknown error occurred during file upload", details: err.message,response:false });
    }
    const { cuisine_description } = req.body;
    const cuisine_image = req.file ? req.file.filename : null;
    if (req.body.frontend_cuisine_section_id) {
      const updateQuery = 'UPDATE frontend_cuisine_section SET cuisine_description = ?, cuisine_image = ? WHERE frontend_cuisine_section_id = ?';
      db.query(updateQuery, [cuisine_description, cuisine_image, req.body.frontend_cuisine_section_id], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: "Failed to update frontend section", details: err.message,response:false });
        }
        if (result.affectedRows === 0) {
          return res.status(200).json({ error_msg: "Frontend section not found" ,response:false});
        }
        return res.json({ success_msg: "Frontend section updated successfully", frontend_cuisine_section_id: req.body.frontend_cuisine_section_id });
      });
    } else {
      const insertQuery = 'INSERT INTO frontend_cuisine_section (cuisine_description, cuisine_image) VALUES (?, ?)';
      db.query(insertQuery, [ cuisine_description, cuisine_image], (err, result) => {
        if (err) {
          return res.status(200).json({error_msg: "Failed to create frontend section", details: err.message });
        }
        return res.status(201).json({ success_msg: "Frontend section created successfully", frontend_cuisine_section_id: result.insertId });
      });
    }
  });
};
exports.getAllCuisinsSections = (req, res) => {
    const getAllQuery = 'SELECT cuisine_id, cuisine_name, cuisines_image FROM cuisines WHERE is_deleted=0';
    db.query(getAllQuery, (err, results) => {
      if (err) {
        return res.status(200).json({error_msg: "Failed to fetch frontend sections", details: err.message });
      }
      return res.json(results);
    });
};

exports.getCuisionSectionById = (req, res) => {
    const { cuisine_id } = req.params;
  
    const getQuery = 'SELECT cuisine_id, cuisine_name, cuisines_image FROM cuisines WHERE cuisine_id = ? AND is_deleted = 0';
    db.query(getQuery, [cuisine_id], (err, result) => {
      if (err) {
        return res.status(200).json({ error_msg: "Failed to fetch frontend section", details: err.message ,response:false});
      }
      if (result.length === 0) {
        return res.status(200).json({ error_msg: "Frontend section not found" ,response:false});
      }
      return res.json(result[0]);
    });
};
  
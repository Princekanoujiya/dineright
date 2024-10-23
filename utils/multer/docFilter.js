const path = require('path');

// Filter for documents (doc, docx, pdf, txt)
const docFilter = (req, file, cb) => {
  const allowedTypes = /doc|docx|pdf|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only document files (doc, docx, pdf, txt) are allowed'));
  }
};

module.exports = docFilter;

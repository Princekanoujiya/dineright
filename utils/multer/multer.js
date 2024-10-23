const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import the filters
const imageFilter = require('./imageFilter');
const docFilter = require('./docFilter');
const pdfFilter = require('./pdfFilter');
const videoFilter = require('./videoFilter');

// Set the upload folder path
const uploadFolder = path.join(__dirname, '../../uploads'); // Correctly join the directory path

// Ensure the uploads folder exists
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder); // Set upload destination folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// All file filter
const allFilter = (req, file, cb) => {
  // No filtering, accept all file types
  return cb(null, true);
};

// Set up Multer middleware with dynamic filters
const uploadWithFilter = (filter) => multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // Limit to 10MB (can be adjusted)
  fileFilter: filter
});

module.exports = {
  upload: uploadWithFilter(allFilter),
  uploadImage: uploadWithFilter(imageFilter),
  uploadDoc: uploadWithFilter(docFilter),
  uploadPDF: uploadWithFilter(pdfFilter),
  uploadVideo: uploadWithFilter(videoFilter)
};

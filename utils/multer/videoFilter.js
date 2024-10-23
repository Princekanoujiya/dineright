const path = require('path');

// Filter for video files
const videoFilter = (req, file, cb) => {
  const allowedTypes = /mp4|avi|mkv|mov/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only video files (mp4, avi, mkv, mov) are allowed'));
  }
};

module.exports = videoFilter;

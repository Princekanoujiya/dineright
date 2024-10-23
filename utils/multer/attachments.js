'use strict';
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Helper function to create a directory if it doesn't exist
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

// Function to upload a new file
async function uploadFile(file, folderName) {
  try {
    const originalPath = file.path;
    const ext = path.extname(file.originalname);
    const newName = `${uuidv4()}${ext}`;
    const uploadDirectory = path.join(__dirname, `../../uploads/${folderName}`);
    const newPath = path.join(uploadDirectory, newName);

    // Ensure the upload directory exists
    ensureDirectoryExists(uploadDirectory);

    // Rename (move) the uploaded file to the new path
    fs.renameSync(originalPath, newPath);

    // Update the file path in the request object for further processing
    file.path = newPath;

    const newFileName = `/uploads/${folderName}/${newName}`;

    return { newPath, newFileName };
  } catch (error) {
    console.error(`Error uploading file: ${error.message}`);
    throw new Error('File upload failed');
  }
}

// Function to update an existing file (replace an old file)
async function updateFile(file, folderName, oldFile) {
  try {
    const originalPath = file.path;
    const ext = path.extname(file.originalname);
    const newName = `${uuidv4()}${ext}`;
    const uploadDirectory = path.join(__dirname, `../../uploads/${folderName}`);
    const newPath = path.join(uploadDirectory, newName);

    // Ensure the upload directory exists
    ensureDirectoryExists(uploadDirectory);

    // Rename (move) the uploaded file to the new path
    fs.renameSync(originalPath, newPath);

    // Update the file path in the request object for further processing
    file.path = newPath;

    const newFileName = `/uploads/${folderName}/${newName}`;

    // Remove the old file if it exists
    if (oldFile) {
      const oldFilePath = path.join(__dirname, '..', '..', oldFile);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    return { newPath, newFileName };
  } catch (error) {
    console.error(`Error updating file: ${error.message}`);
    throw new Error('File update failed');
  }
}

module.exports = {
  uploadFile,
  updateFile,
};
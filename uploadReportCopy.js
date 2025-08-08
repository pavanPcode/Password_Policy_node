const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const router = express.Router();

// Get upload folder from .env
// const uploadFolder = path.join(__dirname, '..', process.env.UPLOAD_FOLDER);
const uploadFolder = process.env.UPLOAD_FOLDER

// Create folder if it doesn't exist
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  // filename: function (req, file, cb) {
  //   const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  //   const ext = path.extname(file.originalname);
  //   cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  // }
  filename: function (req, file, cb) {
  cb(null, file.originalname); // Keep the original filename
}
});

const upload = multer({ storage: storage });

// Upload endpoint
router.post('/uploadReportCopy', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ Status: false, message: 'No file uploaded' });
  }

  res.json({
    Status: true,
    message: 'File uploaded successfully',
    filename: req.file.filename,
    path: req.file.path
  });
});

module.exports = router;

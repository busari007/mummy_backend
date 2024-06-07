const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' })); // Add your React app's origin here

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

// Multer file filter to allow only image files
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'];
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only image files are allowed.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter
});

app.post('/upload', upload.single('image'), (req, res) => {
  res.send('Upload successful');
  console.log(req.file.originalname);
});

app.get('/images', (req, res) => {
  fs.readdir('./uploads', (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to scan directory' });
    }
    res.json(files);
  });
});

app.get('/images/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  res.sendFile(filePath);
});

// Add a new route to handle deletion of files
app.post('/delete', (req, res) => {
  const { filenames } = req.body;

  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(404).json({ error: 'Nothing was passed in' });
  }

  const deletionErrors = [];
  let deletedCount = 0;

  // Iterate over each filename in the array and delete the corresponding file
  filenames.forEach((filename, index) => {
    const filePath = path.join(__dirname, 'uploads', filename);

    fs.unlink(filePath, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // File does not exist
          deletionErrors.push({ filename, error: 'File not found' });
        } else {
          // Other errors
          deletionErrors.push({ filename, error: 'Error deleting file' });
        }
      } else {
        deletedCount++;
      }

      // Check if this is the last iteration
      if (index === filenames.length - 1) {
        if (deletionErrors.length > 0) {
          // If there were any errors during deletion, return them
          res.status(500).json({ errors: deletionErrors });
        } else {
          // Otherwise, all files were deleted successfully
          res.json({ message: `${deletedCount} files deleted successfully` });
        }
      }
    });
  });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

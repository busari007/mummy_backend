const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'https://omose.vercel.app/', 
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true
}));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DBNAME,
  waitForConnection: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database', err);
  } else {
    console.log("Successfully connected to database");
  }
});

app.get('/',(req,res)=>{
  res.send("Backend is functional");
});

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
  const { originalname, mimetype, size } = req.file;
  const filepath = path.join('uploads', originalname);

  const query = 'INSERT INTO files (filename, filepath, mimetype, size) VALUES (?, ?, ?, ?)';
  db.query(query, [originalname, filepath, mimetype, size], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database insertion failed' });
    }
    res.send('Upload successful');
    console.log(originalname);
  });
});

app.get('/images', (req, res) => {
  const query = 'SELECT filename FROM files';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to fetch files from database' });
    }
    res.json(results.map(row => row.filename));
  });
});

app.get('/images/:filename', (req, res) => {
  const { filename } = req.params;
  const query = 'SELECT filepath FROM files WHERE filename = ?';
  db.query(query, [filename], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    const filePath = results[0].filepath;
    res.sendFile(path.resolve(filePath));
  });
});

// Add a new route to handle deletion of files
app.post('/delete', (req, res) => {
  const { filenames } = req.body;

  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(404).json({ error: 'Nothing was passed in' });
  }

  const deletionErrors = [];
  let deletedCount = 0;

  filenames.forEach((filename, index) => {
    const query = 'SELECT filepath FROM files WHERE filename = ?';
    db.query(query, [filename], (err, results) => {
      if (err || results.length === 0) {
        deletionErrors.push({ filename, error: 'File not found in database' });
        return checkCompletion(index);
      }

      const filePath = results[0].filepath;

      fs.unlink(filePath, (fsErr) => {
        if (fsErr && fsErr.code !== 'ENOENT') {
          deletionErrors.push({ filename, error: 'Error deleting file' });
        } else {
          const deleteQuery = 'DELETE FROM files WHERE filename = ?';
          db.query(deleteQuery, [filename], (dbErr) => {
            if (dbErr) {
              deletionErrors.push({ filename, error: 'Error deleting file record from database' });
            } else {
              deletedCount++;
            }
            checkCompletion(index);
          });
        }
      });
    });
  });

  function checkCompletion(index) {
    if (index === filenames.length - 1) {
      if (deletionErrors.length > 0) {
        res.status(500).json({ errors: deletionErrors });
      } else {
        res.json({ message: `${deletedCount} files deleted successfully` });
      }
    }
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

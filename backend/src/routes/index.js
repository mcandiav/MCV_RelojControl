const express = require('express');
const router = express.Router();
const multer = require('multer');

const security = require('../middlewares/authJwt')
const file = require('../controllers/file');

router.use (function (req,res,next) {
  console.log('/' + req.method);
  next();
});

router.get('/',function(req,res){
    res.status(200)
});


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/home/chr/timer/backend/src/uploads/');
  },
  filename: function (req, file, cb) {
    // Asignar un nombre personalizado al archivo
    const customFilename = `${Date.now()}-${file.originalname}`;
    cb(null, customFilename);
  }
});

const upload = multer({ storage: storage });

router.post('/upload', [security.isAdmin, upload.array('file')], function(req, res) {
  file.upload(req, res)
});

module.exports = router;
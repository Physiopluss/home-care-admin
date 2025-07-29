const express = require('express');
const router = express.Router();
const s3Controller = require('../controllers/s3');

router.get('/get-presigned-url', s3Controller.getPresignedUrl);

module.exports = router;

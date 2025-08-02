const multer = require('multer');
const express = require('express');
const path = require('path');
const { handleQuery } = require('../controller/quarycontroller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/query', upload.array('documents'), handleQuery);

module.exports = router;

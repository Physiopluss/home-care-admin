const router = require('express').Router();
const advertisement = require('../../controllers/admin/AdvertisementController');

router.get('/list', advertisement.AllAdvertisements);




module.exports = router;
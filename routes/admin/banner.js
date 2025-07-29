const router = require('express').Router();
const BannerController = require('../../controllers/admin/banner');

router.get('/all', BannerController.getAllBanners);
router.post('/create', BannerController.createBanner);
router.post('/live', BannerController.editBanner);
router.delete('/delete/:bannerId', BannerController.deleteBanner);

module.exports = router;
const router = require('express').Router();
const {
    AllBlogs,
    GetSingleBlog,
    AddHelpContact,
    AllSpecializations,
    AllBanners,
    AddAdvertisement,
    GetCouponByCode,
    BlogsTitleSearch,
    AddInsuranceEnquiry,
    getDegree,
    GetSubSpecializationMultiId,
    getEvent
} = require('../../controllers/website/apiController');
const {
    LoggedIn
} = require('../../middleware/Appauth');
router.get('/all-blogs', AllBlogs);
router.get('/blog/:id', GetSingleBlog);
router.post('/add-help-contact', AddHelpContact);
router.get('/all-specializations', AllSpecializations);
router.get('/all-banners', AllBanners);
router.post('/add-advertisement', AddAdvertisement);
router.post('/coupon', GetCouponByCode);
router.get('/blogs-title-search', BlogsTitleSearch);
router.post('/add-insurance-enquiry', AddInsuranceEnquiry);
router.get('/degree', getDegree);
router.post('/get-sub-specialization-multi-id', GetSubSpecializationMultiId);
router.get('/get-event', getEvent);

module.exports = router;
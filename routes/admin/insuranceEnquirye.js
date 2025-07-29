const router = require('express').Router();
const InsuranceEnquiryController = require('../../controllers/admin/InsuranceEnquiryeController')

router.get('/list', InsuranceEnquiryController.getInsuranceEnquiry);
router.post('/callStatus', InsuranceEnquiryController.callStatus)


module.exports = router;
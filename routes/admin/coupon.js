const router = require('express').Router();
const { CouponCreate, CouponList, CouponEdit, updateCoupon, getCouponById, updateCouponStatus, deleteCoupon } = require('../../controllers/admin/couponController');

router.post('/create', CouponCreate);
router.get('/list', CouponList);
router.put('/edit/:id', CouponEdit);
router.put('/update', updateCoupon);
router.get('/get-coupon-By-Id', getCouponById);

router.put('/update-status', updateCouponStatus);

router.delete("/delete", deleteCoupon)





module.exports = router;
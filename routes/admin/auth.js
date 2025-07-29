const router = require('express').Router()
const { AddBanners, AddBlogs, registerAdmin, loginAdmin, addAppsettingData, getAppSettingData, createCoupon, addFtpMember, addTags, getAllTags, getAllBlogs, getAllFtpMembers, editBlogs, deleteBlog, editFtpMember, deleteFtp, sendNotification, addPlan, getAllPlan, getSinglePlan, getNotificationByUserId, readNotification, deleteSingleNotification, deleteAllNotification, sendNotificationToAllPhysios, sendNotificationToAllPatients, getAllBanner, editBanner, deleteBanner, getAllCoupon, editCoupon, deleteCoupon, editPlan, deletePlan, getAllTransactions, addSpecialization, editSpecialization, deleteSpecialization, getSingleCategory, getSpecialization, addDegreeData, editDegree, getData, addProductCategory, addProduct, adminkpisData, ApproveRejectPhysios, getAllOrdersAdmin, updateOrderStatus, deleteProductCategory, editProductCategory, editProduct, deleteProduct,
    loginPage, login,  sendOtpToAdmin, verifyOtp, resetPassword , getPhysiosByZipCode } = require('../../controllers/admin/auth')
// const { physioDashboardKpis } = require('../controllers/physi////o')

// const verifyToken =require('../../middleware/auth')
// const {LoggedIn} = require("../../middleware/admin") 
// const Degree = require('../../models/Degree');


// router.post('/login', loginAdmin);
// router.post("/product-category/add",addProductCategory)

// router.delete("/category-delete/product/:categoryId",deleteProductCategory)

// router.post("/category-update/product/:categoryId",editProductCategory)

// router.post("/product/add",addProduct)

// router.post("/edit-product/:productId",editProduct)

// router.delete("/delete-product/:productId",deleteProduct)



// router.get('/category/single/:categoryId',getSingleCategory)


router.post('/data/add', addDegreeData)

router.get('/data/get', getData)

router.get('/getPhysiosByZipCode',getPhysiosByZipCode )
// router.post('/data/edit/:degreeId',editDegree)

// router.post('/banner/add', AddBanners)

// router.get('/banners',getAllBanner)

// router.post('/banners/update/:bannerId',editBanner)

// router.delete('/banners/delete/:bannerId',deleteBanner)

// router.post('/blog/add',verifyToken, AddBlogs)

// router.get('/blogs',getAllBlogs)

// router.post('/blogs/edit/:blogId',verifyToken,editBlogs)

// router.delete('/blogs/delete/:blogId',verifyToken, deleteBlog)

// router.post('/register',registerAdmin)

// router.post('/signin',loginAdmin)

// router.post('/app-setting/data',verifyToken, addAppsettingData)

// router.get('/app-setting/data',getAppSettingData)

// router.post('/coupon/add',verifyToken, createCoupon)

// router.get('/coupon',getAllCoupon)

// router.post('/coupon/edit/:couponId',editCoupon)

// router.delete('/coupon/delete/:couponId',deleteCoupon)

// router.post('/ftp/add',verifyToken, addFtpMember)

// router.get('/ftp/members',verifyToken,getAllFtpMembers)

// router.post('/ftp/edit/:ftpId',verifyToken,editFtpMember)

// router.delete('/ftp/delete/:ftpId',verifyToken,deleteFtp)

// router.post('/tags/create',verifyToken, addTags)

// router.get('/tags/',getAllTags)

// router.get('/user/notification/:userId',getNotificationByUserId)

// router.get('/read/notification/:userId',readNotification)

// router.delete('/delete/notification/single/:notificationId',deleteSingleNotification)

// router.delete('/delete/notification/all/:userId',deleteAllNotification)

// router.post('/send-to-all/physio',sendNotificationToAllPhysios)

// router.post('/send-to-all/user',sendNotificationToAllPatients)

// router.post('/plan/add',addPlan)

// router.get('/plan/all',getAllPlan)

// router.post('/plan/edit:/planId',editPlan)

// router.delete('/plan/delete/:planId',deletePlan)

// router.get('/plan/single/:planId',getSinglePlan)

// router.get('/transaction/all',getAllTransactions)

// router.get("/kpis/data",adminkpisData)

// router.post("/approve&reject",ApproveRejectPhysios)

// router.get('/orders/admin',getAllOrdersAdmin)

// router.get("/update-order-status/:orderId",updateOrderStatus)



// Admin Pages
// router.get('/login', loginPage)

router.post('/login', login)
router.post('/send-otp', sendOtpToAdmin)
router.post('/verify-otp', verifyOtp)
router.post('/reset-password', resetPassword)

// router.get('/dashboard',  dashboard)

// router.post('/degree/add', addDegree);
// router.get('/degree/list', getDegrees);
// router.get('/degree/delete/:degreeId', deleteDegree);

// router.get('/physio/list', GetAllphysio);



module.exports = router
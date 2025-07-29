const router = require('express').Router()
const verifyToken = require('../../middleware/auth')
const { signUpOtp, loginOtp, verifyOtp, googleLogin, addPersonalDetails, AllBanners, AllBlogs,
    AllPhysioHomeVisit, AllPhysioClinicVisit, searchBlogs, searchPhysios,
    bookAppointment, getAllSlots, getAllAppointmentsByPatient,
    findPatientByPhone, getScheduleForTreatment, getTreatment,
    writeReview, editProfile, getSinglePatient, getAllSlotsByPhysioId,
    getReviewForDoctor, getAllPatient, verifyCoupon, verifyFTP,
    payForTreatment, upgradePlan, deletePatient, AllPhysioConsult,
    getAllAppointmentsRunningAppointments, getAllAppointmentsCompletedAppointments,
    getAllPhysioBySpecialization, getTreatmentByAppointmentId, getSingleAppointment,
    getAppointmentByPreferId, getTreatmentByPreferId, getAllSpecialization,
    likePhysio, isDeletedPatient, recoverDeletedPatient } = require('../../controllers/app/patient')
const appointment = require('../../models/appointment')
const { LoggedIn } = require('../../middleware/Appauth')

const { addBlog, AllBlogss, deleteBlog, addMultiplier, EditMultiplier } = require('../../controllers/s3')

router.post('/add', addBlog)

router.post('/add-multiplier', addMultiplier)

router.post('/edit-multiplier', EditMultiplier)

router.post('/sign-up/otp', signUpOtp)

router.post('/login/otp', loginOtp)

router.post('/recoverDeletedPatient', recoverDeletedPatient)

router.post('/verify/otp', verifyOtp)

router.post('/google/login', googleLogin)

router.post('/personal-details', addPersonalDetails)

router.put('/profile/edit/:patientId', editProfile)

router.get('/profile/:patientId', getSinglePatient)

router.get('/all/patient', verifyToken, getAllPatient)

router.get('/all-physio/home', AllPhysioHomeVisit)

router.get('/all-physio/clinic', AllPhysioClinicVisit)

router.get('/all-physio/consult', AllPhysioConsult)

router.get('/banners/get', AllBanners)

router.get('/blogs/get', AllBlogs)

router.post('/search/blog', searchBlogs)

router.post('/search/physio', searchPhysios)

router.post('/appointment/book/:patientId', verifyToken, bookAppointment)

router.get('/slots/all', getAllSlots)

router.get('/slots/all/:physioId', getAllSlotsByPhysioId)

router.get('/appointment/:patientId', verifyToken, getAllAppointmentsByPatient)
router.get('/appointment/running/:patientId', verifyToken, getAllAppointmentsRunningAppointments)
router.get('/appointment/completed/:patientId', verifyToken, getAllAppointmentsCompletedAppointments)

router.post('/get-patient/by-phone', findPatientByPhone)

router.get('/schedule/:treatmentId', verifyToken, getScheduleForTreatment)

router.get('/treatment/:patientId', verifyToken, getTreatment)

router.get("/treatment-by-appointment/:appointmentId", getTreatmentByAppointmentId)

router.get("/single-appointment/:appointmentId", getSingleAppointment)

router.get("/appointment-by-preferId/:patientId", getAppointmentByPreferId)

router.get("/treatment-by-preferId/:patientId", getTreatmentByPreferId)

router.post('/review/write/:patientId', writeReview)

router.get('/review/get/:physioId', getReviewForDoctor)

router.post('/verify/coupon', verifyToken, verifyCoupon)

router.post('/verify/ftp', verifyToken, verifyFTP)

router.post('/payForTreatment/:treatmentId', verifyToken, payForTreatment)

router.post('/plan/upgrade/:patientId', verifyToken, upgradePlan)

router.delete('/delete', deletePatient)

module.exports = router
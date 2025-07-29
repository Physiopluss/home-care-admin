const router = require('express').Router()
const {
    getSinglePhysioById,
    physioDashboardKpis,
    todayAppointmentPhysio,
    AllAppointmentPhysio,
    startTreatment,
    startConsultationOtp,
    verifyConsultationOtp,
    updateAppointmentStatus,
    allAppointmentRequest,
    walletDetails,
    getAllPhysios,
    allPatientListByPhysio,
    WritePreceptionNotes,
    AllUpcomingAppointment,
    getTreatmentByPhysio,
    getSingleTreatment,
    updatePrecptionNotes,
    editPhysioProfile,
    // verifyOtpPhysio,
    resendOtp,
    getPreceptionNotesByPhysio,
    deletePhysios,
    getPhysioByPreferId,
    getAllPhysiosRequest,
    getYourQrCode,
    getTreatmentByPhysioRunning,
    getTreatmentByPhysioCompleted,
    AllCompletedAppointment,
    toggleOnlineOfflinePhysio,
    specialization,
    getPhysioByFilter,
    demoGetPhysioByFilter,
    DemoPhysio,
    getPhysioByPreferIds,
    sendOtpToPhysio,
    patientverifyOtp,
    getFilteredPhysios
} = require('../../controllers/app/physio')
const Physio = require('../../models/physio')
const multer = require('multer')
const path = require('path')
const verifyToken = require('../../middleware/auth')
// const { payForAppointment } = require('../controllers/patient')

const serverName = "http://64.227.168.30:8090/api/physio/download/"


let store = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/upload")
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + file.originalname)
    }
})

let upload = multer({
    storage: store
})

const {
    getDegrees
} = require('../../controllers/app/degree');

router.post('/resend-otp', resendOtp)

router.get('/all/physios', getAllPhysios)

router.get('/toggle_online_offline/:physioId', verifyToken, toggleOnlineOfflinePhysio)

router.get('/all/physios-request', verifyToken, getAllPhysiosRequest)

router.get('/get-single-physio', getSinglePhysioById)

router.post('/edit/profile/:physioId', verifyToken, editPhysioProfile)

router.get('/dashboard/:physioId', verifyToken, physioDashboardKpis)

router.get('/appointment/today/:physioId', verifyToken, todayAppointmentPhysio)

router.get('/appointment/all/:physioId', verifyToken, AllAppointmentPhysio)

router.get('/appointment/upcoming/:physioId', verifyToken, AllUpcomingAppointment)

router.get("/appointment/completed/:physioId", verifyToken, AllCompletedAppointment)

router.get('/appointment/request/:physioId', verifyToken, allAppointmentRequest)

router.post('/notes/physio/:appointmentId', verifyToken, WritePreceptionNotes)

router.get('/start-consultaion/otp/:appointmentId', verifyToken, startConsultationOtp)

router.post('/verify-consultation/otp/', verifyToken, verifyConsultationOtp)

router.post('/treatment/start/:doctorId', verifyToken, startTreatment)

router.put('/appointment-status/update/:appointmentId', verifyToken, updateAppointmentStatus)

router.get('/treatment/:physioId', verifyToken, getTreatmentByPhysio)

router.get('/treatment/running/:physioId', verifyToken, getTreatmentByPhysioRunning)

router.get('/treatment/completed/:physioId', verifyToken, getTreatmentByPhysioCompleted)

router.get('/treatment/single/:treatmentId', verifyToken, getSingleTreatment)

router.post('/notes/update/:appointmentId', verifyToken, updatePrecptionNotes)

router.get('/notes/physio/:appointmentId', verifyToken, getPreceptionNotesByPhysio)

router.get('/patient/list/:physioId', allPatientListByPhysio)

router.delete('/delete/:physioId', verifyToken, deletePhysios)

router.get('/physio-by-preferId/:preferId', getPhysioByPreferId)

// router.get("/get-qr-code/:physioId",getYourQrCode)


router.get('/filter', getPhysioByFilter)
router.get('/demoFilter', demoGetPhysioByFilter)


router.get('/update-model', async (req, res) => {
    // const recordsToUpdate = await Physio.find({ shift: { $exists: false } });
    const recordsToUpdate = await Physio.find({
        shift: {
            $exists: false
        }
    });
    for (const record of recordsToUpdate) {
        record.shift = ''; // You can set a default value here
        await record.save();
    }
    console.log('Existing records updated successfully.');
})


// api for single image 
router.post('/upload-single-image', upload.single("image"), (req, res) => {
    // console.log(req.file.filename)
    if (req.file != null) {
        // req.file.originalname = req.file.originalname.replace(/ /g, "");
        //req.file.filename = req.file.filename.replace(/ /g, "");
        let newImage = serverName + req.file.filename
        return res.json({
            status: true,
            message: "Image Uploaded Successfully",
            imageUrl: newImage
        })
    } else {
        console.log("No Image")
        req.file = {
            originalname: null,
            filename: null
        };
    }
})

//api for multiple images
router.post('/upload-multiple-images', upload.array('images'), (req, res) => {
    try {
        if (req.files.length != 0) {
            let newImages = []
            req.files.forEach(j => {
                const filename = j.filename
                newImages.push(serverName + filename)
            })
            return res.json({
                status: true,
                message: "Images Uploaded Successfully",
                imageUrl: newImages
            })
        } else {
            console.log("No Image")
            req.file = {
                originalname: null,
                filename: null
            };
            return res.status(400).json({
                status: false,
                message: "Images not found"
            })
        }
    } catch (err) {
        res.status(400).json({
            message: err
        })
    }
})

router.get('/download/:filename', function (req, res, next) {

    filepath = path.join(__dirname, '../public/upload') + '/' + req.params.filename;

    res.download(filepath, req.params.filename);
})



// Degree routes
router.get('/degrees/list', getDegrees);


// Specialization routes
router.get('/specialization/list', specialization);


router.post('/demo-physio', DemoPhysio)

router.get('/physio-by-preferIds', getPhysioByPreferIds)

// router.post('/send-otp-to-physio', sendOtpToPhysio)

// router.post('/patient-verify-otp', patientverifyOtp)

router.get('/filtered-physios', getFilteredPhysios)


module.exports = router
const router = require('express').Router();
const PhysioController = require('../../controllers/admin/physioController');

router.get('/list', PhysioController.AllPhysio);
router.get('/list-physio-connect', PhysioController.allPhysioConnect);
router.get('/physioConnectById', PhysioController.physioConnectById);
router.post('/transfer-physio-connect', PhysioController.transferPhysioConnect);
router.get('/physioById', PhysioController.physioById);
router.get('/invoiceByPhysioId', PhysioController.getInvoiceByPhysioId);
router.post('/add', PhysioController.createPhysio);
// router.post('/update', PhysioController.editPhysio);
router.get("/getTodayPhysio", PhysioController.getTodayPhysio)
router.get('/getAllPhysiosSummary', PhysioController.getAllPhysiosSummary);
router.get('/getPhysioConnectSummary', PhysioController.getPhysioConnectSummary);
router.get('/getDeletedPhysio', PhysioController.getDeletedPhysio);
router.post('/updatePhysioAccountStatus', PhysioController.updatePhysioAccountStatus);
router.get('/getAllNotifications', PhysioController.getAllNotifications);


// country 
router.get("/allPhysioBefore", PhysioController.AllPhysioBefore);
router.get("/inactivePhysioCounts", PhysioController.InactivePhysioCounts);
router.get("/physioPayment", PhysioController.physioPayment);
router.get('/get-physio-by-state', PhysioController.getPhysioCountByState);

// state 
router.get('/physioGetState', PhysioController.physioGetState);
router.get('/InactivePhysioCountsState', PhysioController.InactivePhysioCountsState);
router.get('/physioPaymentState', PhysioController.physioPaymentState)
router.get('/getPhysioCountByCity', PhysioController.getPhysioCountByCity)

// city
router.get('/physioGetCity', PhysioController.physioGetStateAndCity);
router.get('/InactivePhysioCountsCity', PhysioController.InactivePhysioCountsStateAndCity);
router.get('/physioPaymentCity', PhysioController.physioPaymentStateAndCity)
router.get('/getPhysioCountByPincode', PhysioController.getPhysioCountByPinCode)

// pincode
router.get('/physioGetPincode', PhysioController.physioGetStateAndCityAndPincode);
router.get('/InactivePhysioCountsPincode', PhysioController.InactivePhysioCountsStateAndCityAndPincode);
router.get('/physioPaymentPincode', PhysioController.physioPaymentStateAndCityAndPincode)
router.get('/getPhysioCountByPincodeByPhysio', PhysioController.getPhysioCountByPincodeByPhysio)


// appointment
router.get("/getPhysioByTodayAppointment", PhysioController.getPhysioByTodayAppointment);
router.get("/getPhysioByGetAppointment", PhysioController.getPhysioByGetAppointment);
router.get("/getTodayAppointment", PhysioController.getTodayAppointment);

// chat
router.get("/getPhysioAndPatientChat", PhysioController.getPhysioAndPatientChat);

// review
router.get("/getReviewByPhysio", PhysioController.getReviewByPhysio);

// subscription
router.get("/physioSubscription", PhysioController.physioSubscription);
router.get("/get-Physio-by-paid", PhysioController.getPhysioBySubscription);
router.delete("/delete-subscription", PhysioController.deletePhysioSubscriptionById);
router.get("/get-Physio-by-pending", PhysioController.getPhysioBySubscriptionNotPaid);
router.get("/subscription-expired-physios", PhysioController.getSubscriptionExpiredPhysios);
router.post("/add-subscription", PhysioController.addSubscriptionPlan);

// delete
router.delete("/delete-physio", PhysioController.deletePhysio)
router.delete("/purge-physio", PhysioController.purgePhysio)

// block
router.get("/block-physio", PhysioController.blockPhysio)
router.get("/getBlockPhysio", PhysioController.getBlockedPhysio)

module.exports = router;
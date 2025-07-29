const { addDegree, getDegrees, deleteDegree } = require('../../controllers/admin/degreeController');
const router = require('express').Router();


router.post('/add', addDegree);
router.get('/list', getDegrees);
router.delete('/delete/:degreeId', deleteDegree);

module.exports = router;
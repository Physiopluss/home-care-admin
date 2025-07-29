const routes = require('express').Router();
const { getAllSpecializations } = require('../../controllers/app/specialization');

routes.get('/list', getAllSpecializations);

// routes.get('/:id', SpecializationController.getSpecializationById);

module.exports = routes;
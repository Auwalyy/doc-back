// routes/facility.routes.js
const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facility.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(facilityController.getFacilities)
  .post(authorize('ROM Supervisor', 'ICT Admin'), facilityController.createFacility);

router.get('/search/:stationName', facilityController.searchFacilities);

router.route('/:id')
  .get(facilityController.getFacility)
  .put(authorize('ROM Supervisor', 'ICT Admin'), facilityController.updateFacility)
  .delete(authorize('ICT Admin'), facilityController.deleteFacility);

module.exports = router;
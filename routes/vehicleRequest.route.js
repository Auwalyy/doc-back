// routes/vehicleRequest.routes.js
const express = require('express');
const router = express.Router();
const vehicleRequestController = require('../controllers/vehicleRequest.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.route('/')
  .get(vehicleRequestController.getVehicleRequests)
  .post(vehicleRequestController.createVehicleRequest);

router.get('/stats/dashboard', vehicleRequestController.getDashboardStats);

router.route('/:id')
  .get(vehicleRequestController.getVehicleRequest);

router.put('/:id/approve',
  authorize('Supervisor', 'ROM Supervisor', 'Corporate Services', 'Regional Coordinator', 'Vehicle Officer'),
  vehicleRequestController.approveVehicleRequest
);

router.put('/:id/decline',
  authorize('Supervisor', 'ROM Supervisor', 'Corporate Services', 'Regional Coordinator', 'Vehicle Officer'),
  vehicleRequestController.declineVehicleRequest
);

router.put('/:id/assign',
  authorize('Vehicle Officer'),
  vehicleRequestController.assignVehicle
);

module.exports = router;
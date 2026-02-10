// routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', authorize('ICT Admin', 'Regional Coordinator'), userController.getUsers);
router.get('/eligible-officers', authorize('Regional Coordinator'), userController.getEligibleOfficers);

router.put('/:id', authorize('ICT Admin'), userController.updateUser);
router.put('/:id/deactivate', authorize('ICT Admin'), userController.deactivateUser);

router.post('/relieving-officer', 
  authorize('Regional Coordinator', 'Supervisor'), 
  userController.requestRelievingOfficer
);

router.put('/:id/relieving-officer/approve',
  authorize('ICT Admin', 'Vehicle Officer'),
  userController.approveRelievingOfficer
);

router.put('/:id/relieving-officer/decline',
  authorize('ICT Admin', 'Vehicle Officer'),
  userController.declineRelievingOfficer
);

module.exports = router;
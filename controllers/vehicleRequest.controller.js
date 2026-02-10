// controllers/vehicleRequestController.js
const VehicleRequest = require('../models/VehicleRequest');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// @desc    Create vehicle request
// @route   POST /api/vehicle-requests
// @access  Private (All staff)
exports.createVehicleRequest = async (req, res) => {
  try {
    const {
      name, uniqueId, division, vehicleType, purpose, 
      destination, destinationDetails, durationOfTrip, 
      departureDate, dateOfReturn
    } = req.body;

    const vehicleRequest = await VehicleRequest.create({
      requestingOfficer: req.user._id,
      name,
      uniqueId,
      division,
      vehicleType,
      purpose,
      destination,
      destinationDetails,
      durationOfTrip,
      departureDate,
      dateOfReturn
    });

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'created_vehicle_request',
      description: `Created vehicle request ${vehicleRequest.requestId}`,
      resourceType: 'VehicleRequest',
      resourceId: vehicleRequest._id,
      metadata: { requestId: vehicleRequest.requestId, destination },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle request created successfully',
      data: { vehicleRequest }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error creating vehicle request', 
      error: error.message 
    });
  }
};

// @desc    Get all vehicle requests (filtered by role)
// @route   GET /api/vehicle-requests
// @access  Private
exports.getVehicleRequests = async (req, res) => {
  try {
    const { status, destination, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    // Role-based filtering
    const userRole = req.user.isActingAs?.role || req.user.role;
    
    if (userRole === 'Staff' || userRole === 'Uploader') {
      // Staff can only see their own requests
      query.requestingOfficer = req.user._id;
    } else if (userRole === 'Supervisor' || userRole === 'ROM Supervisor') {
      // Supervisors see requests pending their approval or from their department
      query.$or = [
        { 'approvals.supervisor.status': 'pending' },
        { requestingOfficer: req.user._id }
      ];
    } else if (userRole === 'Corporate Services') {
      // Corporate sees requests pending their approval (within town only)
      query.$or = [
        { 'approvals.corporate.status': 'pending', approvalFlow: 'within_town' },
        { requestingOfficer: req.user._id }
      ];
    } else if (userRole === 'Regional Coordinator') {
      // Regional Coordinator sees all out of town requests
      query.approvalFlow = 'out_of_town';
    } else if (userRole === 'Vehicle Officer') {
      // Vehicle officer sees all requests needing vehicle assignment
      query.$or = [
        { 'approvals.vehicleOfficer.status': 'pending' },
        { overallStatus: 'approved' }
      ];
    }
    // ICT Admin sees all
    
    // Additional filters
    if (status) query.overallStatus = status;
    if (destination) query.destination = destination;
    if (startDate || endDate) {
      query.departureDate = {};
      if (startDate) query.departureDate.$gte = new Date(startDate);
      if (endDate) query.departureDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const [requests, total] = await Promise.all([
      VehicleRequest.find(query)
        .populate('requestingOfficer', 'name staffId email department')
        .populate('approvals.supervisor.approvedBy', 'name staffId')
        .populate('approvals.corporate.approvedBy', 'name staffId')
        .populate('approvals.regionalCoordinator.approvedBy', 'name staffId')
        .populate('approvals.vehicleOfficer.approvedBy', 'name staffId')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      VehicleRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching vehicle requests', 
      error: error.message 
    });
  }
};

// @desc    Get single vehicle request
// @route   GET /api/vehicle-requests/:id
// @access  Private
exports.getVehicleRequest = async (req, res) => {
  try {
    const request = await VehicleRequest.findById(req.params.id)
      .populate('requestingOfficer', 'name staffId email department')
      .populate('approvals.supervisor.approvedBy', 'name staffId')
      .populate('approvals.corporate.approvedBy', 'name staffId')
      .populate('approvals.regionalCoordinator.approvedBy', 'name staffId')
      .populate('approvals.vehicleOfficer.approvedBy', 'name staffId')
      .populate('declinedBy.user', 'name staffId');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle request not found' 
      });
    }

    res.json({
      success: true,
      data: { request }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching vehicle request', 
      error: error.message 
    });
  }
};

// @desc    Approve vehicle request (Supervisor/Corporate/Regional/Vehicle Officer)
// @route   PUT /api/vehicle-requests/:id/approve
// @access  Private
exports.approveVehicleRequest = async (req, res) => {
  try {
    const { comments } = req.body;
    const request = await VehicleRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle request not found' 
      });
    }

    const userRole = req.user.isActingAs?.role || req.user.role;
    let approvalField = null;

    // Determine which approval field to update
    if (request.currentApprovalStage === 'supervisor' && 
        (userRole === 'Supervisor' || userRole === 'ROM Supervisor')) {
      approvalField = 'supervisor';
    } else if (request.currentApprovalStage === 'corporate' && 
               userRole === 'Corporate Services') {
      approvalField = 'corporate';
    } else if (request.currentApprovalStage === 'regional_coordinator' && 
               userRole === 'Regional Coordinator') {
      approvalField = 'regionalCoordinator';
    } else if (request.currentApprovalStage === 'vehicle_officer' && 
               userRole === 'Vehicle Officer') {
      approvalField = 'vehicleOfficer';
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to approve at this stage' 
      });
    }

    // Update approval
    request.approvals[approvalField].status = 'approved';
    request.approvals[approvalField].approvedBy = req.user._id;
    request.approvals[approvalField].approvedAt = new Date();
    request.approvals[approvalField].comments = comments;

    // Move to next stage
    request.moveToNextStage();

    await request.save();

    // Log activity
    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: userRole,
      action: 'approved_vehicle_request',
      description: `Approved vehicle request ${request.requestId} as ${approvalField}`,
      resourceType: 'VehicleRequest',
      resourceId: request._id,
      metadata: { 
        requestId: request.requestId, 
        approvalStage: approvalField,
        destination: request.destination 
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Create notification for requester
    request.notifications.push({
      recipient: request.requestingOfficer,
      message: `Your vehicle request ${request.requestId} has been approved by ${req.user.name}`,
      type: 'approved'
    });

    await request.save();

    res.json({
      success: true,
      message: 'Vehicle request approved successfully',
      data: { request }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error approving vehicle request', 
      error: error.message 
    });
  }
};

// @desc    Decline vehicle request
// @route   PUT /api/vehicle-requests/:id/decline
// @access  Private
exports.declineVehicleRequest = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a reason for declining' 
      });
    }

    const request = await VehicleRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle request not found' 
      });
    }

    const userRole = req.user.isActingAs?.role || req.user.role;

    // Update status
    request.overallStatus = 'declined';
    request.declinedBy = {
      user: req.user._id,
      role: userRole,
      reason,
      declinedAt: new Date()
    };

    await request.save();

    // Log activity
    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: userRole,
      action: 'declined_vehicle_request',
      description: `Declined vehicle request ${request.requestId}`,
      resourceType: 'VehicleRequest',
      resourceId: request._id,
      metadata: { requestId: request.requestId, reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Notify requester
    request.notifications.push({
      recipient: request.requestingOfficer,
      message: `Your vehicle request ${request.requestId} has been declined. Reason: ${reason}`,
      type: 'declined'
    });

    await request.save();

    res.json({
      success: true,
      message: 'Vehicle request declined',
      data: { request }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error declining vehicle request', 
      error: error.message 
    });
  }
};

// @desc    Assign driver and vehicle (Vehicle Officer only)
// @route   PUT /api/vehicle-requests/:id/assign
// @access  Private (Vehicle Officer)
exports.assignVehicle = async (req, res) => {
  try {
    const {
      driverName, driverId, assignedVehicleType, 
      assignedVehicleNumber, expectedReturn, urgentDispatch
    } = req.body;

    const request = await VehicleRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle request not found' 
      });
    }

    if (!request.areAllApprovalsComplete()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Request must be fully approved before assignment' 
      });
    }

    // Assign vehicle
    request.vehicleAssignment = {
      driverName,
      driverId,
      assignedVehicleType,
      assignedVehicleNumber,
      dispatchTime: new Date(),
      expectedReturn: expectedReturn || request.dateOfReturn,
      urgentDispatch: urgentDispatch || false
    };

    request.overallStatus = 'dispatched';

    // Send urgent dispatch alert if needed
    if (urgentDispatch) {
      request.vehicleAssignment.dispatchAlert = {
        sent: true,
        sentAt: new Date()
      };
      
      request.notifications.push({
        recipient: request.requestingOfficer,
        message: `URGENT: Your vehicle is on its way! Driver: ${driverName}`,
        type: 'dispatched'
      });
    }

    await request.save();

    // Log activity
    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'dispatched_vehicle',
      description: `Dispatched vehicle for request ${request.requestId}`,
      resourceType: 'VehicleRequest',
      resourceId: request._id,
      metadata: { 
        requestId: request.requestId, 
        driverName, 
        vehicleNumber: assignedVehicleNumber 
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Vehicle assigned and dispatched successfully',
      data: { request }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error assigning vehicle', 
      error: error.message 
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/vehicle-requests/stats/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await VehicleRequest.aggregate([
      {
        $facet: {
          todayRequests: [
            { $match: { createdAt: { $gte: today } } },
            { $group: { _id: '$overallStatus', count: { $sum: 1 } } }
          ],
          totalRequests: [
            { $group: { _id: '$overallStatus', count: { $sum: 1 } } }
          ],
          byDestination: [
            { $group: { _id: '$destination', count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: { stats: stats[0] }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching statistics', 
      error: error.message 
    });
  }
};

module.exports = exports;
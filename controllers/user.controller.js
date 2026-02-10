// controllers/userController.js
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (ICT Admin, Regional Coordinator)
exports.getUsers = async (req, res) => {
  try {
    const { department, role, isActive, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (department) query.department = department;
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('createdBy', 'name staffId')
        .populate('isActingAs.assignedBy', 'name staffId')
        .populate('relievingOfficer.officer', 'name staffId')
        .sort('name')
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        users,
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
      message: 'Error fetching users', 
      error: error.message 
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (ICT Admin)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, department, role, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (department) user.department = department;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'edited_staff',
      description: `Updated user ${user.name}`,
      resourceType: 'User',
      resourceId: user._id,
      metadata: { staffId: user.staffId, changes: req.body },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating user', 
      error: error.message 
    });
  }
};

// @desc    Deactivate user
// @route   PUT /api/users/:id/deactivate
// @access  Private (ICT Admin)
exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.isActive = false;
    await user.save();

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'deactivated_staff',
      description: `Deactivated user ${user.name}`,
      resourceType: 'User',
      resourceId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deactivating user', 
      error: error.message 
    });
  }
};

// @desc    Request relieving officer
// @route   POST /api/users/relieving-officer
// @access  Private (Regional Coordinator, Supervisors)
exports.requestRelievingOfficer = async (req, res) => {
  try {
    const { officerId, startDate, endDate } = req.body;

    const officer = await User.findById(officerId);
    if (!officer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Officer not found' 
      });
    }

    // Update requesting user
    req.user.relievingOfficer = {
      officer: officerId,
      startDate,
      endDate,
      status: 'pending'
    };
    await req.user.save();

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'assigned_relieving_officer',
      description: `Requested ${officer.name} as relieving officer`,
      resourceType: 'User',
      resourceId: req.user._id,
      metadata: { officerName: officer.name, startDate, endDate },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Relieving officer request submitted',
      data: { relievingOfficer: req.user.relievingOfficer }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error requesting relieving officer', 
      error: error.message 
    });
  }
};

// @desc    Approve relieving officer
// @route   PUT /api/users/:id/relieving-officer/approve
// @access  Private (ICT Admin, Vehicle Officer)
exports.approveRelievingOfficer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.relievingOfficer?.officer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Relieving officer request not found' 
      });
    }

    user.relievingOfficer.status = 'approved';
    user.relievingOfficer.approvedBy = user.relievingOfficer.approvedBy || [];
    user.relievingOfficer.approvedBy.push({
      user: req.user._id,
      role: req.user.role,
      approvedAt: new Date()
    });

    // Activate if all approvals complete (simplified - adjust based on workflow)
    if (user.relievingOfficer.approvedBy.length >= 2) {
      user.relievingOfficer.status = 'active';
    }

    await user.save();

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'approved_relieving_officer',
      description: `Approved relieving officer for ${user.name}`,
      resourceType: 'User',
      resourceId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Relieving officer approved',
      data: { relievingOfficer: user.relievingOfficer }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error approving relieving officer', 
      error: error.message 
    });
  }
};

// @desc    Decline relieving officer
// @route   PUT /api/users/:id/relieving-officer/decline
// @access  Private (ICT Admin, Vehicle Officer)
exports.declineRelievingOfficer = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user || !user.relievingOfficer?.officer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Relieving officer request not found' 
      });
    }

    user.relievingOfficer.status = 'declined';
    user.relievingOfficer.declinedBy = {
      user: req.user._id,
      reason,
      declinedAt: new Date()
    };

    await user.save();

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'declined_relieving_officer',
      description: `Declined relieving officer for ${user.name}`,
      resourceType: 'User',
      resourceId: user._id,
      metadata: { reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Relieving officer request declined'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error declining relieving officer', 
      error: error.message 
    });
  }
};

// @desc    Get eligible officers for relieving
// @route   GET /api/users/eligible-officers
// @access  Private (Regional Coordinator)
exports.getEligibleOfficers = async (req, res) => {
  try {
    const officers = await User.find({
      role: { $in: ['Senior Manager', 'Supervisor', 'Regional Coordinator'] },
      isActive: true,
      'relievingOfficer.status': { $ne: 'On Leave' }
    })
    .select('name staffId role department')
    .sort('name');

    res.json({
      success: true,
      data: { officers }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching eligible officers', 
      error: error.message 
    });
  }
};

module.exports = exports;
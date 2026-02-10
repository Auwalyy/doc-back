// controllers/facilityController.js
const Facility = require('../models/Facility');
const ActivityLog = require('../models/ActivityLog');

// @desc    Create new facility
// @route   POST /api/facilities
// @access  Private (ROM Supervisor, ICT Admin)
exports.createFacility = async (req, res) => {
  try {
    const { name, address, serialNo, fileType, location, takenOverBy } = req.body;

    const facility = await Facility.create({
      name,
      address,
      serialNo,
      fileType,
      location,
      takenOverBy,
      createdBy: req.user._id,
      status: takenOverBy?.company ? 'Taken Over' : 'Active'
    });

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: fileType === 'General File' ? 'uploaded_general_file' : 'uploaded_takeover_file',
      description: `Added facility: ${name}`,
      resourceType: 'Facility',
      resourceId: facility._id,
      metadata: { facilityName: name, serialNo },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: 'Facility created successfully',
      data: { facility }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error creating facility', 
      error: error.message 
    });
  }
};

// @desc    Get all facilities
// @route   GET /api/facilities
// @access  Private
exports.getFacilities = async (req, res) => {
  try {
    const { search, fileType, status, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { serialNo: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (fileType) query.fileType = fileType;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const [facilities, total] = await Promise.all([
      Facility.find(query)
        .populate('createdBy', 'name staffId')
        .populate('lastModifiedBy', 'name staffId')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      Facility.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        facilities,
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
      message: 'Error fetching facilities', 
      error: error.message 
    });
  }
};

// @desc    Get single facility
// @route   GET /api/facilities/:id
// @access  Private
exports.getFacility = async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id)
      .populate('createdBy', 'name staffId email')
      .populate('lastModifiedBy', 'name staffId')
      .populate('modifications.modifiedBy', 'name staffId')
      .populate('retailOutlets.updatedBy', 'name staffId');

    if (!facility) {
      return res.status(404).json({ 
        success: false, 
        message: 'Facility not found' 
      });
    }

    res.json({
      success: true,
      data: { facility }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching facility', 
      error: error.message 
    });
  }
};

// @desc    Update facility
// @route   PUT /api/facilities/:id
// @access  Private (ROM Supervisor, ICT Admin)
exports.updateFacility = async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json({ 
        success: false, 
        message: 'Facility not found' 
      });
    }

    const oldData = facility.toObject();
    
    // Update fields
    const allowedUpdates = ['name', 'address', 'serialNo', 'location', 'mapUrl', 
                           'takenOverBy', 'fileType', 'status', 'retailOutlets'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        facility[field] = req.body[field];
      }
    });

    // Add modification history
    facility.addModification(req.user._id, {
      oldData: oldData,
      newData: req.body
    });

    await facility.save();

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'edited_facility',
      description: `Updated facility: ${facility.name}`,
      resourceType: 'Facility',
      resourceId: facility._id,
      metadata: { facilityName: facility.name },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Facility updated successfully',
      data: { facility }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating facility', 
      error: error.message 
    });
  }
};

// @desc    Delete facility
// @route   DELETE /api/facilities/:id
// @access  Private (ICT Admin only)
exports.deleteFacility = async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json({ 
        success: false, 
        message: 'Facility not found' 
      });
    }

    await facility.deleteOne();

    await ActivityLog.createLog({
      user: req.user._id,
      staffName: req.user.name,
      role: req.user.role,
      action: 'deleted_facility',
      description: `Deleted facility: ${facility.name}`,
      resourceType: 'Facility',
      resourceId: facility._id,
      metadata: { facilityName: facility.name, serialNo: facility.serialNo },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Facility deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting facility', 
      error: error.message 
    });
  }
};

// @desc    Search facilities by station name
// @route   GET /api/facilities/search/:stationName
// @access  Private
exports.searchFacilities = async (req, res) => {
  try {
    const { stationName } = req.params;

    const facilities = await Facility.find({
      name: { $regex: stationName, $options: 'i' }
    })
    .populate('createdBy', 'name staffId')
    .limit(10);

    res.json({
      success: true,
      data: { facilities }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error searching facilities', 
      error: error.message 
    });
  }
};

module.exports = exports;
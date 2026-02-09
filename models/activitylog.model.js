// models/ActivityLog.js
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  staffName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'password_reset',
      'uploaded_general_file',
      'uploaded_takeover_file',
      'created_vehicle_request',
      'approved_vehicle_request',
      'declined_vehicle_request',
      'dispatched_vehicle',
      'created_item_request',
      'approved_item_request',
      'declined_item_request',
      'added_facility',
      'edited_facility',
      'deleted_facility',
      'created_staff',
      'edited_staff',
      'deactivated_staff',
      'activated_staff',
      'assigned_relieving_officer',
      'approved_relieving_officer',
      'declined_relieving_officer',
      'acting_as_role',
      'exported_data',
      'other'
    ]
  },
  description: {
    type: String,
    required: true
  },
  resourceType: {
    type: String,
    enum: ['VehicleRequest', 'ItemRequest', 'Facility', 'User', 'System', 'Other']
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: false
});

// Indexes for efficient querying
activityLogSchema.index({ user: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ resourceType: 1, resourceId: 1 });

// Static method to create log entry
activityLogSchema.statics.createLog = async function(logData) {
  try {
    const log = new this(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error creating activity log:', error);
    // Don't throw - logging should not break app flow
    return null;
  }
};

// Method to get formatted description for UI
activityLogSchema.methods.getFormattedDescription = function() {
  const actionDescriptions = {
    'uploaded_general_file': 'Uploaded a general file',
    'uploaded_takeover_file': 'Uploaded a take over file',
    'password_reset': 'Reset a password',
    'approved_vehicle_request': (meta) => `Approved a Vehicle Request (${meta?.destination || ''})`,
    'acting_as_role': (meta) => `Is now acting as ${meta?.role || 'Unknown Role'}`,
    // Add more formatted descriptions as needed
  };

  const formatter = actionDescriptions[this.action];
  if (typeof formatter === 'function') {
    return formatter(this.metadata);
  }
  return formatter || this.description;
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
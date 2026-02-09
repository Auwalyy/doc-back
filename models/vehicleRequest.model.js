// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  staffId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  department: {
    type: String,
    required: true,
    enum: ['DSSRI', 'DSSR', 'ROM', 'Corporate Services', 'Logistics', 'ICT', 'Regional Office', 'Other']
  },
  role: {
    type: String,
    required: true,
    enum: ['Staff', 'Uploader', 'Approver', 'Viewer', 'ROM Supervisor', 'Supervisor', 'Corporate Services', 
           'Regional Coordinator', 'Vehicle Officer', 'ICT Admin'],
    default: 'Staff'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isActingAs: {
    role: String,
    startDate: Date,
    endDate: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  relievingOfficer: {
    officer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'active', 'completed'],
      default: 'pending'
    },
    approvedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: String,
      approvedAt: Date
    }],
    declinedBy: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String,
      declinedAt: Date
    }
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for performance
userSchema.index({ staffId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ department: 1, role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user has permission
userSchema.methods.hasPermission = function(permission) {
  const rolePermissions = {
    'Staff': ['view_own_requests', 'create_vehicle_request', 'create_item_request', 'view_companies'],
    'Uploader': ['upload_files', 'view_own_requests'],
    'Approver': ['approve_requests', 'view_team_requests'],
    'Viewer': ['view_all_requests'],
    'ROM Supervisor': ['approve_vehicle_level1', 'add_facility', 'edit_facility', 'view_team_requests'],
    'Supervisor': ['approve_vehicle_level1', 'view_department_requests'],
    'Corporate Services': ['approve_vehicle_level2', 'view_corporate_requests'],
    'Regional Coordinator': ['approve_vehicle_level3', 'assign_relieving_officer', 'view_all_data', 'export_data'],
    'Vehicle Officer': ['approve_vehicle_final', 'assign_driver', 'dispatch_vehicle', 'edit_vehicle_info'],
    'ICT Admin': ['manage_users', 'view_activity_log', 'system_config']
  };

  const userRole = this.isActingAs?.role || this.role;
  return rolePermissions[userRole]?.includes(permission) || false;
};

module.exports = mongoose.model('User', userSchema);
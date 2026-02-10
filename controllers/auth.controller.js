// controllers/authController.js
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { staffId, email, password } = req.body;

    if ((!staffId && !email) || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide staff ID/email and password' 
      });
    }

    const user = await User.findOne({
      $or: [{ staffId }, { email }],
      isActive: true
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    await ActivityLog.createLog({
      user: user._id,
      staffName: user.name,
      role: user.role,
      action: 'login',
      description: `${user.name} logged in`,
      resourceType: 'System',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          staffId: user.staffId,
          name: user.name,
          email: user.email,
          department: user.department,
          role: user.role,
          isActingAs: user.isActingAs
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error logging in', error: error.message });
  }
};

// Additional auth methods...
module.exports = exports;
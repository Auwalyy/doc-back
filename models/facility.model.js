// models/Facility.js
const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true
  },
  serialNo: {
    type: String,
    required: true,
    unique: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  mapUrl: String,
  
  // Takeover information
  takenOverBy: {
    company: String,
    date: Date,
    documents: [{
      filename: String,
      fileUrl: String,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // File categorization
  fileType: {
    type: String,
    enum: ['General File', 'Take Over File'],
    required: true
  },
  
  // Retail outlet information (for inventory/checklist)
  retailOutlets: [{
    outletName: String,
    outletAddress: String,
    pmsOpeningStock: Number, // Litres
    productReceived: Number, // Litres
    priceRange: String, // Naira
    pumpDispensingLevel: String,
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Taken Over'],
    default: 'Active'
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  modifications: [{
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedAt: Date,
    changes: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Geospatial index for location-based queries
facilitySchema.index({ location: '2dsphere' });
facilitySchema.index({ serialNo: 1 });
facilitySchema.index({ name: 'text' });
facilitySchema.index({ status: 1 });

// Method to add modification history
facilitySchema.methods.addModification = function(userId, changes) {
  this.modifications.push({
    modifiedBy: userId,
    modifiedAt: new Date(),
    changes: changes
  });
  this.lastModifiedBy = userId;
};

module.exports = mongoose.model('Facility', facilitySchema);
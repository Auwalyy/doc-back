// models/ItemRequest.js
const mongoose = require('mongoose');

const itemRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  requestType: {
    type: String,
    enum: ['Internal'],
    default: 'Internal'
  },
  requestingOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  officerName: {
    type: String,
    required: true
  },
  uniqueId: {
    type: String,
    required: true
  },
  division: {
    type: String,
    required: true
  },
  
  items: [{
    description: {
      type: String,
      required: true
    },
    unit: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    allocation: String, // Purpose/allocation details
  }],
  
  supportingDocuments: [{
    filename: String,
    fileUrl: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'declined', 'fulfilled', 'partially_fulfilled'],
    default: 'pending'
  },
  
  approvals: [{
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approverRole: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined']
    },
    comments: String,
    approvedAt: Date
  }],
  
  fulfillment: {
    fulfilledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fulfilledAt: Date,
    itemsFulfilled: [{
      itemId: mongoose.Schema.Types.ObjectId,
      quantityFulfilled: Number,
      notes: String
    }],
    notes: String
  },
  
  declinedBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    declinedAt: Date
  }
}, {
  timestamps: true
});

// Indexes
itemRequestSchema.index({ requestId: 1 });
itemRequestSchema.index({ requestingOfficer: 1 });
itemRequestSchema.index({ status: 1 });
itemRequestSchema.index({ createdAt: -1 });

// Generate request ID
itemRequestSchema.pre('save', async function(next) {
  if (!this.requestId) {
    const count = await mongoose.model('ItemRequest').countDocuments();
    this.requestId = `ITEM-REQ-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('ItemRequest', itemRequestSchema);
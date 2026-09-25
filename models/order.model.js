import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['placed', 'shipped', 'delivered', 'cancelled'],
    default: 'placed',
  },
}, {
  timestamps: true,
});

export default mongoose.model('Order', orderSchema);
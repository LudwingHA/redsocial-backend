import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['like_post', 'comment_post', 'new_message', 'new_follower']
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  comment: {
    type: String,
    maxlength: 500
  },
  isRead: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Índices para mejor performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1, createdAt: -1 });
notificationSchema.index({ sender: 1, recipient: 1, type: 1 });

export default mongoose.model('Notification', notificationSchema);
import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  content: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 1000 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  likes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
});

const postSchema = new mongoose.Schema({
  content: { 
    type: String, 
    required: function() {
      return !this.image && !this.video;
    },
    trim: true,
    maxlength: 5000 
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  image: { 
    type: String 
  },
  video: { 
    type: String 
  },
  likes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  comments: [commentSchema],
  tags: [{ 
    type: String, 
    lowercase: true 
  }],
  privacy: { 
    type: String, 
    enum: ['public', 'friends', 'private'], 
    default: 'public' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Actualizar updatedAt antes de guardar
postSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Índices para mejor performance
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ privacy: 1, createdAt: -1 });
postSchema.index({ 'comments.timestamp': -1 });

export default mongoose.model('Post', postSchema);
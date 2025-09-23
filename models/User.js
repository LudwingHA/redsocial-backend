import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: [true, 'El username es requerido'], 
    unique: true,
    trim: true,
    minlength: [3, 'El username debe tener al menos 3 caracteres'],
    maxlength: [30, 'El username no puede exceder 30 caracteres']
  },
  email: { 
    type: String, 
    required: [true, 'El email es requerido'], 
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  password: { 
    type: String, 
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
  },
  phone: { 
    type: String,
    match: [/^\d{10}$/, 'Formato de teléfono inválido']
  },
  age: { 
    type: Number, 
    min: [13, 'Debes tener al menos 13 años'], 
    max: [120, 'Edad inválida'] 
  },
  avatar: { 
    type: String, 
    default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
  },
  bio: { 
    type: String, 
    maxlength: [500, 'La biografía no puede exceder 500 caracteres'] 
  },
  location: { type: String },
  interests: [{ type: String }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

// Hash password antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Método para comparar passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
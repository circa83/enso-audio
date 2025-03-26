// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password should be at least 8 characters long'],
  },
  role: {
    type: String,
    enum: ['therapist', 'admin'],
    default: 'therapist',
  },
  // Therapist-specific information
  profile: {
    title: String,
    bio: String,
    specialties: [String],
    organization: String,
  },
  // Session statistics
  stats: {
    sessionsCompleted: {
      type: Number,
      default: 0,
    },
    activeClients: {
      type: Number,
      default: 0,
    },
    totalSessionTime: {
      type: Number, // In milliseconds
      default: 0,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password validity
UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Prevent returning password in JSON responses
UserSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    return ret;
  }
});

// Prevent mongoose error when model is already defined
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
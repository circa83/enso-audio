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
    index: true, // Add index for faster lookups
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
    index: true, // Add index for sorting
  },
  lastLogin: {
    type: Date,
    default: null
  }
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    console.error('Error hashing password:', error);
    next(error);
  }
});

// Method to check password validity with improved error handling
UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // Ensure candidate password is provided
    if (!candidatePassword) {
      console.warn('Empty password provided for comparison');
      return false;
    }
    
    // Ensure the model has a password to compare against
    if (!this.password) {
      console.error('User model has no password stored');
      return false;
    }
    
    // Compare passwords with bcrypt
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    
    // Update last login time if passwords match
    if (isMatch) {
      this.lastLogin = new Date();
      // Save without triggering validators to avoid potential issues
      await this.save({ validateBeforeSave: false });
    }
    
    return isMatch;
  } catch (error) {
    console.error('Password comparison error:', error);
    // Return false on error rather than throwing to prevent API failures
    return false;
  }
};

// Prevent returning password in JSON responses
UserSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    return ret;
  }
});

// Add index to commonly queried fields
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });

// Prevent mongoose error when model is already defined
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
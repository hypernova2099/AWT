import mongoose from "mongoose";

// Enhanced User Schema
const userSchema = new mongoose.Schema({
  name: { type: String },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  settings: {
    breakReminderInterval: { type: Number, default: 60 },
    enableNotifications: { type: Boolean, default: true },
    enableWebcam: { type: Boolean, default: false }
  }
});

// Enhanced Dashboard Schema for Real-time Data
const dashboardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  burnoutScore: { type: Number, default: 0 },
  burnoutLevel: { type: String, default: "Low" },
  workHours: { type: Number, default: 0 },
  sessionTime: { type: Number, default: 0 }, // in minutes
  eyeStrain: {
    status: { type: String, default: "Normal" },
    averageLevel: { type: Number, default: 0 },
    totalAlerts: { type: Number, default: 0 },
    lastAlert: { type: Date }
  },
  productivityScore: { type: Number, default: 0 },
  focusTime: { type: Number, default: 0 }, // in minutes
  breaksTaken: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

// Enhanced Burnout Logs with More Metrics
const burnoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  burnoutScore: Number,
  burnoutLevel: String,
  factors: {
    workIntensity: Number,
    eyeStrain: Number,
    sessionLength: Number,
    breakFrequency: Number,
    lateNightWork: Number
  },
  timestamp: { type: Date, default: Date.now }
});

// Enhanced Eye Strain Logs
const eyeStrainLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  eyeStrainStatus: String, // "None", "Mild", "Severe"
  blinkRate: Number, // blinks per minute
  sessionDuration: Number, // minutes
  timestamp: { type: Date, default: Date.now }
});

// Enhanced App Usage Tracking
const appUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  appName: String,
  usageMinutes: Number,
  category: String, // "Coding", "Browsing", "Communication", "Entertainment"
  timestamp: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

// Enhanced Activity Logs
const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  activityType: String, // "Coding", "Meeting", "Break", "Research", "Planning"
  durationMinutes: Number,
  productivityLevel: Number, // 1-10 scale
  timestamp: { type: Date, default: Date.now }
});

// Session Tracking
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  durationMinutes: Number,
  appsUsed: [String],
  activities: [String],
  eyeStrainAlerts: Number,
  breaksTaken: Number
});

// Recommendations based on actual data
const recommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recommendationText: String,
  priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
  category: String, // "Eye Care", "Break", "Posture", "Hydration", "Workload"
  isApplied: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Export Models
const User = mongoose.model("User", userSchema);
const Dashboard = mongoose.model("Dashboard", dashboardSchema);
const BurnoutLog = mongoose.model("BurnoutLog", burnoutLogSchema);
const EyeStrainLog = mongoose.model("EyeStrainLog", eyeStrainLogSchema);
const AppUsage = mongoose.model("AppUsage", appUsageSchema);
const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
const Session = mongoose.model("Session", sessionSchema);
const Recommendation = mongoose.model("Recommendation", recommendationSchema);

export { 
  User, Dashboard, BurnoutLog, EyeStrainLog, 
  AppUsage, ActivityLog, Session, Recommendation 
};
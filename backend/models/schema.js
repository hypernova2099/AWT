import mongoose from "mongoose";

//1. User Collection 
const userSchema = new mongoose.Schema({
  name: { type: String },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// --- Dashboard Schema ---
const dashboardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // ✅ optional
  isDummy: { type: Boolean, default: false },
  burnoutScore: Number,
  burnoutLevel: String,
  workHours: Number,
  sessionTime: Number,
  eyeStrain: Number
});

// --- Burnout Logs ---
const burnoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // ✅ optional
  isDummy: { type: Boolean, default: false },
  burnoutScore: Number,
  burnoutLevel: String,
  timestamp: { type: Date, default: Date.now }
});

// --- Eye Strain Logs ---
const eyeStrainLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // ✅ optional
  isDummy: { type: Boolean, default: false },
  eyeStrainStatus: String,
  timestamp: { type: Date, default: Date.now }
});

// --- App Usage ---
const appUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // ✅ optional
  isDummy: { type: Boolean, default: false },
  appName: String,
  usageMinutes: Number,
  timestamp: { type: Date, default: Date.now }
});

// --- Activity Logs ---
const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // ✅ optional
  isDummy: { type: Boolean, default: false },
  activityType: String,
  durationMinutes: Number,
  timestamp: { type: Date, default: Date.now }
});

// --- Recommendations ---
const recommendationSchema = new mongoose.Schema({
  isDummy: { type: Boolean, default: false },
  recommendationText: String
});

// --- Export Models ---
const User = mongoose.model("User", userSchema);
const Dashboard = mongoose.model("Dashboard", dashboardSchema);
const BurnoutLog = mongoose.model("BurnoutLog", burnoutLogSchema);
const EyeStrainLog = mongoose.model("EyeStrainLog", eyeStrainLogSchema);
const AppUsage = mongoose.model("AppUsage", appUsageSchema);
const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
const Recommendation = mongoose.model("Recommendation", recommendationSchema);

export { User, Dashboard, BurnoutLog, EyeStrainLog, AppUsage, ActivityLog, Recommendation };
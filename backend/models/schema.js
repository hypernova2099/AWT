import mongoose from "mongoose";

//1. User Collection 
const userSchema = new mongoose.Schema({
  name: { type: String },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model("User", userSchema);

//2. Dashboard Collection 
const dashboardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  burnoutScore: { type: Number, default: 0 },
  burnoutLevel: { type: String, default: "Low" }, // Low / Medium / High
  workHours: { type: Number, default: 0 },
  sessionTime: { type: Number, default: 0 },
  eyeStrain: { type: Number, default: 0 },        // count or % of eye strain events
  updatedAt: { type: Date, default: Date.now }
});

export const Dashboard = mongoose.model("Dashboard", dashboardSchema);

// 3. BurnoutLogs 
const burnoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
  burnoutScore: { type: Number, required: true },
  burnoutLevel: { type: String, required: true } // Low / Medium / High
});

export const BurnoutLog = mongoose.model("BurnoutLog", burnoutLogSchema);

// 4. EyeStrainLogs 
const eyeStrainLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
  eyeStrainStatus: { type: String, required: true } // None / Mild / Severe
});

export const EyeStrainLog = mongoose.model("EyeStrainLog", eyeStrainLogSchema);

//5. AppUsage
const appUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  appName: { type: String, required: true },
  usageMinutes: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

export const AppUsage = mongoose.model("AppUsage", appUsageSchema);

// 6. ActivityLogs
const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  activityType: { type: String, required: true },  // Coding, Meeting, Browsing, etc.
  durationMinutes: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

//  7. Recommendations
const recommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
  recommendationText: { type: String, required: true }
});

export const Recommendation = mongoose.model("Recommendation", recommendationSchema);
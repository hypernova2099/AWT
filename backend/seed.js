import mongoose from "mongoose";
import { Dashboard, BurnoutLog, EyeStrainLog, AppUsage, ActivityLog, Recommendation } from "./models/schema.js";

const MONGO_URI = "mongodb+srv://aditya:digitalburnout@cluster0.zn1dt0m.mongodb.net/DigitalBurnout?retryWrites=true&w=majority";

await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected for seeding");

// --- DUMMY DASHBOARD ---
const dummyDashboard = await Dashboard.findOne({ isDummy: true });
if (!dummyDashboard) {
  await Dashboard.create({
    isDummy: true,
    burnoutScore: 65,
    burnoutLevel: "Moderate",
    workHours: 8,
    sessionTime: 120,
    eyeStrain: 5
  });
  console.log("✅ Dummy Dashboard seeded");
}

// --- DUMMY BURNOUT LOGS ---
const dummyBurnout = await BurnoutLog.findOne({ isDummy: true });
if (!dummyBurnout) {
  const logs = [];
  for (let i = 6; i >= 0; i--) {
    logs.push({
      isDummy: true,
      burnoutScore: 60 + Math.floor(Math.random() * 20),
      burnoutLevel: "Moderate",
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });
  }
  await BurnoutLog.insertMany(logs);
  console.log("✅ Dummy Burnout logs seeded");
}

// --- DUMMY EYE STRAIN LOGS ---
const dummyEye = await EyeStrainLog.findOne({ isDummy: true });
if (!dummyEye) {
  const logs = [];
  for (let i = 6; i >= 0; i--) {
    logs.push({
      isDummy: true,
      eyeStrainStatus: i % 2 === 0 ? "Low" : "High",
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });
  }
  await EyeStrainLog.insertMany(logs);
  console.log("✅ Dummy Eye Strain logs seeded");
}

// --- DUMMY APP USAGE ---
const dummyApps = await AppUsage.findOne({ isDummy: true });
if (!dummyApps) {
  const apps = ["VS Code", "Chrome", "Slack", "Terminal"];
  const logs = [];
  for (let i = 6; i >= 0; i--) {
    logs.push({
      isDummy: true,
      appName: apps[i % apps.length],
      usageMinutes: 60 + Math.floor(Math.random() * 120),
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });
  }
  await AppUsage.insertMany(logs);
  console.log("✅ Dummy App Usage logs seeded");
}

// --- DUMMY ACTIVITY LOGS ---
const dummyActivity = await ActivityLog.findOne({ isDummy: true });
if (!dummyActivity) {
  const logs = [];
  for (let i = 0; i < 5; i++) {
    logs.push({
      isDummy: true,
      activityType: `Dummy activity ${i + 1}`,
      durationMinutes: 30 + i * 10,
      timestamp: new Date(Date.now() - i * 3600 * 1000)
    });
  }
  await ActivityLog.insertMany(logs);
  console.log("✅ Dummy Activity logs seeded");
}

// --- DUMMY RECOMMENDATIONS ---
const dummyRec = await Recommendation.findOne({ isDummy: true });
if (!dummyRec) {
  await Recommendation.insertMany([
    { isDummy: true, recommendationText: "Take a 5-minute break every hour." },
    { isDummy: true, recommendationText: "Reduce screen brightness to avoid strain." },
    { isDummy: true, recommendationText: "Follow 20-20-20 rule for eye health." }
  ]);
  console.log("✅ Dummy Recommendations seeded");
}

process.exit();

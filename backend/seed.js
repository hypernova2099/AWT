import mongoose from "mongoose";
import { Dashboard, BurnoutLog, EyeStrainLog, AppUsage, ActivityLog, Recommendation } from "./models/schema.js";

const MONGO_URI = "mongodb+srv://aditya:digitalburnout@cluster0.zn1dt0m.mongodb.net/DigitalBurnout?retryWrites=true&w=majority";

await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected for seeding");

// Drop the problematic unique index first
try {
  await mongoose.connection.collection('activitylogs').dropIndex('userId_1_date_1');
  console.log("✅ Dropped unique index for seeding");
} catch (error) {
  console.log("ℹ️ Index already dropped or doesn't exist");
}

// Clear existing dummy data
await Dashboard.deleteMany({ isDummy: true });
await BurnoutLog.deleteMany({ isDummy: true });
await EyeStrainLog.deleteMany({ isDummy: true });
await AppUsage.deleteMany({ isDummy: true });
await ActivityLog.deleteMany({ isDummy: true });
await Recommendation.deleteMany({ isDummy: true });

console.log("🧹 Cleared existing dummy data");

// --- HELPER FUNCTION ---
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// --- DUMMY DASHBOARD ---
await Dashboard.create({
  isDummy: true,
  burnoutScore: 65,
  burnoutLevel: "Moderate",
  workHours: 8.5,
  sessionTime: 145,
  eyeStrain: 1.2,
  updatedAt: new Date()
});
console.log("✅ Dummy Dashboard seeded");

// --- DUMMY BURNOUT LOGS ---
const burnoutLogs = [];
for (let i = 6; i >= 0; i--) {
  const score = 55 + Math.floor(Math.random() * 25);
  burnoutLogs.push({
    isDummy: true,
    burnoutScore: score,
    burnoutLevel: score >= 70 ? "High" : score >= 50 ? "Moderate" : "Low",
    timestamp: daysAgo(i)
  });
}
await BurnoutLog.insertMany(burnoutLogs);
console.log("✅ Dummy Burnout logs seeded");

// --- DUMMY EYE STRAIN LOGS ---
const eyeStrainLogs = [];
const eyeStrainStatuses = ["None", "Mild", "Severe"];
for (let i = 6; i >= 0; i--) {
  const statusIndex = i < 2 ? (Math.random() > 0.3 ? 2 : 1) : 
                     i < 4 ? (Math.random() > 0.5 ? 1 : 0) : 0;
  
  eyeStrainLogs.push({
    isDummy: true,
    eyeStrainStatus: eyeStrainStatuses[statusIndex],
    timestamp: daysAgo(i)
  });
}
await EyeStrainLog.insertMany(eyeStrainLogs);
console.log("✅ Dummy Eye Strain logs seeded");

// --- DUMMY APP USAGE ---
const appUsageLogs = [];
const apps = [
  { name: "VS Code", category: "Coding", baseMinutes: 180 },
  { name: "Chrome", category: "Browsing", baseMinutes: 120 },
  { name: "Slack", category: "Communication", baseMinutes: 90 },
  { name: "Terminal", category: "Coding", baseMinutes: 60 },
  { name: "Figma", category: "Design", baseMinutes: 45 },
  { name: "Spotify", category: "Entertainment", baseMinutes: 30 }
];

for (let i = 6; i >= 0; i--) {
  for (const app of apps.slice(0, 3 + i % 3)) {
    appUsageLogs.push({
      isDummy: true,
      appName: app.name,
      usageMinutes: app.baseMinutes + Math.floor(Math.random() * 60),
      category: app.category,
      timestamp: daysAgo(i)
    });
  }
}
await AppUsage.insertMany(appUsageLogs);
console.log("✅ Dummy App Usage logs seeded");

// --- DUMMY ACTIVITY LOGS (Now will work without unique constraint) ---
const activityLogs = [];
const activities = [
  { type: "Coding", baseMinutes: 240 },
  { type: "Research", baseMinutes: 120 },
  { type: "Meetings", baseMinutes: 90 },
  { type: "Break", baseMinutes: 45 },
  { type: "Planning", baseMinutes: 60 },
  { type: "Communication", baseMinutes: 75 }
];

for (let i = 6; i >= 0; i--) {
  // Create multiple activities per day (now possible without unique constraint)
  const dailyActivities = activities
    .sort(() => 0.5 - Math.random())
    .slice(0, 3 + i % 3);
  
  for (const activity of dailyActivities) {
    activityLogs.push({
      isDummy: true,
      activityType: activity.type,
      durationMinutes: activity.baseMinutes + Math.floor(Math.random() * 30),
      timestamp: daysAgo(i)
    });
  }
}
await ActivityLog.insertMany(activityLogs);
console.log("✅ Dummy Activity logs seeded");

// --- DUMMY RECOMMENDATIONS ---
await Recommendation.insertMany([
  { 
    isDummy: true, 
    recommendationText: "Take a 5-minute break every hour to reduce eye strain." 
  },
  { 
    isDummy: true, 
    recommendationText: "Consider reducing screen brightness and using blue light filters." 
  },
  { 
    isDummy: true, 
    recommendationText: "Follow the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds." 
  },
  { 
    isDummy: true, 
    recommendationText: "Take a 15-minute walk to refresh your mind and body." 
  },
  { 
    isDummy: true, 
    recommendationText: "Stay hydrated and maintain good posture while working." 
  }
]);
console.log("✅ Dummy Recommendations seeded");

console.log("🎉 All dummy data seeded successfully!");
console.log("📊 Dashboard will show:");
console.log("   - Burnout Score: 65 (Moderate)");
console.log("   - Work Hours: 8.5 hours");
console.log("   - Session Time: 145 minutes");
console.log("   - Eye Strain: 1.2");

process.exit();
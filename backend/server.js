import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import { spawn, exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = "mongodb+srv://aditya:digitalburnout@cluster0.zn1dt0m.mongodb.net/DigitalBurnout?retryWrites=true&w=majority";
const JWT_SECRET = "yourSecretKey";

const app = express();
app.use(express.json());
app.use(cors());

// Simple schema definitions
const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const dashboardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDummy: { type: Boolean, default: false },
  burnoutScore: Number,
  burnoutLevel: String,
  workHours: Number,
  sessionTime: Number,
  eyeStrain: Number,
  updatedAt: { type: Date, default: Date.now }
});

const burnoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDummy: { type: Boolean, default: false },
  burnoutScore: Number,
  burnoutLevel: String,
  timestamp: { type: Date, default: Date.now }
});

const eyeStrainLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDummy: { type: Boolean, default: false },
  eyeStrainStatus: String,
  timestamp: { type: Date, default: Date.now }
});

const appUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDummy: { type: Boolean, default: false },
  appName: String,
  usageMinutes: Number,
  category: String,
  timestamp: { type: Date, default: Date.now }
});

const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDummy: { type: Boolean, default: false },
  activityType: String,
  durationMinutes: Number,
  timestamp: { type: Date, default: Date.now }
});

const recommendationSchema = new mongoose.Schema({
  isDummy: { type: Boolean, default: false },
  recommendationText: String
});

// Create models
const User = mongoose.model("User", userSchema);
const Dashboard = mongoose.model("Dashboard", dashboardSchema);
const BurnoutLog = mongoose.model("BurnoutLog", burnoutLogSchema);
const EyeStrainLog = mongoose.model("EyeStrainLog", eyeStrainLogSchema);
const AppUsage = mongoose.model("AppUsage", appUsageSchema);
const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
const Recommendation = mongoose.model("Recommendation", recommendationSchema);

// Track running processes
let eyeStrainProcess = null;
let activityTrackerProcess = null;

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB Atlas Connected");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

connectDB();

// Auth middleware
function auth(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ success: false, message: "Invalid token" });
  }
}

// Check if real user data exists
async function hasRealUserData(userId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [hasAppUsage, hasEyeStrain, hasActivities] = await Promise.all([
      AppUsage.findOne({ userId: userId, timestamp: { $gte: today } }),
      EyeStrainLog.findOne({ userId: userId, timestamp: { $gte: today } }),
      ActivityLog.findOne({ userId: userId, timestamp: { $gte: today } })
    ]);
    
    return !!(hasAppUsage || hasEyeStrain || hasActivities);
  } catch (error) {
    console.error("Error checking real data:", error);
    return false;
  }
}

// Calculate metrics from available data
async function calculateDashboardMetrics(userId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const hasRealData = await hasRealUserData(userId);
    
    // Get data (real or dummy)
    const [appUsage, eyeStrainLogs, activityLogs] = await Promise.all([
      AppUsage.find({
        $or: [
          { userId: userId, timestamp: { $gte: today } },
          { isDummy: true, timestamp: { $gte: today } }
        ]
      }),
      EyeStrainLog.find({
        $or: [
          { userId: userId, timestamp: { $gte: today } },
          { isDummy: true, timestamp: { $gte: today } }
        ]
      }),
      ActivityLog.find({
        $or: [
          { userId: userId, timestamp: { $gte: today } },
          { isDummy: true, timestamp: { $gte: today } }
        ],
        activityType: "Break"
      })
    ]);

    // Calculate work hours
    const workHours = appUsage.reduce((total, app) => total + (app.usageMinutes || 0), 0) / 60;

    // Calculate eye strain metrics
    const levelMap = { "None": 0, "Mild": 1, "Severe": 2 };
    const eyeStrainLevels = eyeStrainLogs.map(log => levelMap[log.eyeStrainStatus] || 0);
    const avgEyeStrain = eyeStrainLevels.length > 0 ? 
      eyeStrainLevels.reduce((a, b) => a + b, 0) / eyeStrainLevels.length : 0;

    const totalAlerts = eyeStrainLogs.filter(log => levelMap[log.eyeStrainStatus] > 0).length;
    const lastAlert = eyeStrainLogs.length > 0 ? eyeStrainLogs[0].timestamp : null;

    // Calculate session time (simulated)
    const sessionTime = 45 + Math.floor(Math.random() * 120);

    // Calculate burnout score
    let burnoutScore = 25; // Base score
    
    // Add factors
    if (workHours > 8) burnoutScore += 25;
    if (workHours > 6) burnoutScore += 15;
    
    if (avgEyeStrain > 1.5) burnoutScore += 20;
    if (avgEyeStrain > 1.0) burnoutScore += 10;
    
    if (sessionTime > 180) burnoutScore += 15;
    if (sessionTime > 120) burnoutScore += 10;
    
    if (activityLogs.length < 2) burnoutScore += 10; // Few breaks

    burnoutScore = Math.min(100, burnoutScore);

    // Determine burnout level
    let burnoutLevel = "Low";
    if (burnoutScore >= 70) burnoutLevel = "High";
    else if (burnoutScore >= 40) burnoutLevel = "Medium";

    // Determine eye strain status
    let eyeStrainStatus = "Normal";
    if (avgEyeStrain >= 1.5) eyeStrainStatus = "High";
    else if (avgEyeStrain >= 1.0) eyeStrainStatus = "Medium";
    else if (avgEyeStrain >= 0.5) eyeStrainStatus = "Mild";

    return {
      burnoutScore,
      burnoutLevel,
      workHours: Math.round(workHours * 10) / 10,
      sessionTime,
      eyeStrain: {
        status: eyeStrainStatus,
        averageLevel: Math.round(avgEyeStrain * 100) / 100,
        totalAlerts,
        lastAlert
      },
      dataSource: hasRealData ? "real" : "dummy"
    };
  } catch (error) {
    console.error("Error calculating metrics:", error);
    return null;
  }
}

// ==================== API ENDPOINTS ====================

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Digital Burnout Detector API", 
    timestamp: new Date().toISOString(),
    monitors: {
      eyeStrain: eyeStrainProcess !== null,
      activityTracker: activityTrackerProcess !== null
    }
  });
});

// Main dashboard data
app.get("/dashboard-data", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`📊 Loading dashboard data for user ${userId}`);
    
    const metrics = await calculateDashboardMetrics(userId);
    
    if (!metrics) {
      // Fallback to dummy data
      const dummyDashboard = await Dashboard.findOne({ isDummy: true });
      return res.json({
        burnoutScore: dummyDashboard?.burnoutScore || 65,
        burnoutLevel: dummyDashboard?.burnoutLevel || "Moderate",
        workHours: dummyDashboard?.workHours || 8.5,
        sessionTime: dummyDashboard?.sessionTime || 145,
        eyeStrain: {
          status: "Medium",
          averageLevel: 1.2,
          totalAlerts: 3,
          lastAlert: new Date()
        },
        dataSource: "dummy"
      });
    }

    res.json(metrics);
    
  } catch (error) {
    console.error("Dashboard data error:", error);
    res.status(500).json({ 
      burnoutScore: 65, 
      burnoutLevel: "Moderate", 
      workHours: 8.5, 
      sessionTime: 145,
      eyeStrain: { 
        status: "Medium", 
        averageLevel: 1.2, 
        totalAlerts: 3, 
        lastAlert: new Date() 
      },
      dataSource: "error"
    });
  }
});

// Start real-time monitoring
app.post("/api/monitoring/start", auth, async (req, res) => {
  try {
    console.log("🚀 Starting real-time monitoring...");
    
    // Start Eye Strain Monitor
    if (!eyeStrainProcess) {
      eyeStrainProcess = spawn('python', ['ESTV4.py', '--headless', '--silent'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      eyeStrainProcess.stdout.on('data', (data) => {
        console.log(`👁️ Eye Strain: ${data}`);
      });
      
      eyeStrainProcess.stderr.on('data', (data) => {
        console.error(`❌ Eye Strain Error: ${data}`);
      });
      
      eyeStrainProcess.on('close', (code) => {
        console.log(`👁️ Eye Strain process exited with code ${code}`);
        eyeStrainProcess = null;
      });
    }

    // Start Activity Tracker
    if (!activityTrackerProcess) {
      activityTrackerProcess = spawn('python', ['ATV3.py'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      activityTrackerProcess.stdout.on('data', (data) => {
        console.log(`💻 Activity: ${data}`);
      });
      
      activityTrackerProcess.stderr.on('data', (data) => {
        console.error(`❌ Activity Error: ${data}`);
      });
      
      activityTrackerProcess.on('close', (code) => {
        console.log(`💻 Activity process exited with code ${code}`);
        activityTrackerProcess = null;
      });
    }

    res.json({ 
      success: true, 
      message: "Real-time monitoring started",
      monitors: {
        eyeStrain: eyeStrainProcess !== null,
        activityTracker: activityTrackerProcess !== null
      }
    });
    
  } catch (error) {
    console.error("Monitoring start error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop real-time monitoring
app.post("/api/monitoring/stop", auth, async (req, res) => {
  try {
    console.log("🛑 Stopping real-time monitoring...");
    
    if (eyeStrainProcess) {
      eyeStrainProcess.kill();
      eyeStrainProcess = null;
    }
    
    if (activityTrackerProcess) {
      activityTrackerProcess.kill();
      activityTrackerProcess = null;
    }
    
    res.json({ 
      success: true, 
      message: "Real-time monitoring stopped",
      monitors: {
        eyeStrain: false,
        activityTracker: false
      }
    });
    
  } catch (error) {
    console.error("Monitoring stop error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get monitoring status
app.get("/api/monitoring/status", auth, async (req, res) => {
  res.json({
    eyeStrain: eyeStrainProcess !== null,
    activityTracker: activityTrackerProcess !== null,
    isMonitoring: eyeStrainProcess !== null || activityTrackerProcess !== null
  });
});

// Data ingestion endpoints
app.post("/api/ingest/eye-strain", auth, async (req, res) => {
  try {
    const { eyeStrainStatus, blinkRate, sessionDuration } = req.body;
    
    await EyeStrainLog.create({
      userId: req.user.id,
      eyeStrainStatus,
      timestamp: new Date()
    });
    
    console.log(`👁️ Eye strain data ingested: ${eyeStrainStatus}`);
    res.json({ success: true, message: "Eye strain data saved" });
  } catch (error) {
    console.error("Eye strain ingestion error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/ingest/app-usage", auth, async (req, res) => {
  try {
    const { appName, usageMinutes, category } = req.body;
    
    await AppUsage.create({
      userId: req.user.id,
      appName,
      usageMinutes,
      category: category || "Other",
      timestamp: new Date()
    });
    
    console.log(`📱 App usage ingested: ${appName} - ${usageMinutes} minutes`);
    res.json({ success: true, message: "App usage data saved" });
  } catch (error) {
    console.error("App usage ingestion error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/ingest/activity", auth, async (req, res) => {
  try {
    const { activityType, durationMinutes } = req.body;
    
    await ActivityLog.create({
      userId: req.user.id,
      activityType,
      durationMinutes,
      timestamp: new Date()
    });
    
    console.log(`📝 Activity ingested: ${activityType} - ${durationMinutes} minutes`);
    res.json({ success: true, message: "Activity data saved" });
  } catch (error) {
    console.error("Activity ingestion error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stats endpoints (auto-handle real/dummy data)
app.get("/api/stats/burnout", auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    let data = await BurnoutLog.find({
      $or: [
        { userId: req.user.id, timestamp: { $gte: since } },
        { isDummy: true, timestamp: { $gte: since } }
      ]
    }).sort({ timestamp: 1 });
    
    console.log(`📈 Burnout stats: ${data.length} records`);
    res.json(data);
  } catch (error) {
    console.error("Burnout stats error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/stats/eyestrain", auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    let data = await EyeStrainLog.find({
      $or: [
        { userId: req.user.id, timestamp: { $gte: since } },
        { isDummy: true, timestamp: { $gte: since } }
      ]
    }).sort({ timestamp: 1 });
    
    console.log(`👁️ Eye strain stats: ${data.length} records`);
    res.json(data);
  } catch (error) {
    console.error("Eye strain stats error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/stats/appUsage", auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    let data = await AppUsage.find({
      $or: [
        { userId: req.user.id, timestamp: { $gte: since } },
        { isDummy: true, timestamp: { $gte: since } }
      ]
    }).sort({ timestamp: 1 });
    
    console.log(`💻 App usage stats: ${data.length} records`);
    res.json(data);
  } catch (error) {
    console.error("App usage stats error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/activity", auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let logs = await ActivityLog.find({
      $or: [
        { userId: req.user.id, timestamp: { $gte: since } },
        { isDummy: true, timestamp: { $gte: since } }
      ]
    }).sort({ timestamp: -1 }).limit(10);

    console.log(`📝 Activity logs: ${logs.length} records`);
    res.json(logs);
  } catch (error) {
    console.error("Activity logs error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/recommendations", auth, async (req, res) => {
  try {
    let recs = await Recommendation.find({ 
      $or: [
        { userId: req.user.id },
        { isDummy: true }
      ]
    }).limit(5);
    
    if (recs.length === 0) {
      recs = [
        { recommendationText: "Take regular breaks every 45-60 minutes." },
        { recommendationText: "Practice the 20-20-20 rule for eye care." },
        { recommendationText: "Stay hydrated throughout the day." },
        { recommendationText: "Maintain good posture while working." },
        { recommendationText: "Consider taking a short walk to refresh your mind." }
      ];
    }
    
    console.log(`💡 Recommendations: ${recs.length} items`);
    res.json(recs);
  } catch (error) {
    console.error("Recommendations error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register endpoint
app.post("/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    
    if (!name || !username || !email || !password) {
      return res.json({ success: false, message: "All fields required" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.json({ success: false, message: "Username already exists" });
    }

    const user = await User.create({ name, username, email, password });
    res.json({ success: true, message: "User registered successfully", user });
  } catch (error) {
    console.error("Register error:", error);
    res.json({ success: false, message: "Registration failed" });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.json({ success: false, message: "Username and password required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    
    if (user.password !== password) {
      return res.json({ success: false, message: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id, username }, JWT_SECRET, {
      expiresIn: "1d",
    });
    
    res.json({ success: true, message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    res.json({ success: false, message: "Login failed" });
  }
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`🚀 Digital Burnout Detector API running at http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
});
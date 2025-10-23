import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import { User, Dashboard, BurnoutLog, EyeStrainLog, AppUsage, ActivityLog, Recommendation } from "./models/schema.js";

const MONGO_URI = "mongodb+srv://aditya:digitalburnout@cluster0.zn1dt0m.mongodb.net/DigitalBurnout?retryWrites=true&w=majority";
const JWT_SECRET = "yourSecretKey";

const app = express();
app.use(express.json());
app.use(cors());

// Connect MongoDB
await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected");

// --- Auth middleware ---
function auth(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ success: false, message: "Invalid token" });
  }
}

// --- REGISTER ---
app.post("/register", async (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) return res.json({ success: false, message: "All fields required" });

  const existing = await User.findOne({ username });
  if (existing) return res.json({ success: false, message: "Username already exists" });

  const user = await User.create({ name, username, email, password });
  res.json({ success: true, message: "User registered successfully", user });
});

// --- LOGIN ---
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "Username and password required" });

  const user = await User.findOne({ username });
  if (!user) return res.json({ success: false, message: "User not found" });
  if (user.password !== password) return res.json({ success: false, message: "Invalid password" });

  const token = jwt.sign({ id: user._id, username }, JWT_SECRET, { expiresIn: "1d" });
  res.json({ success: true, message: "Login successful", token });
});

// --- DASHBOARD DATA ---
app.get("/dashboard-data", auth, async (req, res) => {
  let data = await Dashboard.findOne({ userId: req.user.id });
  if (!data) data = await Dashboard.findOne({ isDummy: true });
  res.json(data);
});

// --- STATS BY TYPE & DAYS ---
app.get("/api/stats/:type/:days", auth, async (req, res) => {
  const { type, days } = req.params;
  const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
  let data = [];

  switch (type) {
    case "burnout":
      data = await BurnoutLog.find({ userId: req.user.id, timestamp: { $gte: since } });
      if (!data.length) data = await BurnoutLog.find({ isDummy: true, timestamp: { $gte: since } });
      break;

    case "eyestrain":
      data = await EyeStrainLog.find({ userId: req.user.id, timestamp: { $gte: since } });
      if (!data.length) data = await EyeStrainLog.find({ isDummy: true, timestamp: { $gte: since } });
      break;

    case "appUsage":
      data = await AppUsage.find({ userId: req.user.id, timestamp: { $gte: since } });
      if (!data.length) data = await AppUsage.find({ isDummy: true, timestamp: { $gte: since } });
      break;

    default:
      return res.status(400).json({ success: false, message: "Invalid type" });
  }

  res.json(data);
});

// --- ACTIVITY LOGS ---
app.get("/api/activity/:days?", auth, async (req, res) => {
  const days = req.params.days ? Number(req.params.days) : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let logs = await ActivityLog.find({ userId: req.user.id, timestamp: { $gte: since } }).sort("-timestamp").limit(10);
  if (!logs.length) logs = await ActivityLog.find({ isDummy: true, timestamp: { $gte: since } }).sort("-timestamp").limit(10);

  res.json(logs);
});

// --- RECOMMENDATIONS ---
app.get("/api/recommendations", auth, async (req, res) => {
  let recs = await Recommendation.find({ userId: req.user.id }).limit(5);
  if (!recs.length) recs = await Recommendation.find({ isDummy: true }).limit(5);
  res.json(recs);
});

app.listen(8080, () => console.log("Server running on http://localhost:8080"));

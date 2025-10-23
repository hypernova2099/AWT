import express from 'express';
import mongoose from 'mongoose';

import User from '../models/user.js'
import {
  Dashboard,
  BurnoutLog,
  EyeStrainLog,
  AppUsage,
  ActivityLog,
  Recommendation
} from "../models/schema.js";


import cors from 'cors';
import auth from './middleware/auth.js'
import jwt from 'jsonwebtoken'

const app = express();
const port = 8080;

app.use(express.json());
app.use(cors());
mongoose.connect("mongodb+srv://aditya:digitalburnout@cluster0.zn1dt0m.mongodb.net/DigitalBurnout?retryWrites=true&w=majority")
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

app.post("/login", async(req,res)=>{
    console.log(req.body);
    try {
        const { username,password } = req.body;
        const user = await(User.findOne({username}));

        if (user && user.password === password){
            const token = jwt.sign({userId:user._id, username : user.username}, "yourSecretKey", {expiresIn:'1h'});
            res.json({success: true , token});
        }
        else{
            res.status(401).json({success: false, message: "Invalid Credentials"})
        }

    } catch (error) {
        res.status(500).json({success:false , message: "server error"});    }
});

app.post("/register", async(req,res)=>{

    try {
        const {name,username,email,password} = req.body;

        const existingUser = await User.findOne({email});
        if (existingUser){
            return res.status(400).json({message:"User with same email exists!"});
        }

        //const hashedPassword = await bcrypt.hash(password, 10);  for future

        const newUser = new User({
            name,
            username,
            email,
            password
        })

        await newUser.save();
        res.status(201).json({message:"User Registered Successfully!"});   

    } catch (error) {
        res.status(500).json({message:"Server Error", error}); 
    }
    
});

// --- DASHBOARD DATA ---
app.get("/dashboard-data", auth, async (req, res) => {
  let data = await Dashboard.findOne({ userId: req.user.userId });
  if (!data) data = await Dashboard.findOne({ isDummy: true }); // global dummy
  res.json(data);
});

// --- CHART STATS ---
app.get("/api/stats/:type/:days", auth, async (req, res) => {
  const { type, days } = req.params;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let data;

  if (type === "burnout") {
    data = await BurnoutLog.find({ userId: req.user.userId, timestamp: { $gte: since } });
    if (!data.length) data = await BurnoutLog.find({ isDummy: true, timestamp: { $gte: since } });
  }

  if (type === "eyeStrain") {
    data = await EyeStrainLog.find({ userId: req.user.userId, timestamp: { $gte: since } });
    if (!data.length) data = await EyeStrainLog.find({ isDummy: true, timestamp: { $gte: since } });
  }

  if (type === "appUsage") {
    data = await AppUsage.find({ userId: req.user.userId, timestamp: { $gte: since } });
    if (!data.length) data = await AppUsage.find({ isDummy: true, timestamp: { $gte: since } });
  }

  res.json(data);
});

// --- ACTIVITY LOGS ---
app.get("/api/activity", auth, async (req, res) => {
  let logs = await ActivityLog.find({ userId: req.user.userId }).sort("-timestamp").limit(10);
  if (!logs.length) logs = await ActivityLog.find({ isDummy: true }).sort("-timestamp").limit(10);
  res.json(logs);
});

// --- RECOMMENDATIONS ---
app.get("/api/recommendations", auth, async (req, res) => {
  let recs = await Recommendation.find({ userId: req.user.userId }).limit(5);
  if (!recs.length) recs = await Recommendation.find({ isDummy: true }).limit(5);
  res.json(recs);
});


app.listen(port,()=>{
    console.log(`server running on ${port}`);
})
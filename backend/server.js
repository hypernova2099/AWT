import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import auth from "./middleware/auth.js";
import User from "./models/user.js";
import { MongoClient } from "mongodb";

const app = express();
const port = 8080;

const atlasUri = "mongodb+srv://aditya:digitalburnout@cluster0.zn1dt0m.mongodb.net/DigitalBurnout?retryWrites=true&w=majority";

app.use(express.json());
app.use(cors());

// MongoDB via Mongoose
mongoose.connect(atlasUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Atlas connected"))
  .catch(err => console.log(err));

// ========== LOGIN ==========
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (user && user.password === password) {
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        "yourSecretKey",
        { expiresIn: "1h" }
      );
      return res.json({ success: true, token });
    }

    res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ========== REGISTER ==========
app.post("/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ name, username, email, password });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// ========== DASHBOARD ==========
app.get("/dashboard-data", auth, async (req, res) => {
  const client = new MongoClient(atlasUri);

  try {
    await client.connect();
    const db = client.db("DigitalBurnout");
    const dashboardCollection = db.collection("Dashboard");

    // Always fetch the single shared dummy
    const data = await dashboardCollection.findOne({ dummy: true });

    if (!data) return res.status(404).json({ message: "No dashboard data found" });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await client.close();
  }
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

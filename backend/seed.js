// backend/seedDashboard.js
import { MongoClient } from "mongodb";

const uri = "mongodb+srv://aditya:digitalburnout@cluster0.zn1dt0m.mongodb.net/DigitalBurnout?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db("DigitalBurnout");
    const dashboard = db.collection("Dashboard");

    // Check if dummy exists
    const exists = await dashboard.findOne({ dummy: true });
    if (!exists) {
      await dashboard.insertOne({
        dummy: true,             // marker field
        burnoutScore: 50,
        burnoutLevel: "Medium",
        workHours: 8,
        sessionTime: 120,
        eyeStrain: 15
      });
      console.log("Single shared dummy data seeded!");
    } else {
      console.log("Dummy data already exists.");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();

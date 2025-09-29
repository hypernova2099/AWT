import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name : String,
    username : {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email : {
        type: String,
        required: true,
        unique: true,
        lowercase : true
    }, 
    password : {
        type: String,
        required: true
    }
}); 

export default mongoose.model("User", userSchema);


/*const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // Dashboard Data
  burnoutScore: { type: Number, default: 0 },
  burnoutLevel: { type: String, default: "Low" },
  workHours:    { type: Number, default: 0 },
  sessionTime:  { type: Number, default: 0 },
  eyeStrain:    { type: String, default: "None" },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);

*/
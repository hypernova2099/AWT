import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name : String,
    username : String,
    email : String, 
    password : String
});

export default mongoose.model("User", userSchema);
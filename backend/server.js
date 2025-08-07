const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const cors = require('cors');

const app = express();
const port = 8080;

app.use(express.json());
app.use(cors());
mongoose.connect("mongodb://localhost:27017/burnoutDB");


app.post("/login", async(req,res)=>{
    console.log(req.body);
    try {
        const { username,password } = req.body;
        const user = await(User.findOne({username}));

        if (user && user.password === password){
        res.json({success: true , userId : user._id});
        }
        else{
            res.json({success: false , message : "Invalid Credentials "})
        }

    } catch (error) {
        res.status(500).json({success:false , message: "server error"});    }
});

app.post("/register", async(req,res)=>{
    const user = new User(req.body);
    await user.save();
    res.json({success:true});
})

app.listen(port,()=>{
    console.log(`server running on ${port}`);
})
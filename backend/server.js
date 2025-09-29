import express from 'express';
import mongoose from 'mongoose';
import User from '../models/user.js'
import cors from 'cors';
import auth from './middleware/auth.js'     
import jwt from 'jsonwebtoken'  

const app = express();
const port = 8080;

app.use(express.json());
app.use(cors());
mongoose.connect("mongodb://localhost:27017/burnoutDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true    });


app.post("/login", async(req,res)=>{
    console.log(req.body);
    try {
        const { username,password } = req.body;
        const user = await(User.findOne({username}));
        console.log(user.passwor);

        if (user && user.password === password){
            const token = jwt.sign({userId:user._id, username : user.username}, "yourSecretKey", {expiresIn:'1h'});
            res.json({success: true , token});
        }
        else{
            res.json({success: false , message : "Invalid Credentials "})
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

app.get('/dashboard-data', auth , async(req,res)=>{

    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({message: "User not found"});

        res.json({
                
            burnoutScore: user.burnoutScore,
            burnoutLevel: user.burnoutLevel,
            workHours: user.workHours,
            sessionTime: user.sessionTime,
            eyeStrain: user.eyeStrain

        });
        
    } catch (error) {
        res.status(500).json({message:"Server Error", error });
    }

});

app.listen(port,()=>{
    console.log(`server running on ${port}`);
})
import jwt from "jsonwebtoken";

const auth = function (req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.headers['authorization'];
        if (!token) return res.status(401).json({message: "No token provided"});

        const decoded = jwt.verify(token, 'yourSecretKey');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({message: "Invalid token"});
    }
};

export default auth;
const jwt = require('jsonwebtoken');

module.exports = function (res,req,next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({message: "no token provided"});

    try {
        const decoded= jwt.verify(token , 'yourSecretKey');
        req.user = decoded;
        next();
        
    } catch (error) {
        res.status(403).json({message: "invalid token"});
    }

};
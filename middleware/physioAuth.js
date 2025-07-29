const Physio = require('../models/physio');
const jwt = require('jsonwebtoken');

const LoggedIn = async (req, res, next) => {
    try {
        const { authorization } = req.headers;
        if (!authorization) {
            return res.status(400).json({ status: false, message: "token not find" });
        }

        const token = authorization.replace("Bearer ", "");
        const userId = jwt.verify(token, process.env.JWT_SECRET_KEY);
        // return console.log(userId)
        const user = await Physio.findById(userId.patient._id);
        if (!user) {
            return res.status(400).json({ status: false, message: "user not found" });
        }

        // if check user.token
        if (user.token !== token) {
            return res.status(400).json({ status: false, message: "user not found" });
        }

        req.loginUser = user;
        next();

    } catch (error) {
        return res.status(400).json({ message: "token is not valid" });
    }
};

module.exports = { LoggedIn };

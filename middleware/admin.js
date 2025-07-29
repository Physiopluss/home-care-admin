const Admin = require('../models/admin');

const LoggedIn = async (req, res, next) => {
    const email = req.session.user.email;
    const password = req.session.user.password;



    if (!email || !password) {
        return res.redirect("/api/admin/login")
    }

    const user = await Admin.findOne({ email: email })
    if (!user) return res.redirect("/api/admin/login")

    const validPassword = user.password == password ? true : false;
    if (!validPassword) return res.redirect("/api/admin/login")

    next()

}

module.exports = {
    LoggedIn
}
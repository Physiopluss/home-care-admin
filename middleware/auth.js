const jwt = require('jsonwebtoken')

const verifyToken = async (req, res, next) => {
  let token = req.headers['authorization']
  if (!token) {
    res.status(400).json({ status: false, message: "token not find" })
  } else {
    token = token.split(' ')[1] // removing bearer
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, valid) => {
      if (err) {
        res.status(400).json({ message: "token is not valid" })
      } else {
        next()
      }
    })
  }
}
module.exports = verifyToken
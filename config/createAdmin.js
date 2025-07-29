const Admin = require('../models/admin');
const bcrypt = require('bcrypt');

const createAdmin = async (req, res) => {
  console.log("create admin")
  const exists = await Admin.find();

  if (exists.length == 0) {
    const salt = await bcrypt.genSalt(Number(process.env.SALT_ROUNDS))
    const hash = await bcrypt.hash('123456', salt)
    const newAdmin = await new Admin({
      email: 'admin@gmail.com',
      password: hash
    })
    try {
      await newAdmin.save()
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = createAdmin
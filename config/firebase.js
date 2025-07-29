const admin = require('firebase-admin');
const serviceAccount = require('../accountkey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;

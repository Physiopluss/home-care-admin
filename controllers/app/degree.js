const Degree = require('../../models/Degree');

// Get all degrees
exports.getDegrees = async (req, res) => {
    try {
        const degrees = await Degree.find();
        res.status(200).json({ status: true, degrees: degrees });
    } catch (err) {
        res.status(400).json({ status: false, message: err });
    }
}

const Specialization = require('../../models/specialization');
const moment = require('moment');

// Get all specializations
const getAllSpecializations = async (req, res) => {
    try {

        // 
        console.log(moment().format("YYYY-MM-DDTHH:mm:ss.SSSSSS"));
        // return console.log('getAllSpecializations');
        const specializations = await Specialization.find();
        res.status(200).json({
            message: 'Specializations fetched successfully',
            success: true,
            status: 200,
            data: specializations
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get a specialization by id
const getSpecializationById = async (req, res) => {
    try {
        const specialization = await Specialization.findById(req.params.id);
        res.json(specialization);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getAllSpecializations,
    getSpecializationById
};


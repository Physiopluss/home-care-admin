const Degree = require('../../models/Degree');

// Add a degree
exports.addDegree = async (req, res) => {
    try {

        // return console.log(req.body, 'req.body');

        let name = req.body.name;
        if (!name) {
            return res.status(400).json({ status: false, message: 'Degree name is required' });
        }

        const degree = new Degree({
            name: name
        });
        await degree.save();
        res.status(201).json({ status: true, message: 'Degree added successfully' });
    } catch (err) {
        res.status(400).json({ status: false, message: err });
    }
}

// Get all degrees
exports.getDegrees = async (req, res) => {
    try {
        const degrees = await Degree.find();
        res.status(200).json({ status: true, degrees: degrees });
    } catch (err) {
        res.status(400).json({ status: false, message: err });
    }
}


// delete degree
exports.deleteDegree = async (req, res) => {
    try {
        let degreeId = req.params.degreeId;
        if (!degreeId) {
            return res.status(400).json({ status: false, message: 'Degree ID is required' });
        }

        let degree = await Degree.findById(degreeId);
        if (!degree) {
            return res.status(404).json({ status: false, message: 'Degree not found' });
        }

        await Degree.findByIdAndDelete(degreeId);
        res.status(200).json({ status: true, message: 'Degree deleted successfully' });

    } catch (err) {
        res.status(400).json({ status: false, message: err });
    }
}

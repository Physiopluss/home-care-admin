const InsuranceEnquiry = require("../../models/insuranceEnquiry")


// Get all insurance enquiries
exports.getInsuranceEnquiry = async (req, res) => {
    try {
        const insuranceEnquiry = await InsuranceEnquiry.find();
        res.status(200).json({ message: 'Insurance Enquiry successfully', status: 200, data: insuranceEnquiry });
    } catch (err) {
        res.status(500).json({ message: err.message, status: 500, data: err.data });
    }
};

// callStatus updates the status
exports.callStatus = async (req, res) => {
    try {

        const { Id } = req.query;

        if (!Id) return res.status(400).json({ message: 'Call status is required', status: 401 });

        const insuranceEnquiry = await InsuranceEnquiry.findByIdAndUpdate(Id, { callStatus: req.body.callStatus }, { new: true });

        if (!insuranceEnquiry) return res.status(404).json({ message: 'Insurance Enquiry not found' });

        res.status(200).json({ message: 'Call status updated successfully', status: 200, data: insuranceEnquiry });
    } catch (err) {
        res.status(500).json({ message: err.message, status: 500, data: err.data });
    }
};
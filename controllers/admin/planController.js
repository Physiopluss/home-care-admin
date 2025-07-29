const Plan = require('../../models/plan')

// Add Plans
exports.addPlans = async (req, res) => {
    try {
        const { name, price, planMonth, planType, patientLimit } = req.body

        if (!name || !price || !planMonth || !planType) {
            return res.status(400).json({ status: false, message: 'All fields are required' });
        }

        const plan = new Plan({
            name,
            price,
            planMonth,
            planType,
            patientLimit,
        })

        await plan.save()

        res.status(201).json({ message: 'Plan added successfully', status: true, success: true, plan })
    } catch (err) {
        console.log(err)
        res.status(500).json({
            message: "Something went wrong Please try again later",
            status: 500,
            success: false,
            err: err.message
        })
    }
}

// Get All Plans
exports.getAllPlans = async (req, res) => {
    try {
        const plans = await Plan.find().sort({ createdAt: -1 });
        res.status(200).json({
            message: 'Plans fetched successfully',
            status: 200,
            success: true,
            data: plans
        });
    } catch (err) {
        res.status(400).json({
            message: 'Something went wrong',
            status: 400,
            success: false,
            err: err.message
        });
    }
};

// Get Plan by ID
exports.getPlanById = async (req, res) => {
    try {

        let Id = req.query.Id;
        if (!Id) {
            return res.status(400).json({ message: 'Plan ID is required', status: 400, success: false });
        }

        const plan = await Plan.findById(Id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        res.status(200).json({ message: 'Plan fetched successfully', status: 200, success: true, data: plan });
    } catch (err) {
        res.status(400).json({ message: 'Something went wrong', status: 400, success: false });
    }
};

// Update Plan by ID status
exports.updatePlanById = async (req, res) => {
    try {
        let Id = req.query.Id;
        if (!Id) {
            return res.status(400).json({ message: 'Plan ID is required', status: 400, success: false });
        }
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ message: 'Status is required', status: 400, success: false });
        }
        const plan = await Plan.findById(Id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        plan.status = status;
        await plan.save();
        res.status(200).json({ message: 'Plan updated successfully', status: 200, success: true, data: plan });
    } catch (err) {
        res.status(400).json({ message: 'Something went wrong', status: 400, success: false });
    }
};


// Delete Plan by ID
exports.deletePlanById = async (req, res) => {
    try {
        let planId = req.query.planId;

        if (!planId) {
            return res.status(400).json({ message: 'Plan ID is required', status: 400, success: false });
        }

        const plan = await Plan.findById(planId);

        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        await Plan.deleteOne({ _id: planId });

        res.status(200).json({
            message: 'Plan fetched successfully',
            status: 200,
            success: true,
            data: plan
        });
    } catch (err) {
        res.status(400).json({
            message: 'Something went wrong',
            status: 400,
            success: false,
            err: err.message
        });
    }
};

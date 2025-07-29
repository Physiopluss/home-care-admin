const Coupon = require('../../models/coupon');
const moment = require('moment-timezone');

// Generate a coupon code
const generateCouponCode = () => {
    let couponCode = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 8; i++) {
        couponCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return couponCode;
};

// Create a new coupon
module.exports.CouponCreate = async (req, res) => {
    try {

        let { couponName, discount, usageLimit, startDate, endDate, message, couponType, couponPlace, status } = req.body;

        if (!couponName) return res.status(400).json({ message: 'Coupon name is required', status: 400, success: false });
        if (!discount) return res.status(400).json({ message: 'Discount is required', status: 400, success: false });
        if (!usageLimit) return res.status(400).json({ message: 'Usage limit is required', status: 400, success: false });
        if (!startDate) return res.status(400).json({ message: 'Start date is required', status: 400, success: false });
        if (!endDate) return res.status(400).json({ message: 'End date is required', status: 400, success: false });
        if (!couponType) return res.status(400).json({ message: 'Coupon type is required', status: 400, success: false });
        if (!couponPlace) return res.status(400).json({ message: 'Coupon place is required', status: 400, success: false });
        if (!status) return res.status(400).json({ message: 'Status is required', status: 400, success: false });

        // check if the coupon name already exists
        const couponExists = await Coupon.findOne({ couponName });
        if (couponExists) return res.status(400).json({ message: 'Coupon name already exists', status: 400, success: false });

        // check if the start date and end date is before the current date
        // if(startDate < moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')) return res.status(400).json({ message: 'Start date must be after the current date', status : 400, success: false });
        // if(endDate < moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')) return res.status(400).json({ message: 'End date must be after the current date', status : 400, success: false });
        // // check if the start date is before the end date
        // if (startDate > endDate) return res.status(400).json({ message: 'Start date must be before the end date', status : 400, success: false });

        // check if the couponcode already exists than generate a new one
        let couponCode = generateCouponCode();
        let couponCodeExists = await Coupon.findOne({ couponCode });
        while (couponCodeExists) {
            couponCode = generateCouponCode();
            couponCodeExists = await Coupon.findOne({ couponCode });
        }

        // return console.log(couponName);
        let coupon = Coupon({
            couponCode: couponCode,
            couponName: req.body.couponName,
            discount: req.body.discount,
            usageLimit: req.body.usageLimit,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            status: req.body.status,
            message: req.body.message,
            couponType: req.body.couponType,
            couponPlace: req.body.couponPlace
        });

        await coupon.save();

        return res.status(201).json({
            message: 'Coupon created successfully',
            status: 201,
            success: true,
            data: coupon
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: 'Something went wrong',
            status: 500,
            success: false,
        });
    }
};

// Get all coupons
module.exports.CouponList = async (req, res) => {
    try {
        const coupons = await Coupon.find().populate('physioId').populate('patientId').sort({ createdAt: -1 });
        res.status(200).json({
            message: 'Coupons fetched successfully',
            status: 200,
            success: true,
            data: coupons
        });
    } catch (err) {
        res.status(500).json({
            message: 'Something went wrong',
            status: 500,
            success: false,
        });
    }
};

// Edit a coupon
module.exports.CouponEdit = async (req, res) => {
    try {

        let { status } = req.body;
        let { id } = req.params;

        if (!status) return res.status(400).json({ message: 'Status is required', status: 400, success: false });
        if (!id) return res.status(400).json({ message: 'Coupon ID is required', status: 400, success: false });

        // check if the coupon exists
        const coupon = await Coupon.findById(id);
        if (!coupon) return res.status(400).json({ message: 'Coupon not found', status: 400, success: false });

        coupon.status = status;
        await coupon.save();
        res.status(200).json({
            message: 'Coupon updated successfully',
            status: 200,
            success: true,
            data: coupon
        });


    } catch (err) {
        res.status(500).json({
            message: 'Something went wrong',
            status: 500,
            success: false,
        });
    }
};

// Update coupon status by id
exports.updateCouponStatus = async (req, res) => {
    try {
        const { id, status } = req.query;
        // const { status } = req.body;
        // return console.log(status, "Coupon status updated");
        if (!id) return res.status(400).json({ message: 'Coupon ID is required', status: 400, success: false });
        if (!status) return res.status(400).json({ message: 'Status is required', status: 400, success: false });
        const coupon = await Coupon.findById(id);
        if (!coupon) return res.status(400).json({ message: 'Coupon not found', status: 400, success: false });

        await Coupon.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        )
        res.json({
            message: 'Coupon updated successfully',
            status: 200,
            success: true,
            data: coupon
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: 'Semething went wrong Please try again',
            success: false,
            status: 500
        })
    }
}

// update coupon by id
exports.updateCoupon = async (req, res) => {
    try {
        const { Id } = req.query;
        const {
            couponName,
            discount,
            usageLimit,
            startDate,
            endDate,
            status,
            couponType,
            couponPlace,
            message
        } = req.body;
        if (!Id) return res.status(400).json({ message: 'Coupon ID is required', status: 400, success: false });

        const couponExists = await Coupon.findById(Id);
        if (!couponExists) return res.status(400).json({ message: 'Coupon not found', status: 400, success: false });


        const coupon = await Coupon.findByIdAndUpdate(Id, {
            couponName: couponName || couponExists.couponName,
            discount: discount || couponExists.discount,
            usageLimit: usageLimit || couponExists.usageLimit,
            startDate: startDate || couponExists.startDate,
            endDate: endDate || couponExists.endDate,
            message: message || couponExists.message,
            status: status || couponExists.status,
            couponType: couponType || couponExists.couponType,
            couponPlace: couponPlace || couponExists.couponPlace
        }, { new: true });
        if (!coupon) return res.status(400).json({ message: 'Coupon not found', status: 400, success: false });
        res.json({
            message: 'Coupon updated successfully',
            status: 200,
            success: true,
            data: coupon
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: 'Semething went wrong Please try again',
            success: false,
            status: 500
        })
    }
}

// Get the coupon by id and get physical and patient details
exports.getCouponById = async (req, res) => {
    try {
        const { couponId } = req.query;
        if (!couponId) return res.status(400).json({ message: 'Coupon ID is required', status: 400, success: false });
        const coupon = await Coupon.findById(couponId).populate('physioId').populate('patientId');
        if (!coupon) return res.status(400).json({ message: 'Coupon not found', status: 400, success: false });
        res.json({
            message: 'Coupon fetched successfully',
            status: 200,
            success: true,
            data: coupon
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: 'Semething went wrong Please try again',
            success: false,
            status: 500
        })
    }
}


// Delete a coupon
exports.deleteCoupon = async (req, res) => {
    try {
        const { couponId } = req.query;

        if (!couponId) return res.status(400).json({ message: 'Coupon ID is required', status: 400, success: false });


        const coupon = await Coupon.findByIdAndDelete(couponId);
        if (!coupon) return res.status(400).json({ message: 'Coupon not found', status: 400, success: false });
        res.json({
            message: 'Coupon deleted successfully',
            status: 200,
            success: true,
            data: coupon
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: 'Semething went wrong Please try again',
            success: false,
            status: 500
        })
    }
}

const Faq = require('../../models/Faq');


// Add Faq
exports.AddFaq = async (req, res) => {
    try {

        const { title, description } = req.body;
        if (!title || !description) {
            return res.status(400).json({
                message: "All fields are required",
                status: 400,
                success: false
            });
        }

        // if check if faq already exists
        const faqExist = await Faq.findOne({ title: req.body.title });
        if (faqExist) {
            return res.status(400).json({
                message: "Faq already exists",
                status: 400,
                success: false
            });
        }

        const faq = new Faq({
            title: req.body.title,
            description: req.body.description
        });
        faq.save();

        return res.status(200).json({
            message: "Faq added successfully",
            status: 200,
            success: true,
            data: faq
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong Please try again",
            status: 500,
            success: false
        });
    }
};


// Get all Faqs
exports.AllFaqs = async (req, res) => {
    try {
        const faqs = await Faq.find();
        return res.status(200).json({
            message: "All Faqs",
            status: 200,
            success: true,
            data: faqs
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Edit Faq
exports.EditFaq = async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title || !description) {
            return res.status(400).json({
                message: "All fields are required",
                status: 400,
                success: false
            });
        }

        let faqId = req.query.faqId;
        if (!faqId) {
            return res.status(400).json({
                message: "Faq Id is required",
                status: 400,
                success: false
            });
        }

        // if check if faq already exists
        const faqExist = await Faq.findOne({ _id: faqId });
        if (!faqExist) {
            return res.status(400).json({
                message: "Faq does not exist",
                status: 400,
                success: false
            });
        }

        const faq = await Faq.findByIdAndUpdate(faqId, {
            title: req.body.title,
            description: req.body.description
        }, { new: true });

        return res.status(200).json({
            message: "Faq updated successfully",
            status: 200,
            success: true,
            data: faq
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Delete Faq
exports.DeleteFaq = async (req, res) => {
    try {
        let faqId = req.query.faqId;
        console.log(faqId);
        if (!faqId) {
            return res.status(400).json({
                message: "Faq Id is required",
                status: 400,
                success: false
            });
        }
        // if check if faq already exists
        const faqExist = await Faq.findOne({ _id: faqId });
        if (!faqExist) {
            return res.status(400).json({
                message: "Faq does not exist",
                status: 400,
                success: false
            });
        }
        const faq = await Faq.findByIdAndDelete(faqId);
        return res.status(200).json({
            message: "Faq deleted successfully",
            status: 200,
            success: true,
            data: faq
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};


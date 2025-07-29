const Advertisement = require('../../models/advertisement');

// Get all Advertisements
exports.AllAdvertisements = async (req, res) => {
    try {
        const advertisement = await Advertisement.find();
        return res.status(200).json({
            message: "All Advertisements",
            status: 200,
            success: true,
            data: advertisement
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Semething went wrong",
            status: 500,
            success: false
        });
    }
};


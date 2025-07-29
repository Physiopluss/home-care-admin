const Banner = require('../../models/banner');
const { deleteFileFromS3 } = require('../../services/awsService');
exports.createBanner = async (req, res) => {
    try {
        const { title, image, platform, isLive } = req.body;

        // Validation
        if (!title || !image || !platform || typeof isLive !== 'boolean') {
            return res.status(400).json({
                message: 'Please provide all required fields: title, image, platform, isLive',
                status: 400,
                success: false
            });
        }

        // Check for duplicate title
        const existingBanner = await Banner.findOne({ title });
        if (existingBanner) {
            return res.status(400).json({
                message: 'Banner with this title already exists',
                status: 400,
                success: false
            });
        }

        // Create new banner
        const newBanner = new Banner({
            title,
            image,
            platform,
            isLive
        });

        await newBanner.save();

        res.status(201).json({
            message: 'Banner added successfully',
            status: 201,
            success: true,
            banner: newBanner
        });

    } catch (error) {
        console.error('Error creating banner:', error);
        res.status(500).json({
            message: 'Internal server error',
            status: 500,
            success: false
        });
    }
};



// Get all banners

exports.getAllBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ createdAt: -1 });

        res.status(200).json({
            message: 'All banners fetched successfully',
            status: 200,
            success: true,
            banners
        });

    } catch (error) {
        console.error('Error fetching banners:', error);
        res.status(500).json({
            message: 'Error fetching banners',
            status: 500,
            success: false
        });
    }
};




exports.editBanner = async (req, res) => {
    try {
        const { bannerId, isLive } = req.body;

        if (!bannerId || typeof isLive !== 'boolean') {
            return res.status(400).json({
                message: 'bannerId and isLive (boolean) are required',
                status: 400,
                success: false
            });
        }

        const banner = await Banner.findByIdAndUpdate(
            bannerId,
            { isLive },
            { new: true }
        );

        if (!banner) {
            return res.status(404).json({
                message: 'Banner not found',
                status: 404,
                success: false
            });
        }

        res.status(200).json({
            message: 'Banner updated successfully',
            status: 200,
            success: true,
            banner
        });

    } catch (error) {
        console.error('Error updating banner:', error);
        res.status(500).json({
            message: 'Internal server error',
            status: 500,
            success: false
        });
    }
};
// Delete a banner


exports.deleteBanner = async (req, res) => {
    try {
        const { bannerId } = req.params;

        if (!bannerId) {
            return res.status(400).json({
                message: 'Banner ID is required',
                status: 400,
                success: false,
            });
        }

        // Get the banner first to retrieve the image path
        const banner = await Banner.findById(bannerId);
        if (!banner) {
            return res.status(404).json({
                message: 'Banner not found',
                status: 404,
                success: false,
            });
        }

        // Delete the image from S3 if exists
        if (banner.image) {
            await deleteFileFromS3(banner.image); // banner.image should be the S3 key or URL
        }

        // Now delete the banner
        await Banner.findByIdAndDelete(bannerId);

        res.status(200).json({
            message: 'Banner deleted successfully',
            status: 200,
            success: true,
        });
    } catch (error) {
        console.error('Error deleting banner:', error);
        res.status(500).json({
            message: 'Internal server error',
            status: 500,
            success: false,
        });
    }
};
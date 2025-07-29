const Blog = require('../../models/blog');
const Help_Contact = require('../../models/Help_Contact');
const Specialization = require('../../models/specialization');
const Banner = require('../../models/banner');
const Advertisement = require('../../models/advertisement');
const Coupon = require('../../models/coupon');
const moment = require('moment');
const InsuranceEnquiry = require('../../models/insuranceEnquiry');
const Degree = require('../../models/Degree');
const Subspecialization = require('../../models/subSpecialization');
const mongoose = require('mongoose');
const Event = require("../../models/Event");

// Get all Blogs
exports.AllBlogs = async (req, res) => {
    try {
        let { title, page } = req.query;
        let query = {};

        if (title) {
            query.title = { $regex: title, $options: 'i' };
        }

        // Set default values for pagination
        const limit = 12; // Number of records per page
        const pages = parseInt(page) || 1; // Current page, default to 1
        const skip = (pages - 1) * limit; // Calculate number of records to skip

        // Fetch blogs and count total blogs for the query
        const blogs = await Blog.find(query)
            .sort({ createdAt: -1 }) // Sort by creation date in descending order
            .skip(skip)
            .limit(limit);

        const count = await Blog.countDocuments(query) // Total number of matching blogs

        // Calculate total pages
        const totalPages = Math.ceil(count / limit);

        return res.status(200).json({
            message: "Blogs fetched successfully",
            status: 200,
            success: true,
            totalBlogs: count, // Total number of blogs
            currentPage: pages, // Current page number
            totalPages, // Total number of pages
            blogs, // Blog data for the current page
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Get Single Blog
exports.GetSingleBlog = async (req, res) => {
    try {

        let slug = req.params.id;

        if (!slug) {
            return res.status(400).json({
                message: "Blog slug is required",
                status: 400,
                success: false
            })
        }

        const blog = await Blog.findOne({ slug: slug });

        // add views: maybe in future
        // await Blog.findByIdAndUpdate(blog._id, {
        //     $inc: {
        //         views: 1
        //     }
        // })

        return res.status(200).json({
            message: "Blog fetched successfully",
            status: 200,
            success: true,
            data: blog
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Add Help Contact
exports.AddHelpContact = async (req, res) => {
    try {

        // console.log(req.body);

        const {
            name,
            email,
            phone,
            message,
            subject
        } = req.body;
        if (!name || !email || !message || !subject || !phone) {
            return res.status(400).json({
                message: "All fields are required",
                status: 400,
                success: false
            });
        }

        const helpContact = new Help_Contact({
            name: req.body.name,
            email: req.body.email,
            messages: {
                message: req.body.message
            },
            type: 0,
            subject: req.body.subject,
            phone: req.body.phone
        });
        await helpContact.save();
        return res.status(200).json({
            message: "Help Contact added successfully",
            status: 200,
            success: true,
            data: helpContact
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};


// Get Specialization Name and SubSpecializations Full Data
exports.AllSpecializations = async (req, res) => {
    try {
        // Aggregation to fetch specializations and their sub-specializations
        const data = await Specialization.aggregate([
            {
                $lookup: {
                    from: "subspecializations", // Subspecialization collection
                    localField: "_id",
                    foreignField: "specializationId",
                    as: "subSpecializations",
                },
            },
            {
                $project: {
                    _id: 1,
                    name: 1, // Include specialization name
                    subSpecializations: {
                        _id: 1, // Include sub-specialization IDs
                        name: 1, // Include sub-specialization names
                        description: 1, // Include other fields if needed
                    },
                },
            },
        ]);

        res.status(200).json({
            message: "Specializations and SubSpecializations fetched successfully",
            status: 200,
            success: true,
            data,
        });
    } catch (err) {
        res.status(400).json({
            message: "Error fetching data",
            error: err.message,
        });
    }
};


// Get all Banners
exports.AllBanners = async (req, res) => {
    try {
        const banners = await Banner.find({
            bannerType: 2
        });
        return res.status(200).json({
            message: "All Banners",
            status: 200,
            success: true,
            data: banners
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Add Advertisements
exports.AddAdvertisement = async (req, res) => {
    try {
        const {
            email
        } = req.body;
        if (!email) {
            return res.status(400).json({
                message: "Email is required",
                status: 400,
                success: false
            });
        }

        const advertisement = new Advertisement({
            email: req.body.email
        });
        await advertisement.save();
        return res.status(200).json({
            message: "Advertisement added successfully",
            status: 200,
            success: true,
            data: advertisement
        });

    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Get Coupons By code
exports.GetCouponByCode = async (req, res) => {
    try {
        const {
            couponName,
            patientId
        } = req.body;
        if (!couponName) {
            return res.status(400).json({
                message: "Coupon Name is required",
                status: 400,
                success: false
            });
        }

        if (!patientId) {
            return res.status(400).json({
                message: "patientId is required",
                status: 400,
                success: false
            });
        }

        // if coupon code is valid
        const coupon = await Coupon.findOne({
            couponName: new RegExp(couponName?.trim(), 'i'),
            couponPlace: 1,
            status: 0
        });

        if (!coupon) {
            return res.status(400).json({
                message: "Invalid Coupon code",
                status: 400,
                success: false
            });
        }

        const constAlreadyUsed = coupon.patientId.some((id) => id.equals(patientId))

        if (constAlreadyUsed) {
            return res.status(400).json({
                message: "Coupon code is already used",
                status: 400,
                success: false
            });
        }
        let today = moment().format('YYYY-MM-DDTHH:mm:ss.SSSSSS');

        // if check if coupon end date is greater than today
        if (coupon.endDate < today) {
            return res.status(400).json({
                message: "Coupon code expired",
                status: 400,
                success: false
            });
        }

        return res.status(200).json({
            message: "Coupon code fetched successfully",
            status: 200,
            success: true,
            data: coupon
        });

    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong" + error,
            status: 500,
            success: false
        });
    }
};

// Blogs Title search
exports.BlogsTitleSearch = async (req, res) => {
    try {
        let {
            title,
            page
        } = req.query;


        // Set default values for pagination if not provided
        const pages = parseInt(page) || 1;
        const limit = 12;
        const skip = (pages - 1) * limit;

        // Create a dynamic query object
        var query;

        if (title) {
            query = {
                title: {
                    $regex: title,
                    $options: 'i'
                },
                blogType: 0
            };
        } else {
            query = {};
        }



        // Fetch blogs based on the query
        const blogs = await Blog.find(query)
            .skip(skip)
            .limit(limit);

        //  Get total number of blogs
        const count = await Blog.countDocuments(query);

        return res.status(200).json({
            message: "Blogs fetched successfully",
            status: 200,
            success: true,
            totalBlogs: blogs.length, // Add total property to the response
            pageNumber: pages, // Add pageNumber property to the response
            pages: count, // Add pages property to the response
            data: blogs,
        });


    } catch (error) {
        console.error(error); // Log the error for debugging
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Add InsuranceEnquiry
exports.AddInsuranceEnquiry = async (req, res) => {
    try {

        const {
            name,
            phone,
            companyName,
            policyNumber
        } = req.body;

        // console.log(req.body)

        if (!name) {
            return res.status(400).json({
                message: "Name is required",
                status: 400,
                success: false
            });
        }

        if (!phone) {
            return res.status(400).json({
                message: "Phone is required",
                status: 400,
                success: false
            });
        }

        if (!companyName) {
            return res.status(400).json({
                message: "Company Name is required",
                status: 400,
                success: false
            });
        }

        if (!policyNumber) {
            return res.status(400).json({
                message: "Policy Number is required",
                status: 400,
                success: false
            });
        }

        const insuranceEnquiry = InsuranceEnquiry({
            name: name,
            phone: phone,
            companyName: companyName,
            policyNumber: policyNumber
        });
        await insuranceEnquiry.save();
        return res.status(200).json({
            message: "Insurance Enquiry added successfully",
            status: 200,
            success: true,
            data: insuranceEnquiry
        });

    } catch (error) {
        console.error(error); // Log the error for debugging
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Get Degree
exports.getDegree = async (req, res) => {
    try {
        const degree = await Degree.find();
        res.status(200).json({
            message: "Degree fetched successfully",
            status: 200,
            success: true,
            data: degree
        });
    } catch (err) {
        res.status(400).json({
            message: err
        });
    }
}

// Get Sub Specialization multipal id
exports.GetSubSpecializationMultiId = async (req, res) => {
    try {

        const specializationId = req.body.specializationId;

        if (!specializationId) {
            return res.status(400).json({
                message: "SpecializationId is required",
                status: 400,
                success: false
            });
        }

        // console.log(specializationId);

        const subSpecialization = await Subspecialization.find({
            specializationId: { $in: specializationId }
        })
        res.status(200).json({
            message: "Sub Specialization fetched successfully",
            status: 200,
            success: true,
            data: subSpecialization
        });
    } catch (err) {
        res.status(400).json({
            message: err
        });
    }
}

// Get Event
exports.getEvent = async (req, res) => {
    try {
        const event = await Event.find();
        res.status(200).json({
            message: "Event fetched successfully",
            status: 200,
            success: true,
            data: event
        });
    } catch (err) {
        res.status(400).json({
            message: err
        });
    }
}

// Get Specialization And Sub Specialization
exports.GetSpecializationAndSubSpecialization = async (req, res) => {
    try {

        const specialization = await Specialization.find();
        const subSpecialization = await Subspecialization.find().populate('specializationId');
        res.status(200).json({
            message: "Specialization And Sub Specialization fetched successfully",
            status: 200,
            success: true,
        });
    } catch (err) {
        res.status(400).json({
            message: err
        });
    }
}
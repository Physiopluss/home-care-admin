const HelpContact = require('../../models/Help_Contact');
const Specialization = require('../../models/specialization');
const Subscription = require('../../models/subscription');
const Subspecialization = require('../../models/subSpecialization');
const Coupon = require('../../models/coupon');
const Notification = require('../../models/notification');
const notification = require('../../models/notification');
const physio = require('../../models/physio');
const moment = require('moment-timezone');
const { populate } = require('../../models/Degree');

exports.AddHelpContact = async (req, res) => {
    try {

        // return console.log(req.body);
        const helpContact = new HelpContact({
            email: req.body.email,
            messages: {
                message: req.body.message
            },
            physioId: req.body.physioId,
            type: 1,
            createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
            updatedAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
        });

        await helpContact.save();
        return res.status(200).json({
            message: "Help Contact added successfully",
            status: 200,
            success: true,
            data: helpContact
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// get help by physio
exports.helpByPhysio = async (req, res) => {
    try {
        const {
            physioId,
        } = req.query;

        if (!physioId) {
            return res.send({
                message: "physioId Is required",
                status: 400,
                success: false
            })
        }

        const helpContact = await HelpContact.find({
            physioId: physioId
        })

        return res.send({
            message: "Help Send Successfully",
            status: 201,
            success: true,
            data: helpContact
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Something went wrong Please try again",
            status: 500,
            success: false
        });
    }
}

// resend message to Help Contact
exports.resendMessage = async (req, res) => {
    try {
        console.log("Resend Messageoooo", req.body);

        const { message, helpContactId } = req.body;

        if (!message || !helpContactId) {
            return res.status(400).json({
                message: "Message and Help Contact Id are required",
                status: 400,
                success: false
            });
        }

        const newMessage = {
            message: message,
            date: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
        };

        const helpContact = await HelpContact.findByIdAndUpdate(
            helpContactId,
            {
                $push: {
                    "messages": newMessage // Append the new message to the `messages` array
                },
                $set: {
                    "status": 0 // Update the `status` field
                }
            },
            { new: true }
        );

        return res.status(200).json({
            message: "Help Contact message resent successfully",
            status: 200,
            success: true,
            data: helpContact
        });


    } catch (error) {
        console.log(error.message);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

exports.GetPhysioReviews = async (req, res) => {
    try {

        let physioId = req.query.physioId
        let rating = req.query.rating
        if (!physioId) {
            return res.status(400).json({
                message: "Physio Id is required",
                status: 400,
                success: false
            });
        }

        if (rating) {
            const reviews = await Review.find({
                physioId: physioId,
                rating: rating
            }).populate('patientId physioId');
            if (reviews.length < 0) {
                return res.status(400).json({
                    message: "No reviews found",
                    status: 400,
                    success: false
                });
            }
            return res.status(200).json({
                message: "Reviews fetched successfully",
                success: true,
                status: 200,
                data: reviews
            });
        } else {
            const reviews = await Review.find({
                physioId: physioId
            }).populate('patientId physioId');
            if (reviews.length < 0) {
                return res.status(400).json({
                    message: "No reviews found",
                    status: 400,
                    success: false
                });
            }
            return res.status(200).json({
                message: "Reviews fetched successfully",
                success: true,
                status: 200,
                data: reviews
            });
        }

    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Get Specialization
exports.GetSpecialization = async (req, res) => {
    try {
        const specialization = await Specialization.find();
        return res.status(200).json({
            message: "Specialization fetched successfully",
            status: 200,
            success: true,
            data: specialization
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

// Get Physio By subscription
exports.GetSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.find().populate('physioId planId');
        return res.status(200).json({
            message: "Subscription fetched successfully",
            status: 200,
            success: true,
            data: subscription
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

// Get Physio By SubSpecialization
exports.GetPhysioBySubscription = async (req, res) => {
    ;;
    try {

        const { physioId } = req.query

        if (!physioId) {
            return res.status(400).json({
                message: "Physio Id is required",
                status: 400,
                success: false
            });
        }

        const subscription = await Subscription.find({
            physioId: physioId
        });
        return res.status(200).json({
            message: "Subscription fetched successfully",
            status: 200,
            success: true,
            data: subscription
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

// Get Physio By Plan
exports.GetPhysioByPlan = async (req, res) => {
    try {
        const plan = await Plan.find();
        return res.status(200).json({
            message: "Plan fetched successfully",
            status: 200,
            success: true,
            data: plan
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

// Get SubSpecialization By Specialization
exports.GetSubSpecialization = async (req, res) => {
    try {
        let specializationId = req.query.specializationId;
        if (!specializationId) {
            return res.status(400).json({
                message: "SpecializationId is required",
                status: 400,
                success: false
            });
        }

        // console.log(specializationId);

        const specialization = await Specialization.find({
            _id: specializationId
        });

        if (specialization.length < 0) {
            return res.status(400).json({
                message: "No specialization found",
                status: 400,
                success: false
            });
        }

        const subSpecialization = await Subspecialization.find({
            specializationId: specializationId
        });

        return res.status(200).json({
            message: "SubSpecialization fetched successfully",
            status: 200,
            success: true,
            data: subSpecialization
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}


// Get Coupon
exports.getCoupon = async (req, res) => {
    try {
        const { couponName, physioId } = req.query;

        // Validate required query parameters
        if (!couponName) {
            return res.status(400).json({
                message: "Coupon Name is required",
                status: 400,
                success: false
            });
        }

        if (!physioId) {
            return res.status(400).json({
                message: "Physio ID is required",
                status: 400,
                success: false,
            });
        }

        // Find the coupon with the specified couponName and physioId
        const coupon = await Coupon.findOne({
            couponName: couponName,
            physioId: { $nin: [physioId] }, // Check if physioId exists in the array
        });
        // console.log(coupon);
        // Check if coupon exists
        if (!coupon) {
            return res.status(404).json({
                message: "No coupon found",
                status: 404,
                success: false
            });
        }

        // Check if the coupon usage limit has been reached
        if (coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({
                message: "Coupon usage limit reached",
                status: 400,
                success: false
            });
        }

        // Return the coupon details
        return res.status(200).json({
            message: "Coupon fetched successfully",
            status: 200,
            success: true,
            data: coupon
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


// Get Notification
exports.getNotification = async (req, res) => {
    try {
        const { physioId } = req.query;

        if (!physioId) {
            return res.status(400).json({
                message: "Physio ID is required",
                status: 400,
                success: false,
            });
        }

        const notification = await Notification.find({
            physioId: physioId,
            to: "physio",
            from: { $in: ["admin", "patient"] },
            isRead: true
        }).populate("physioId patientId")
            .populate({
                path: 'physioId',
                populate: [
                    { path: 'mptDegree.degreeId' },
                    { path: 'bptDegree.degreeId' },
                    // { path: 'degree.degreeId' } // Also included if you want to populate array inside `degree`
                ]
            });

        return res.status(200).json({
            message: "Notification fetched successfully",
            status: 200,
            success: true,
            data: notification
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}


exports.getUnreadNotification = async (req, res) => {
    try {
        const { physioId } = req.query

        if (!physioId) {
            return res.status(404).send({ "message": "physioId not found" })
        }

        let checkPhysio = await physio.findById(physioId)

        if (!checkPhysio) {
            return res.status(404).send({ "message": "physio not found" })
        }

        const chatsWithUnreadMessages = await notification.find({
            physioId,
            to: "physio",
            isRead: false,
            from: { $in: ["admin", "patient"] },
        }).populate({
            path: 'physioId',
            populate: [
                { path: 'mptDegree.degreeId' },
                { path: 'bptDegree.degreeId' },
                // { path: 'degree.degreeId' } // Also included if you want to populate array inside `degree`
            ]
        });

        if (!chatsWithUnreadMessages) {
            return res.status(404).send({ "message": "no unread notifications" })
        }
        return res.status(200).send({
            message: "Notification fetched successfully",
            status: 200,
            success: true,
            data: chatsWithUnreadMessages
        })
    } catch (error) {
        console.log(error);

        return res.status(500).send({ "message": "error while fetching notifications" })
    }
}


// update notifications from physio side
exports.getUnreadNotificationUpdate = async (req, res) => {
    try {
        const { physioId } = req.query

        if (!physioId) {
            return res.status(404).send({ "message": "physioId not found" })
        }

        const physioNotifications = await notification.updateMany({
            physioId,
            to: "physio",
            from: { $in: ["admin", "patient"] },
            isRead: false,
        },
            {
                $set: { isRead: true }
            }
        ).populate({
            path: 'physioId',
            populate: [
                { path: 'mptDegree.degreeId' },
                { path: 'bptDegree.degreeId' },
                // { path: 'degree.degreeId' } // Also included if you want to populate array inside `degree`
            ]
        });

        if (!physioNotifications) {
            return res.status(404).send({ "message": "no notifications" })
        }

        return res.status(200).send({
            message: "Notification fetched successfully",
            status: 200,
            success: true,
            data: physioNotifications
        })

    } catch (error) {
        return res.status(500).send({
            message: "error" + error,
        })
    }

}


exports.addApplicationVersion = async (req, res) => {

    try {

        const { physioId, version } = req.query
        if (!physioId && !version) {
            return res.status(400).json({
                message: 'physioId  and version is required',
                success: false
            })
        }

        const LetPhysio = await physio.findById(physioId)
        if (!physio) {
            return res.status(400).json({
                message: 'physio is not found from this id',
                success: false
            })
        }
        LetPhysio.applicationVersion = version || null
        const data = await LetPhysio.save()

        return res.status(200).json({
            message: 'version save successfully',
            success: true,
            data: data,
            status: 200
        })
    }
    catch (error) {

        return res.status(500).json({
            message: 'Internal Server Error' + error,
            success: false
        })
    }

}
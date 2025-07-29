const Physio = require('../../models/physio')
const jwt = require('jsonwebtoken')
const crypto = require('crypto');
const mongoose = require('mongoose')
const multer = require("multer");
// const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const Coupon = require('../../models/coupon');
const Appointment = require('../../models/appointment');
const PhysioProfileEdit = require('../../models/physioProfileEdit');
const { toArray } = require('../../utility/helper');
const Razorpay = require('razorpay');
const Subscription = require('../../models/subscription');
const Transaction = require('../../models/transaction');
const { msg91OTP } = require('msg91-lib');
const { console } = require('inspector');
const Invoice = require('../../models/invoice');
const generateRandomCode = require('../../utility/generateRandomCode');
const { sendFCMNotification } = require('../../services/fcmService');
const { uploadFileToS3, deleteFileFromS3 } = require('../../services/awsService');

// const { v4: uuidv4 } = require("uuid");
// const { AccessToken } = require("twilio").jwt;
// const VideoGrant = AccessToken.VideoGrant;

// const twilioClient = require("twilio")(
//     process.env.TWILIO_API_KEY_SID,
//     process.env.TWILIO_API_KEY_SECRET,
//     { accountSid: process.env.TWILIO_ACCOUNT_SID }
// );

let instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const msg91otp = new msg91OTP({
    authKey: process.env.MSG91_AUTH_KEY,
    templateId: process.env.MSG91_TEMP_ID,
});

// AWS S3 bucket configuration
// const s3 = new AWS.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });

// upload function
const storage = multer.memoryStorage();

const upload = multer({ storage: storage }).fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'degreeImage', maxCount: 11 },
    { name: 'iapImage', maxCount: 1 },
    { name: 'imagesClinic', maxCount: 10 },
    { name: 'achievementImage', maxCount: 10 },
    { name: 'bptDegreeImage', maxCount: 1 },
    { name: 'mptDegreeImage', maxCount: 1 },
]);


// const uploadFileToS3 = (file, folder) => {
//     const fileKey = `${folder}/${Date.now()}-${file.originalname}`;
//     const params = {
//         Bucket: process.env.AWS_BUCKET_NAME,
//         Key: fileKey,
//         Body: file.buffer,
//     };

//     return new Promise((resolve, reject) => {
//         s3.upload(params, (err, data) => {
//             if (err) return reject(new Error("Something went wrong" + err));
//             resolve(data.Location);
//         });
//     });
// };


// const deleteFileFromS3 = (fileUrl) => {
//     try {
//         // Extract the S3 object key from the file URL
//         const fileKey = fileUrl.split('.amazonaws.com/')[1]; // Adjust this according to your S3 URL format
//         if (!fileKey) {
//             throw new Error(`Invalid file URL: ${fileUrl}`);
//         }

//         const params = {
//             Bucket: process.env.AWS_BUCKET_NAME,
//             Key: fileKey,
//         };

//         return new Promise((resolve, reject) => {
//             s3.deleteObject(params, (err, data) => {
//                 if (err) {
//                     console.error('Error deleting file from S3:', err);
//                     return reject(err);
//                 }
//                 resolve(data);
//             });
//         });
//     } catch (error) {
//         console.error('Failed to delete file:', error.message);
//         throw new Error('Invalid S3 file URL or missing parameters');
//     }
// };


const parseNumber = (val) => {
    const num = parseInt(val);
    return isNaN(num) ? null : num;
};


const generateUnique6CharID = () => {
    // Define the characters to include in the ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charsLength = chars.length;

    // Generate 6 random characters
    let id = '';
    for (let i = 0; i < 8; i++) {
        // Generate a random index based on the chars length
        const randomIndex = crypto.randomBytes(1)[0] % charsLength;
        // Append the character at the random index to the ID
        id += chars[randomIndex];
    }

    return id;
}


exports.signUpPhysioOtp = async (req, res) => {
    try {
        const {
            phone
        } = req.body;

        // let otp = generateRandomCode()
        // const patient =await Patient.findOne({phone : phone})
        Physio.findOne({
            phone: `+91${phone}`,

        })
            .then(
                async (userData) => {

                    // return console.log(userData)

                    if (userData != null && userData.isDeleted) {
                        return res.status(402).json({
                            status: false,
                            message: "You have deleted your account. Please connect with PhysioPlus team to recover your account."
                        });
                    }

                    else if (userData && phone != Number.parseFloat(phone) === 8107333576) {
                        return res.status(409).json({
                            status: false,
                            message: "User with this Phone already exists"
                        });
                    }

                    else {

                        const response = await msg91otp.send(`91${phone}`)
                        // return res.json(response)

                        if (response.type === "success") {
                            res.status(200).json({
                                status: true,
                                message: "otp sent successfully"
                            })
                        } else {
                            res.status(200).json({
                                status: false,
                                message: "otp not sent"
                            })
                        }
                    }
                }
            )

        // })

    } catch (error) {
        res.status(400).json({
            status: false,
            message: "otp not sent"
        })
    }
}
exports.loginPhysioOtp = async (req, res) => {
    try {
        const phone = req.query.phone; // assuming /login-otp?phone=8107333576
        const phoneNumber = Number(phone);

        const userData = await Physio.findOne({
            phone: `+91${phone}`,
        });

        // Create a dummy test user if it's the test phone number
        if (!userData && phoneNumber === 8107333576) {
            const physioN = new Physio({
                fullName: "Test Google",
                phone: `+91${phone}`,
            });
            await physioN.save();
        }

        // Return error for unknown numbers except the test number
        if (!userData && phoneNumber !== 8107333576) {
            return res.status(400).json({
                status: false,
                message: "User with this phone number does not exist",
            });
        }

        // User validations
        if (userData?.isBlocked) {
            return res.status(400).json({
                status: false,
                message: "Your account has been blocked",
            });
        }

        if (userData?.isDeleted) {
            return res.status(402).json({
                status: false,
                message: "Your account has been deleted",
                isDeleted: true,
            });
        }

        // Send OTP
        const response = await msg91otp.send(`91${phone}`);
        if (response.type !== "success") {
            return res.status(400).json({
                status: false,
                message: "Failed to send OTP",
            });
        }

        return res.status(200).json({
            status: true,
            message: "OTP sent successfully",
            data: userData,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            message: "Server error",
            error: error.message,
        });
    }
};

exports.verifyOtpPhysio = async (req, res) => {
    const { otp, phone, deviceId } = req.body;
    try {
        const physioData = await Physio.findOne({ phone: `+91${phone}`, isDeleted: false });

        // Bypass Login OTP verification for testing
        if (physioData?._id && Number.parseFloat(phone) === 8107333576) {
            const token = jwt.sign({ physio: physioData?._id || null }, process.env.JWT_SECRET_KEY);
            physioData.deviceId = deviceId
            await physioData.save()
            return res.status(200).json({
                status: true,
                newUser: false,
                message: "OTP verified successfully",
                token,
                data: physioData || null,
            });
        }

        let response;
        if (!physioData && Number.parseFloat(phone) === 8107333576 && Number.parseFloat(otp) === 1234) {
            // Bypass Sign up OTP verification for testing
            response = { type: "success" }
        } else {
            // Verify OTP using msg91otp
            try {
                response = await msg91otp.verify(`91${phone}`, otp);
            } catch (err) {
                // Handle OTP verification errors
                if (err.statusCode === 400 && err.code === "BAD_REQUEST_DATA") {
                    return res.status(400).json({
                        status: false,
                        message: "OTP not match or expired",
                    });
                }
                console.error("Unexpected error during OTP verification:", err);
                return res.status(500).json({
                    status: false,
                    message: "An error occurred while verifying OTP",
                });
            }
        }

        if (response.type === "success") {
            if (!physioData) {
                // New user registration
                let preferId = 0;
                let unique = false;
                while (!unique) {
                    preferId = generateUnique6CharID();
                    const check = await Physio.findOne({
                        preferId: preferId
                    });
                    if (!check) {
                        unique = true;
                    }
                }

                const newUser = new Physio({
                    phone: `+91${phone}`,
                    deviceId,
                    preferId
                });

                await newUser.save();

                const token = jwt.sign({ patient: newUser._id }, process.env.JWT_SECRET_KEY);

                return res.status(200).json({
                    status: true,
                    newUser: true,
                    message: "OTP verified successfully",
                    token,
                    data: newUser,
                    login: 0,
                });
            }

            await Physio.findByIdAndUpdate(physioData._id, { deviceId });

            const token = jwt.sign({ patient: physioData._id }, process.env.JWT_SECRET_KEY);

            return res.status(200).json({
                status: true,
                newUser: false,
                message: "OTP verified successfully",
                token,
                data: physioData,
                login: 1,
            });
        } else {
            return res.status(400).json({
                status: false,
                message: "Entered wrong OTP",
            });
        }
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({
            status: false,
            message: "An unexpected error occurred while verifying OTP",
            error: err.message,
        });
    }
};


// google login 
exports.googleLogin = async (req, res) => {
    try {
        const { googleId } = req.body;

        if (!googleId) {
            return res.status(400).json({
                message: "Google ID is required",
                status: 400,
                success: false,
            });
        }

        // Check if user already exists
        const patientData = await Physio.findOne({ googleId });

        if (patientData) {
            // Generate a JWT for an existing user
            jwt.sign(
                { patient: patientData._id },
                process.env.JWT_SECRET_KEY,
                // { expiresIn: "1h" },
                (err, token) => {
                    if (err) {
                        console.error("JWT Sign Error:", err);
                        return res.status(500).json({
                            message: "Token generation failed",
                            status: 500,
                            success: false,
                        });
                    }
                    return res.status(200).json({
                        message: "Google login successful",
                        status: 200,
                        token,
                        data: patientData,
                        login: 1,
                        success: true,
                    });
                }
            );
        } else {
            // Generate a unique preferId
            let preferId = '';
            let unique = false;

            while (!unique) {
                preferId = generateUnique6CharID();
                const exists = await Physio.findOne({ preferId });
                if (!exists) {
                    unique = true;
                }
            }

            // Create a new user with Google ID
            const physio = new Physio({
                googleId,
                preferId,
            });

            await physio.save();

            // Generate a JWT for the new user
            jwt.sign(
                { patient: physio._id },
                process.env.JWT_SECRET_KEY,
                // { expiresIn: "1h" },
                (err, token) => {
                    if (err) {
                        console.error("JWT Sign Error:", err);
                        return res.status(500).json({
                            message: "Token generation failed",
                            status: 500,
                            success: false,
                        });
                    }
                    return res.status(201).json({
                        message: "Google signup successful",
                        status: 201,
                        token,
                        data: physio,
                        login: 1,
                        success: true,
                    });
                }
            );
        }
    } catch (error) {
        console.error("Google Login Error:", error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message,
        });
    }
};

// Professional Details
exports.getProfessionalDetails = async (req, res) => {
    try {

        const professionalDetails = await Physio.findById(req.query.Id, {
            degree: 1,
            achievement: 1,
            specialization: 1,
            subspecializationId: 1,
            workExperience: 1,
            iapMember: 1,
            iapNumber: 1,
            iapImage: 1,
            serviceType: 1,
            bptDegree: 1,
            mptDegree: 1,
        }).populate("specialization").populate("subspecializationId").populate("degree.degreeId").populate("bptDegree.degreeId").populate("mptDegree.degreeId");

        return res.status(200).json({
            message: "Professional details fetched successfully",
            status: 200,
            success: true,
            data: professionalDetails,
        });


    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
        });
    }
};

// Business Details
exports.getBusinessDetails = async (req, res) => {
    try {

        let id = req.query.Id

        if (!id && id === undefined) {
            return res.status(404).json({
                success: false,
                message: "please provide id" + req.query.Id,
            })
        }
        if (!mongoose.Types.ObjectId.isValid(req.query.Id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ObjectId format" + req.query.Id,

            });
        }
        const businessDetails = await Physio.findById(id, {
            "clinic.name": 1,
            "clinic.address": 1,
            "clinic.imagesClinic": 1,
            "clinic.workingDays": 1,
            "clinic.timings.morningStart": 1,
            "clinic.timings.morningEnd": 1,
            "clinic.timings.eveningStart": 1,
            "clinic.timings.eveningEnd": 1,
            "clinic.duration": 1,
            "clinic.charges": 1,
            "home.workingDays": 1,
            "home.address": 1,
            "home.morningTimings.start": 1,
            "home.morningTimings.end": 1,
            "home.eveningTimings.start": 1,
            "home.eveningTimings.end": 1,
            "home.duration": 1,
            "home.charges": 1,
            "home.zipCode": 1,
            "home.consultationCharges5Km": 1,
            "home.consultationCharges10Km": 1,
        }).populate('subscriptionId'); // Include subscription details if needed

        if (!businessDetails) {
            return res.status(404).json({
                message: "Business details not found",
                status: 404,
                success: false,
            });
        }

        return res.status(200).json({
            message: "Business details fetched successfully",
            status: 200,
            success: true,
            data: businessDetails,
        });



    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong" + error.message,
            status: 500,
            success: false,
        });
    }
}


exports.addProfileDetails = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                console.error('File upload error:', err);
                return res.status(400).json({
                    message: 'File upload failed',
                    status: 400,
                    success: false,
                    error: err.message,
                });
            }

            const physio = await Physio.findById(req.body.physioId)
                .populate('specialization')
                .populate('degree.degreeId')
                .populate('subscriptionId');

            if (!physio) {
                return res.status(404).json({
                    message: 'No physio exists with this ID',
                    status: 404,
                    success: false,
                });
            }

            // Parse the `title` field for achievements
            let parsedTitles = [];
            if (req.body.title) {
                try {
                    // Attempt to parse the title as JSON
                    parsedTitles = JSON.parse(req.body.title);

                    // Check if the parsed value is an array
                    if (!Array.isArray(parsedTitles)) {
                        throw new Error('Parsed title is not an array');
                    }
                } catch (error) {
                    return res.status(400).json({
                        message: 'Invalid format for title. Expected a JSON array.',
                        status: 400,
                        success: false,
                        error: error.message,
                    });
                }
            }

            // Prepare upload promises
            let profileImageUrl, iapImageUrl, degreeImageUrls = [], clinicImageUrls = [], achievementImages = []

            if (req.files['profileImage']?.[0]) {
                profileImageUrl = await uploadFileToS3(req.files['profileImage'][0], 'PhysioApps/physio');
                if (physio.profileImage) {
                    await deleteFileFromS3(physio.profileImage);
                }
            }
            if (req.files['degreeImage']) {
                degreeImageUrls = await Promise.all(
                    req.files['degreeImage'].map((file) => uploadFileToS3(file, 'PhysioApps/physio'))
                );
                if (physio.degree?.degreeImage) {
                    await Promise.all(
                        physio.degree.degreeImage.map((image) => deleteFileFromS3(image))
                    );
                }
            }
            if (req.files['iapImage']?.[0]) {
                iapImageUrl = await uploadFileToS3(req.files['iapImage'][0], 'PhysioApps/physio');
                if (physio.iapImage) {
                    await deleteFileFromS3(physio.iapImage);
                }
            }
            if (req.files['imagesClinic']) {
                clinicImageUrls = await Promise.all(
                    req.files['imagesClinic'].map((file) => uploadFileToS3(file, 'PhysioApps/physio'))
                );
                if (physio.clinic.imagesClinic) {
                    await Promise.all(
                        physio.clinic.imagesClinic.map((image) => deleteFileFromS3(image))
                    );
                }
            }
            if (req.files['achievementImage']) {
                achievementImages = await Promise.all(
                    req.files['achievementImage'].map((file) => uploadFileToS3(file, 'PhysioApps/physio'))
                );
                if (physio.achievement.achievementImage) {
                    await Promise.all(
                        physio.achievement.achievementImage.map((image) => deleteFileFromS3(image))
                    );
                }
            }

            // Pair achievements with titles
            let achievements = [];
            if (parsedTitles.length > 0) {
                achievements = parsedTitles.map((title, index) => ({
                    title,
                    achievementImage: achievementImages[index] || null,
                }));
            }

            console.log(req.body.fullName, "req.body")

            // Update physio profile
            const updatedPhysio = await Physio.findByIdAndUpdate(
                physio._id,
                {
                    $set: {
                        profileImage: profileImageUrl || physio.profileImage,
                        fullName: req.body.fullName || physio.fullName,
                        dob: req.body.dob || physio.dob,
                        email: req.body.email || physio.email,
                        about: req.body.about || physio.about,
                        'degree.degreeId': Array.isArray(req.body.degreeId) ? req.body.degreeId : req.body.degreeId && req.body.degreeId !== '[]' ? JSON.parse(req.body.degreeId) : physio.degree.degreeId,
                        'degree.degreeImage': degreeImageUrls.length > 0 ? degreeImageUrls : physio.degree.degreeImage,
                        specialization: Array.isArray(req.body.specializationId) ? req.body.specializationId : req.body.specializationId && req.body.specializationId !== '[]' ? JSON.parse(req.body.specializationId) : physio.specialization,
                        subspecializationId: Array.isArray(req.body.subSpecializationId) ? req.body.subSpecializationId : req.body.subSpecializationId && req.body.subSpecializationId !== '[]' ? JSON.parse(req.body.subSpecializationId) : physio.subspecializationId,
                        workExperience: req.body.workExperience || physio.workExperience,
                        iapMember: req.body.iapMember || physio.iapMember,
                        iapNumber: req.body.iapNumber || physio.iapNumber,
                        iapImage: iapImageUrl || physio.iapImage,
                        serviceType: Array.isArray(req.body.serviceType) ? req.body.serviceType : req.body.serviceType && req.body.serviceType !== '[]' ? JSON.parse(req.body.serviceType) : physio.serviceType,
                        country: req.body.clinicCountry?.toLowerCase() || physio.country,
                        state: req.body.clinicState?.toLowerCase() || physio.state,
                        city: req.body.clinicCity?.toLowerCase() || physio.city,
                        'clinic.name': req.body.clinicName || physio.clinic.name,
                        'clinic.address': req.body.clinicAddress || physio.clinic.address,
                        'clinic.workingDays': Array.isArray(req.body.clinicWorkingDays) ? req.body.clinicWorkingDays : req.body.clinicWorkingDays && req.body.clinicWorkingDays !== '[]' ? JSON.parse(req.body.clinicWorkingDays) : physio.clinic.workingDays,
                        'clinic.timings.start': req.body.clinicStartTime || physio.clinic.timings.start,
                        'clinic.timings.end': req.body.clinicEndTime || physio.clinic.timings.end,
                        'clinic.duration': req.body.clinicDuration || physio.clinic.duration,
                        'clinic.charges': req.body.clinicCharges || physio.clinic.charges,
                        'clinic.zipCode': req.body.clinicZipCode || physio.clinic.zipCode,
                        'clinic.imagesClinic': clinicImageUrls.length > 0 ? clinicImageUrls : physio.clinic.imagesClinic,
                        home: {
                            status: 0,
                            workingDays: Array.isArray(req.body.homeWorkingDays) ? req.body.homeWorkingDays : req.body.homeWorkingDays && req.body.homeWorkingDays !== '[]' ? JSON.parse(req.body.homeWorkingDays) : physio.home.workingDays,
                            mode: Array.isArray(req.body.homeMode) ? req.body.homeMode : req.body.homeMode && req.body.homeMode !== '[]' ? JSON.parse(req.body.homeMode) : physio.home.mode,
                            morningTimings: {
                                start: req.body.homeMorningStartTime || physio.home.morningTimings.start,
                                end: req.body.homeMorningEndTime || physio.home.morningTimings.end,
                            },
                            eveningTimings: {
                                start: req.body.homeEveningStartTime || physio.home.eveningTimings.start,
                                end: req.body.homeEveningEndTime || physio.home.eveningTimings.end,
                            },
                            duration: req.body.homeDuration || physio.home.duration,
                            charges: req.body.homeCharges || physio.home.charges,
                            zipCode: req.body.homeZipCode || physio.home.zipCode
                        },
                        online: {
                            status: 0,
                            workingDays: Array.isArray(req.body.onlineWorkingDays) ? req.body.onlineWorkingDays : req.body.onlineWorkingDays && req.body.onlineWorkingDays !== '[]' ? JSON.parse(req.body.onlineWorkingDays) : physio.online.workingDays,
                            // mode: req.body.onlineMode || physio.online.mode,
                            timings: {
                                start: req.body.onlineStartTime || physio.online.timings.start,
                                end: req.body.onlineEndTime || physio.online.timings.end,
                            },
                            duration: req.body.onlineDuration || physio.online.duration,
                            charges: req.body.onlineCharges || physio.online.charges,
                        },
                        latitude: req.body.latitude || physio.latitude,
                        longitude: req.body.longitude || physio.longitude,
                        activeStatus: req.body.activeStatus || physio.activeStatus,
                        accountStatus: req.body.accountStatus || physio.accountStatus,
                        gender: req.body.gender || physio.gender,
                        language: req.body.language || physio.language,
                        achievement: achievements.length > 0 ? achievements : physio.achievement,
                        // Update the location field with latitude and longitude
                        // location: {
                        //     type: 'Point',
                        //     coordinates: [
                        //         req.body.longitude || physio.longitude,  // longitude first
                        //         req.body.latitude || physio.latitude    // latitude second
                        //     ]
                        // }
                    },
                },
                { new: true }
            );

            return res.status(200).json({
                message: 'Profile updated successfully',
                status: true,
                success: true,
                data: updatedPhysio,
            });
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            message: 'Something went wrong, please try again later',
            status: 500,
            success: false,
            error: error.message,
        });
    }
};

// physio PersonalDetails

exports.addPhysioPersonalDetails = async (req, res) => {
    try {
        const physio = await Physio.findById(req.body.physioId)
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                status: 404,
                success: false,
            });
        }

        const updatedPhysio = await Physio.findByIdAndUpdate(
            physio._id,
            {
                onboardedFrom: "mobile",
                profileImage: req.body.profileImage || physio.profileImage,
                fullName: req.body.fullName || physio.fullName,
                dob: req.body.dob || physio.dob,
                email: req.body.email || physio.email,
                gender: req.body.gender || physio.gender,
                about: req.body.about || physio.about,
            },
            { new: true }
        );

        // Send Notification To Admin
        await sendFCMNotification("Token Placeholder", {
            physioId: updatedPhysio._id,
            title: `New Physio ${updatedPhysio.fullName} Added`,
            body: `A new physio has been added to the system.`,
            type: 'onboarding',
            from: 'admin',
            to: 'admin',
            for: 'admin'
        }, true)

        return res.status(200).json({
            message: 'Physio profile updated successfully',
            status: true,
            success: true,
            data: updatedPhysio,
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            message: 'Something went wrong, please try again later',
            status: 500,
            success: false,
            error: error.message,
        });
    }
};

// physio Professions Details
exports.addPhysioProfessionDetails = async (req, res) => {
    try {
        const physio = await Physio.findById(req.body.physioId)
        if (!physio) {
            return res.status(404).json({
                message: 'No physio exists with this ID',
                status: 404,
                success: false,
            });
        }

        const updatedPhysio = await Physio.findByIdAndUpdate(
            physio._id,
            {
                $set: {
                    bptDegree: {
                        degreeId: req.body.bptDegreeId || null,
                        image: req.body.bptDegreeImage || physio.bptDegree.image
                    },
                    mptDegree: {
                        degreeId: Array.isArray(req.body?.mptDegreeId) && req.body?.mptDegreeId.length > 0 ? req.body?.mptDegreeId[0] : null,
                        image: req.body?.mptDegreeImage || physio.mptDegree?.image

                    },
                    specialization: Array.isArray(req.body.specializationId) ? req.body.specializationId : req.body.specializationId && req.body.specializationId !== '[]' ? JSON.parse(req.body.specializationId) : physio.specialization,
                    subspecializationId: Array.isArray(req.body.subSpecializationId) ? req.body.subSpecializationId : req.body.subSpecializationId && req.body.subSpecializationId !== '[]' ? JSON.parse(req.body.subSpecializationId) : physio.subspecializationId,
                    workExperience: req.body.workExperience || physio.workExperience,
                    iapMember: req.body.iapMember || physio.iapMember,
                    iapNumber: req.body.iapNumber || physio.iapNumber,
                    iapImage: req.body.iapImage || physio.iapImage,
                    serviceType: Array.isArray(req.body.serviceType) ? req.body.serviceType : req.body.serviceType && req.body.serviceType !== '[]' ? JSON.parse(req.body.serviceType) : physio.serviceType,
                    achievement: Array.isArray(req.body.achievements) ? req.body.achievements : req.body.achievements && req.body.achievements !== '[]' ? JSON.parse(req.body.achievements) : physio.achievement,
                },
            },
            { new: true }
        );

        return res.status(200).json({
            message: 'Physio profile updated successfully',
            status: true,
            success: true,
            data: updatedPhysio,
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Something went wrong, please try again later',
            status: 500,
            success: false,
            error: error.message,
        });

    }
};

// Add Physio Business Details
exports.addPhysioBusinessDetails = async (req, res) => {
    try {
        const physio = await Physio.findById(req.body.physioId)
        if (!physio) {
            return res.status(404).json({
                message: 'No physio exists with this ID',
                status: 404,
                success: false,
            });
        }

        const uniqueId = physio._id.toString();
        const nameSlug = physio.fullName.toLowerCase();
        let slug = `${nameSlug}-${uniqueId}`;

        const existingPhysio = await Physio.findOne({ slug });

        if (existingPhysio) {
            slug = existingPhysio.slug
            console.log('slug is already present' + slug);
        }

        const updatedPhysio = await Physio.findByIdAndUpdate(
            physio._id,
            {
                $set: {
                    slug: slug,
                    country: req.body.clinicCountry?.toLowerCase() || physio.country,
                    state: req.body.clinicState?.toLowerCase() || physio.state,
                    city: req.body.clinicCity?.toLowerCase() || physio.city,
                    'clinic.name': req.body.clinicName || physio.clinic.name,
                    'clinic.address': req.body.clinicAddress || physio.clinic.address,
                    'clinic.workingDays': Array.isArray(req.body.clinicWorkingDays) ? req.body.clinicWorkingDays : req.body.clinicWorkingDays && req.body.clinicWorkingDays !== '[]' ? JSON.parse(req.body.clinicWorkingDays) : physio.clinic.workingDays,
                    'clinic.timings.start': req.body.clinicStartTime || physio.clinic.timings.start,
                    'clinic.timings.end': req.body.clinicEndTime || physio.clinic.timings.end,
                    'clinic.duration': req.body.clinicDuration || physio.clinic.duration,
                    'clinic.charges': req.body.clinicCharges || physio.clinic.charges,
                    'clinic.zipCode': req.body.clinicZipCode || physio.clinic.zipCode,
                    'clinic.imagesClinic': req.body.clinicImages,
                    home: {
                        status: 0,
                        workingDays: Array.isArray(req.body.homeWorkingDays) ? req.body.homeWorkingDays : req.body.homeWorkingDays && req.body.homeWorkingDays !== '[]' ? JSON.parse(req.body.homeWorkingDays) : physio.home.workingDays,
                        mode: Array.isArray(req.body.homeMode) ? req.body.homeMode : req.body.homeMode && req.body.homeMode !== '[]' ? JSON.parse(req.body.homeMode) : physio.home.mode,
                        morningTimings: {
                            start: req.body.homeMorningStartTime || physio.home.morningTimings.start,
                            end: req.body.homeMorningEndTime || physio.home.morningTimings.end,
                        },
                        eveningTimings: {
                            start: req.body.homeEveningStartTime || physio.home.eveningTimings.start,
                            end: req.body.homeEveningEndTime || physio.home.eveningTimings.end,
                        },
                        duration: req.body.homeDuration || physio.home.duration,
                        charges: req.body.homeCharges || physio.home.charges,
                        zipCode: req.body.homeZipCode || physio.home.zipCode,
                        homeCity: req.body.homeCity || physio.home.homeCity,
                        homeState: req.body.homeState || physio.home.homeState,
                        consultationCharges5Km: req.body.homeConsultationCharges5Km || physio.home.consultationCharges5Km,
                        consultationCharges10Km: req.body.homeConsultationCharges10Km || physio.home.consultationCharges5Km,
                    },
                    online: {
                        status: 0,
                        workingDays: Array.isArray(req.body.onlineWorkingDays) ? req.body.onlineWorkingDays : req.body.onlineWorkingDays && req.body.onlineWorkingDays !== '[]' ? JSON.parse(req.body.onlineWorkingDays) : physio.online.workingDays,
                        timings: {
                            start: req.body.onlineStartTime || physio.online.timings.start,
                            end: req.body.onlineEndTime || physio.online.timings.end,
                        },
                        duration: req.body.onlineDuration || physio.online.duration,
                        charges: req.body.onlineCharges || physio.online.charges,
                    },
                    longitude: req.body.longitude || physio.longitude,
                    latitude: req.body.latitude || physio.latitude,
                    // location: {
                    //     type: 'Point',
                    //     coordinates: [
                    //         req.body.longitude || physio.longitude,  // longitude first
                    //         req.body.latitude || physio.latitude    // latitude second
                    //     ]
                    // }
                }
            },
            { new: true }
        )

        return res.status(200).json({
            message: 'Physio business details updated successfully',
            status: true,
            success: true,
            data: updatedPhysio,
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Something went wrong, please try again later',
            status: 500,
            success: false,
            error: error.message,
        });
    }
};


// exports.deleteAccount = async (req, res) => {
//     try {
//         const physio = await Physio.findById(req.user._id);
//         if (!physio) {
//             return res.status(404).json({
//                 message: "Physio not found",
//                 status: 404,
//                 success: false,
//             });
//         }

//         // Delete the profile picture
//         if (physio.profilePicture) {
//             const deleteParams = {
//                 Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                 Key: `Physio/${physio.profilePicture}`,
//             };
//             s3.deleteObject(deleteParams, (err) => {
//                 if (err) {
//                     console.error('Error deleting profile picture:', err);
//                 }
//             });
//         }

//         // Delete the clinic images
//         if (physio.clinic.imagesClinic) {
//             physio.clinic.imagesClinic.forEach((image) => {
//                 const deleteParams = {
//                     Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                     Key: `Physio/${image}`,
//                 };
//                 s3.deleteObject(deleteParams, (err) => {
//                     if (err) {
//                         console.error('Error deleting clinic image:', err);
//                     }
//                 });
//             });
//         }

//         // Delete the degree image
//         if (physio.degreeImage) {
//             const deleteParams = {
//                 Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                 Key: `Physio/${physio.degreeImage}`,
//             };
//             s3.deleteObject(deleteParams, (err) => {
//                 if (err) {
//                     console.error('Error deleting degree image:', err);
//                 }
//             });
//         }

//         // Delete the iap image
//         if (physio.iapImage) {
//             const deleteParams = {
//                 Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                 Key: `Physio/${physio.iapImage}`,
//             };
//             s3.deleteObject(deleteParams, (err) => {
//                 if (err) {
//                     console.error('Error deleting iap image:', err);
//                 }
//             });
//         }

//         await Physio.findByIdAndDelete(req.user._id);
//         return res.status(200).json({
//             message: "Account deleted successfully",
//             status: true,
//             success: true,
//         });
//     } catch (error) {
//         console.error('Delete account error:', error);
//         return res.status(500).json({
//             message: "Something went wrong, please try again later",
//             status: 500,
//             success: false,
//         });
//     }
// };


// logout
exports.logout = async (req, res) => {
    try {
        const physio = await Physio.findById(req.user._id);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false,
            });
        }

        // remove token
        await Physio.findByIdAndUpdate(req.user._id, {
            token: null
        });
        return res.status(200).json({
            message: "Logged out successfully",
            status: true,
            success: true,
        });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
        });
    }
};

// add physio uplode csv file 
exports.addPhysioUplodeCSV = async (req, res) => {
    try {
        upload(req, res, async (err) => {

        })

    } catch (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
        });
    }
}


// physio clinic home and online status on and off
exports.physioStatus = async (req, res) => {
    try {

        const {
            physioId,
            status
        } = req.body

        if (!physioId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false,
            });
        }

        if (!status) {
            return res.status(400).json({
                message: "status is required",
                status: 400,
                success: false,
            });
        }

        // check if physio exists
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "physio not found",
                status: 400,
                success: false,
            });
        }

        await Physio.findByIdAndUpdate(physioId, {
            clinic: {
                status: status
            },
        });


    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
        });
    }
};

// get physio By id
exports.getPhysioById = async (req, res) => {
    try {
        let id = req.query.physioId;

        console.log(id, "physio");
        const physio = await Physio.findById(id)
            .populate("specialization")
            .populate("degree.degreeId")
            .populate("subscriptionId")
            .populate("subspecializationId")
            .populate({
                path: "subscriptionId", // path to subscriptionId
                populate: {
                    path: "planId", // populate the planId field inside subscriptionId
                    model: "Plan" // specify the model for planId
                }
            });
        if (!physio) {
            return res.status(404).json({
                status: false,
                message: `Physio not found ${id}`,
                status: 404,
                id: id
            });
        }

        // total Appointment
        const totalAppointment = await Appointment.find({
            physioId: physio._id
        }).countDocuments();

        // Total Appointments with `isTreatmentScheduled.startTime`
        const totalStartTimeScheduled = await Appointment.find({
            physioId: physio._id,
            "isTreatmentScheduled.startTime": { $exists: true, $ne: "" }, // Ensures startTime exists and is not empty
        }).countDocuments();

        // console.log(totalStartTimeScheduled, "totalTreatmentScheduled");


        return res.json({
            status: true,
            message: "Data returned",
            data: physio,
            totalAppointment,
            totalTreatmentScheduled: totalStartTimeScheduled
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({

            status: false,
            message: "Error fetching physio" + error,
            status: 500
        });
    }
};


// Delete physio
exports.deletePhysio = async (req, res) => {
    try {
        const { physioId } = req.query;

        if (!physioId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false,
            });
        }

        // Validate physioId as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: 'Invalid physioId format',
                success: false,
                status: 400
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "physio not found",
                status: 400,
                success: false,
            });
        }

        // Unapprove Physio & Soft Delete Physio
        await Physio.findByIdAndUpdate(
            physioId,
            {
                accountStatus: 0,
                isDeleted: true
            },
            { new: true }
        );

        return res.status(200).json({
            message: "physio deleted successfully",
            status: true,
            success: true,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later" + error,
            status: 500,
            success: false,
        });
    }

};


//  Twilio video call CreateRoom
exports.videoCallCreateRoom = async (req, res) => {
    try {
        const {
            appointmentId,
            name,
        } = req.body;

        if (!appointmentId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false,
            });
        }
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(400).json({
                message: "appointment not found",
                status: 400,
                success: false,
            });
        }

        const room = await twilioClient.video.rooms.create({
            uniqueName: `room-${name}`,
            type: 'group',
            maxParticipants: 3,
            // recordingEnabled: true,
            recordParticipantsOnConnect: true
        });

        // return console.log('Room created', room)

        // Generate an access token
        const token = new AccessToken(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_API_KEY_SID,
            process.env.TWILIO_API_KEY_SECRET,
            { identity: uuidv4() }
        );

        // Create a VideoGrant for the token
        const videoGrant = new VideoGrant({
            room: room.sid
        });
        token.addGrant(videoGrant);


        return res.status(200).json({
            message: "Room created successfully",
            status: true,
            success: true,
            data: token.toJwt()
        });

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error
        });
    }
};


exports.videoCallGenerateToken = async (req, res) => {
    try {
        const { roomId, appointmentId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                message: "roomId is required",
                status: 400,
                success: false,
            });
        }

        if (!appointmentId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false,
            });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(400).json({
                message: "Appointment not found",
                status: 400,
                success: false,
            });
        }

        // Fetch the room using the v1 API
        const room = await twilioClient.video.v1.rooms(roomId).fetch();
        // Check if room exists
        if (!room) {
            return res.status(400).json({
                message: "room not found",
                status: 400,
                success: false,
            });
        }

        // Generate an access token
        const token = new AccessToken(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_API_KEY_SID,
            process.env.TWILIO_API_KEY_SECRET,
            { identity: uuidv4() }
        );

        // Create a VideoGrant for the token
        const videoGrant = new VideoGrant({
            room: roomId,
        });
        token.addGrant(videoGrant);

        return res.status(200).json({
            message: "Token generated successfully",
            status: true,
            success: true,
            data: token.toJwt()  // Convert the token to a JWT string
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
        });
    }
};


exports.physioSubscriptionPlanPayment = async (req, res) => {
    try {
        const {
            physioId,
            amount,
            couponId,
        } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false,
            });
        }

        if (!amount) {
            return res.status(400).json({
                message: "amount is required",
                status: 400,
                success: false,
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "physio not found",
                status: 400,
                success: false,
            });
        }

        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if (!coupon) {
                return res.status(400).json({
                    message: "coupon not found",
                    status: 400,
                    success: false,
                });
            }
        }

        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: "order_rcptid_11",
            payment_capture: '1',
            notes: {
                couponId: couponId,
                physioId: physioId,
                amount: amount,
            }
        };

        const payment = await instance.orders.create(options);


        return res.status(200).json({
            message: "Payment initiated successfully",
            status: true,
            success: true,
            data: payment
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
        });
    }
};

// payment verify
exports.verifyPayment = async (req, res) => {
    try {
        const {
            orderId
        } = req.body;

        if (!orderId) {
            return res.status(400).json({
                message: "orderId is required",
                status: 400,
                success: false,
            });
        }

        const payment = await instance.orders.fetch(orderId);

        if (payment.status === 'paid') {
            const physio = await Physio.findById(payment.notes.physioId);
            if (!physio) {
                return res.status(400).json({
                    message: "physio not found",
                    status: 400,
                    success: false,
                });
            }

            await Physio.findByIdAndUpdate(payment.notes.physioId, {
                orderId: payment.id,
                amount: payment.amount,
                couponId: payment.notes.couponId || null,
            });

            // Physio transaction
            const transaction = Transaction({
                physioId: physio._id,
                transactionId: payment.id,
                amount: payment.amount,
                physioTransactionType: 1,
                paymentMode: online,
                paymentStatus: paid,
            });

            await transaction.save();

            return res.status(200).json({
                message: "Payment verified successfully",
                status: 200,
                success: true,
            });

        } else {
            return res.status(400).json({
                message: "Payment failed",
                status: 400,
                success: false,
            });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
        });
    }
};

// Subscription plan payment
exports.subscriptionPlanPayment = async (req, res) => {
    try {
        const {
            physioId,
            amount,
            gst,
            couponId,
            planId,
            isRazorPay,
            walletAmount,
        } = req.body;

        console.log(req.body, "body")

        if (!physioId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false,
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "physio not found",
                status: 400,
                success: false,
            });
        }
        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(400).json({
                message: "plan not found",
                status: 400,
                success: false,
            });
        }

        if (isRazorPay == "false" || isRazorPay == false) {
            if (couponId) {
                const coupon = await Coupon.findById(couponId);
                if (!coupon) {
                    return res.status(400).json({
                        message: "coupon not found",
                        status: 400,
                        success: false,
                    });
                }
                await Coupon.findByIdAndUpdate(
                    couponId,
                    {
                        $addToSet: { physioId: physio._id }, // Add physioId to the array if not already present
                        $inc: { usageCount: 1 }             // Increment usageCount by 1
                    },
                    { new: true } // Return the updated document
                );
            }

            // Subscription
            const subscription = Subscription({
                planId: plan._id,
                physioId: physio._id,
                amount: plan.price,
                couponId: couponId,
                patientLimit: plan.patientLimit,
                paymentStatus: 1,
                startAt: moment().toDate(),
                expireAt: moment().add(plan.planMonth, 'months').toDate()
            });
            await subscription.save();

            // Transaction
            const transaction = await Transaction.create({
                physioId: physio._id,
                subscriptionId: subscription._id,
                amount: walletAmount,
                couponId: couponId,
                wallet: walletAmount,
                physioTransactionType: "debit",
                paymentStatus: "paid",
                paymentMode: "wallet",
                paidTo: "physioPlus",
                paidFor: "subscription",
            });

            // Physio Add Subscription
            await Physio.findByIdAndUpdate(physioId, {
                subscriptionId: subscription._id,
                subscriptionCount: physio.subscriptionCount + 1
            });

            if (walletAmount) {
                await Physio.findByIdAndUpdate(physioId, {
                    $inc: { wallet: -walletAmount }
                });
            }

            // Approve Physio On Wallet Payment
            const planType = plan.planType
            if (planType !== 0) {
                await Physio.findByIdAndUpdate(
                    physio._id,
                    {
                        accountStatus: 1,
                    },
                    { new: true }
                );
            }

            // Create Subscription Invoice On Wallet Payment
            await Invoice.create({
                type: "subscription",
                paymentMode: "wallet",
                physioId: physio._id,
                subscriptionId: subscription._id,
                transactionId: transaction._id,
                amount: walletAmount
            });

            return res.status(200).json({
                message: "Subscription plan added successfully",
                status: 201,
                success: true,
                data: subscription
            });
        }

        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: "order_rcptid_11",
            payment_capture: '1',
            notes: {
                couponId: couponId,
                physioId: physioId,
                amount: amount,
                planId: planId,
                walletAmount: walletAmount,
                gst: gst
            }
        };

        const payment = await instance.orders.create(options);

        // physio walletAmount should be  updated
        if (walletAmount) {
            await Physio.findByIdAndUpdate(physioId, {
                $inc: { wallet: -walletAmount }
            });
        }

        return res.status(200).json({
            message: "Payment initiated successfully",
            status: true,
            success: true,
            data: payment
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
        });
    }
}

// verify payment
exports.verifySubscriptionPlanPayment = async (req, res) => {
    try {
        const {
            orderId
        } = req.body;

        if (!orderId) {
            return res.status(400).json({
                message: "orderId is required",
                status: 400,
                success: false,
            });
        }

        const payment = await instance.orders.fetch(orderId);

        if (payment.status === 'paid') {
            const physio = await Physio.findById(payment.notes.physioId);
            if (!physio) {
                return res.status(400).json({
                    message: "physio not found",
                    status: 400,
                    success: false,
                });
            }

            // subscription plan
            const plan = await Plan.findById(payment.notes.planId);
            if (!plan) {
                return res.status(400).json({
                    message: "plan not found",
                    status: 400,
                    success: false,
                });
            }

            // const transaction = await Transaction.create({
            //     amount,
            //     gst: payment.notes.gst,
            //     wallet: payment.notes.walletAmount,
            //     planType: plan.planType,
            //     transactionId: `PHONL_${generateRandomCode()}`,
            //     orderId: payment.id,
            //     physioId: physio._id,
            //     paidTo: "physioPlus",
            //     paymentStatus: 'paid',
            //     paymentMode: 'online',
            //     adminAmount: amount
            // });

            // Subscription
            const subscription = Subscription({
                physioId: payment.notes.physioId,
                planId: payment.notes.planId,
                couponId: payment.notes.couponId || null,
                orderId: payment.id,
                amount: payment.amount / 100,
                patientLimit: plan.planPatientLimit,
                startAt: moment().toDate(),
                expireAt: moment().add(plan.planMonth, 'months').toDate()
            })
            const savedSubscription = await subscription.save();

            // Transaction
            const transaction = await Transaction.create({
                orderId: payment.id,
                physioId: physio._id,
                subscriptionId: subscription._id,
                couponId: payment.notes.couponId,
                amount: payment.amount / 100,
                gstAmount: payment.notes.gst,
                wallet: payment.notes.walletAmount,
                transactionId: `PHONL_${generateRandomCode()}`,
                physioTransactionType: "debit",
                paymentStatus: "paid",
                paymentMode: "online",
                paidTo: "physioPlus",
                paidFor: "subscription"
            });

            // coupon Count
            if (payment.notes.couponId) {

                let couponId = await Coupon.findById(payment.notes.couponId);

                await Coupon.findByIdAndUpdate(
                    payment.notes.couponId,
                    {
                        $addToSet: { physioId: physio._id }, // Add physioId to the array if not already present
                        $inc: { usageCount: 1 }             // Increment usageCount by 1
                    },
                    { new: true } // Return the updated document
                );
            }

            // physio add subscriptionId
            physio.subscriptionId = savedSubscription._id;
            await physio.save();

            const physio2 = await Physio.findById(physio._id).populate({
                path: 'subscriptionId',
                populate: { path: 'planId' }
            });

            const planType = physio2.subscriptionId.planId.planType
            if (planType !== 0) {
                await Physio.findByIdAndUpdate(
                    physio2._id,
                    {
                        accountStatus: 1,
                    },
                    { new: true }
                );
            }

            // Create Subscription Invoice
            await Invoice.create({
                type: "subscription",
                paymentMode: "online",
                physioId: physio._id,
                transactionId: transaction._id,
                subscriptionId: savedSubscription._id,
                amount: payment.amount / 100
            });

            // Send Notification
            const data = {
                title: "Congratulations! Subscription Upgrade",
                body: `You have been upgraded to ${plan.name} plan.`,
                type: "subscription",
                from: "admin",
                to: "physio",
                for: "physio",
            }
            await sendFCMNotification(physio.deviceToken, data)

            return res.status(200).json({
                message: "Payment verified successfully",
                status: 200,
                success: true,
                data: savedSubscription
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message
        });
    }
}

// add Subscription plan
exports.addSubscriptionPlan = async (req, res) => {
    try {
        const { physioId, planId, amount } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false,
            });
        }

        if (!planId) {
            return res.status(400).json({
                message: "planId is required",
                status: 400,
                success: false,
            });
        }


        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "physio not found",
                status: 400,
                success: false,
            });
        }

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(400).json({
                message: "plan not found",
                status: 400,
                success: false,
            });
        }

        // Subscription
        const subscription = Subscription({
            physioId: physio._id,
            planId: plan._id,
            amount: amount,
            patientLimit: plan.patientLimit || 0,
            expireAt: moment().add(plan.planMonth, 'months').toDate()
        })

        const savedSubscription = await subscription.save();

        await Physio.findByIdAndUpdate(physioId, {
            $set: {
                subscriptionId: savedSubscription._id,
                subscriptionCount: physio.subscriptionCount + 1
            }
        }, {
            new: true
        });

        return res.status(200).json({
            message: "Subscription plan added successfully",
            status: 200,
            success: true,
            data: savedSubscription,
            physio
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}


// plan
exports.GetPhysioByPlan = async (req, res) => {
    try {
        const plan = await Plan.find({
            status: 0
        });
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


exports.getAllDeletedPhysios = async (req, res) => {
    try {

        const result = await Physio.find({
            _id: { $ne: ObjectId("6747148969866e56d82539d0") }
        }).skip(7);


        return res.status(200).json({
            message: "All physios deleted successfully",
            status: 200,
            success: true,
            data: result
        });

    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}


exports.Physio = async (req, res) => {
    try {
        const { couponId, physioId } = req.query;
        console.log(couponId, physioId);
        await Coupon.findByIdAndUpdate(
            couponId,
            {
                $addToSet: { physioId: physioId }, // Add physioId to the array if not already present
                $inc: { usageCount: 1 }             // Increment usageCount by 1
            },
            { new: true } // Return the updated document
        );

        return res.status(200).json({
            message: "Coupon applied successfully",
            status: 200,
            success: true,
        });


    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
        });
    }
}

// Add transaction
exports.addTransaction = async (req, res) => {
    try {
        const transaction = Transaction({
            physioId: "67502b29d44e7a9d52def451",
            transactionId: "czjgcfajsd",
            amount: 0,
            physioTransactionType: 1,
            paymentMode: "online",
            paymentStatus: "paid",
        });

        await transaction.save();
        return res.status(201).json({
            message: "Transaction added successfully",
            status: 201,
            success: true,
            data: transaction
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

// Add plan upgrade
exports.addPlanUpgrade = async (req, res) => {
    try {

        const { physioId, planId, amount, wallet, isRazorPay } = req.body;

        if (!physioId || !planId || !amount) {
            return res.status(400).json({
                message: "Please provide all required fields",
                status: 400,
                success: false
            })
        }

        const physio = await Physio.findById(physioId);

        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false,
            });
        }

        const plan = await Plan.findById(planId);

        if (!plan) {
            return res.status(404).json({
                message: "Plan not found",
                status: 404,
                success: false,
            });
        }

        if (isRazorPay == "true") {
            const options = {
                amount: amount * 100, // amount in the smallest currency unit
                currency: "INR",
                receipt: "order_rcptid_11",
                payment_capture: '1',
                notes: {
                    physioId: physioId,
                    amount: amount,
                    planId: planId,
                    wallet: wallet
                }
            };

            const payment = await instance.orders.create(options);

            return res.status(201).json({
                message: "Order created successfully",
                status: 201,
                success: true,
                data: payment
            });



        } else {

            if (physio.wallet < amount) {
                return res.status(400).json({
                    message: "Insufficient wallet balance",
                    status: 400,
                    success: false
                })
            }

            // physio wallet amount -
            await Physio.findByIdAndUpdate(physioId, {
                $inc: {
                    wallet: -amount
                }
            }, { new: true });

            // subscription
            const subscription = Subscription({
                physioId: physioId,
                planId: planId,
                amount: amount,
                paymentStatus: 1,
                patientLimit: plan.patientLimit,
                expireAt: moment().add(plan.planMonth, 'months').toDate()
            });

            await subscription.save();

            // physio add subscriptionId
            await Physio.findByIdAndUpdate(physioId, {
                $set: {
                    subscriptionId: subscription._id,
                    subscriptionCount: physio.subscriptionCount + 1
                }
            })

            // transaction
            const transaction = Transaction({
                physioId: physioId,
                // transactionId: "czjgcfajsd",
                amount: amount,
                physioTransactionType: 1,
                paymentMode: "offline",
                paymentStatus: "paid",
            });

            await transaction.save();

            return res.status(201).json({
                message: "Plan upgraded successfully",
                status: 201,
                success: true,
                data: transaction
            });
        }

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

// verify transaction
exports.verifyPlanUpgrade = async (req, res) => {
    try {
        const {
            orderId
        } = req.body;

        if (!orderId) {
            return res.status(400).json({
                message: 'orderId is required',
                success: false,
                status: 400
            });
        }

        const payment = await instance.orders.fetch(orderId);
        if (payment.status == 'paid') {

            // physio wallet amount -
            await Physio.findByIdAndUpdate(payment.notes.physioId, {
                $inc: {
                    wallet: -payment.notes.wallet
                }
            }, { new: true });

            // subscription
            const subscription = Subscription({
                physioId: payment.notes.physioId,
                orderId: payment.id,
                planId: payment.notes.planId,
                amount: payment.notes.amount,
                paymentStatus: 1,
                patientLimit: payment.notes.plan.patientLimit,
            });

            await subscription.save();

            // physio add subscriptionId
            await Physio.findByIdAndUpdate(payment.notes.physioId, {
                $set: {
                    subscriptionId: subscription._id
                }
            }, { new: true });

            // transaction
            const transaction = Transaction({
                physioId: payment.notes.physioId,
                transactionId: payment.id,
                amount: payment.notes.amount,
                physioTransactionType: 1,
                paymentMode: "online",
                paymentStatus: "paid",
            });

            await transaction.save();

            return res.status(201).json({
                message: "Plan upgraded successfully",
                status: 201,
                success: true,
                data: transaction
            });


        } else {
            return res.status(400).json({
                message: "Plan upgrade failed",
                status: 400,
                success: false,
                data: payment
            });
        }


    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

exports.physioRevenue = async (req, res) => {
    try {
        const { physioId } = req.query;
        if (!physioId) {
            return res.status(400).json({
                data: req.query,
                dat: req.params,
                message: "Required physioId",
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false,
            });
        }

        const transactions = await Transaction.find({
            physioId: physioId,
            physioTransactionType: { $in: ["credit", "debit", "withdraw"] },
            paidFor: { $in: ['appointment', 'treatment'] },
        })

        const [totalAppointment, totalTreatment] = await Promise.all([
            Appointment.find({ physioId: physioId, appointmentStatus: 0 }).countDocuments(),
            Appointment.find({ physioId: physioId, appointmentStatus: 1 }).countDocuments()
        ])

        let consultationAmt = 0;
        let treatmentAmt = 0;
        let cashAmount = 0
        let cashPlatFormCharges = 0
        let onlineAmount = 0;
        let payToPhysioPlusTxnAmt = 0;
        transactions.map(txn => {


            if (txn.paidTo === "physioPlus" && txn.paidFor === "debt") {
                payToPhysioPlusTxnAmt += txn.amount
            }

            if (txn.paymentMode === 'online') {
                onlineAmount += txn.physioAmount
            }
            else if (txn.paymentMode === 'cash') {
                cashAmount += txn.physioAmount
                cashPlatFormCharges += txn.platformCharges + txn.gstAmount
            }
            if (txn.paidFor === "appointment") {
                consultationAmt += txn.physioAmount
            }
            else if (txn.paidFor === "treatment") {
                treatmentAmt += txn.physioAmount
            }
        })

        return res.status(200).json({
            message: "physio Revenue",
            status: 200,
            success: true,
            data: {
                totalRevenue: (consultationAmt + treatmentAmt),
                consultationAmt,
                treatmentAmt,
                cashPlatFormCharges: (cashPlatFormCharges - payToPhysioPlusTxnAmt),
                onlineAmount,
                cashAmount,
                totalAppointment,
                totalTreatment,
                physioWalletAmt: physio?.wallet

            },
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

// physio Add wallet amount
exports.addWalletAmount = async (req, res) => {
    try {
        const { physioId, amount } = req.body;
        console.log(req.body, "body");
        if (!physioId) {
            return res.status(400).json({
                message: "Required physioId",
                status: 400,
                success: false
            });
        }

        if (!amount) {
            return res.status(400).json({
                message: "Required amount",
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false,
            });
        }

        // check if amount is greater than 0
        if (amount <= 0) {
            return res.status(400).json({
                message: "Amount must be greater than 0",
                status: 400,
                success: false,
            });
        }

        // create options
        var options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: "order_rcptid_11",
            payment_capture: '1',
            notes: {
                physioId: physioId,
                amount: amount
            }
        };

        const payment = await instance.orders.create(options);

        return res.status(201).json({
            message: "Wallet amount added successfully",
            status: 201,
            success: true,
            data: payment
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}
// physio get wallet amount
exports.VerifyWalletAmount = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                message: 'orderId is required',
                success: false,
                status: 400
            });
        }

        const payment = await instance.orders.fetch(orderId);
        // console.log(payment, "orderId");
        if (payment.status === 'paid') {
            await Physio.findByIdAndUpdate(payment.notes.physioId, {
                $inc: {
                    wallet: payment.notes.amount
                }
            }, { new: true });

            await Transaction.create({
                physioId: payment.notes.physioId,
                amount: payment.notes.amount,
                physioTransactionType: "debit",
                transactionId: `PHONL_${generateRandomCode()}`,
                paymentMode: 'online',
                paymentStatus: 'paid',
                paidTo: "physioPlus",
                paidFor: "debt",
            });

            return res.status(201).json({
                message: "Wallet amount added successfully",
                status: 201,
                success: true,
                data: payment
            });
        }

        return res.status(400).json({
            message: "Wallet amount add failed",
            status: 400,
            success: false,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

exports.approvePhysio = async (req, res) => {
    try {
        const data = req.body;

        const physio = await Physio.findById(data.id)

        if (!physio.slug) {
            let Id = physio._id.toString().slice(-6);
            let name = physio.fullName;
            let slug = name + "-" + Id;
            // return console.log(slug);

            await Physio.findByIdAndUpdate(data.id, {
                slug: slug
            }, { new: true })
            console.log("physio", slug)

        }

        // console.log(physio, "data")

        await Physio.findByIdAndUpdate(data.id, {
            accountStatus: data.approved,
        });
        ({
            type: "form_status",
            data: {
                id: Physio.id,
                status: data.approved ? 0 : 1,
                time: Date.now(),
            },
        });

        return res.send({
            message: "User updated successfully",
            error: false
        });
    } catch (error) {
        console.log(error);
        return res
            .send({
                message: "Something went wrong",
                error: true
            });
    }
};

exports.getPhysioProfileEdit = async (req, res) => {
    try {
        const { physioId, status } = req.query;

        if (!physioId && !status) {
            return res.status(400).json({
                success: false,
                message: "Physio Id or Status is required",
            });
        }

        let filter = {};

        if (status) {
            filter.status = status;
        }

        if (physioId) {
            filter.physioId = physioId;
        }

        const physioProfileEdit = await PhysioProfileEdit.find(filter, 'updatedAt');

        return res.status(200).json({
            message: "Profile Get Success",
            success: true,
            data: physioProfileEdit,
        });

    } catch (error) {
        res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500,
            error: error.message
        });
    }
};


exports.physioProfileEdit = async (req, res) => {
    try {
        const physioId = req.body.physioId;
        if (!physioId) {
            return res.status(400).json({
                message: 'Physio id is required',
                success: false,
                status: 400
            });
        }

        const physio = await Physio.findById(physioId)
        if (!physio) {
            return res.status(404).json({
                message: 'No physio exists with this ID',
                status: 404,
                success: false,
            });
        }

        // Update physio profile
        const updatedPhysio = PhysioProfileEdit(
            {
                physioId: physio._id || null,
                profileImage: req.body.profileImage || null,
                fullName: req.body.fullName || null,
                dob: req.body.dob || null,
                email: req.body.email || null,
                gender: req.body.gender || null,
                about: req.body.about || null
            },
        );

        await updatedPhysio.save();

        await Physio.findByIdAndUpdate(physio._id, {
            $set: {
                edit: true
            }
        }, { new: true });

        // Send notification to admin
        let data = {
            physioId: physio._id.toString(),
            title: "Edit Request Profile",
            body: `Physio ${physio.fullName} has requested to edit their profile.`,
            type: 'editRequest',
            from: 'admin',
            to: 'admin',
            for: 'admin'
        }

        await sendFCMNotification("PlaceHolder", data, true);

        return res.status(200).json({
            message: 'PhysioProfile updated successfully',
            status: true,
            success: true,
            data: updatedPhysio
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


exports.addPhysioProfileProfessionDetailsEdit = async (req, res) => {
    try {
        const physio = await PhysioProfileEdit.findById(req.query.physioProfileId)
        if (!physio) {
            return res.status(404).json({
                message: 'No physio exists with this ID',
                status: 404,
                success: false,
            });
        }

        const updatedPhysio = await PhysioProfileEdit.findByIdAndUpdate(
            physio._id,
            {
                $set: {
                    bptDegree: {
                        degreeId: req.body.bptDegreeId ? req.body.bptDegreeId : null,
                        image: req.body.bptDegreeImage || null,
                    },
                    mptDegree: {
                        degreeId: req.body.mptDegreeId ? req.body.mptDegreeId : null,
                        image: req.body.mptDegreeImage || null,
                    },
                    // specialization: req.body.specializationId ? toArray(req.body.specializationId, true) : null,
                    // subspecializationId: req.body.subSpecializationId ? toArray(req.body.subSpecializationId, true) : null,


                    specialization: Array.isArray(req.body.specializationId) ? req.body.specializationId : req.body.specializationId && req.body.specializationId !== '[]' ? JSON.parse(req.body.specializationId) : null,
                    subspecializationId: Array.isArray(req.body.subSpecializationId) ? req.body.subSpecializationId : req.body.subSpecializationId && req.body.subSpecializationId !== '[]' ? JSON.parse(req.body.subSpecializationId) : null,


                    workExperience: parseNumber(req.body.workExperience),
                    iapMember: parseNumber(req.body.iapMember),
                    iapNumber: req.body.iapNumber ? req.body.iapNumber : null,
                    iapImage: req.body.iapImage || null,
                    serviceType: Array.isArray(req.body.serviceType) ? req.body.serviceType : req.body.serviceType && req.body.serviceType !== '[]' ? JSON.parse(req.body.serviceType) : null,
                    achievement: Array.isArray(req.body.achievements) ? req.body.achievements :
                        (req.body.achievements && req.body.achievements !== '[]') ? JSON.parse(req.body.achievements)
                            : physio.achievement,
                },
            },
            { new: true }
        )

        await Physio.findByIdAndUpdate(physio._id, {
            $set: {
                edit: true
            }
        }, { new: true });

        return res.status(200).json({
            message: 'Physio profile updated successfully',
            status: true,
            success: true,
            data: updatedPhysio
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Something went wrong, please try again later',
            status: 500,
            success: false,
            error: error.message,
        });

    }
};


exports.addPhysioProfileBusinessDetailsEdit = async (req, res, next) => {
    try {
        const physio = await PhysioProfileEdit.findById(req.query.physioProfileId)
        if (!physio) {
            return res.status(404).json({
                message: 'No physio exists with this IDddddd',
                status: 404,
                success: false,
            });
        }

        const updatedPhysio = await PhysioProfileEdit.findByIdAndUpdate(
            physio._id,
            {
                $set: {
                    country: req.body.clinicCountry?.toLowerCase() || null,
                    state: req.body.clinicState?.toLowerCase() || null,
                    city: req.body.clinicCity?.toLowerCase() || null,
                    latitude: req.body.latitude || null,
                    longitude: req.body.longitude || null,
                    'clinic.name': req.body.clinicName || null,
                    'clinic.address': req.body.clinicAddress || null,
                    'clinic.workingDays': req.body.clinicWorkingDays ? toArray(req.body.clinicWorkingDays) : null,
                    'clinic.timings.start': req.body.clinicStartTime || null,
                    'clinic.timings.end': req.body.clinicEndTime || null,
                    'clinic.duration': parseNumber(req.body.clinicDuration),
                    'clinic.charges': parseNumber(req.body.clinicCharges),
                    'clinic.zipCode': parseNumber(req.body.clinicZipCode),
                    'clinic.imagesClinic': req.body.clinicImages?.length > 0 ? req.body.clinicImages : null,
                    home: {
                        workingDays: req.body.homeWorkingDays ? toArray(req.body.homeWorkingDays) : null,
                        mode: req.body.homeMode ? toArray(req.body.homeMode) : null,
                        morningTimings: {
                            start: req.body.homeMorningStartTime || null,
                            end: req.body.homeMorningEndTime || null,
                        },
                        eveningTimings: {
                            start: req.body.homeEveningStartTime || null,
                            end: req.body.homeEveningEndTime || null,
                        },
                        duration: parseNumber(req.body.homeDuration),
                        charges: parseNumber(req.body.homeCharges),
                        zipCode: parseNumber(req.body.homeZipCode),
                        homeState: req.body.homeState || null,
                        homeCity: req.body.homeCity || null,
                    },
                },
            },
            { new: true }
        );

        await Physio.findByIdAndUpdate(physio._id, {
            $set: {
                edit: true
            }
        }, { new: true });

        return res.status(200).json({
            message: 'Physio business details updated successfully',
            status: true,
            success: true,
            data: updatedPhysio
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Something went wrong, please try again later',
            status: 500,
            success: false,
            error: error.message,
        });
    }
};


exports.deletePhysioEditRequest = async (req, res) => {
    const { id } = req.query
    const physioProfileEdit = await PhysioProfileEdit.findById(id)

    if (!physioProfileEdit) {
        return res.status(404).json({
            success: false,
            message: 'Physio profile edit not found',
        })
    }

    try {
        await PhysioProfileEdit.deleteOne({ _id: id })

        await Physio.findByIdAndUpdate(physioProfileEdit.physioId, {
            $set: {
                edit: false
            }
        }, { new: true })

        return res.status(200).json({
            success: true,
            message: 'Deleted physio profile edit',
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error deleting physio profile edit',
            error: error.message,
        })
    }
}


exports.recoverDeletedPhysio = async (req, res) => {

    try {
        const { phone, isWantToRecover } = req.body;

        if (!phone && !isWantToRecover) {

            return res.status(400).json({
                status: false,
                message: "please provide phone and isWantToRecover "
            });
        }

        const userData = await Physio.findOne({
            phone: `+91${phone}`,
        }).populate({
            path: "subscriptionId",
            populate: {
                path: "planId"
            }
        });

        if (!userData) {
            return res.status(400).json({
                status: false,
                message: "User with this Phone does not exist"
            });
        }


        if (userData.isDeleted === false) {
            return res.status(400).json({
                status: false,
                message: "This physio not soft Deleted please login normally"
            });
        }

        else if (isWantToRecover) {

            let freePlan = "Free Plan"

            const patientCount = userData.subscriptionId?.patientCount || 0;
            const planName = userData.subscriptionId?.planId?.name || "";

            if (patientCount >= 4 && planName.toLowerCase() === freePlan) {
                userData.accountStatus = 0;
            }

            userData.isDeleted = false;

            await userData.save();
            isDeltedPhysio = true

            return res.status(200).json({
                status: true,
                message: "This update Physio Status you can procced"
            });

        }

        else {

            return res.status(402).json({
                status: false,
                message: "no changes are apply"
            });

        }

    } catch (error) {

        res.status(400).json({
            status: false,
            message: "som",
            err: error
        });

    }


}

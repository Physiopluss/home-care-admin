const Physio = require('../../models/physio')
const Appointment = require('../../models/appointment')
const physioConnect = require('../../models/physioConnect')
const Review = require('../../models/review')
const Patient = require('../../models/patient')
const Transaction = require('../../models/transaction')
const RefundRequest = require('../../models/refundRequest')
const Coupon = require('../../models/coupon')
const Plan = require('../../models/plan')
const Invoice = require('../../models/invoice')
const jwt = require('jsonwebtoken');
const moment = require('moment');
const {
    msg91OTP
} = require('msg91-lib');
const crypto = require('crypto');
const Razorpay = require('razorpay');
var instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
const Blog = require('../../models/blog')
const mongoose = require('mongoose')
const multer = require("multer");
const path = require("path");
const root = process.cwd();
const fs = require("fs");
// const AWS = require('aws-sdk');
const { addTravelDistance, getCityFromCoordinates } = require('../../utility/locationUtils')
const { redisClient, CACHE_EXPIRATION } = require('../../utility/redisClient');


// Set The Storage Engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/blog');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename(req, file, cb) {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
});

// AWS S3 bucket configuration
// const s3 = new AWS.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });

// upload function
const upload = multer({
    storage: storage
}).fields([{
    name: 'profileImage',
    maxCount: 1
},
{
    name: 'degreeImage',
    maxCount: 5
},
{
    name: 'iapImage',
    maxCount: 1
},
{
    name: 'imagesClinic',
    maxCount: 10
},
{
    name: 'patientImage',
    maxCount: 10
}
]);

// Rendem code generator
function generateUnique6CharID() {
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
generateUnique6CharID()

// SMS OTP sender
const msg91otp = new msg91OTP({
    authKey: process.env.MSG91_AUTH_KEY,
    templateId: process.env.MSG91_TEMP_ID
});


// get physio by id
exports.getPhysioById = async (req, res) => {
    try {

        const { slug } = req.query
        if (!slug) {
            return res.status(400).json({
                message: "slug is required",
                status: 400,
                success: false
            });
        }

        // console.log(physioId, "physioId")

        const physio = await Physio.findOne({
            slug
            // isDeleted: false,
            // accountStatus: 1
        }).populate("specialization").populate("subspecializationId").populate("bptDegree.degreeId").populate("mptDegree.degreeId").populate({
            path: "subscriptionId",
            populate: {
                path: "planId"
            }
        });

        if (!physio) {
            return res.status(400).json({
                message: "Physio not found",
                status: 400,
                success: false
            });
        }

        return res.json({
            status: true,
            message: "data Returned",
            data: physio
        })
    } catch (error) {
        console.log(error)
        return res.json({
            status: false,
            message: "Error fetching physio",
            status: 500
        })
    }
}



// // Filter physio by specialization, Gender, charges, rating, experience
const filterByPhysio = async (req, res) => {
    try {
        const {
            specialization,  // Done
            gender,        // 0-mail 1-femail 2-other Done
            workExperience,  // Done
            rating,
            name,
            location,
            language,
            serviceType,
            subspecializationId
        } = req.query;

        // return console.log(req.query, "req.query")

        let query = {
            isDeleted: false,
            accountStatus: 1
        }

        // if name is provided
        if (name) {
            // search by fullName and clinic.name
            query.$or = [{
                fullName: {
                    $regex: name,
                    $options: 'i'
                }
            }, {
                "clinic.name": {
                    $regex: name,
                    $options: 'i'
                }
            }]
        }

        // if location is provided
        if (location) {
            // search by clinic.city, clinic.state, clinic.landmark and clinic.address
            query.$or = [
                {
                    "clinic.city": {
                        $regex: location,
                        $options: 'i'
                    }
                },
                {
                    "clinic.state": {
                        $regex: location,
                        $options: 'i'
                    }
                },
                {
                    "clinic.area": {
                        $regex: location,
                        $options: 'i'
                    }
                },
                {
                    "clinic.address": {
                        $regex: location,
                        $options: 'i'
                    }
                },
                // {
                //     "clinic.zipCode": {
                //         $regex: Number(location),
                //         $options: 'i'
                //     }
                // }
            ]
        }

        // if specialization is provided
        if (specialization) {
            // specialization multiple values
            query.specialization = {
                $in: specialization.split(",")
            }
        }

        // subspecializationId
        if (subspecializationId) {
            query.subspecializationId = {
                $eq: mongoose.Types.ObjectId(subspecializationId).split(",")
            }
        }

        // if Gender is provided
        if (gender) {
            // gender multiple values
            query.gender = {
                $in: Number(gender.split(","))
            }
        }

        // if experience is provided
        if (workExperience) {
            // workExperience multiple values (0-5, 5-10, 10 and above)
            const experienceValues = workExperience.split("-")
            console.log(experienceValues[0], "experienceValues")
            query.workExperience = {
                $gte: Number(experienceValues[0]),
                $lt: Number(experienceValues[1])
            }
        }

        // if rating is provided
        if (rating) {
            // Convert the rating query string to an array of numbers
            const ratingValues = rating.split(",").map(Number);

            // Build an array of conditions for each rating range
            const ratingConditions = ratingValues.map((r) => {
                return {
                    rating: {
                        $gte: r,
                        $lt: r + 0.9 // Ensures the range is [r, r.9)
                    }
                };
            });

            // Combine the conditions with an $or operator
            query.$or = ratingConditions;
        }

        // if language is provided
        if (language) {
            // language multiple values
            query.language = {
                $in: language.split(",")
            }
        }

        // if serviceType is provided
        if (serviceType) {
            // serviceType multiple values
            query.serviceType = {
                $in: serviceType.split(",")
            }
        }

        let Pages = req.query.page || 1;

        // console.log(query)

        const physios = await Physio.find(
            query,
            null,
            {
                skip: 10 * (Pages - 1),
                limit: 10
            }
        ).populate("specialization degree.degreeId")

        if (physios.length == 0) {
            return res.json({

                message: "No physio in This city",
                status: 401,

            })
        }

        const physioCount = await Physio.countDocuments()


        // console.log(physioCount, "physioCount")



        return res.json({
            message: "data Returned",
            status: 200,
            physioCount: physioCount,
            data: physios,
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Something went wrong Please try again",
            status: false,
            status: 500
        })
    }
}

// signup for physio
exports.signUpPhysioOtp = async (req, res) => {
    try {
        const otp = Math.floor(100000 + Math.random() * 900000);
        try {
            const {
                phone
            } = req.body;
            // console.log(phone, "phone")

            // let otp = generateRandomCode()
            // const patient =await Patient.findOne({phone : phone})

            physioConnect.findOne({
                phone: `+91${phone}`
            })
                .then(
                    async (userData) => {
                        // return console.log(userData)
                        const response = await msg91otp.send(`91${phone}`)
                        // res.json(response)

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
                )
        } catch (error) {
            res.status(400).json({
                status: false,
                message: "otp not sent"
            })
        }
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong Please try again",
            status: 500,
            success: false
        });
    }
}



exports.loginPhysioOtp = async (req, res) => {
    const {
        phone
    } = req.body;
    try {

        let user = await Physio.findOne({
            phone: `+91${phone}`
        })
        // return console.log(user)
        physioData = await physioConnect.findOne({
            phone: `+91${phone}`
        }).then(
            async (physioData) => {

                if (!physioData) {
                    res
                        .status(409) // 409 is for conflict
                        .json({
                            status: true,
                            message: "physio does'nt exists please register ",
                        });
                } else {
                    const response = await msg91otp.send(`91${phone}`)
                    // res.json(response)

                    if (response.type === "success") {
                        res
                            .status(200)
                            .json({
                                status: true,
                                message: "OTP sent successfully"
                            });
                    } else {
                        res.status(200).json({ status: true, message: "otp not sent" })
                    }
                }
            }
        );
    } catch (error) {
        res.status(400).json({
            status: false,
            message: "otp not sent"
        });
    }
};



// verify otp for physio

exports.verifyOtp = async (req, res) => {
    const { otp, phone, name, deviceId, latitude, longitude, location } = req.body;
    console.log("Received data:", { otp, phone, name, deviceId });

    const formattedPhone = `+91${phone}`;
    const msg91Phone = `91${phone}`;

    try {
        const physio = await physioConnect.findOne({ phone: formattedPhone });

        if (physio) {
            const response = await msg91otp.verify(msg91Phone, otp);
            if (response.type === "success") {
                const token = jwt.sign({ physio }, process.env.JWT_SECRET_KEY);
                return res.status(200).json({
                    status: true,
                    newUser: false,
                    token,
                    data: physio,
                    message: "OTP verified successfully",
                    success: true,
                    physio,
                    isNew: false,
                });
            } else {
                return res.status(400).json({ status: false, message: "Entered wrong OTP" });
            }
        } else {
            // New Physio: verify OTP first
            const response = await msg91otp.verify(msg91Phone, otp);
            if (response.type !== "success") {
                return res.status(400).json({
                    status: false,
                    message: "Invalid or expired OTP",
                });
            }

            // Generate unique preferId
            let preferId;
            let unique = false;
            while (!unique) {
                preferId = generateUnique6CharID();
                const existing = await physioConnect.findOne({ preferId });
                unique = !existing;
            }

            const newPhysio = new physioConnect({
                phone: formattedPhone,
                fullName: name,
                preferId,
                accountStatus: 0,
                deviceId,
                latitude: latitude || null,
                longitude: longitude || null,
                // location: location || {
                //     type: "Point",
                //     coordinates: [0, 0],
                // },
                isPhysioConnect: true,
                onboardedFrom: "web"
            });

            await newPhysio.save();

            return res.status(201).json({
                message: "OTP verified, new physio created",
                status: 201,
                success: true,
                physio: newPhysio,
                isNew: true,
            });
        }
    } catch (error) {
        console.error("Verify OTP error:", error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: false,
            success: false,
        });
    }
};


// exports.verifyOtp = async (req, res) => {
//     const { otp, phone, name, deviceId , latitude, longitude, location} = req.body;
//     console.log("Received data:", { otp, phone, name, deviceId, latitude, longitude, location });

//     const formattedPhone = `+91${phone}`;
//     const msg91Phone = `91${phone}`;

//     try {
//         console.log("Looking for physio with phone:", formattedPhone);
//         const physio = await Physio.findOne({ phone: formattedPhone });
//         console.log("Physio found:", physio);

//         if (physio) {
//             // Update deviceId for physio
//             await Physio.findByIdAndUpdate(physio._id, { deviceId }, { new: true });

//             // TEMPORARY DEV BYPASS OTP
//             if (otp === '1234') {
//                 jwt.sign({ physio: physio }, process.env.JWT_SECRET_KEY, (err, token) => {
//                     return res.status(200).json({
//                         status: true,
//                         newUser: false,
//                         message: "OTP verified successfully",
//                         token: token,
//                         data: physio
//                     });
//                 });
//             } else {
//                 const response = await msg91otp.verify(msg91Phone, otp);
//                 console.log("OTP verify response:", response);

//                 if (response.type === "success") {
//                     jwt.sign({ physio: physio }, process.env.JWT_SECRET_KEY, (err, token) => {
//                         return res.status(200).json({
//                             status: true,
//                             newUser: false,
//                             token: token,
//                             data: physio,
//                             message: "OTP verified successfully",
//                             success: true,
//                             physio: physio,
//                             isNew: false,
//                         });
//                     });
//                 } else {
//                     return res.status(400).json({ status: false, message: "Entered wrong OTP" });
//                 }
//             }
//         } else {
//             console.log("Physio not found, creating new physio...");

//             // Verify OTP with msg91 for new user
//             const response = await msg91otp.verify(msg91Phone, otp);
//             console.log("msg91 response:", response);

//             if (response.type !== "success") {
//                 return res.status(400).json({
//                     status: false,
//                     message: "Invalid or expired OTP"
//                 });
//             }

//             // Generate unique preferId for new physio
//             let preferId;
//             let unique = false;
//             while (!unique) {
//                 preferId = generateUnique6CharID();
//                 const existing = await Physio.findOne({ preferId });
//                 unique = !existing;
//             }
//             console.log("Generated unique preferId:", preferId);

//             const newPhysio = new Physio({
//                 phone: formattedPhone,
//                 fullName: name,
//                 preferId,
//                 accountStatus: 0,

//             });

//             await newPhysio.save();
//             console.log("New physio created:", newPhysio);

//             return res.status(201).json({
//                 message: "OTP verified, new physio created",
//                 status: 201,
//                 success: true,
//                 physio: newPhysio,
//                 isNew: true
//             });
//         }
//     } catch (error) {
//         console.error("Verify OTP error:", error);
//         return res.status(500).json({
//             message: "Something went wrong. Please try again.",
//             status: false,
//             success: false
//         });
//     }
// };

// exports.verifyOtp = async (req, res) => {
//     const { otp, phone, name } = req.body;
//     const formattedPhone = `+91${phone}`;
//     const msg91Phone = `91${phone}`;

//     try {
//     console.log("Looking for physio with phone:", formattedPhone);
//     const physio = await Physio.findOne({ phone: formattedPhone });
//     console.log("Physio found:", physio);

//     // TEMPORARY DEV BYPASS
//     if (otp === '1234') {
//         console.log("DEV bypass OTP used");
//         return res.status(200).json({
//             message: "OTP bypassed successfully (DEV ONLY)",
//             status: 200,
//             success: true,
//             physio: physio || null,
//             isNew: !physio
//         });
//     }

//     console.log("Verifying OTP via msg91otp");
//     const response = await msg91otp.verify(msg91Phone, otp);
//     console.log("msg91 response:", response);

//     if (response.type !== "success") {
//         return res.status(400).json({
//             status: false,
//             message: "Invalid or expired OTP"
//         });
//     }

//     if (physio) {
//         let updatedPhysio = physio;
//         if (name) {
//             console.log("Updating physio name to:", name);
//             updatedPhysio = await Physio.findByIdAndUpdate(
//                 physio._id,
//                 { $set: { fullName: name } },
//                 { new: true }
//             );
//         }

//         return res.status(200).json({
//             message: "OTP verified successfully",
//             status: 200,
//             success: true,
//             physio: updatedPhysio,
//             isNew: false
//         });
//     } else {
//         console.log("Creating new physio");
//         let preferId;
//         let unique = false;
//         while (!unique) {
//             preferId = generateUnique6CharID();
//             const existing = await Physio.findOne({ preferId });
//             unique = !existing;
//         }
//         console.log("Generated unique preferId:", preferId);

//         const newPhysio = new Physio({
//             phone: formattedPhone,
//             fullName: name,
//             preferId,
//             accountStatus: 0
//         });

//         await newPhysio.save();


//         if (redisClient && Cha && Cha.AdminAllPhysioCacheKey) {
//             redisClient.del(Cha.AdminAllPhysioCacheKey, (err) => {
//                 if (err) console.log("Redis cache deletion failed:", err);
//                 else console.log("Admin Physio cache cleared.");
//             });
//         } else {
//             console.log("redisClient or cache key missing, skipping redis delete");
//         }

//         return res.status(201).json({
//             message: "OTP verified, new physio created",
//             status: 201,
//             success: true,
//             physio: newPhysio,
//             isNew: true
//         });
//     }

// } catch (error) {
//     console.error("Verify OTP error:", error);
//     return res.status(500).json({
//         message: "Something went wrong. Please try again.",
//         status: false,
//         success: false
//     });
// }
// };



// singup for physio
exports.signUpPhysio = async (req, res) => {
    try {

        const {
            physioId
        } = req.query;

        // console.log(physioId, "physioId")

        if (!physioId) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await physioConnect.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "No physio exists with this Id",
                status: 400,
                success: false
            });
        }


        return res.status(200).json({
            message: "Physio Details",
            status: 200,
            success: true,
            data: physio
        });

    } catch (error) {
        console.log(error)
        return res.json({
            message: "Something went wrong Please try again",
            status: false,
            status: 500
        })
    }
};

// exports.addProfileDetails = async (req, res) => {
//     try {
//         upload(req, res, async (err) => {
//             if (err) {
//                 return res.status(500).json({
//                     message: 'Something went wrong during file upload',
//                     status: 500,
//                     success: false,
//                 });

//             }
//             // console.log(req.body, "req.body")
//             // return console.log(req.files, "files");

//             const physio = await Physio.findById(req.body.physioId);
//             if (!physio) {
//                 return res.status(400).json({
//                     message: "No physio exists with this Id",
//                     status: 400,
//                     success: false,
//                 });
//             }

//             if (req.body.degree) {
//                 const checkDegree = await Degree.findById(req.body.degree);
//                 if (!checkDegree) {
//                     return res.status(400).json({
//                         message: "Degree not found",
//                         status: 400,
//                         success: false,
//                     });
//                 }
//             }

//             if (req.body.specialization) {
//                 const checkSpecialization = await Specialization.findById(req.body.specialization);
//                 if (!checkSpecialization) {
//                     return res.status(400).json({
//                         message: "Specialization not found",
//                         status: 400,
//                         success: false,
//                     });
//                 }
//             }

//             let profileImagePromise = Promise.resolve(null);
//             let degreeImagePromises = [];
//             let iapImagePromise = Promise.resolve(null);
//             let clinicImagesPromises = [];
//             let patientImagesPromises = [];

//             // Handle profile image upload
//             if (req.files && req.files['profileImage'] && req.files['profileImage'][0]) {
//                 const profileImage = req.files['profileImage'][0];
//                 const profileImageKey = `Physio/${profileImage.filename}`;
//                 const params = {
//                     Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                     Key: profileImageKey,
//                     Body: fs.createReadStream(profileImage.path),
//                 };
//                 profileImagePromise = new Promise((resolve, reject) => {
//                     s3.upload(params, (err, data) => {
//                         if (err) {
//                             return reject(err);
//                         }
//                         if (physio.profileImage) {
//                             const deleteParams = {
//                                 Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                                 Key: `Physio/${physio.profileImage}`,
//                             };
//                             s3.deleteObject(deleteParams, (err) => {
//                                 if (err) {
//                                     console.error('Error deleting old profile image:', err);
//                                 }
//                             });
//                         }
//                         resolve(data.Location);
//                     });
//                 });
//             }

//             // Handle degree image upload
//             if (req.files && req.files['degreeImage']) {
//                 const degreeImages = req.files['degreeImage']; // Get all uploaded degree images

//                 degreeImagePromises = degreeImages.map((degreeImage) => {
//                     const degreeImageKey = `Physio/${degreeImage.filename}`;
//                     const params = {
//                         Bucket: process.env.AWS_BUCKET_NAME, // Correct bucket name (no need to add 'Physio' here again)
//                         Key: degreeImageKey,
//                         Body: fs.createReadStream(degreeImage.path),
//                     };

//                     return new Promise((resolve, reject) => {
//                         s3.upload(params, (err, data) => {
//                             if (err) {
//                                 return reject(err);
//                             }

//                             // If an old degree image exists in the `physio` object, delete it
//                             if (physio.degreeImage) {
//                                 const deleteParams = {
//                                     Bucket: process.env.AWS_BUCKET_NAME,
//                                     Key: `Physio/${physio.degreeImage}`,
//                                 };
//                                 s3.deleteObject(deleteParams, (deleteErr) => {
//                                     if (deleteErr) {
//                                         console.error('Error deleting old degree image:', deleteErr);
//                                     }
//                                 });
//                             }

//                             resolve(data.Location);
//                         });
//                     });
//                 });
//             }

//             // Handle IAP image upload
//             if (req.files && req.files['iapImage'] && req.files['iapImage'][0]) {
//                 const iapImage = req.files['iapImage'][0];
//                 const iapImageKey = `Physio/${iapImage.filename}`;
//                 const params = {
//                     Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                     Key: iapImageKey,
//                     Body: fs.createReadStream(iapImage.path),
//                 };
//                 iapImagePromise = new Promise((resolve, reject) => {
//                     s3.upload(params, (err, data) => {
//                         if (err) {
//                             return reject(err);
//                         }
//                         if (physio.iapImage) {
//                             const deleteParams = {
//                                 Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                                 Key: `Physio/${physio.iapImage}`,
//                             };
//                             s3.deleteObject(deleteParams, (err) => {
//                                 if (err) {
//                                     console.error('Error deleting old IAP image:', err);
//                                 }
//                             });
//                         }
//                         resolve(data.Location);
//                     });
//                 });
//             }

//             // Handle clinic images upload
//             if (req.files && req.files['imagesClinic']) {
//                 const clinicImages = req.files['imagesClinic'];
//                 clinicImagesPromises = clinicImages.map((image) => {
//                     const clinicImageKey = `Physio/${image.filename}`;
//                     const params = {
//                         Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                         Key: clinicImageKey,
//                         Body: fs.createReadStream(image.path),
//                     };
//                     return new Promise((resolve, reject) => {
//                         s3.upload(params, (err, data) => {
//                             if (err) {
//                                 return reject(err);
//                             }
//                             resolve(data.Location);
//                         });
//                     });
//                 });
//             }

//             // Handle patient images upload
//             if (req.files && req.files['patientImage']) {
//                 const patientImages = req.files['patientImage'];
//                 patientImagesPromises = patientImages.map((image) => {
//                     const patientImageKey = `Physio/${image.filename}`;
//                     const params = {
//                         Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                         Key: patientImageKey,
//                         Body: fs.createReadStream(image.path),
//                     };
//                     return new Promise((resolve, reject) => {
//                         s3.upload(params, (err, data) => {
//                             if (err) {
//                                 return reject(err);
//                             }
//                             // return console.log(data.Location, "data.Location");

//                             resolve(data.Location);
//                         });
//                     });
//                 });
//             }

//             // Wait for all uploads to complete
//             Promise.all([profileImagePromise, ...degreeImagePromises, iapImagePromise, ...clinicImagesPromises, ...patientImagesPromises])
//                 .then(async (urls) => {
//                     const profileImageUrl = urls[0];
//                     const degreeImageUrls = urls.slice(1, 1 + degreeImagePromises.length);
//                     const iapImageUrl = urls[1 + degreeImagePromises.length];
//                     const clinicImageUrls = urls.slice(2 + degreeImagePromises.length, 2 + degreeImagePromises.length + clinicImagesPromises.length);
//                     const patientImageUrls = urls.slice(2 + degreeImagePromises.length + clinicImagesPromises.length);

//                     // return console.log(patientImageUrls, "patientImageUrls");
//                     // Update physio profile with the new data
//                     await Physio.findByIdAndUpdate(
//                         physio._id, {
//                         $set: {
//                             profileImage: profileImageUrl || physio.profileImage,
//                             degree: {
//                                 degreeId: req.body.degree || physio.degree.degreeId,
//                                 degreeImage: degreeImageUrls.length > 0 ? degreeImageUrls : physio.degree.degreeImage,
//                             },
//                             specialization: req.body.specialization || physio.specialization,
//                             workExperience: req.body.workExperience || physio.workExperience,
//                             iapMember: req.body.iapMember || physio.iapMember,
//                             iapNumber: req.body.iapNumber || physio.iapNumber,
//                             iapImage: iapImageUrl || physio.iapImage,
//                             serviceType: req.body.serviceType ? req.body.serviceType : physio.serviceType,
//                             clinic: {
//                                 status: 0,
//                                 name: req.body.clinicName || physio.clinic.name,
//                                 address: req.body.clinicAddress || physio.clinic.address,
//                                 charges: req.body.clinicCharges || physio.clinic.charges,
//                                 imagesClinic: clinicImageUrls.length > 0 ? clinicImageUrls : physio.clinic.imagesClinic,
//                                 zipCode: req.body.ClinicZipCode || physio.clinic.zipCode,
//                                 city: req.body.ClinicCity || physio.clinic.city,
//                                 state: req.body.ClinicState || physio.clinic.state,
//                                 consultationCharges: req.body.consultationCharges || physio.clinic.consultationCharges,
//                             },
//                             home: {
//                                 consultationChargesUp5Km: req.body.consultationChargesUp5Km || physio.home.consultationChargesUp5Km,
//                                 consultationChargesUp10Km: req.body.consultationChargesUp10Km || physio.home.consultationChargesUp10Km,
//                                 otherTreatmentName: req.body.otherTreatmentName || physio.home.otherTreatmentName,
//                                 otherTreatmentCharges: req.body.otherTreatmentCharges || physio.home.otherTreatmentCharges,
//                             },

//                             latitude: req.body.latitude || physio.latitude,
//                             longitude: req.body.longitude || physio.longitude,
//                             patientImage: patientImageUrls.length > 0 ? patientImageUrls : physio.patientImage,
//                             achievement: req.body.achievement || physio.achievement,
//                             linkedinUrl: req.body.linkedinUrl || physio.linkedinUrl,
//                             treatInsuranceclaims: req.body.treatInsuranceclaims || physio.treatInsuranceclaims,
//                             accountStatus: 0,
//                         },
//                     }, {
//                         new: true
//                     }
//                     );

//                     return res.status(200).json({
//                         message: "Profile updated successfully",
//                         status: true,
//                         success: true,
//                     });
//                 })
//                 .catch((error) => {
//                     console.error('Error updating profile:', error);
//                     return res.status(500).json({
//                         message: "Something went wrong, please try again later",
//                         status: 500,
//                         success: false,
//                     });
//                 });
//         });
//     } catch (error) {
//         console.error('Update profile error:', error);
//         return res.status(500).json({
//             message: "Something went wrong, please try again later",
//             status: 500,
//             success: false,
//         });
//     }
// };


exports.getProfessionalDetails = async (req, res) => {
    try {
        const {
            specializationId,
            physioId,
            serviceType,
            degreeId,
            clinicName,
            address,
            zipCode,
            city,
            state,
            charges,
            consultationCharges,
            consultationChargesUp5Km,
            consultationChargesUp10Km,
            otherTreatmentName,
            otherTreatmentCharges,
            homeZipCode
        } = req.body;

        console.log(req.body, "ProfessionalDetails");


        // Validate physioId
        if (!physioId || !mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: "Valid PhysioId is required",
                status: 400,
                success: false
            });
        }

        // Fetch the physio by id
        const physio = await physioConnect.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });

        }

        // Update the professional details
        const updatedPhysio = await physioConnect.findByIdAndUpdate(
            physioId,
            {
                $set: {
                    // Updating specialization
                    specialization: specializationId || physio.specialization || "",
                    // Updating degrees
                    "degree.degreeId": degreeId || physio.degree.degreeId || "",
                    // Updating clinic details
                    clinic: {
                        name: clinicName || physio.clinic.name || "",
                        address: address || physio.clinic.address || "",
                        zipCode: zipCode || physio.clinic.zipCode || "",
                        city: city || physio.clinic.city || "",
                        state: state || physio.clinic.state || "",
                        charges: charges || physio.clinic.charges || "",
                        consultationCharges: consultationCharges || physio.clinic.consultationCharges || "",
                        consultationChargesUp5Km: consultationChargesUp5Km || physio.clinic.consultationChargesUp5Km || "",
                        consultationChargesUp10Km: consultationChargesUp10Km || physio.clinic.consultationChargesUp10Km || "",
                    },
                    // Updating home treatment details
                    home: {
                        consultationChargesUp5Km: consultationChargesUp5Km || physio.home.consultationChargesUp5Km || "",
                        consultationChargesUp10Km: consultationChargesUp10Km || physio.home.consultationChargesUp10Km || "",
                        otherTreatmentName: otherTreatmentName || physio.home.otherTreatmentName || "",

                        otherTreatmentCharges: otherTreatmentCharges || physio.home.otherTreatmentCharges || "",
                        zipCode: homeZipCode || physio.home.zipCode || "",

                    },
                    // Updating service type
                    serviceType: serviceType || physio.serviceType || ""
                }
            },
            { new: true } // Return updated physio details
        );


        // Send success response
        return res.status(200).json({
            message: "Professional details updated successfully",
            status: 200,
            success: true,
            data: updatedPhysio
        });

    } catch (error) {
        console.error("Error updating professional details:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};



// Work Experiences 
exports.getWorkExperiences = async (req, res) => {
    try {
        const {
            physioId,
            workExperience
        } = req.body;

        console.log(req.body, "WorkExperiences");


        if (!physioId) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        if (!physioId || !mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: "Valid PhysioId is required",
                status: 400,
                success: false
            });
        }

        if (!workExperience) {
            return res.status(400).json({
                message: "Work experience is required",
                status: 400,
                success: false
            });

        }


        // Fetch the physio by id
        const physio = await physioConnect.findOne({ _id: physioId });
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false,
            });
        }
        // console.log(req.body.treatInsuranceclaims, "physio");

        await physioConnect.findByIdAndUpdate(physioId, {
            $set: {
                "workExperience": workExperience || physio.workExperience || "",
                "iapMember": req.body.iapMember ? req.body.iapMember : 0,
                "iapNumber": req.body.iapNumber ? req.body.iapNumber : "",
                "treatInsuranceclaims": req.body.treatInsuranceclaims ? 0 : 1
            }
        }, { new: true });

        // console.log(physio, "physio");  



        return res.status(200).json({
            message: "Work experience updated successfully",
            status: 200,
            success: true,
            Physio
        });

    } catch (error) {
        console.error("Error updating professional details:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};


exports.filterByPhysio = async (req, res) => {
    try {
        const {
            longitude,
            latitude,
            specialization,
            gender,
            workExperience,
            rating,
            name,
            location,
            language,
            serviceType,
            subspecializationId,
            state,
            city,
            page = 1 // Default to page 1
        } = req.query;

        const limit = 10; // Number of results per page

        const params = {
            name: name ? name.toLowerCase().trim() : undefined,
            location: location ? location.toLowerCase().trim() : undefined,
            longitude,
            latitude,
            specialization,
            gender,
            workExperience,
            rating,
            language,
            serviceType,
            subspecializationId,
            state,
            city
        };

        // Remove undefined or null values
        const filteredParams = Object.fromEntries(
            Object.entries(params).filter(([_, value]) => value !== undefined && value !== null && value !== '')
        );

        const hash = crypto.createHash('sha256').update(JSON.stringify(filteredParams)).digest('hex');
        const cacheKey = `website:filterByPhysio:${hash}`;

        // Check if data exists in Redis
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            console.log("> Returning cached data");

            const parsedData = JSON.parse(cachedData);
            const startIndex = (page - 1) * limit;
            const paginatedData = parsedData.slice(startIndex, startIndex + limit);

            return res.json({
                message: "Data returned successfully (from cache)",
                status: 200,
                physioCount: parsedData.length,
                totalPages: Math.ceil(parsedData.length / limit),
                currentPage: page,
                data: paginatedData
            });
        }

        let query = { accountStatus: 1, isBlocked: false }; // Base query

        // Apply filters
        if (name) {
            query.fullName = { $regex: name, $options: 'i' };
        }

        if (location) {
            const zipCode = parseInt(location);
            query.$or = [
                { city: { $regex: location, $options: 'i' } },
                { state: { $regex: location, $options: 'i' } },
                ...(isNaN(zipCode) ? [] : [{ "clinic.zipCode": zipCode }]),
                ...(isNaN(zipCode) ? [] : [{ "home.zipCode": zipCode }]),
            ];
        }

        if (specialization) {
            query.specialization = { $in: specialization.split(",") };
        }

        if (subspecializationId) {
            query.subspecializationId = { $in: subspecializationId.split(",") };
        }

        if (gender) {
            query.gender = parseInt(gender);
        }

        if (workExperience) {
            const [minExp, maxExp] = workExperience.split("-").map(Number);
            query.workExperience = { $gte: minExp, $lte: maxExp };
        }

        if (rating) {
            const ratingValue = parseInt(rating, 10);
            query.$expr = { $eq: [{ $floor: "$rating" }, ratingValue] };
        }

        if (language) {
            query.language = { $in: language.split(",") };
        }

        if (serviceType) {
            query.serviceType = { $in: serviceType.split(",") };
        }

        if (state) {
            query.state = { state: { $regex: new RegExp(state, "i") } }
        }

        if (city) {
            query.city = { city: { $regex: new RegExp(city, "i") } }
        }

        // Fetch all matching physiotherapists
        const physios = await Physio.find(query).populate("specialization").populate({
            path: "subscriptionId",
            populate: {
                path: "planId"
            }
        });
        if (!physios.length) {
            return res.status(404).json({
                status: false,
                message: "No Physio Found"
            });
        }

        // Randomize physio list to prevent predictable ordering when location-based sorting is not applied
        physios.sort(() => Math.random() - 0.5);

        let sortedPhysios = null
        if (latitude == null || longitude == null) {
            sortedPhysios = physios
        } else {
            sortedPhysios = await addTravelDistance(physios, latitude, longitude, sorted = true);
        }

        await redisClient.set(cacheKey, JSON.stringify(sortedPhysios), { EX: CACHE_EXPIRATION.TWO_MINUTES });

        const paginatedPhysios = sortedPhysios.slice((page - 1) * limit, page * limit);

        const responseData = {
            message: "Data returned successfully",
            status: 200,
            physioCount: sortedPhysios.length,
            totalPages: Math.ceil(sortedPhysios.length / limit),
            currentPage: page,
            data: paginatedPhysios
        };

        return res.json(responseData);
    } catch (error) {
        console.error("Error in filterByPhysio:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again",
            status: false,
            error: error.message
        });
    }
};


exports.razorpayPayment = async (req, res) => {
    try {
        let { physioId, amount, couponId } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        if (!amount) {
            return res.status(400).json({
                message: "Amount is required",
                status: 400,
                success: false
            });
        }

        // if check physioId valid objectid
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: "Invalid physioId",
                status: 400,
                success: false
            });
        }

        amount = Math.round(amount)
        const physio = await physioConnect.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "Physio not found",
                status: 400,
                success: false
            });
        }

        var options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: "order_rcptid_11",
            payment_capture: '1',
            notes: {
                physioId: physioId,
                couponId: couponId
            }
        };

        const myPayment = await instance.orders.create(options);

        const uniqueId = physio._id.toString();
        const nameSlug = physio.fullName.toLowerCase();
        let slug = `${nameSlug}-${uniqueId}`;

        const existingPhysio = await Physio.findOne({ slug });

        if (existingPhysio) {
            slug = existingPhysio.slug
            console.log('slug is already present' + slug);
        }

        physio.slug = slug
        await physio.save()

        return res.json({
            message: "Data returned successfully",
            status: 200,
            data: myPayment
        });
    } catch (error) {
        console.log(error);
        return res.json({
            message: "Something went wrong, please try again",
            status: false,
            status: 500
        });
    }
};


exports.razorpayPaymentVerification = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                message: 'orderId is required',
                success: false,
                status: 400
            });
        }

        const myPayment = await instance.orders.fetch(orderId);

        if (myPayment.status === 'paid') {
            const physio = await physioConnect.findById(myPayment.notes.physioId);

            if (!physio) {
                return res.status(400).json({
                    message: 'Physio not found',
                    success: false,
                    status: 400
                });
            }

            await physioConnect.findByIdAndUpdate(myPayment.notes.physioId, {
                $set: {
                    isPhysioConnectPaid: true,
                    isPhysioConnectPaidDate: new Date(),
                    isPhysioConnectPayment: myPayment.amount / 100,
                    isPhysioConnectCoupon: myPayment.notes.couponId
                }
            });

            // Get Physio Connect Pro Plan
            const plan = await Plan.findOne({ planType: 3 });

            // Get Coupon
            const coupon = await Coupon.findById(myPayment.notes.couponId);

            // Create Transaction
            const transaction = await Transaction.create({
                orderId: myPayment.id,
                physioId: physio._id,
                transactionId: `PHONL_${generateRandomCode()}`,
                amount: myPayment.amount / 100,
                couponId: coupon?._id,
                physioTransactionType: "debit",
                paymentStatus: "paid",
                paymentMode: "online",
                paidTo: "physioPlus",
                paidFor: "subscription"
            });

            // Create Invoice
            await Invoice.create({
                type: "subscription",
                paymentMode: "online",
                physioId: physio._id,
                transactionId: transaction._id,
                subscriptionId: null,            // Will be provided from admin
                planType: plan?.planType,
                amount: myPayment.amount / 100,
                couponDiscount: coupon?.couponDiscount,
                couponName: coupon?.couponName,
            });

            return res.json({
                message: 'Payment successful',
                status: 200,
                success: true
            });
        } else {
            return res.json({
                message: 'Payment failed',
                status: 400,
                success: false,
                data: myPayment
            });
        }
    } catch (error) {
        if (error.statusCode === 400 && error.error.code === 'BAD_REQUEST_ERROR') {
            console.error("Error: Invalid order ID");
            return res.status(400).json({
                message: "The provided orderId does not exist. Please verify the ID.",
                success: false,
                status: 400
            });
        }

        console.error("Unexpected error:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again",
            success: false,
            status: 500
        });
    }
};


// physio payment free
exports.physioPaymentFree = async (req, res) => {
    try {
        const {
            physioId,
            experiencePriceId,
        } = req.body;
        if (!physioId) {
            return res.status(400).json({
                message: 'physioId is required',
                success: false,
                status: 400
            });
        }

        // console.log("experiencePriceId", req.body)

        if (!experiencePriceId) {
            return res.status(400).json({
                message: 'experiencePriceId is required',
                success: false,
                status: 400
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: 'Physio not found',
                success: false,
                status: 400
            });
        }

        let myPayment = await Physio.findByIdAndUpdate(physioId, {
            $push: {
                listingCharges: {
                    amount: 0,
                    paymentStatus: 2,
                    experiencePriceId: experiencePriceId,
                    paymentType: 2,
                    paymentDate: new Date(),
                }
            }
        }, {
            new: true
        });

        return res.json({
            message: 'Payment successful',
            status: 200,
            success: true,
            data: myPayment
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong, please try again",
            status: false,
            status: 500
        });
    }
}




exports.getPhysio = async (req, res) => {
    try {
        // console.log("hello", req.query.Id)
        const physio = await Physio.find({
            accountStatus: 1,
            isBlocked: false,
            specialization: {
                $in: req.query.specialization
            }
        })
        return res.json({
            status: true,
            message: "data Returned",
            data: physio
        })
    } catch (error) {
        return res.json({
            status: false,
            message: "Error fetching physio",
            status: 500
        })
    }
}


const patient = require('../../models/patient');
const generateRandomCode = require('../../utility/generateRandomCode')
const { sendFCMNotification } = require('../../services/fcmService')
const { createAppointmentInvoice } = require('../app/appointmentController')
// const Blog = require('../models/blog'); // Adjust the path to your Blog model

// Export Blogs Controller
exports.exportBlogs = async (req, res) => {
    try {
        // Fetch all blogs from the database
        const blogs = await Blog.find();

        // Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Blogs');

        // Add headers to the worksheet
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 20 },
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Description', key: 'description', width: 50 },
            { header: 'YouTube Link', key: 'youTubeLink', width: 30 },
            { header: 'Image', key: 'image', width: 30 },
            { header: 'Tags', key: 'tags', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Blog Type', key: 'blogType', width: 20 },
            { header: 'Views', key: 'views', width: 10 },
            { header: 'Date', key: 'date', width: 25 },
            { header: 'Created At', key: 'createdAt', width: 25 },
            { header: 'Updated At', key: 'updatedAt', width: 25 },
        ];

        // Add rows to the worksheet
        blogs.forEach(blog => {
            worksheet.addRow({
                id: blog._id,
                title: blog.title,
                description: blog.description,
                youTubeLink: blog.youTubeLink,
                image: blog.image,
                tags: blog.tags.join(', '),
                status: blog.status === 0 ? 'Active' : 'Disabled',
                blogType: blog.blogType.map(type => (type === 0 ? 'WEB' : type === 1 ? 'Patient' : 'Physio')).join(', '),
                views: blog.views,
                date: blog.date,
                createdAt: blog.createdAt,
                updatedAt: blog.updatedAt,
            });
        });

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=blogs.xlsx');

        // Write the workbook to the response
        await workbook.xlsx.write(res);

        // End the response
        res.end();
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || 'An error occurred while exporting blogs.'
        });
    }
};


// Import Blogs Controller
exports.importBlogs = async (req, res) => {
    try {
        // Use multer to handle the uploaded file
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: err.message || 'Error uploading file.'
                });
            }


            // Get the uploaded file path
            const filePath = path.join(root, "controllers/uploads/blog/1734764252489.xlsx");

            // Read the Excel file
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.getWorksheet(1); // Get the first worksheet

            // Extract data from rows
            const blogs = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) {
                    // Skip the header row
                    return;
                }

                const blog = {
                    title: row.getCell(2).value,
                    description: row.getCell(3).value,
                    youTubeLink: row.getCell(4).value,
                    image: row.getCell(5).value,
                    tags: row.getCell(6).value ? row.getCell(6).value.split(',') : [],
                    status: row.getCell(7).value === 'Active' ? 0 : 1,
                    blogType: row.getCell(8).value
                        ? row.getCell(8).value.split(',').map(type => (type.trim() === 'WEB' ? 0 : type.trim() === 'Patient' ? 1 : 2))
                        : [],
                    views: parseInt(row.getCell(9).value, 10) || 0,
                    date: row.getCell(10).value || new Date().toISOString(),
                };
                blogs.push(blog);
            });

            // Insert blogs into the database
            await Blog.insertMany(blogs);

            // Respond to the client
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Blogs imported successfully.',
                data: blogs
            });
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || 'An error occurred while importing blogs.'
        });
    }
};

exports.getPhysioReviews = async (req, res) => {
    const physioId = req.query.physioId;
    const thePhysio = await Physio.findById(physioId);
    if (!thePhysio) {
        res
            .status(400)
            .json({
                status: false,
                message: "no physio exists with this id"
            });
    } else {
        const theReview = await Review.find({
            physioId: physioId
        }).populate('patientId');
        res
            .status(200)
            .json({
                status: true,
                message: "data Returned",
                data: theReview
            });
    }
};

// Create Physio Personal Details
// https://api.physioplushealthcare.com/api/web/physio/signUpPhysioOtp
exports.createPhysioPersonalDetails = async (req, res) => {
    try {
        const {
            physioId,
            fullName,
            email,
            gender,
            dob,
            phone,
            about
        } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        if (!physioId || !mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: "Valid PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await physioConnect.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false,
            });
        }


        const UpdatedPhysio = await physioConnect.findByIdAndUpdate(physioId, {
            $set: {
                "fullName": fullName || null,
                "email": email || null,
                "gender": gender || null,
                "dob": dob || null,
                "about": about || null,
                "isPhysioConnect": true,
                "onboardedFrom": "web"
            }

        }, { new: true });

        return res.status(200).json({
            message: "Personal details updated successfully",
            status: 200,
            success: true,
            physio: UpdatedPhysio
        });

    } catch (error) {
        console.error("Error updating personal details:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message
        });
    }
}

// Create Physio Professional Details
// https://api.physioplushealthcare.com/api/web/physio/createPhysioProfessionalDetails
exports.createPhysioProfessionalDetails = async (req, res) => {
    try {
        const {
            physioId,
            specialization,
            experience,
            iapMember,
            iapNumber,
            bptDegree,
            mptDegree,
            serviceType
        } = req.body;
        console.log(req.body, "ProfessionalDetails");

        if (!physioId) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        if (!physioId || !mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: "Valid PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await physioConnect.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });
        }

        const UpdatedPhysio = await physioConnect.findByIdAndUpdate(
            physioId,
            {
                $set: {
                    specialization: specialization ?? null,
                    workExperience: experience ?? null,
                    serviceType: serviceType ?? null,
                    iapMember: iapMember ?? 0,          // 0 => no, 1 => yes
                    iapNumber: iapNumber ?? null,
                    "bptDegree.degreeId": bptDegree.degreeId ? bptDegree.degreeId : null,
                    "mptDegree.degreeId": mptDegree.degreeId ? mptDegree.degreeId : null,
                }
            },
            { new: true } // returns updated document
        );

        console.log(UpdatedPhysio);
        return res.status(200).json({
            message: "Professional details updated successfully",
            status: 200,
            success: true,
            physio: UpdatedPhysio
        });

    } catch (error) {
        console.error("Error updating professional details:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

// Create Physio Business Details
// https://api.physioplushealthcare.com/api/web/physio/createPhysioProfessionalDetails
exports.createPhysioBusinessDetails = async (req, res) => {
    try {
        const {
            physioId,
            clinicName,
            clinicAddress,
            clinicPincode,
            clinicCity,
            clinicState,
            clinicCharges,
            clinicDuration,
            homePincode,
            homeCity,
            homeState,
            homeDuration,
            homeCharges,
        } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        if (!physioId || !mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: "Valid PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await physioConnect.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });
        }

        const UpdatedPhysio = await Physio.findByIdAndUpdate(physioId, {
            $set: {
                // Clinic
                "clinic.name": clinicName ?? null,
                "clinic.address": clinicAddress ?? null,
                "clinic.zipCode": clinicPincode ?? 0,
                "city": clinicCity ?? null,
                "state": clinicState ?? null,
                "clinic.duration": clinicDuration ?? 0,
                "clinic.charges": clinicCharges ?? 0,

                // Home
                "home.zipCode": homePincode ?? 0,
                "home.homeCity": homeCity ?? null,
                "home.homeState": homeState ?? null,
                "home.duration": homeDuration ?? 0,
                "home.charges": homeCharges ?? 0,
            }
        }
            , { new: true });


        return res.status(200).json({
            message: "Business details updated successfully",
            status: 200,
            success: true,
            physio: UpdatedPhysio
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};

// Get Physio Name, Email, Phone, Gender, DOB, About
// https://api.physioplushealthcare.com/api/web/physio/getPhysioPersonalDetailsById
exports.getPhysioDetailsById = async (req, res) => {
    try {
        const { Id } = req.query;

        if (!Id) {
            return res.status(400).json({
                message: "Physio ID is required",
                status: 400,
                success: false
            });
        }

        const physio = await physioConnect.findById(Id).populate('subscriptionId').populate('isPhysioConnectCoupon'); // lowercase `physio`, not `Physio` (name conflict in your code)

        if (!physio) {
            return res.status(404).json({
                message: "No physio found for the provided ID",
                status: 404,
                success: false
            });
        }

        // Return Temporary Invoice
        const invoice = await Invoice.findOne({
            physioId: Id,
            type: "subscription",
            subscriptionId: null,
            couponName: physio.isPhysioConnectCoupon?.couponName
        }).populate('transactionId');

        return res.status(200).json({
            message: "Physio found",
            status: 200,
            success: true,
            physioData: physio,
            invoiceData: invoice
        });

    } catch (error) {
        console.error("Error fetching physio:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};



exports.AddPhysioReviews = async (req, res) => {
    try {
        console.log(req.body);

        const {
            appointmentId,
            patientId,
            physioId,
            rating,
            comment
        } = req.body;

        if (!patientId) {
            return res.status(400).json({
                message: "Patient Id is required",
                status: 400,
                success: false
            });
        }

        if (!physioId) {
            return res.status(400).json({
                message: "Physio Id is required",
                status: 400,
                success: false
            });
        }

        if (!rating) {
            return res.status(400).json({
                message: "Rating is required",
                status: 400,
                success: false
            });
        }

        if (!appointmentId) {
            return res.status(400).json({
                message: "Appointment Id is required",
                status: 400,
                success: false
            });
        }

        // Validate Patient Id
        const checkPatient = await Patient.findById(patientId);
        if (!checkPatient) {
            return res.status(400).json({
                message: "Invalid Patient Id",
                status: 400,
                success: false
            });
        }

        // Validate Physio Id
        const checkPhysio = await Physio.findById(physioId);
        if (!checkPhysio) {
            return res.status(400).json({
                message: "Invalid Physio Id",
                status: 400,
                success: false
            });
        }

        // Check if the patient has already reviewed the physio
        const checkReview = await Review.findOne({
            patientId,
            physioId,
            appointmentId

        });
        if (checkReview) {
            return res.status(400).json({
                message: "You have already reviewed this appointment",
                status: 400,
                success: false
            });
        }

        // Add the review
        const review = new Review({
            patientId,
            physioId,
            rating: Number(rating),
            comment,
            appointmentId
        });
        await review.save();

        // Update physio's average rating
        const reviews = await Review.find({ physioId });
        const totalCountRating = reviews.length;
        const totalRatingCount = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = (totalRatingCount / totalCountRating).toFixed(1);

        await Physio.findByIdAndUpdate(physioId, { rating: averageRating });

        return res.status(201).json({
            message: "Review added successfully and physio rating updated",
            status: 201,
            success: true,
            data: review
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false
        });
    }
}
exports.physioConnectProfileEdit = async (req, res) => {
    try {
        const physioData = { ...req.body };
        const physioId = physioData?._id;

        if (!physioId) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        if (!physioId || !mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: "Valid PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await physioConnect.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false,
            });
        }

        const updatedPhysio = await physioConnect.findByIdAndUpdate(
            physioId,
            {
                $set: {
                    profileImage: physioData.profileImage || null,
                    fullName: physioData.fullName || null,
                    email: physioData.email || null,
                    gender: physioData.gender || 1,
                    dob: physioData.dob || null,
                    about: physioData.about || null,
                    achievement: Array.isArray(physioData.achievement) ? physioData.achievement : [],
                    specialization: physioData.specialization || null,
                    subspecializationId: physioData.subspecializationId || null,
                    workExperience: physioData.workExperience || null,

                    mpt: physioData.mpt || false,
                    iapMember: physioData.iapMember ?? 0,
                    iapNumber: physioData.iapNumber || null,
                    iapImage: physioData.iapImage || null,
                    serviceType: physioData.serviceType || null,

                    "bptDegree.degreeId": physioData.bptDegree.degreeId || null,
                    "bptDegree.image": physioData.bptDegree.image || null,

                    "mptDegree.degreeId": physioData.mptDegree.degreeId || null,
                    "mptDegree.image": physioData.mptDegree.image || null,

                    "clinic.name": physioData.clinic.name || null,
                    "clinic.address": physioData.clinic.address || null,
                    "clinic.imagesClinic": physioData.clinic.imagesClinic || [],
                    "clinic.zipCode": physioData.clinic.zipCode || 0,
                    "city": physioData.city || null,
                    "state": physioData.state || null,
                    "clinic.duration": physioData.clinic.duration || 0,
                    "clinic.charges": physioData.clinic.charges || 0,
                    "clinic.timings.start": physioData.clinic?.timings?.start || "",
                    "clinic.timings.end": physioData.clinic?.timings?.end || "",
                    "clinic.workingDays": Array.isArray(physioData.clinic?.workingDays) ? physioData.clinic.workingDays : [],

                    "home.zipCode": physioData.home.zipCode || 0,
                    "home.homeCity": physioData.home.homeCity || null,
                    "home.homeState": physioData.home.homeState || null,
                    "home.duration": physioData.home.duration || 0,
                    "home.charges": physioData.home.charges || 0,
                    "home.mode": Array.isArray(physioData.home?.mode) ? physioData.home.mode : [],
                    "home.morningTimings.start": physioData.home?.morningTimings?.start || "",
                    "home.morningTimings.end": physioData.home?.morningTimings?.end || "",
                    "home.eveningTimings.start": physioData.home?.eveningTimings?.start || "",
                    "home.eveningTimings.end": physioData.home?.eveningTimings?.end || "",
                    "home.workingDays": Array.isArray(physioData.home?.workingDays) ? physioData.home.workingDays : [],

                    // patientImage: Array.isArray(physioData.patientImage) ? physioData.patientImage : [],
                    isPhysioConnectProfileCompleted: true,

                    latitude: physioData.latitude || null,
                    longitude: physioData.longitude || null,
                    // location: {
                    //     type: "Point",
                    //     coordinates:
                    //         physioData.longitude && physioData.latitude
                    //             ? [parseFloat(physioData.longitude), parseFloat(physioData.latitude)]
                    //             : [0, 0],
                    // },
                },
            },
            { new: true }
        );

        return res.status(200).json({
            message: "Personal details updated successfully",
            status: 200,
            success: true,
            physio: updatedPhysio
        });

    } catch (error) {
        console.error("Error updating profile details:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message
        });
    }
}

exports.GetCouponByCode = async (req, res) => {
    try {
        const {
            couponName,
            physioId
        } = req.body;
        if (!couponName) {
            return res.status(400).json({
                message: "Coupon Name is required",
                status: 400,
                success: false
            });
        }

        if (!physioId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false
            });
        }

        // if coupon code is valid
        const coupon = await Coupon.findOne({
            couponName: couponName,
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

        const constAlreadyUsed = coupon.physioId.some((id) => id.equals(physioId))

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

// physio withdraw request from website
exports.PhysioWalletWithdrawTransaction = async (req, res) => {
    try {
        const { physioId, amount } = req.body;



        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });

        if (!amount) return res.status(400).json({
            message: 'Amount is required',
            success: false,
            status: 400
        });

        const physio = await Physio.findById({ _id: physioId });
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });

        // if check balance

        if (amount > physio.wallet) return res.status(400).json({
            message: 'Insufficient balance',
            success: false,
            status: 400
        });

        // transaction details
        const transaction = new Transaction({
            physioId: physioId,
            amount: amount,
            wallet: amount,
            physioTransactionType: "withdraw",
            transactionId: `PHWID_${generateRandomCode()}`,
            paymentMode: 'wallet',
            paymentStatus: 'pending',
            paidTo: "physioPlus",
        });
        await transaction.save();

        // physio wallet update
        const physioWallet = await Physio.findById({ _id: physioId });
        await physioWallet.updateOne({ $inc: { wallet: -amount } });

        const data = {
            physioId: physio._id.toString(),
            title: "Withdraw Request",
            body: `${physio.fullName} has requested to withdraw ₹${amount} from wallet`,
            type: 'withdrawal',
            from: 'admin',
            to: 'admin',
            for: 'admin'
        }

        await sendFCMNotification(physio.deviceId, data, true);

        return res.status(200).json({
            message: 'Transaction created',
            success: true,
            status: 200,
            data: transaction
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        });
    }
};


exports.getPhysioTransaction = async (req, res) => {
    try {
        let physioId = req.query.physioId;
        let paidTo = req.query.paidTo;

        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }

        const query = {}

        if (physioId) {
            query.physioId = physioId
        }

        if (paidTo) {
            query.paidTo = paidTo
        } else {
            query.paidTo = { $in: ["physio", "patient"] }
        }

        query.physioTransactionType = { $nin: ["withdrawal"] }

        const transactions = await Transaction.find(query).sort({ createdAt: -1 }).populate('patientId')
        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: transactions
        })
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}

exports.getPhysioWithdrawalRequest = async (req, res) => {
    try {
        const { physioId } = req.query;

        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }

        const physio = await Physio.findOne({ _id: physioId });
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        const transactions = await Transaction.find({
            physioId,
            physioTransactionType: 'withdraw',
        }).sort({ createdAt: -1 })

        const data = {
            transactions: transactions,
            wallet: physio.wallet
        }

        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: data
        });
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}

exports.getPhysioWalletData = async (req, res) => {
    try {
        const { physioId } = req.query;
        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }

        const transactions = await Transaction.find({ physioId }).populate({
            path: 'subscriptionId',
            populate: { path: 'planId' }
        }).lean();

        if (!transactions) {
            return res.status(404).json({
                message: 'Transactions not found',
                success: false,
                status: 404
            });
        }

        const physio = await Physio.findById(physioId).populate({
            path: 'subscriptionId',
            populate: { path: 'planId' }
        }).lean();

        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        let totalRevenue = 0;
        let totalPlatformCharges = 0;
        let cashAmount = 0;
        let cashPlatformCharges = 0;
        let cashPlatformChargesPaid = 0;
        let cashGstAmount = 0;
        let onlineAmount = 0;
        let onlinePlatformCharges = 0;
        let onlineGstAmount = 0;
        let walletAmount = 0;
        let walletWithdrawAmount = 0;
        let subscriptionWalletAmount = 0;
        let gstAmount = 0;

        transactions.forEach(txn => {
            let txnAmount = 0;

            if (txn.paidFor === 'debt') {
                cashPlatformChargesPaid += txn.amount;
                return
            }

            if (txn.paidTo === 'physioPlus' && txn.physioTransactionType === 'withdraw') {
                walletWithdrawAmount += txn.amount;
                return
            }

            if (txn.paidFor === 'subscription') {
                subscriptionWalletAmount += txn.wallet;
                walletAmount += txn.wallet;
                return
            }

            if (txn.paymentMode === 'cash') {
                txnAmount = txn.amount || 0;
                cashAmount += txn.amount;
                cashPlatformCharges += txn.platformCharges;
                cashGstAmount += txn.gstAmount;
            } else {
                txnAmount = txn.appointmentAmount || 0;
                onlineAmount += txn.appointmentAmount;
                onlinePlatformCharges += txn.platformCharges;
                onlineGstAmount += txn.gstAmount;
            }

            totalRevenue += txnAmount;
            totalPlatformCharges += txn.platformCharges;
            walletAmount += txn.wallet;
            gstAmount += txn.gstAmount;
        });

        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            totalRevenue: totalRevenue,
            physioPlusEarning: totalPlatformCharges,
            gstAmount: gstAmount,
            physioWallet: physio.wallet,
            walletAmount: walletAmount,
            walletWithdrawAmount: walletWithdrawAmount,
            subscriptionWalletAmount: subscriptionWalletAmount,
            onlineAmount: onlineAmount,
            physioEarning: {
                total: (totalRevenue - (totalPlatformCharges + gstAmount)),
                cash: (cashAmount - (cashPlatformCharges + cashGstAmount)),
                online: (onlineAmount - (onlinePlatformCharges + onlineGstAmount)),
            },
            cash: {
                amount: cashAmount,
                commission: cashPlatformCharges + cashGstAmount,
                paid: cashPlatformChargesPaid,
            },
            commission: {
                total: (cashPlatformCharges + cashGstAmount) + (onlinePlatformCharges + onlineGstAmount),
                online: onlinePlatformCharges + onlineGstAmount,
                cash: cashPlatformCharges + cashGstAmount,
            }
        });

    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong. Please try again.',
            status: 500,
            success: false,
            error: error.message
        });
    }
};

exports.requestRefund = async (req, res) => {
    try {
        const { physioId, refundShare } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                status: 404,
                success: false
            });
        }

        if (physio.isPhysioConnectRefundRequest) {
            return res.status(400).json({
                message: 'Refund request already exists',
                status: 400,
                success: false
            });
        }

        let refundAmount = 0
        if (refundShare === "full") {
            refundAmount = physio.isPhysioConnectPayment
        } else {
            refundAmount = physio.isPhysioConnectPayment * 0.70
        }

        const refundRequest = await RefundRequest.create({
            physioId: physioId,
            refundAmount: refundAmount,
            paidAmount: physio.isPhysioConnectPayment,
            status: 'pending',
            refundType: 'subscription'
        });

        // Update Physio Refund Request Field
        physio.isPhysioConnectRefundRequest = true;
        await physio.save();

        return res.status(200).json({
            message: 'Refund request created',
            success: true,
            status: 200,
            data: refundRequest
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Something went wrong. Please try again.',
            status: 500,
            success: false,
            error: error.message
        });
    }
}



exports.getAllPhysios = async (req, res) => {
    console.log(req.query);

    try {
        const { lng, lat, filter } = req.query;

        if (!lng || !lat) {
            return res.status(400).json({
                message: "Please provide lng and lat",
                status: 400,
                success: false,
            });
        }

        const roundedLongitude = parseFloat(parseFloat(lng).toFixed(4));
        const roundedLatitude = parseFloat(parseFloat(lat).toFixed(4));

        const cacheKey = `getAllPhysios:${JSON.stringify({
            longitude: roundedLongitude,
            latitude: roundedLatitude,
            filter
        })}`;

        // Uncomment to use cache
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            console.log("> Returning cached data");
            return res.json({
                status: 200,
                message: "Data returned from cache",
                data: JSON.parse(cachedData)
            });
        }

        let matchConditions = {};
        let city;
        let CheckError = false;
        let sortedPhysios = [];
        let sortField = {}

        // Add MPT filter


        try {

            city = await getCityFromCoordinates(lat, lng);
            console.log("Resolved city from coordinates:", city);
            matchConditions.accountStatus = 1;
            matchConditions.isBlocked = false;
            matchConditions.city = new RegExp("^" + city + "$", "i");
        } catch (error) {
            console.warn("Failed to resolve city from coordinates, falling back to patient city.");
            console.log(error);

            // CheckError = true;
            // city = thePatient.city || ' ';
            // matchConditions.city = new RegExp("^" + city + "$", "i");
        }

        if (!city || city.trim() === "") {
            return res.status(400).json({
                message: "Unable to determine city from coordinates or patient profile",
                status: 400,
                success: false,
            });
        }

        if (filter) {

            switch (filter) {
                case "price":
                    sortField['home.charges'] = filter === "price" ? -1 : 0;
                    break;

                case "mpt":
                    matchConditions.$or = [
                        { mpt: true },
                        { "mptDegree.degreeId": { $ne: null } }
                    ];
                    break;

                case "rating":
                    sortField['rating'] = filter === "rating" ? -1 : 0;
                    break;
                default:
                    break;
            }

        }


        const pipeline = [
            { $match: matchConditions },
            // { $sort: sortField },
            // { $skip: parseInt(skip) || 0 },
            {
                $lookup: {
                    from: "specializations",
                    localField: "specialization",
                    foreignField: "_id",
                    as: "specialization",
                },
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "subscriptionId",
                    foreignField: "_id",
                    as: "subscription",
                },
            },
            {
                $lookup: {
                    from: "plans",
                    localField: "subscription.planId",
                    foreignField: "_id",
                    as: "plan",
                },
            },
            {
                $unwind: {
                    path: "$plan",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "reviews",
                    localField: "_id",
                    foreignField: "physioId",
                    as: "reviews",
                },
            },
            {
                $addFields: {
                    reviewCount: { $size: "$reviews" },
                },
            },
            {
                $project: {
                    reviews: 0,
                },
            },
        ];

        // Conditionally add planType filtering


        const populatedPhysios = await Physio.aggregate(pipeline);
        // console.log("Matched physios count:", populatedPhysios.length);

        if (CheckError === false) {
            sortedPhysios = await addTravelDistance(populatedPhysios, lat, lng, true, false);
        } else {
            sortedPhysios = populatedPhysios.map((physio) => ({
                ...physio,
                travelDistance: `0 km`,
                travelDuration: "N/A"
            }));
        }

        // console.log("Final physios returned:", sortedPhysios.length);

        await redisClient.set(cacheKey, JSON.stringify(sortedPhysios), { EX: CACHE_EXPIRATION.TWO_MINUTES });

        return res.json({
            status: 200,
            message: "Data returned",
            data: sortedPhysios
        });

    } catch (error) {
        console.error("Error fetching physios:", error);
        return res.status(500).json({
            status: false,
            message: "Error fetching physios",
            error: error.message,
        });
    }
};

exports.getSinglePhysioById = async (req, res) => {
    try {
        let physioId = req.query.physioId
        if (!physioId) {
            return res.status(400).json({
                message: "Please provide physioId",
                status: 400,
                success: false,
            })
        }
        // return console.log(req.query)

        const thePhysio = await Physio.findOne({
            _id: physioId
        }).populate("specialization degree.degreeId subspecializationId bptDegree.degreeId mptDegree.degreeId")
        if (!thePhysio) {
            return res.status(400).json({
                status: false,
                message: "no physio exists with this Id"
            })
        }

        return res.status(200).json({
            message: "Physio fetched successfully",
            status: true,
            data: thePhysio
        })


    } catch (error) {
        console.log(error)
        return res.status(400).json({
            message: "Error fetching physio",
            status: 400,
            success: false,
            error: error,
        })
    }
}


exports.completeTreatment = async (req, res) => {
    try {
        const {
            appointmentId,
            prescriptionNotes,
        } = req.query;

        if (!appointmentId) return res.status(400).json({
            message: 'AppointmentId is required',
            success: false,
            status: 400
        });

        const appointment = await Appointment.findById({
            _id: appointmentId
        })


        if (!appointment) return res.status(400).json({
            message: 'Appointment not found',
            success: false,
            status: 400
        });


        // if (appointment.isTreatmentScheduled.isTreatmentCompleted === true) return res.status(400).json({
        //     message: 'Treatment Already Completed',
        //     success: false,
        //     status: 400
        // });

        const GetTreamentDate = appointment.isTreatmentScheduled.treatmentDate
        //Check if the getLastDateObject is before today's date to determine if the treatment is complete.
        const getLastDateObject = GetTreamentDate[(GetTreamentDate.length - 1)]
        const todayDate = moment.tz('Asia/kolkata').format('YYYY-MM-DD')
        const lastDateCheck = moment(getLastDateObject.date).tz('Asia/kolkata').format('YYYY-MM-DD')

        if (todayDate <= lastDateCheck) {
            return res.status(403).json({
                message: 'Treatment Complete only last date or after last date',
                success: false,
                status: 403,
            });
        }

        let updateAppointment = await Appointment.findByIdAndUpdate({
            _id: appointmentId
        }, {
            prescriptionNotes: prescriptionNotes ? prescriptionNotes : null,
            otpStatus: true,
            'isTreatmentScheduled.isTreatmentCompleted': true,
        }, {
            new: true
        })

        // Fetch the patient and physio associated with the appointment
        const patient = await Patient.findById(appointment.patientId);
        const physio = await Physio.findById(appointment.physioId);

        const invoice = await createAppointmentInvoice(appointmentId, isTreatment = true)

        if (physio && physio.deviceId) {
            const data = {
                title: "Treatment Completed",
                physioId: physio._id.toString(),
                name: patient.fullName,
                time: appointment.time,
                date: appointment.date,
                type: 'treatment',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            }

            // Send Notification to physio
            data.body = `A treatment with ${patient?.fullName} has been completed successfully.`
            let result = await sendFCMNotification(physio.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result.error);
            }

            // Send Notification to patient
            data.body = `Your treatment with ${physio?.fullName} has been completed successfully.`
            data.name = physio.fullName
            data.type = 'treatment',
                data.from = 'admin',
                data.to = 'patient',
                data.for = 'patient'
            data.physioId = null
            data.patientId = patient._id.toString()
            result = await sendFCMNotification(patient?.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to patient", result.error);
            }
        }

        return res.status(200).json({
            message: 'Treatment Completed',
            success: true,
            status: 200,
            data: updateAppointment,
            invoice

        });

    } catch (error) {
        console.log(error.message);
        res.status(500).json({
            message: 'Something went wrong Please try again',
            success: false,
            status: 500,
            error: error.message
        });
    }
};
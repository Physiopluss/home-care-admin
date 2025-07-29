const Physio = require('../../models/physio')
const Appointment = require('../../models/appointment')
const Patient = require('../../models/patient')
const Treatment = require('../../models/treatment')
const Wallet = require('../../models/wallet')
const Transaction = require('../../models/transaction')
require('dotenv/config')
const {
    msg91OTP
} = require('msg91-lib');
const crypto = require('crypto');

const Specialization = require('../../models/specialization')
const Degree = require('../../models/Degree')
const mongoose = require('mongoose')
const multer = require("multer");
const path = require("path");
const root = process.cwd();
const fs = require("fs");
// const AWS = require('aws-sdk');
const axios = require("axios");
const { getCityFromCoordinates, addTravelDistance } = require('../../utility/locationUtils');
const { redisClient, CACHE_EXPIRATION } = require('../../utility/redisClient');

// Set The Storage Engine
const storage = multer.diskStorage({
    // destination: (req, file, cb) => {
    //     const uploadPath = path.join(__dirname, '../uploads/blog');
    //     fs.mkdirSync(uploadPath, { recursive: true });
    //     cb(null, uploadPath);
    //   },
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
const upload = multer({ storage: storage }).fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'degreeImage', maxCount: 1 },
    { name: 'iapImage', maxCount: 1 },
    { name: 'imagesClinic', maxCount: 10 },
]);

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
const msg91otp = new msg91OTP({
    authKey: process.env.MSG91_AUTH_KEY,
    templateId: process.env.MSG91_TEMP_ID
});

const signUpPhysioOtp = async (req, res) => {
    try {
        const {
            phone
        } = req.body;

        // let otp = generateRandomCode()
        // const patient =await Patient.findOne({phone : phone})
        Physio.findOne({
            phone: `+91${phone}`
        })
            .then(
                async (userData) => {

                    // return console.log(userData)
                    if (userData) {
                        return res.status(409).json({
                            status: false,
                            message: "User with this Phone already exists"
                        });
                    } else {

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

const loginPhysioOtp = async (req, res) => {
    try {
        const phone = req.body.phone
        // const deviceId = req.body.deviceId
        // let token = generateRandomCode()
        //const patient =await Patient.findOne({phone : phone})
        Physio.findOne({
            phone: `+91${phone}`
        })
            .then(async userData => {
                if (!userData) {
                    return res.status(400).json({
                        status: false,
                        message: "User with this Phone does'not exists"
                    });
                } else {
                    const response = await msg91otp.send(`91${phone}`)
                    if (response.type !== "success") {
                        res.status(400).json({
                            status: false,
                            message: "otp not sent"
                        })
                    } else {

                        return res.json({
                            status: true,
                            message: "OTP sent successfully"
                        });

                    }

                    // }
                    // else{
                    // return res.status(400).json({status:false, message:"OTP not sent"});
                    // }
                }
            })
        // })

    } catch (error) {
        res.status(400).json({
            status: false,
            message: "otp not sent"
        })
    }
}


const resendOtp = async (req, res) => {
    try {
        const phone = req.body.phone
        // const response = await msg91otp.retry(`+91${phone}`)
        // if(response.type!=="success"){
        //     res.status(400).json({status:false ,message:"couldnt send otp"})
        // }else{

        return res.json({
            status: true,
            message: "OTP sent successfully"
        });

        // }
    } catch (er) {
        res.status(400).json({
            status: false,
            message: "otp expired"
        })
    }
}


// const addProfileDetails = async (req, res) => {
//     try {
//         upload(req, res, async (err) => {
//             if (err) {
//                 return res.status(500).json({
//                     message: 'Something went wrong during file upload',
//                     status: 500,
//                     success: false,
//                 });
//             }

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

//             // let profileImagePromise = Promise.resolve(null);
//             // let degreeImagePromise = Promise.resolve(null);
//             // let iapImagePromise = Promise.resolve(null);
//             // let clinicImagesPromises = [];

//             // // Handle profile image upload
//             // if (req.files && req.files['profileImage'] && req.files['profileImage'][0]) {
//             //     const profileImage = req.files['profileImage'][0];
//             //     const profileImageKey = `Physio/${profileImage.filename}`;
//             //     const params = {
//             //         Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//             //         Key: profileImageKey,
//             //         Body: fs.createReadStream(profileImage.path),
//             //     };
//             //     profileImagePromise = new Promise((resolve, reject) => {
//             //         s3.upload(params, (err, data) => {
//             //             if (err) {
//             //                 return reject(err);
//             //             }
//             //             if (physio.profileImage) {
//             //                 const deleteParams = {
//             //                     Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//             //                     Key: `Physio/${physio.profileImage}`,
//             //                 };
//             //                 s3.deleteObject(deleteParams, (err) => {
//             //                     if (err) {
//             //                         console.error('Error deleting old profile image:', err);
//             //                     }
//             //                 });
//             //             }
//             //             resolve(data.Location);
//             //         });
//             //     });
//             // }

//             // // Handle degree image upload
//             // if (req.files && req.files['degreeImage'] && req.files['degreeImage'][0]) {
//             //     const degreeImage = req.files['degreeImage'][0];
//             //     const degreeImageKey = `Physio/${degreeImage.filename}`;
//             //     const params = {
//             //         Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//             //         Key: degreeImageKey,
//             //         Body: fs.createReadStream(degreeImage.path),
//             //     };
//             //     degreeImagePromise = new Promise((resolve, reject) => {
//             //         s3.upload(params, (err, data) => {
//             //             if (err) {
//             //                 return reject(err);
//             //             }
//             //             if (physio.degreeImage) {
//             //                 const deleteParams = {
//             //                     Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//             //                     Key: `Physio/${physio.degreeImage}`,
//             //                 };
//             //                 s3.deleteObject(deleteParams, (err) => {
//             //                     if (err) {
//             //                         console.error('Error deleting old degree image:', err);
//             //                     }
//             //                 });
//             //             }
//             //             resolve(data.Location);
//             //         });
//             //     });
//             // }

//             // // Handle IAP image upload
//             // if (req.files && req.files['iapImage'] && req.files['iapImage'][0]) {
//             //     const iapImage = req.files['iapImage'][0];
//             //     const iapImageKey = `Physio/${iapImage.filename}`;
//             //     const params = {
//             //         Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//             //         Key: iapImageKey,
//             //         Body: fs.createReadStream(iapImage.path),
//             //     };
//             //     iapImagePromise = new Promise((resolve, reject) => {
//             //         s3.upload(params, (err, data) => {
//             //             if (err) {
//             //                 return reject(err);
//             //             }
//             //             if (physio.iapImage) {
//             //                 const deleteParams = {
//             //                     Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//             //                     Key: `Physio/${physio.iapImage}`,
//             //                 };
//             //                 s3.deleteObject(deleteParams, (err) => {
//             //                     if (err) {
//             //                         console.error('Error deleting old IAP image:', err);
//             //                     }
//             //                 });
//             //             }
//             //             resolve(data.Location);
//             //         });
//             //     });
//             // }

//             // // Handle clinic images upload
//             // if (req.files && req.files['imagesClinic']) {
//             //     const clinicImages = req.files['imagesClinic'];
//             //     clinicImagesPromises = clinicImages.map((image) => {
//             //         const clinicImageKey = `Physio/${image.filename}`;
//             //         const params = {
//             //             Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//             //             Key: clinicImageKey,
//             //             Body: fs.createReadStream(image.path),
//             //         };
//             //         return new Promise((resolve, reject) => {
//             //             s3.upload(params, (err, data) => {
//             //                 if (err) {
//             //                     return reject(err);
//             //                 }
//             //                 resolve(data.Location);
//             //             });
//             //         });
//             //     });
//             // }

//             // // Wait for all uploads to complete
//             // Promise.all([profileImagePromise, degreeImagePromise, iapImagePromise, ...clinicImagesPromises])
//             //     .then(async (urls) => {
//             //         const [profileImageUrl, degreeImageUrl, iapImageUrl, ...clinicImageUrls] = urls;

//             // Update physio profile with the new data
//             const updatedPhysio = await Physio.findByIdAndUpdate(
//                 physio._id,
//                 {
//                     $set: {
//                         profileImage: req.body.profileImageUrl || physio.profileImage,
//                         fullName: req.body.fullName || physio.fullName,
//                         dob: req.body.dob || physio.dob,
//                         email: req.body.email || physio.email,
//                         about: req.body.about || physio.about,
//                         degree: {
//                             title: req.body.degreeTitle || physio.degree.title,
//                             degreeId: req.body.degree || physio.degree.degreeId,
//                             degreeImage: req.body.degreeImageUrl || physio.degree.degreeImage,
//                         },
//                         specialization: req.body.specialization || physio.specialization,
//                         workExperience: req.body.workExperience || physio.workExperience,
//                         iapMember: req.body.iapMember || physio.iapMember,
//                         iapNumber: req.body.iapNumber || physio.iapNumber,
//                         iapImage: req.body.iapImageUrl || physio.iapImage,
//                         //  serviceType data is coming as string from the client "["clinic","home"]" so need to parse it clinic,home
//                         serviceType: req.body.serviceType ? JSON.parse(req.body.serviceType) : physio.serviceType,
//                         clinic: {
//                             status: 0,
//                             name: req.body.clinicName || physio.clinic.name,
//                             address: req.body.clinicAddress || physio.clinic.address,
//                             workingDays: req.body.workingDays ? JSON.parse(req.body.workingDays) : physio.clinic.workingDays,
//                             timings: {
//                                 start: req.body.clinicStartTime || physio.clinic.timings.start,
//                                 end: req.body.clinicEndTime || physio.clinic.timings.end,
//                             },
//                             duration: req.body.clinicDuration || physio.clinic.duration,
//                             charges: req.body.clinicCharges || physio.clinic.charges,
//                             imagesClinic: req.body.clinicImageUrls.length > 0 ? req.body.clinicImageUrls : physio.clinic.imagesClinic,
//                             area: req.body.ClinicArea || physio.clinic.area,
//                             zipCode: req.body.ClinicZipCode || physio.clinic.zipCode,
//                             city: req.body.ClinicCity || physio.clinic.city,
//                             state: req.body.ClinicState || physio.clinic.state,
//                         },
//                         home: {
//                             status: 0,
//                             workingDays: req.body.homeWorkingDays ? JSON.parse(req.body.homeWorkingDays) : physio.home.workingDays,
//                             mode: req.body.homeMode ? JSON.parse(req.body.homeMode) : physio.home.mode,
//                             morningTimings: {
//                                 start: req.body.homeMorningStartTime || physio.home.morningTimings.start,
//                                 end: req.body.homeMorningEndTime || physio.home.morningTimings.end,
//                             },
//                             eveningTimings: {
//                                 start: req.body.homeEveningStartTime || physio.home.eveningTimings.start,
//                                 end: req.body.homeEveningEndTime || physio.home.eveningTimings.end,
//                             },
//                             duration: req.body.homeDuration || physio.home.duration,
//                             charges: req.body.homeCharges || physio.home.charges,
//                         },
//                         online: {
//                             status: 0,
//                             workingDays: req.body.onlineWorkingDays ? JSON.parse(req.body.onlineWorkingDays) : physio.online.workingDays,
//                             // mode: req.body.onlineMode || physio.online.mode,
//                             timings: {
//                                 start: req.body.onlineStartTime || physio.online.timings.start,
//                                 end: req.body.onlineEndTime || physio.online.timings.end,
//                             },
//                             duration: req.body.onlineDuration || physio.online.duration,
//                             charges: req.body.onlineCharges || physio.online.charges,
//                         },
//                         latitude: req.body.latitude || physio.latitude,
//                         longitude: req.body.longitude || physio.longitude,
//                         activeStatus: req.body.activeStatus || physio.activeStatus,
//                         accountStatus: req.body.accountStatus || physio.accountStatus,
//                         gender: req.body.gender || physio.gender,
//                         language: req.body.language || physio.language,
//                     },
//                 },
//                 { new: true }
//             );

//             if (updatedPhysio.clinic.imagesClinic !== physio.clinic.imagesClinic) {
//                 // Delete the old clinic images only after successfully updating the clinic images
//                 physio.clinic.imagesClinic.forEach((image) => {
//                     const deleteParams = {
//                         Bucket: `${process.env.AWS_BUCKET_NAME}/Physio`,
//                         Key: `Physio/${image}`,
//                     };
//                     s3.deleteObject(deleteParams, (err) => {
//                         if (err) {
//                             console.error('Error deleting old clinic image:', err);
//                         }
//                     });
//                 });
//             }

//             return res.status(200).json({
//                 message: "Profile updated successfully",
//                 status: true,
//                 success: true,
//             });
//         })
//     } catch (error) {
//         console.error('Update profile error:', error);
//         return res.status(500).json({
//             message: "Something went wrong, please try again later",
//             status: 500,
//             success: false,
//         })
//     }
// }

const getSinglePhysioById = async (req, res) => {
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
const editPhysioProfile = async (req, res) => {
    try {
        const physioId = req.params.physioId
        const {
            fullName,
            profileImage,
            email,
            about,
            degree,
            specialization,
            workExperience,
            aadharNumber,
            bachelorDegree,
            mastersDegree,
            iapMember,
            iapNumber,
            iapDoc,
            clinicName,
            address,
            images,
            area,
            zipCode,
            city,
            state,
            consultationMode,
            workingDays,
            start,
            end,
            duration,
            homeVisitCharges,
            clinicVisitCharges,
            teleConsultationCharges,
            accountNumber,
            accountHolderName,
            ifscCode,
            bankName,
        } = req.body



        const thePhysio = Physio.findById(physioId)
        if (!thePhysio) {
            res.status(400).json({
                status: true,
                message: "No physio exists with this Id"
            })
        }



        const updatedData = await Physio.findByIdAndUpdate(physioId, {
            fullName: fullName,
            profileImage: profileImage,
            email: email,
            about: about,
            degree: degree,
            specialization: specialization,
            workExperience: workExperience,
            aadharNumber: aadharNumber,
            bachelorDegree: bachelorDegree,
            mastersDegree: mastersDegree,
            iapMember: iapMember,
            iapNumber: iapNumber,
            iapDoc: iapDoc,
            clinic: {
                clinicName: clinicName,
                address: address,
                images: images,
                area: area,
                zipCode: zipCode,
                city: city,
                state: state,
                consultationMode: consultationMode,
                workingDays: workingDays,
                timings: {
                    start: start,
                    end: end,
                },
                duration: duration,
                homeVisitCharges: homeVisitCharges,
                clinicVisitCharges: clinicVisitCharges,
                teleConsultationCharges: teleConsultationCharges,
            },
            bankDetails: {
                accountNumber: accountNumber,
                accountHolderName: accountHolderName,
                ifscCode: ifscCode,
                bankName: bankName
            }

        }, {
            new: true
        })
        res.status(201).json({
            status: true,
            message: "profile updated successfully",
            data: updatedData
        })
    } catch (error) {
        return res.status(400).json({
            status: false,
            message: "Error updating profile"
        });
    }
}


const getAllPhysios = async (req, res) => {
    try {
        const { patientId, longitude, latitude, skip = 0, serviceType, planType, sortOrder, mpt = false } = req.query;

        if (!patientId) {
            return res.status(400).json({
                status: 400,
                message: "Please provide patientId",
            });
        }

        const thePatient = await Patient.findById(patientId);
        if (!thePatient) {
            return res.status(400).json({
                message: "No patient exists with this Id",
                status: 400,
                success: false,
            });
        }

        if (!longitude || !latitude) {
            return res.status(400).json({
                message: "Please provide longitude and latitude",
                status: 400,
                success: false,
            });
        }

        const roundedLongitude = parseFloat(parseFloat(longitude).toFixed(4));
        const roundedLatitude = parseFloat(parseFloat(latitude).toFixed(4));

        const cacheKey = `getAllPhysios:${JSON.stringify({
            longitude: roundedLongitude,
            latitude: roundedLatitude,
            serviceType,
            sortOrder,
            planType,
            mpt
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

        // Add MPT filter
        if (mpt === "true" || mpt === true) {
            matchConditions["mptDegree.degreeId"] = { $nin: [null, ""] };
        }

        try {
            city = await getCityFromCoordinates(latitude, longitude);
            console.log("Resolved city from coordinates:", city);
            matchConditions.accountStatus = 1;
            matchConditions.isBlocked = false;
            matchConditions.city = new RegExp("^" + city + "$", "i");
        } catch (error) {
            console.warn("Failed to resolve city from coordinates, falling back to patient city.");
            CheckError = true;
            city = thePatient.city || ' ';
            matchConditions.city = new RegExp("^" + city + "$", "i");
        }

        if (!city || city.trim() === "") {
            return res.status(400).json({
                message: "Unable to determine city from coordinates or patient profile",
                status: 400,
                success: false,
            });
        }

        const sortDirection = sortOrder === "desc" ? -1 : 1;
        const normalizedServiceType = serviceType?.toLowerCase();

        const sortField = {};
        if (normalizedServiceType === "home") {
            sortField["home.charges"] = sortDirection;
        } else if (normalizedServiceType === "clinic") {
            sortField["clinic.charges"] = sortDirection;
        } else {
            sortField["createdAt"] = -1;
        }

        const pipeline = [
            { $match: matchConditions },
            { $sort: sortField },
            { $skip: parseInt(skip) || 0 },
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
        if (planType && planType !== "null" && planType !== "") {
            const parsedPlanType = parseInt(planType);
            if (!isNaN(parsedPlanType)) {
                pipeline.splice(7, 0, {
                    $match: { "plan.planType": parsedPlanType }
                });
            }
        }

        const populatedPhysios = await Physio.aggregate(pipeline);
        // console.log("Matched physios count:", populatedPhysios.length);

        if (CheckError === false) {
            sortedPhysios = await addTravelDistance(populatedPhysios, latitude, longitude, true, false);
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



const DemoPhysio = async (req, res) => {
    try {

        upload(req, res, async (err) => {
            const data = req.body;

            //   return console.log(data.clinic.workingDays)
            const physio = await Physio.findById(data.physioId);
            if (!physio) {
                return res.status(400).json({
                    message: "No physio exists with this Id",
                });

            }

            //  if profile image is uploaded and thePhysio.profileImage is not null then delete the previous image
            if (req.files && req.files.profileImage) {
                let profileImage = physio.profileImage ? physio.profileImage : "";
                if (profileImage && fs.existsSync(path.join(root, `/public/uploads/Physio/${profileImage}`))) {
                    fs.unlinkSync(path.join(root, `/public/uploads/Physio/${profileImage}`));
                }
            }
            // if degreeImage is uploaded and physio.degreeImage is not null then delete the previous image
            if (req.files && req.files.degreeImage) {
                let degreeImage = physio.degreeImage ? physio.degreeImage : "";
                if (degreeImage && fs.existsSync(path.join(root, `/public/uploads/Physio/${degreeImage}`))) {
                    fs.unlinkSync(path.join(root, `/public/uploads/Physio/${degreeImage}`));
                }
            }
            // if iapImage is uploaded and physio.iapImage is not null then delete the previous image
            if (req.files && req.files.iapImage) {
                let iapImage = physio.iapImage ? physio.iapImage : "";
                if (iapImage && fs.existsSync(path.join(root, `/public/uploads/Physio/${iapImage}`))) {
                    fs.unlinkSync(path.join(root, `/public/uploads/Physio/${iapImage}`));
                }
            }
            // if imagesClinic multiple images are uploaded and physio.clinic.imagesClinic is not null then delete the previous images
            // console.log("imagesClinic",req.files.imagesClinic)
            if (req.files && req.files.imagesClinic) {
                let imagesClinic = physio.clinic.imagesClinic ? physio.clinic.imagesClinic : [];
                imagesClinic.map(i => {
                    if (i && fs.existsSync(path.join(root, `/public/uploads/Physio/${i}`))) {
                        fs.unlinkSync(path.join(root, `/public/uploads/Physio/${i}`));
                    }
                });
            }

            // if check degree
            if (req.body.degree) {
                const checkDegree = await Degree.findById(req.body.degree)
                if (!checkDegree) {
                    return res.status(400).json({
                        message: "Degree not found",
                        status: 400,
                        success: false,
                    })
                }
            }


            const updatedData = await Physio.findByIdAndUpdate(physio._id, {
                profileImage: req.files.profileImage ? req.files.profileImage[0].filename : physio.profileImage,
                fullName: data.fullName ? data.fullName : physio.fullName,
                dob: data.dob ? data.dob : physio.dob,
                email: data.email ? data.email : physio.email,
                about: data.about ? data.about : physio.about,
                degree: data.degree ? data.degree : physio.degree,
                specialization: data.specialization ? data.specialization : physio.specialization,
                workExperience: data.workExperience ? data.workExperience : physio.workExperience,
                degreeImage: req.files.degreeImage ? req.files.degreeImage[0].filename : physio.degreeImage,
                iapMember: data.iapMember ? data.iapMember : physio.iapMember,
                iapNumber: data.iapNumber ? data.iapNumber : physio.iapNumber,
                iapImage: req.files.iapImage ? req.files.iapImage[0].filename : physio.iapImage,
                serviceType: data.serviceType ? data.serviceType : physio.serviceType,

                clinic: {
                    status: 0,
                    name: data.clinic ? data.clinic.name : physio.clinic.name,
                    address: data.clinic ? data.clinic.address : physio.clinic.address,
                    workingDays: data.clinic ? data.clinic.workingDays : physio.clinic.workingDays,
                    timings: {
                        start: data.clinic ? data.clinic.timings.start : physio.clinic.timings.start,
                        end: data.clinic ? data.clinic.timings.end : physio.clinic.timings.end
                    },
                    duration: data.clinic ? data.clinic.duration : physio.clinic.duration,
                    charges: data.clinic ? data.clinic.charges : physio.clinic.charges,
                    imagesClinic: req.files.imagesClinic ? req.files.imagesClinic.map(i => i.filename) : thePhysio.clinic.imagesClinic,

                },
                home: {
                    status: 0,
                    workingDays: data.home ? data.home.workingDays : physio.home.workingDays,
                    mode: data.home ? data.home.mode : physio.home.mode,
                    timings: {
                        start: data.home ? data.home.timings.start : physio.home.timings.start,
                        end: data.home ? data.home.timings.end : physio.home.timings.end
                    },
                    duration: data.home ? data.home.duration : physio.home.duration,
                    charges: data.home ? data.home.charges : physio.home.charges
                },
                online: {
                    status: 0,
                    workingDays: data.online ? data.online.workingDays : physio.online.workingDays,
                    mode: data.online ? data.online.mode : physio.online.mode,
                    timings: {
                        start: data.online ? data.online.timings.start : physio.online.timings.start,
                        end: data.online ? data.online.timings.end : physio.online.timings.end
                    },
                    duration: data.online ? data.online.duration : physio.online.duration,
                    charges: data.online ? data.online.charges : physio.online.charges
                },
                latitude: data.latitude ? data.latitude : physio.latitude,
                longitude: data.longitude ? data.longitude : physio.longitude,
                activeStatus: data.activeStatus ? data.activeStatus : physio.activeStatus,
                accountStatus: data.accountStatus ? data.accountStatus : physio.accountStatus,

            }, {
                new: true
            });

            return res.status(200).json({
                message: "Profile updated successfully",
                status: true,
                success: true,
                data: updatedData
            });

        })

    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong please try again later",
            status: 500,
            success: false,
        });
    }
};
const toggleOnlineOfflinePhysio = async (req, res) => {
    const physioId = req.params.physioId
    const activeStatus = req.query.activeStatus
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.json({
            status: false,
            message: "physio not found"
        })
    } else {
        const updated = await Physio.findByIdAndUpdate(physioId, {
            activeStatus: activeStatus
        }, {
            new: true
        })
        res.json({
            status: true,
            message: "active status updated",
            data: updated
        })
    }
}
const getAllPhysiosRequest = async (req, res) => {
    try {
        const skip = req.query.skip || 0
        const limit = req.query.limit || 0
        const thePhysios = await Physio.find({ accountStatus: 1 }).skip(skip).limit(limit)
        return res.json({
            status: true,
            message: "data Returned",
            data: thePhysios
        })
    } catch (error) {
        return res.status(400).json({
            status: false,
            message: "Error fetching physios"
        });
    }
}

const physioDashboardKpis = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no physio exist with this id"
        })
    } else {
        const theWallet = await Wallet.findOne({
            physioId: physioId
        })
        const theAppointment = await Appointment.find({
            physioId: physioId,
            status: 1
        })
        const filteredAppointment = await theAppointment.filter(i => {
            //   return new Date(Number(i.date)).getDate()===new Date().getDate()
            const appointmentDate = new Date(Number(i.date));
            const currentDate = new Date();
            return (
                appointmentDate.getDate() === currentDate.getDate() &&
                appointmentDate.getMonth() === currentDate.getMonth() &&
                appointmentDate.getFullYear() === currentDate.getFullYear()
            );
        })
        if (!theAppointment) {
            res.status(400).json({
                status: false,
                message: "no appointments find"
            })
        }
        res.status(200).json({
            status: true,
            message: "data Returned",
            appointments: filteredAppointment.length,
            balance: theWallet.balance
        })
    }

}

const todayAppointmentPhysio = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no physio exist with this id"
        })
    } else {
        const theAppointment = await Appointment.find({
            physioId: physioId,
            status: 0
        }).lean()
        const filteredAppointment = await theAppointment.filter(i => {
            const appointmentDate = new Date(Number(i.date));
            const currentDate = new Date();

            return (
                appointmentDate.getDate() === currentDate.getDate() &&
                appointmentDate.getMonth() === currentDate.getMonth() &&
                appointmentDate.getFullYear() === currentDate.getFullYear()
            );

        })
        if (theAppointment.length == 0) {
            res.status(400).json({
                status: false,
                message: "no appointments find"
            })
        }
        const promises = await filteredAppointment.map(async j => {
            const thePatient = await Patient.findById(j.patientId)
            j.patientImage = thePatient.profilePhoto
            // j.address = thePatient.clinic.address
        })
        await Promise.all(promises);
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: filteredAppointment
        })
    }
}

const AllAppointmentPhysio = async (req, res) => {
    const seacrhQuery = req.query.seacrhQuery
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no physio exist with this id"
        })
    } else {
        const theAppointment = await Appointment.find({
            physioId: physioId,
            $or: [{
                fullName: {
                    $regex: new RegExp(seacrhQuery, 'i')
                }
            },
            {
                phone: {
                    $regex: new RegExp(seacrhQuery, 'i')
                }
            }
            ]
        }).lean()
        if (theAppointment.length == 0) {
            res.status(400).json({
                status: false,
                message: "no appointments find"
            })
        }
        const promises = await theAppointment.map(async j => {
            const thePatient = await Patient.findById(j.patientId)
            j.patientImage = thePatient.profilePhoto
            j.address = thePhysio.clinic.address
        })
        await Promise.all(promises);
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: theAppointment
        })
    }
}

const AllUpcomingAppointment = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no physio exist with this id"
        })
    } else {
        const theAppointment = await Appointment.find({
            physioId: physioId,
            status: 1
        }).lean()
        if (theAppointment.length == 0) {
            res.status(400).json({
                status: false,
                message: "no appointments find"
            })
        }
        const promises = await theAppointment.map(async j => {
            const thePatient = await Patient.findById(j.patientId)
            j.patientData = thePatient
            j.physioData = thePhysio
            j.patientImage = thePatient.profilePhoto
            j.address = thePhysio.clinic.address
        })
        await Promise.all(promises);
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: theAppointment
        })
    }
}

const AllCompletedAppointment = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no physio exist with this id"
        })
    } else {
        const theAppointment = await Appointment.find({
            physioId: physioId,
            status: 1
        }).lean()
        if (theAppointment.length == 0) {
            res.status(400).json({
                status: false,
                message: "no appointments find"
            })
        }
        const promises = await theAppointment.map(async j => {
            const thePatient = await Patient.findById(j.patientId)
            j.patientData = thePatient
            j.physioData = thePhysio
            j.patientImage = thePatient.profilePhoto
            j.address = thePhysio.clinic.address
        })
        await Promise.all(promises);
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: theAppointment
        })
    }
}

const allAppointmentRequest = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no physio exist with this id"
        })
    } else {
        const theAppointment = await Appointment.find({
            physioId: physioId,
            status: 0
        })
        if (theAppointment.length == 0) {
            res.status(400).json({
                status: false,
                message: "no appointments find"
            })
        }
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: theAppointment
        })
    }
}

const WritePreceptionNotes = async (req, res) => {
    const appointmentId = req.params.appointmentId
    physioNotes = req.body.physioNotes
    const theAppointment = await Appointment.findById(appointmentId)
    if (!theAppointment) {
        res.status(400).json({
            status: false,
            message: "no appointment Exist with this id"
        })
    } else {
        const updatedData = await Appointment.findByIdAndUpdate(appointmentId, {
            physioNotes: physioNotes
        }, {
            new: true
        })

        res.status(200).json({
            status: true,
            message: "notes added succesfully",
            data: updatedData
        })
    }
}

const startConsultationOtp = async (req, res) => {
    const appointmentId = req.params.appointmentId
    // const phone =req.body.phone
    const theAppointment = await Appointment.findById(appointmentId)
    const thePatient = await Patient.findById(theAppointment.patientId)
    if (!theAppointment) {
        res.status(400).json({
            status: false,
            message: "no appointment find"
        })
    } else {
        //     const response=await msg91otp.send(theAppointment.phone)
        // // res.json(response)

        //  if(response.type==="success"){
        res.status(200).json({
            status: true,
            message: "otp sent successfully"
        })
        //  }else{
        //   res.status(200).json({status:true,message:"otp not sent"})
        //  }
        //     res.status(200).json({ status: true, message: "otp sent successfully" })
    }

}

const verifyConsultationOtp = async (req, res) => {
    const otp = req.body.otp
    const appointmentId = req.body.appointmentId
    // const phone =req.body.phone
    try {
        const theAppointment = await Appointment.findById(appointmentId)
        // if (otp == "1234") {
        //     res.status(200).json({ status: true, message: "otp verified successfully" })
        // } else {
        // res.status(400).json({ status: false, message: "entered wrong otp" })
        // const response = await msg91otp.verify(theAppointment.phone,otp)
        // if(response.type==="success"){
        if (otp === "1234") {
            res.status(200).json({
                status: true,
                message: "otp verified successfully"
            })
        } else {
            res.status(400).json({
                status: true,
                message: "entered wrong otp"
            })
        }
        // }
    } catch (er) {
        res.status(400).json({
            status: true,
            message: "entered wrong otp"
        })
    }
}

const startTreatment = async (req, res) => {
    const physioId = req.params.doctorId
    const appointmentId = req.body.appointmentId
    const dates = req.body.dates
    const from = req.body.from
    const to = req.body.to
    const mode = req.body.mode
    const feePerDay = req.body.feePerDay
    const notes = req.body.notes
    const thePhysio = await Physio.findById(physioId)
    const theAppointment = await Appointment.findById(appointmentId)
    const thePatient = await Patient.findById(theAppointment.patientId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no doctor exists with this Id"
        })
    } else if (!theAppointment) {
        res.status(400).json({
            status: false,
            message: "no appointment exists with this Id"
        })
    } else {
        const theTreatment = await Treatment.findOne({
            appointmentId: appointmentId
        })
        if (theTreatment) {
            res.status(400).json({
                status: false,
                message: "treatment already scheduled for this appointment"
            })
        } else {
            const updatedAppointment = await Appointment.findByIdAndUpdate(appointmentId, {
                isTreatmentScheduled: true
            }, {
                new: true
            })
            const newTreatment = await new Treatment({
                appointmentId: appointmentId,
                physioId: physioId,
                patientId: theAppointment.patientId,
                dates: dates,
                timing: {
                    from: from,
                    to: to
                },
                mode: mode,
                feePerDay: feePerDay,
                notes: notes,
                status: 0,
                paidPayments: [],
                createdAt: new Date()
            })
            await newTreatment.save()
            let title = "Treatment Started"
            let body = `${thePhysio.fullName} just Scheduled your treatment`
            // await sendNotification(thePatient.deviceId, theAppointment.patientId, title, body, newTreatment._id)
            res.status(201).json({
                status: true,
                message: "treatment created successfully",
                data: newTreatment
            })
        }
    }
}

const updateAppointmentStatus = async (req, res) => {
    const appointmentId = req.params.appointmentId
    const theAppointment = await Appointment.findById(appointmentId)
    if (!theAppointment) {
        res.status(400).json({
            status: false,
            message: "no appointment with this id exists"
        })
    } else {
        const theTreatment = await Treatment.findOne({
            appointmentId: appointmentId
        })

        const updatedAppointment = await Appointment.findByIdAndUpdate(appointmentId, {
            status: req.body.status,
            notes: req.body.notes
        }, {
            new: true
        })
        if (theTreatment) {
            await Treatment.findByIdAndUpdate(theTreatment._id, {
                status: 1
            }, {
                new: true
            })
        } else {

        }
        res.status(200).json({
            status: true,
            message: "status updated successfully",
            data: updatedAppointment
        })
    }
}

const allPatientListByPhysio = async (req, res) => {
    const patientId = []
    const physioId = req.params.physioId
    const theAppointments = await Appointment.find({
        physioId: physioId
    })
    theAppointments.map(i => {
        return patientId.push(i.patientId)

    })
    const uniqueArray = [...new Set(patientId)]
    uniqueArray.map(async j => {
        const thePatient = await Patient.find({
            _id: j
        }).lean()
        const promises = await thePatient.map(async k => {
            const theAppointment = await Appointment.find({
                patientId: k._id
            })
            k.appointment = theAppointment
        })
        await Promise.all(promises);
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: thePatient
        })
    })
}

const updatePrecptionNotes = async (req, res) => {
    const appointmentId = req.params.appointmentId
    const physioNotes = req.body.physioNotes
    const theAppointment = await Appointment.findById(appointmentId)
    if (!theAppointment) {
        res.status(400).json({
            status: false,
            message: "no appointment exists with this Id"
        })
    } else {
        const updatedData = await Appointment.findByIdAndUpdate(appointmentId, {
            physioNotes: physioNotes
        }, {
            new: true
        })
        res.status(200).json({
            status: true,
            message: "notes updated successfully",
            data: updatedData
        })
    }
}

const getTreatmentByPhysio = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no patient exists with this Id"
        })
    } else {
        const theTreatment = await Treatment.find({
            physioId: physioId
        }).lean()
        const promises = theTreatment.map(async i => {
            const theAppointment = await Appointment.findById(i.appointmentId)
            const thePatient = await Patient.findById(i.patientId)
            i.patientName = thePatient.fullName
            i.patientImage = thePatient.profilePhoto
            i.patientAge = thePatient.age
            i.patientGender = thePatient.gender
            i.patientNotes = theAppointment.notes
        })
        await Promise.all(promises);
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: theTreatment
        })
    }
}

const getTreatmentByPhysioRunning = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no patient exists with this Id"
        })
    } else {
        const theTreatment = await Treatment.find({
            physioId: physioId,
            status: 0
        }).lean()
        const promises = theTreatment.map(async i => {
            const theAppointment = await Appointment.findById(i.appointmentId)
            const thePatient = await Patient.findById(i.patientId)
            i.patientName = thePatient.fullName
            i.patientImage = thePatient.profilePhoto
            i.patientAge = thePatient.age
            i.patientGender = thePatient.gender
            i.patientNotes = theAppointment.notes
        })
        await Promise.all(promises);
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: theTreatment
        })
    }
}
const getTreatmentByPhysioCompleted = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "no patient exists with this Id"
        })
    } else {
        const theTreatment = await Treatment.find({
            physioId: physioId,
            status: 1
        }).lean()
        const promises = theTreatment.map(async i => {
            const theAppointment = await Appointment.findById(i.appointmentId)
            const thePatient = await Patient.findById(i.patientId)
            i.patientName = thePatient.fullName
            i.patientImage = thePatient.profilePhoto
            i.patientAge = thePatient.age
            i.patientGender = thePatient.gender
            i.patientNotes = theAppointment.notes
        })
        await Promise.all(promises);
        res.status(200).json({
            status: true,
            message: "data Returned",
            data: theTreatment
        })
    }
}
const getSingleTreatment = async (req, res) => {
    const treatmentId = req.params.treatmentId
    const i = await Treatment.findById(treatmentId).lean()

    const thePatient = await Patient.findById(i.patientId)
    i.patientName = thePatient.fullName
    i.patientImage = thePatient.profilePhoto
    i.age = thePatient.age
    i.gender = thePatient.gender
    res.status(200).json({
        status: true,
        message: "data Returned",
        data: i
    })
}


const getPreceptionNotesByPhysio = async (req, res) => {
    const appointmentId = req.params.appointmentId
    const theAppointment = await Appointment.findById(appointmentId)
    if (!theAppointment) {
        res.status(400).json({
            status: false,
            message: "no appointment exists with this Id"
        })
    } else {
        res.json({
            status: true,
            message: "data Returned",
            data: {
                physioNotes: theAppointment.physioNotes
            }
        })
    }
}

const deletePhysios = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    const theWallet = await Wallet.findOne({
        physioId: physioId
    })
    if (!thePhysio) {
        res.status(400).json({
            status: false,
            message: "No physio exists with this Id"
        })
    } else {
        await Physio.findByIdAndDelete(physioId)
        await Appointment.deleteMany({
            physioId: physioId
        })
        await Slot.deleteMany({
            physioId: physioId
        })
        await Review.deleteMany({
            physioId: physioId
        })
        await Transaction.deleteMany({
            walletId: theWallet._id
        })
        await Wallet.deleteOne({
            physioId: physioId
        })
        await Request.deleteMany({
            physioId: physioId
        })
        await Treatment.deleteMany({
            physioId: physioId
        })
    }
    res.status(200).json({
        status: true,
        message: "Physio deleted successfully"
    })
}

const getPhysioByPreferId = async (req, res) => {
    const preferId = req.params.preferId
    const patientId = req.query.patientId

    // const thePatient = Patient.find({patientId})

    const thePhysio = await Physio.findOne({
        preferId: preferId
    }).lean().populate('specialization degree');

    if (!thePhysio) {

        res.status(400).json({
            status: false,
            message: "user does not exists"
        })
    } else {
        const theAppointment = await Appointment.find({
            patientId: patientId,
            physioId: thePhysio._id
        }).lean()
        const theTreatment = await Treatment.find({
            patientId: patientId,
            physioId: thePhysio._id
        }).lean()
        const theAppointmentCount = await Appointment.find({
            physioId: thePhysio._id
        }).count()
        const theReviews = await Review.find({
            physioId: thePhysio._id
        }).count()

        thePhysio.Appointments = theAppointment
        thePhysio.Treatments = theTreatment
        thePhysio.totalConsult = theAppointmentCount
        thePhysio.totalPatients = theAppointmentCount
        thePhysio.ReviewsCount = theReviews

        res.json({
            status: true,
            message: "data Returned",
            data: thePhysio
        })
    }
}

const getYourQrCode = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.json({
            status: false,
            message: "physio not found"
        })
    } else {
        qrCode = `${process.env.BASE_URL}/preferId=${thePhysio.preferId}`
        res.json({
            status: true,
            message: "Url Generated",
            url: qrCode
        })
    }
}

const specialization = async (req, res) => {
    try {
        const specialization = await Specialization.find()
        return res.status(200).json({
            status: true,
            message: "Specialization fetched successfully",
            data: specialization
        })


    } catch (error) {
        res
            .status(400)
            .json({
                status: false,
                message: "Error fetching specialization"
            })
    }
}


// Physio clinic , home and online visit on Physio Get Profile
const getOnlinePhysioProfile = async (req, res) => {

    try {
        const physioId = req.params.physioId

        const thePhysio = await Physio.findById(physioId)
        if (!thePhysio) {
            res.status(400).json({
                status: false,
                message: "no physio exists with this Id"
            })
        }

        // statusClinc, statusHome, statusOnline
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Something went wrong please try again later",
            status: 500,
            success: false,
        });
    }
}


// create QrCode for physio
// const getPhysioQrCode = async (req, res) => {
//     try {
//         let preferId = req.params.preferId;

//         if (!preferId) {
//             return res.status(400).json({
//                 message: "Prefer Id is required",
//                 status: 400,
//                 success: false,
//             });
//         }

//         const physio = await Physio.findOne({
//             _id: preferId
//         });

//         if (!physio) {
//             return res.status(400).json({
//                 message: "Physio not found",
//                 status: 400,
//                 success: false,
//             });
//         }


//         // Generate QrCode
//         const qrCodeData = await QRCode.toDataURL(`Physio ID: ${physio._id}`);

//         return res.status(200).json({
//             message: "QR Code generated successfully",
//             status: 200,
//             success: true,
//             qrCode: qrCodeData,
//         });

//     } catch (error) {
//         console.log(error)
//         return res.status(500).json({
//             message: "Something went wrong please try again later",
//             status: 500,
//             success: false,
//         });

//     }
// };

// Get physio by preferId
const getPhysioByPreferIds = async (req, res) => {
    try {
        const preferId = req.query.preferId;

        if (!preferId) {
            return res.status(400).json({
                message: "Prefer Id is required",
                status: 400,
                success: false,
            });
        }

        const physio = await Physio.findOne({
            preferId: preferId
        }).populate('specialization degree');

        if (!physio) {
            return res.status(400).json({
                message: "Physio not found",
                status: 400,
                success: false,
            });
        }

        return res.status(200).json({
            message: "Physio fetched successfully",
            status: 200,
            success: true,
            data: physio
        });

    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong please try again later",
            status: 500,
            success: false,
        });
    }
};


const getPhysioByFilter = async (req, res) => {
    try {
        const { longitude, latitude, limit = 10, page = 1, mpt = false, rating, serviceType, specialization, searchQuery, planType, sortOrder } = req.query;

        if (!longitude || !latitude) {
            return res.status(400).json({
                status: false,
                message: "Longitude and Latitude are required"
            });
        }

        const skip = (page - 1) * limit;
        let filter = { accountStatus: 1, isBlocked: false }
        let sortViaDistance = true;

        // Search Query
        if (searchQuery) {
            const specializations = await Specialization.find({
                name: { $regex: searchQuery, $options: 'i' }
            });
            const specializationIds = specializations.map(spec => spec._id);

            filter.$or = [
                { fullName: { $regex: searchQuery, $options: 'i' } },
                { specialization: { $in: specializationIds } }
            ];
        }

        if (rating) {
            const ratingValue = parseInt(rating, 10);
            filter.$expr = { $eq: [{ $floor: "$rating" }, ratingValue] };
            sortViaDistance = false;
        }

        if (mpt == "true") {
            filter["mptDegree.degreeId"] = { $nin: [null, ""] };
        }

        // Service Type Filter
        if (serviceType) {
            filter.serviceType = serviceType;
        }

        // Specialization Filter
        if (specialization) {
            filter.specialization = new mongoose.Types.ObjectId(specialization)
        }

        // Sorting Logic
        let sortField = {};
        if (serviceType === "clinic" && sortOrder !== "") {
            sortField["clinic.charges"] = sortOrder === "desc" ? -1 : 1;
            sortViaDistance = false;


        } else if (serviceType === "home" && sortOrder !== "") {
            sortField["home.charges"] = sortOrder === "desc" ? -1 : 1;
        }

        let city = await getCityFromCoordinates(latitude, longitude)

        if (city) {
            filter.city = new RegExp("^" + city + "$", "i");
        }

        const pipeline = [
            { $match: filter },
            ...(Object.keys(sortField).length > 0 ? [{ $sort: sortField }] : []),
            // { $skip: skip },
            // { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: "specializations",
                    localField: "specialization",
                    foreignField: "_id",
                    as: "specialization"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "subscriptionId",
                    foreignField: "_id",
                    as: "subscription"
                }
            },
            {
                $lookup: {
                    from: "plans",
                    localField: "subscription.planId",
                    foreignField: "_id",
                    as: "plan"
                }
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
                    as: "reviews"
                }
            },
            {
                $addFields: {
                    reviewCount: { $size: "$reviews" }
                }
            },
        ];

        // Conditionally add the planType match
        if (planType != "null" && planType != "") {
            pipeline.splice(7, 0, {
                $match: {
                    "plan.planType": parseInt(planType)
                }
            });
        }

        const physios = await Physio.aggregate(pipeline);
        const sortedPhysios = await addTravelDistance(physios, latitude, longitude, sortViaDistance, false)

        res.json({
            status: true,
            data: sortedPhysios,
            currentPage: parseInt(page)
        });

    } catch (error) {
        console.error("Error in getPhysioByFilter:", error);
        res.status(500).json({
            status: false,
            message: "Error fetching physiotherapists",
            error: error.message
        });
    }
};

const demoGetPhysioByFilter = async (req, res) => {
    try {
        const { longitude, latitude, limit = 10, page = 1, rating, serviceType, specialization, searchQuery, sortOrder } = req.query;

        if (!longitude || !latitude) {
            return res.status(400).json({
                status: false,
                message: "Longitude and Latitude are required"
            });
        }

        const skip = (page - 1) * limit;
        let filter = { accountStatus: 1, isBlocked: false }

        // Search Query
        if (searchQuery) {
            const specializations = await Specialization.find({
                name: { $regex: searchQuery, $options: 'i' }
            });
            const specializationIds = specializations.map(spec => spec._id);

            filter.$or = [
                { fullName: { $regex: searchQuery, $options: 'i' } },
                { city: { $regex: searchQuery, $options: 'i' } },
                { state: { $regex: searchQuery, $options: 'i' } },
                { specialization: { $in: specializationIds } }
            ];
        }

        if (rating) {
            const ratingValue = parseInt(rating, 10);
            filter.$expr = { $eq: [{ $floor: "$rating" }, ratingValue] };
        }

        // Service Type Filter
        if (serviceType) {
            filter.serviceType = serviceType;
        }

        // // Specialization Filter
        if (specialization) {
            filter.specialization = specialization;
        }

        // Sorting Logic
        let sortField = {};
        if (serviceType === "clinic") {
            sortField["clinic.charges"] = sortOrder === "desc" ? -1 : 1;

        } else if (serviceType === "home") {
            sortField["home.charges"] = sortOrder === "desc" ? -1 : 1;
        }

        // Fetch Physios
        const physios = await Physio.find(filter)
            .populate("specialization subscriptionId")
            .populate({
                path: "subscriptionId",
                populate: {
                    path: "planId",
                    model: "Plan"
                }
            })
            .sort(sortField)
            .limit(parseInt(limit))
            .skip(skip);

        if (physios.length === 0) {
            return res.status(404).json({
                status: false,
                message: "No physiotherapists found"
            });
        }

        const apiKey = process.env.GOOGLE_MAPS;

        // Create Google Distance Matrix API Request
        const destinations = physios
            .map(physio => `${physio.location.coordinates[1]},${physio.location.coordinates[0]}`)
            .join("|");

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${latitude},${longitude}&destinations=${destinations}&mode=driving&key=${apiKey}`;

        // Call Google Distance Matrix API
        const response = await axios.get(url);
        const distances = response.data.rows[0].elements;

        // Attach Distance & Duration to Physios
        const updatedPhysios = physios.map((physio, index) => ({
            ...physio.toObject(),
            travelDistance: distances[index].distance?.text || "N/A",
            travelDuration: distances[index].duration?.text || "N/A"
        }));

        // Count Total Physios
        const total = await Physio.countDocuments(filter);

        await Promise.all(
            updatedPhysios.map(async (physio) => {
                const reviewCount = await Review.countDocuments({ physioId: physio._id });
                Object.assign(physio, { reviewCount }); // Adds field directly
            })
        );

        // Send Response
        res.json({
            status: true,
            data: updatedPhysios,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error("Error in getPhysioByFilter:", error);
        res.status(500).json({
            status: false,
            message: "Error fetching physiotherapists",
            error: error.message
        });
    }
};


// find by physio 5 km reng 
const getFilteredPhysios = async (req, res) => {
    try {
        const { latitude, longitude, distance } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                message: "Latitude and longitude are required",
                success: false,
            });
        }

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        const dis = parseFloat(distance);
        const maxDistanceInMeters = dis * 1000;

        //   console.log(lat, lon, dis, maxDistanceInMeters);

        const physios = await Physio.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [lon, lat] },
                    distanceField: "distance",
                    maxDistance: maxDistanceInMeters,
                    spherical: true,
                },
            },
        ]);

        res.status(200).json({
            message: "Physios fetched successfully",
            success: true,
            data: physios,
        });
    } catch (error) {
        console.error("Error fetching physios:", error);
        res.status(500).json({
            message: "Something went wrong, please try again later",
            success: false,
        });
    }
};





module.exports = getPhysioByFilter;



module.exports = {
    signUpPhysioOtp,
    loginPhysioOtp,
    // verifyOtpPhysio,
    resendOtp,
    getSinglePhysioById,
    getAllPhysios,
    physioDashboardKpis,
    todayAppointmentPhysio,
    AllAppointmentPhysio,
    startTreatment,
    startConsultationOtp,
    verifyConsultationOtp,
    updateAppointmentStatus,
    allAppointmentRequest,
    allPatientListByPhysio,
    WritePreceptionNotes,
    AllUpcomingAppointment,
    updatePrecptionNotes,
    getTreatmentByPhysio,
    getSingleTreatment,
    editPhysioProfile,
    getPreceptionNotesByPhysio,
    deletePhysios,
    getPhysioByPreferId,
    getAllPhysiosRequest,
    getYourQrCode,
    getTreatmentByPhysioRunning,
    getTreatmentByPhysioCompleted,
    AllCompletedAppointment,
    toggleOnlineOfflinePhysio,
    specialization,
    getPhysioByFilter,
    demoGetPhysioByFilter,
    DemoPhysio,
    getPhysioByPreferIds,
    // sendOtpToPhysio,
    // patientverifyOtp
    getFilteredPhysios,
}

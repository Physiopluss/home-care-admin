const PhysioProfileEdit = require('../../models/physioProfileEdit');
const Physio = require('../../models/physio');
const moment = require('moment-timezone');
const multer = require('multer');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Notification = require('../../models/notification');
const { toArray } = require('../../utility/helper');
const { uploadFileToS3, deleteFileFromS3 } = require('../../services/awsService');
const { sendFCMNotification } = require('../../services/fcmService');
const { redisClient, CACHE_EXPIRATION } = require('../../utility/redisClient');

const storage = multer.memoryStorage();

// upload function
const upload = multer({ storage: storage }).fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'degreeImage', maxCount: 5 },
    { name: 'iapImage', maxCount: 1 },
    { name: 'imagesClinic', maxCount: 10 },
    { name: 'achievementImages', maxCount: 10 },
]);

const isValid = val => val !== null && val !== undefined && val !== "";


// Get physioProfile
exports.getPhysioProfileEdit = async (req, res) => {
    try {
        const { status, date, physioId, cache = false } = req.query;
        let filter = {};

        if (physioId && mongoose.Types.ObjectId.isValid(physioId)) {
            filter.physioId = physioId;
        }

        if (status) {
            filter.status = status;
        }

        if (date) {
            const startOfDay = moment(date).tz('Asia/Kolkata').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
            const endOfDay = moment(date).tz('Asia/Kolkata').endOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
            filter.updatedAt = { $gte: startOfDay, $lte: endOfDay };
        }

        let cacheKey = null;
        if (cache && physioId === "null") {
            const keys = {
                status,
                date
            }

            // Redis Cache Key Hash
            const hash = crypto.createHash('sha256').update(JSON.stringify(keys)).digest('hex');
            cacheKey = `admin:getPhysioProfileEdit:${hash}`;

            // Check if data exists in Redis
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log("> Returning cached data (Admin getPhysioProfileEdit)");

                return res.status(200).json({
                    message: "All Profile Edit Request",
                    success: true,
                    data: JSON.parse(cachedData),
                });
            }
        }

        const physioProfileEdit = await PhysioProfileEdit.find(filter).populate('physioId');

        if (physioProfileEdit && cache && physioId === "null") {
            await redisClient.set(cacheKey, JSON.stringify(physioProfileEdit), { EX: CACHE_EXPIRATION.ONE_HOUR });
        }

        return res.status(200).json({
            message: "All Profile Edit Request",
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


// update status
exports.updateStatus = async (req, res) => {
    try {
        const { physioProfileId, status, message } = req.body;

        if (!physioProfileId) {
            return res.status(400).json({
                message: 'physioProfileId is required',
                success: false,
            });
        }

        if (!mongoose.Types.ObjectId.isValid(physioProfileId)) {
            return res.status(400).json({
                message: 'physioProfileId is invalid',
                success: false,
            });
        }

        if (!status) {
            return res.status(400).json({
                message: 'Status is required',
                success: false,
            });
        }

        if (!message) {
            return res.status(400).json({
                message: 'Message is required',
                success: false,
            });
        }

        const physioProfileEdit = await PhysioProfileEdit.findByIdAndUpdate(
            physioProfileId,
            { status, message },
            { new: true }
        );

        if (!physioProfileEdit) {
            return res.status(404).json({
                message: 'Profile not found',
                success: false,
            });
        }

        const physio = await Physio.findByIdAndUpdate(
            physioProfileEdit.physioId,
            { edit: false },
            { new: true }
        )

        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
            });
        }

        let data = {
            physioId: physio._id.toString(),
            title: "Edit Request Profile",
            body: `Your profile edit request has been rejected.`,
            type: 'editRequest',
            from: 'admin',
            to: 'physio',
            for: 'physio'
        }

        if (physio.deviceId) {
            await sendFCMNotification(physio.deviceId, data);
        } else {
            await Notification.create({
                physioId: physio._id,
                title: data.title,
                message: data.body,
                type: data.type,
                from: data.from,
                to: data.to,
                for: data.for,
            })
        }

        if (status === 'rejected') {
            const imagesToDelete = [];

            if (physioProfileEdit.iapImage) imagesToDelete.push(physioProfileEdit.iapImage);

            if (physioProfileEdit.profileImage) imagesToDelete.push(physioProfileEdit.profileImage);

            if (physioProfileEdit.degree?.degreeImage?.length) {
                const physioDegreeImages = physio.degree?.degreeImage || [];
                const uniqueDegreeImages = physioProfileEdit.degree.degreeImage.filter(
                    (img) => img && !physioDegreeImages.includes(img)
                );
                imagesToDelete.push(...uniqueDegreeImages);
            }

            if (physioProfileEdit.clinic?.imagesClinic?.length) {
                const physioClinicImages = physio.clinic?.imagesClinic || [];
                const uniqueClinicImages = physioProfileEdit.clinic.imagesClinic.filter(
                    (img) => img && !physioClinicImages.includes(img)
                );
                imagesToDelete.push(...uniqueClinicImages);
            }

            if (physioProfileEdit.achievement?.length) {
                const physioAchievements = physio.achievement || [];
                const physioAchievementImages = physioAchievements.map(a => a.achievementImage);
                physioProfileEdit.achievement.forEach(a => {
                    if (a.achievementImage && !physioAchievementImages.includes(a.achievementImage)) {
                        imagesToDelete.push(a.achievementImage);
                    }
                });
            }

            // Delete each image from S3
            for (const imageUrl of imagesToDelete) {
                try {
                    await deleteFileFromS3(imageUrl);
                    console.log(`✅ Deleted from S3: ${imageUrl}`);
                } catch (error) {
                    console.error(`❌ Failed to delete: ${imageUrl}`, error.message);
                }
            }

            await PhysioProfileEdit.findByIdAndDelete(physioProfileId);
        }


        return res.status(200).json({
            message: 'Status updated successfully',
            success: true,
            data: physioProfileEdit,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500,
            error
        })
    }
};

//Get Single Profile
exports.getSinglePhysioProfile = async (req, res) => {
    try {
        const physioProfileId = req.query.Id;
        if (!physioProfileId) {
            return res.status(400).json({
                message: 'Physio Profile ID is required',
                success: false,
                status: 400
            });
        }
        const physioProfileEdit = await PhysioProfileEdit.findById(physioProfileId).populate('physioId')
        if (!physioProfileEdit) {
            return res.status(404).json({
                message: 'Profile not found',
                success: false,
            });
        }
        return res.status(200).json({
            message: 'Profile Get Success',
            success: true,
            data: physioProfileEdit,
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        })
    }
}


exports.editPhysioProfile = async (req, res) => {
    try {

        const physio = await Physio.findById(req.body.physioId)
        if (!physio) {
            return res.status(404).json({
                message: 'Physio Not Found',
                status: 404,
                success: false
            });
        }
        ``
        // Update physio profile

        const updatedPhysio = await Physio.findByIdAndUpdate(
            req.body.physioId,
            {
                physioId: req.body.physioId || physio._id,
                profileImage: req.body.profileImage ? req.body.profileImage : physio.profileImage || null,
                fullName: req.body.fullName || physio.fullName || null,
                email: req.body.email || physio.email || null,
                about: req.body.about || physio.about || null,
                treatedPatient: req.body.treatedPatients ? toArray(req.body.treatedPatients) : physio.treatedPatient || null,
                bptDegree: {
                    degreeId: req.body.bptDegreeId || physio.bptDegree.degreeId || null,
                    image: req.body.bptDegreeImage || physio.bptDegree.image || null
                },
                mptDegree: {
                    degreeId: req.body.mptDegreeId == "null" ? null : req.body.mptDegreeId || physio.mptDegree.degreeId,   // Degree Id can't be anything else than null or Degree Model Ids
                    image: req.body.mptDegreeImage || physio.mptDegree.image || null
                },
                specialization: req.body.specialization ? toArray(req.body.specialization) : physio.specialization || null,
                subspecializationId: req.body.subspecialization ? toArray(req.body.subspecialization) : physio.subspecialization || null,
                workExperience: isValid(req.body.workExperience) ? parseInt(req.body.workExperience) : physio.workExperience || null,
                iapMember: req.body.iapMember ? parseInt(req.body.iapMember) : physio.iapMember || null,
                iapNumber: req.body.iapNumber ? req.body.iapNumber : physio.iapNumber || null,
                iapImage: req.body.iapImage ? req.body.iapImage : physio.iapImage || null,
                treatInsuranceclaims: req.body.treatInsuranceclaims || physio.treatInsuranceclaims || null,
                country: req.body.country?.toLowerCase() || physio.country || null,
                state: req.body.state?.toLowerCase() || physio.state || null,
                city: req.body.city?.toLowerCase() || physio.city || null,
                home: {
                    workingDays: req.body.homeWorkingDays ? toArray(req.body.homeWorkingDays) : physio.home.workingDays || null,
                    charges: isValid(req.body.homeCharges) ? parseInt(req.body.homeCharges) : physio.home.charges || null,

                },
                gender: req.body.gender ? parseInt(req.body.gender) : physio.gender || null,
                language: req.body.language || physio.language || null,
                latitude: req.body.latitude || physio.latitude || null,
                longitude: req.body.longitude || physio.longitude || null,
                treatedPatient: req.body.treatedPatients != " " ? req.body.treatedPatients || physio.treatedPatient || null : []
            },
            {
                new: true
            }
        )

        // Send notification to admin
        let data = {
            physioId: physio._id.toString(),
            title: "Edit Request Profile",
            body: `Physio ${physio.fullName} has requested to edit their profile.`,
            type: 'editRequest',
            from: 'admin',
            to: 'physio',
            for: 'physio'
        }

        await sendFCMNotification("PlaceHolder", data, true);

        return res.status(200).json({
            message: 'Profile updated successfully',
            status: true,
            success: true,
            data: updatedPhysio
        });
        // });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message
        });
    }
};


// Physio Profile edit Approval
exports.physioProfileEditApproval = async (req, res) => {
    try {
        const { physioProfileEdit } = req.query;

        const physioProfile = await PhysioProfileEdit.findById(physioProfileEdit)

        if (!physioProfile) {
            return res.status(404).json({
                message: 'Physio profile Id not found',
                success: false,
                status: 404
            });
        }

        if (physioProfile.status === "approved") {
            return res.status(402).json({
                message: 'your profile is already approved',
                success: false,
            });
        }

        const physio = await Physio.findById(physioProfile.physioId)

        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        if (physioProfile.profileImage) {
            await deleteFileFromS3(physio.profileImage);
        }

        if (physioProfile.iapImage) {
            await deleteFileFromS3(physio.iapImage);
        }

        if (physioProfile.bptDegree?.image) {
            await deleteFileFromS3(physio.bptDegree.image);
        }

        if (physioProfile.mptDegree?.image) {
            await deleteFileFromS3(physio.mptDegree.image);
        }

        if (physioProfile.clinic?.imagesClinic?.length > 0) {
            const imagesToKeep = new Set(physioProfile.clinic.imagesClinic);

            const imagesToDelete = physio.clinic.imagesClinic.filter(
                image => !imagesToKeep.has(image)
            );

            await Promise.all(
                imagesToDelete.map(image => deleteFileFromS3(image))
            );
        }

        if (Array.isArray(physioProfile.achievement)) {
            const newAchievementImages = new Set(
                physioProfile.achievement.map((a) => a.achievementImage)
            );

            const imagesToDelete = (physio.achievement || [])
                .map((a) => a.achievementImage)
                .filter((url) => !newAchievementImages.has(url));

            await Promise.all(imagesToDelete.map((url) => deleteFileFromS3(url)));
        }


        if (physioProfile.degree?.degreeImage && physioProfile.degree?.degreeImage.length > 0) {
            const imagesToKeep = new Set(physioProfile.degree.degreeImage);

            const imagesToDelete = physio.degree.degreeImage.filter(
                image => !imagesToKeep.has(image)
            );

            await Promise.all(
                imagesToDelete.map(image => deleteFileFromS3(image))
            );
        }

        const resolveField = (input, fallback) => input === "__NULL__" ? null : (input || fallback);

        const updatePhysio = await Physio.findByIdAndUpdate(
            physio._id,
            {
                $set: {
                    profileImage: resolveField(physioProfile.profileImage, physio.profileImage),
                    fullName: resolveField(physioProfile.fullName, physio.fullName),
                    dob: resolveField(physioProfile.dob, physio.dob),
                    email: resolveField(physioProfile.email, physio.email),
                    about: resolveField(physioProfile.about, physio.about),

                    workExperience: isValid(physioProfile.workExperience) ? physioProfile.workExperience : physio.workExperience,

                    iapMember: [0, 1].includes(physioProfile.iapMember) ? physioProfile.iapMember : physio.iapMember,
                    iapNumber: resolveField(physioProfile.iapNumber, physio.iapNumber),
                    iapImage: resolveField(physioProfile.iapImage, physio.iapImage),

                    treatInsuranceclaims: resolveField(physioProfile.treatInsuranceclaims, physio.treatInsuranceclaims),
                    country: resolveField(physioProfile.country, physio.country),
                    state: resolveField(physioProfile.state, physio.state),
                    city: resolveField(physioProfile.city, physio.city),

                    bptDegree: {
                        degreeId: resolveField(physioProfile.bptDegree.degreeId, physio.bptDegree.degreeId),
                        image: resolveField(physioProfile.bptDegree.image, physio.bptDegree.image),
                    },
                    mptDegree: {
                        degreeId: physioProfile.mptDegree.degreeId == null ? null : resolveField(physioProfile.mptDegree.degreeId, physio.mptDegree.degreeId),
                        image: resolveField(physioProfile.mptDegree.image, physio.mptDegree.image),
                    },
                    serviceType: physioProfile.serviceType || physio.serviceType,
                    specialization: physioProfile.specialization || physio.specialization,
                    subspecializationId: physioProfile.subspecializationId || physio.subspecializationId,

                    clinic: {
                        name: resolveField(physioProfile.clinic.name, physio.clinic.name),
                        address: resolveField(physioProfile.clinic.address, physio.clinic.address),

                        timings: {
                            start: resolveField(physioProfile.clinic.timings.start, physio.clinic.timings.start),
                            end: resolveField(physioProfile.clinic.timings.end, physio.clinic.timings.end)
                        },

                        duration: isValid(physioProfile.clinic.duration) ? physioProfile.clinic.duration : physio.clinic.duration,
                        charges: isValid(physioProfile.clinic.charges) ? physioProfile.clinic.charges : physio.clinic.charges,
                        zipCode: isValid(physioProfile.clinic.zipCode) ? physioProfile.clinic.zipCode : physio.clinic.zipCode,

                        workingDays: physioProfile.clinic.workingDays || physio.clinic.workingDays,
                        imagesClinic: physioProfile.clinic.imagesClinic || physio.clinic.imagesClinic,
                    },
                    home: {
                        mode: physioProfile.home.mode || physio.home.mode,

                        workingDays: resolveField(physioProfile.home.workingDays, physio.home.workingDays),

                        morningTimings: {
                            start: resolveField(physioProfile.home.morningTimings.start, physio.home.morningTimings.start),
                            end: resolveField(physioProfile.home.morningTimings.end, physio.home.morningTimings.end),
                        },

                        eveningTimings: {
                            start: resolveField(physioProfile.home.eveningTimings.start, physio.home.eveningTimings.start),
                            end: resolveField(physioProfile.home.eveningTimings.end, physio.home.eveningTimings.end),
                        },

                        homeCity: resolveField(physioProfile.home.homeCity, physio.home.homeCity),
                        homeState: resolveField(physioProfile.home.homeState, physio.home.homeState),

                        duration: isValid(physioProfile.home.duration) ? physioProfile.home.duration : physio.home.duration,
                        charges: isValid(physioProfile.home.charges) ? physioProfile.home.charges : physio.home.charges,
                        consultationCharges10Km: isValid(physioProfile.home.consultationCharges10Km) ? physioProfile.home.consultationCharges10Km : physio.home.consultationCharges10Km,
                        zipCode: isValid(physioProfile.home.zipCode) ? physioProfile.home.zipCode : physio.home.zipCode,
                    },
                    achievement: physioProfile.achievement || physio.achievement,
                    latitude: isValid(physioProfile.latitude) ? physioProfile.latitude : physio.latitude,
                    longitude: isValid(physioProfile.longitude) ? physioProfile.longitude : physio.longitude,
                    // location: {
                    //     type: 'Point',
                    //     coordinates: [
                    //         isValid(physioProfile.longitude) ? physioProfile.longitude : physio.longitude,
                    //         isValid(physioProfile.latitude) ? physioProfile.latitude : physio.latitude
                    //     ]
                    // },
                    gender: isValid(physioProfile.gender) ? physioProfile.gender : physio.gender,
                    edit: false
                }
            },
            { new: true }
        )

        // physioProfile updates status approved
        physioProfile.status = "approved";
        await physioProfile.save();

        let data = {
            physioId: physio._id.toString(),
            title: "Edit Request Profile",
            body: `Your profile edit request has been approved and updated successfully.`,
            type: 'editRequest',
            from: 'admin',
            to: 'physio',
            for: 'physio'
        }

        if (physio.deviceId) {
            await sendFCMNotification(physio.deviceId, data);
        }

        return res.status(200).json({
            message: 'Physio profile approval updated successfully',
            success: true,
            status: 200,
            updatePhysio
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500,
            error: error.message
        });
    }
};

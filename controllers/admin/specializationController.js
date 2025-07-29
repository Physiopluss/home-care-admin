const Specialization = require('../../models/specialization')
const fs = require('fs')
const multer = require('multer')
const path = require('path')
// const AWS = require('aws-sdk')


// upload a file to s3
const storage = multer.diskStorage({
    filename(req, file, cb) {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
})
const upload = multer({
    storage: storage
}).single('icon')


// AWS S3 config
// const s3 = new AWS.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });

// Add a new Specialization
exports.addSpecialization = async (req, res) => {
    try {
        upload(req, res, async function (err) {
            if (err) {
                return res.status(400).json({
                    message: "Something went wrong",
                    status: 400,
                    success: false,
                    error: err.message
                });
            }

            let { name } = req.body;
            let icon = req.file;

            if (!name) {
                return res.status(400).json({
                    message: "All fields are required",
                    status: 400,
                    success: false
                });
            }

            // if title is already exist
            const checkSpecialization = await Specialization.findOne({ name: name });
            if (checkSpecialization) {
                return res.status(400).json({
                    message: "Specialization already exist",
                    status: 400,
                    success: false
                });
            }


            // Upload file to s3
            const params = {
                Bucket: `${process.env.AWS_BUCKET_NAME}/specialization`,
                Key: `${icon.filename}`,
                Body: fs.createReadStream(icon.path)
            };

            s3.upload(params, async (err, data) => {
                if (err) {
                    return res.status(400).json({
                        message: "Something went wrong",
                        status: 400,
                        success: false,
                        error: err.message
                    });
                }

                const specialization = new Specialization({
                    name: name,
                    icon: data.Location
                });

                await specialization.save();

                return res.status(201).json({
                    message: "Specialization added successfully",
                    status: 201,
                    success: true,
                    data: specialization
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
}

// Get All Specializations
exports.getAllSpecializations = async (req, res) => {
    try {
        const specializations = await Specialization.find();
        return res.status(200).json({
            message: "All Specializations",
            status: 200,
            success: true,
            data: specializations
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
}

// Edit Specialization
exports.editSpecialization = async (req, res) => {
    try {
        upload(req, res, async function (err) {
            if (err) {
                return res.status(400).json({
                    message: "Something went wrong",
                    status: 400,
                    success: false,
                    error: err.message
                });
            }

            const Id = req.query.specializationId;

            const specialization = await Specialization.findById(Id);
            if (!specialization) {
                return res.status(404).json({
                    message: "Specialization not found",
                    status: 404,
                    success: false
                });
            }

            // 


            if (req.file) {
                if (specialization.icon) {
                    const oldKey = specialization.icon.split('/').pop();
                    const params = {
                        Bucket: `${process.env.AWS_BUCKET_NAME}/specialization`,
                        Key: oldKey
                    };
                    s3.deleteObject(params, function (err, data) {
                        if (err) {
                            return res.status(400).json({
                                message: "Something went wrong",
                                status: 400,
                                success: false,
                                error: err.message
                            });
                        }
                    });
                }
            }

            const params = {
                Bucket: `${process.env.AWS_BUCKET_NAME}/specialization`,
                Key: `${req.file.filename}`,
                Body: fs.createReadStream(req.file.path)
            };

            s3.upload(params, async (err, data) => {
                if (err) {
                    return res.status(400).json({
                        message: "Something went wrong",
                        status: 400,
                        success: false,
                        error: err.message
                    });
                }

                const updateSpecialization = await Specialization.findByIdAndUpdate(Id, {
                    name: req.body.name || specialization.name,
                    icon: req.file ? data.Location : specialization.icon
                }, { new: true })

                return res.status(200).json({
                    message: "Specialization Updated Successfully",
                    status: 200,
                    data: updateSpecialization
                })

            });


        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
}


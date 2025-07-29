const fs = require('fs');
const path = require('path');
const multer = require('multer');
// const AWS = require('aws-sdk');
const { s3, getUploadPresignedUrl } = require('../services/awsService');

// Upload a file to S3
const storage = multer.diskStorage({
    filename(req, file, cb) {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ storage: storage }).single('image');

// multiplier image upload (thumbnail, image)
const multiplierUpload = multer({ storage: storage }).fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'image', maxCount: 5 }
]);

// const s3 = new AWS.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });

// Add a new blog
const addBlog = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(500).json({
                    message: 'Something went wrong',
                    status: 500,
                    success: false
                });
            }

            const { title, description, youTubeLink, tags, status } = req.body;
            const image = req.file;

            if (!title || !description || !tags || !status) {
                return res.status(400).json({
                    message: 'All fields are required',
                    status: 400,
                    success: false
                });
            }

            // if title is already exist
            const blogExist = await Blog.findOne({ title });
            if (blogExist) {
                return res.status(400).json({
                    message: 'Blog already exist',
                    status: 400,
                    success: false
                });
            }

            const params = {
                Bucket: `${process.env.AWS_BUCKET_NAME}/blog`,
                Key: `${image.filename}`,
                Body: fs.createReadStream(image.path)
            };


            s3.upload(params, async (err, data) => {
                if (err) {
                    return res.status(500).json({
                        status: 500,
                        success: false,
                        message: err
                    });
                }

                const blog = new Blog({
                    title,
                    description,
                    youTubeLink,
                    image: data.Location,
                    tags,
                    status
                });
                await blog.save();

                return res.status(201).json({
                    message: 'Blog added successfully',
                    status: 201,
                    success: true
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Something went wronggg',
            status: 500,
            success: false
        });
    }
};
// get all blogs
const AllBlogss = async (req, res) => {
    try {
        const blogs = await Blog.find();
        return res.status(200).json({
            status: 200,
            success: true,
            data: blogs
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err
        });
    }
}

// delete blog
const deleteBlog = async (req, res) => {
    try {

        let id = req.query.Id;
        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Blog not found'
            });
        }

        // s3 code to delete image from s3
        const params = {
            Bucket: '123456789video',
            Key: blog.image.split('/').pop()
        };

        s3.deleteObject(params, async (err, data) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    success: false,
                    message: err
                });
            }

            await Blog.findByIdAndDelete(id);

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Blog deleted successfully'
            });
        });




    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: "Something went wrong"
        });
    }
}

// Edit Blog
exports.EditBlog = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(500).json({
                    message: 'Something went wrong',
                    status: 500,
                    success: false
                });
            }

            const id = req.query.Id;


            const params = {
                Bucket: `${process.env.AWS_BUCKET_NAME}/blog`,
                Key: `${image.filename}`,
                Body: fs.createReadStream(image.path)
            };

            const blog = await Blog.findById(id);

            if (!blog) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Blog not found'
                });
            }

            // if image is uploaded then delete the previous image from s3
            if (req.file) {

                s3.deleteObject(params, async (err, data) => {
                    if (err) {
                        return res.status(500).json({
                            status: 500,
                            success: false,
                            message: err
                        });
                    }
                });
            }

            await Blog.findByIdAndUpdate(id, {
                title: req.body.title,
                description: req.body.description,
                youTubeLink: req.body.youTubeLink,
                image: req.file ? GetImageURL(req.file) : blog.image,
                tags: req.body.tags,
                status: req.body.status
            });

            // S3 code to upload image
            function GetImageURL(file) {
                s3.upload(params, async (err, data) => {
                    if (err) {
                        return res.status(500).json({
                            status: 500,
                            success: false,
                            message: err
                        });
                    }

                    return data.Location;

                });
            }



            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Blog updated successfully'
            });



        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            success: false,
            status: 500,
        });
    }
};



// Add a new multiplier  (thumbnail, image)
// Add a new multiplier (thumbnail, image)
const addMultiplier = async (req, res) => {
    try {
        multiplierUpload(req, res, async (err) => {
            if (err) {
                return res.status(500).json({
                    message: 'Something went wrong',
                    status: 500,
                    success: false
                });
            }
            const { title } = req.body;

            // if title is already exist
            const multiplierExist = await Multiplier.findOne({ title });
            if (multiplierExist) {
                return res.status(400).json({
                    message: 'Multiplier already exist',
                    status: 400,
                    success: false
                });
            }

            const thumbnail = req.files['thumbnail'][0];
            const images = req.files['image'];

            const thumbnailParams = {
                Bucket: `${process.env.AWS_BUCKET_NAME}/multiplier`,
                Key: `${thumbnail.filename}`,
                Body: fs.createReadStream(thumbnail.path)
            };

            const thumbnailUploadPromise = new Promise((resolve, reject) => {
                s3.upload(thumbnailParams, (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data.Location);
                    }
                });
            });

            const imageUploadPromises = images.map((image) => {
                const imageParams = {
                    Bucket: `${process.env.AWS_BUCKET_NAME}/multiplier`,
                    Key: `${image.filename}`,
                    Body: fs.createReadStream(image.path)
                };

                return new Promise((resolve, reject) => {
                    s3.upload(imageParams, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data.Location);
                        }
                    });
                });
            });

            Promise.all([thumbnailUploadPromise, ...imageUploadPromises])
                .then(async (urls) => {
                    console.log(urls);
                    const multiplier = new Multiplier({
                        title,
                        thumbnail: urls[0],
                        image: urls.slice(1)
                    });

                    await multiplier.save();

                    return res.status(201).json({
                        message: 'Multiplier added successfully',
                        status: 201,
                        success: true
                    });
                })
                .catch((err) => {
                    return res.status(500).json({
                        message: 'Something went wrong',
                        status: 500,
                        success: false
                    });
                });

        });
    } catch (error) {
        return res.status(500).json({
            message: 'Something went wrong',
            status: 500,
            success: false
        });
    }
};


const EditMultiplier = async (req, res) => {
    try {
        multiplierUpload(req, res, async (err) => {
            if (err) {
                return res.status(500).json({
                    message: 'Something went wrong',
                    status: 500,
                    success: false
                });
            }

            const id = req.query.Id;
            const multiplier = await Multiplier.findById(id);

            if (!multiplier) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Multiplier not found'
                });
            }

            // Initialize the promise for thumbnail upload as null
            let thumbnailUploadPromise = Promise.resolve(null);

            // Validate if the thumbnail file is present
            if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
                const thumbnail = req.files['thumbnail'][0];
                const thumbnailParams = {
                    Bucket: `${process.env.AWS_BUCKET_NAME}/multiplier`,
                    Key: `${thumbnail.filename}`,
                    Body: fs.createReadStream(thumbnail.path)
                };

                thumbnailUploadPromise = new Promise((resolve, reject) => {
                    s3.upload(thumbnailParams, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data.Location);
                            // if thumbnail is uploaded then delete the previous thumbnail from s3
                            if (multiplier.thumbnail) {
                                const params = {
                                    Bucket: `${process.env.AWS_BUCKET_NAME}/multiplier`,
                                    Key: `${multiplier.thumbnail.split('/').pop()}`
                                };
                                s3.deleteObject(params, async (err, data) => {
                                    if (err) {
                                        return res.status(500).json({
                                            status: 500,
                                            success: false,
                                            message: err
                                        });
                                    }
                                });
                            }
                        }
                    });
                });

            }

            let imageUploadPromises = [];
            if (req.files && req.files['image']) {
                const images = req.files['image'];
                imageUploadPromises = images.map((image) => {
                    const imageParams = {
                        Bucket: `${process.env.AWS_BUCKET_NAME}/multiplier`,
                        Key: `${image.filename}`,
                        Body: fs.createReadStream(image.path)
                    };

                    return new Promise((resolve, reject) => {
                        s3.upload(imageParams, (err, data) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(data.Location);
                                // if image is uploaded then delete the previous image from s3
                                if (multiplier.image) {
                                    multiplier.image.forEach(async (img) => {
                                        const params = {
                                            Bucket: `${process.env.AWS_BUCKET_NAME}/multiplier`,
                                            Key: `${img.split('/').pop()}`
                                        };
                                        s3.deleteObject(params, async (err, data) => {
                                            if (err) {
                                                return res.status(500).json({
                                                    status: 500,
                                                    success: false,
                                                    message: err
                                                });
                                            }
                                        });
                                    });
                                }
                            }
                        });
                    });
                });
            }

            // Use Promise.all with the thumbnailUploadPromise and imageUploadPromises
            Promise.all([thumbnailUploadPromise, ...imageUploadPromises])
                .then(async (urls) => {
                    await Multiplier.findByIdAndUpdate(id, {
                        title: req.body.title ? req.body.title : multiplier.title,
                        thumbnail: req.files['thumbnail'] ? urls[0] : multiplier.thumbnail,
                        image: req.files['image'] ? urls.slice(1) : multiplier.image
                    });

                    return res.status(200).json({
                        status: 200,
                        success: true,
                        message: 'Multiplier updated successfully'
                    });
                }).catch((err) => {
                    return res.status(500).json({
                        message: 'Something went wrong' + err,
                        status: 500,
                        success: false
                    });
                });

        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong" + error,
            success: false,
            status: 500,
        });
    }
}


const getPresignedUrl = async (req, res) => {
    const { fileName, fileType, folder } = req.query;

    if (!fileName || !fileType || !folder) {
        return res.status(400).json({
            message: "fileName, fileType and folder are required",
            success: false,
            status: 400,
        });
    }

    try {
        const data = await getUploadPresignedUrl(fileName, fileType, folder);
        res.status(200).json({
            message: "Presigned URL generated successfully",
            success: true,
            status: 200,
            ...data
        });
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong" + error,
            success: false,
            status: 500,
        });
    }
}


module.exports = {
    addBlog,
    getPresignedUrl,
    addMultiplier,
    EditMultiplier,
};

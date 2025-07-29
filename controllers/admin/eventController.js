// const Event = require('../../models/Event')
// const fs = require('fs')
// const multer = require('multer')
// const path = require('path')
// const AWS = require('aws-sdk')


// // upload a file to s3
// const storage = multer.diskStorage({
//     // destination: (req, file, cb) => {
//     //     const uploadPath = path.join(__dirname, '../uploads/blog');
//     //     fs.mkdirSync(uploadPath, { recursive: true });
//     //     cb(null, uploadPath);
//     // },
//     filename(req, file, cb) {
//         cb(null, `${Date.now()}${path.extname(file.originalname)}`);
//     },
// });

// const upload = multer({ storage: storage }).single('image');


// // AWS S3 setup
// const s3 = new AWS.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });


// // Add new event
// exports.addEvent = async (req, res) => {
//     try {
//         upload(req, res, async (err) => {
//             if (err) {
//                 return res.status(500).json({
//                     message: 'Something went wrong',
//                     status: 500,
//                     success: false
//                 });
//             }

//             const { title, description } = req.body;
//             const image = req.file;
            
//             if (!title) {
//                 return res.status(400).json({
//                     message: 'All fields are required',
//                     status: 400,
//                     success: false
//                 });
//             }


//             if (!image) {
//                 return res.status(400).json({
//                     message: 'Image is required',
//                     status: 400,
//                     success: false
//                 });
//             }

//             if (!description) {
//                 return res.status(400).json({
//                     message: 'Description is required',
//                     status: 400,
//                     success: false
//                 });
//             }

//             // if title is already exist
//             const checkEvent = await Event.findOne({ title: title });
//             if (checkEvent) {
//                 return res.status(400).json({
//                     message: 'Event already exist',
//                     status: 400,
//                     success: false
//                 });
//             }

//             const params = {
//                 Bucket: `${process.env.AWS_BUCKET_NAME}/PhysioApp/Events`,
//                 Key: `${image.filename}`,
//                 Body: fs.createReadStream(image.path)
//             };


//             s3.upload(params, async (err, data) => {
//                 if (err) {
//                     return res.status(500).json({
//                         status: 500,
//                         success: false,
//                         message: err
//                     });
//                 }
//                 // console.log(req.body, "req.body");

//                 const event = await Event.create({
//                     title: title,
//                     description: description,
//                     image: data.Location
//                 });
//                 // console.log(event, "event");
//                 return res.status(200).json({
//                     status: 200,
//                     success: true,
//                     data: event
//                 });


//             });
//         });

//     } catch (error) {
//         console.log(error)
//         return res.status(500).json({
//             status: 500,
//             success: false,
//             message: 'Something went wrong'
//         });
//     }
// };

// // Get all events
// exports.getAllEvents = async (req, res) => {
//     try {
//         const events = await Event.find();
//         return res.status(200).json({
//             status: 200,
//             success: true,
//             data: events
//         });
//     } catch (error) {
//         console.log(error)
//         return res.status(500).json({
//             status: 500,
//             success: false,
//             message: 'Something went wrong'
//         });
//     }
// };
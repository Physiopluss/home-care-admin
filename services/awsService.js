const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Upload file to S3
exports.uploadFileToS3 = async (file, folder) => {
    if (!file || !folder) {
        return { success: false, error: 'Missing file or folder' };
    }

    const fileKey = `${folder}/${file.filename}`;
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer
    };

    try {
        const data = await s3.send(new PutObjectCommand(params));
        const fileUrl = `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
        return { success: true, url: fileUrl };
    } catch (err) {
        return { success: false, error: "Something went wrong: " + err.message };
    }
};

// Delete physio Image 
exports.deleteFileFromS3 = async (fileUrl) => {
    if (!fileUrl) {
        return { success: false, error: 'Missing file URL' };
    }

    // Extract the S3 object key from the file URL
    const fileKey = fileUrl.split('.amazonaws.com/')[1];

    if (!fileKey) {
        return { success: false, error: `Invalid file URL: ${fileUrl}` };
    }

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
    };

    try {
        const data = await s3.send(new DeleteObjectCommand(params));
        return { success: true, data };
    } catch (err) {
        return { success: false, error: "Something went wrong: " + err.message };
    }

};

// Generate a pre-signed URL for uploading a file
exports.getUploadPresignedUrl = async (fileName, fileType, folder) => {
    if (!fileName || !fileType || !folder) {
        return { success: false, error: 'Missing fileName, fileType or folder' };
    }

    const fileKey = `${folder}/${Date.now()}_${fileName}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
        ContentType: fileType
    });

    try {
        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 mins

        const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

        return {
            uploadUrl,
            fileUrl,
            fileKey
        };
    } catch (error) {
        return { success: false, error: 'Failed to generate upload URL: ' + error.message };
    }
};

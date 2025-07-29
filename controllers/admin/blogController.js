const Blog = require("../../models/blog")
const { deleteFileFromS3 } = require("../../services/awsService")

exports.listBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 });
        return res.status(200).json({
            status: 200,
            success: true,
            data: blogs
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}

exports.createBlog = async (req, res) => {
    try {
        const { coverImage, title, body } = req.body;

        if (!title || !body) {
            return res.status(400).json({
                message: "Title and body are required",
                status: 400,
                success: false
            });
        }

        const blogExist = await Blog.findOne({ title });
        if (blogExist) {
            return res.status(400).json({
                message: 'Blog already exist',
                status: 400,
                success: false
            });
        }

        const blog = await Blog.create({ coverImage, title, body });
        return res.status(201).json({
            message: "Blog created successfully",
            status: 201,
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
}

exports.deleteBlog = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({
                message: "Blog ID is required",
                status: 400,
                success: false
            });
        }

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                message: "Blog not found",
                status: 404,
                success: false
            });
        }

        await deleteFileFromS3(blog.coverImage);
        await Blog.findByIdAndDelete(blog._id);

        return res.status(200).json({
            message: "Blog deleted successfully",
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
}

exports.updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { coverImage, title, body } = req.body;

        if (!id) {
            return res.status(400).json({
                message: "Blog ID is required",
                status: 400,
                success: false
            });
        }

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                message: "Blog not found",
                status: 404,
                success: false
            });
        }

        if (!title || !body) {
            return res.status(400).json({
                message: "Title and body are required",
                status: 400,
                success: false
            });
        }

        if (coverImage != blog.coverImage) {
            await deleteFileFromS3(blog.coverImage);
        }

        blog.coverImage = coverImage;
        blog.title = title;
        blog.body = body;

        await blog.save();

        return res.status(200).json({
            message: "Blog updated successfully",
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
}

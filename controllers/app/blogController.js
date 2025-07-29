const Blog = require("../../models/blog");

// Get All Blogs
exports.GetBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find();
        return res.status(200).json({
            message: "Blogs fetched successfully",
            success: true,
            status: 200,
            data: blogs
        })
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
        })
    }
}


// Get Single Blog

exports.GetSingleBlog = async (req, res) => {
    try {

        let blogId = req.params.id;
        if (!blogId) {
            return res.status(400).json({
                message: "Blog ID is required",
                success: false,
                status: 400,
            })
        }

        // if blog id is invalid 
        let blog = await Blog.findOne({ _id: blogId })
        if (!blog) {
            return res.status(400).json({
                message: "Bloge is Note Found",
                success: false,
                status: 400
            })
        }


        return res.status(200).json({
            message: "Blog fetched successfully",
            success: true,
            status: 200,
            data: blog
        })
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            success: false,
            status: 500
        })
    }
}
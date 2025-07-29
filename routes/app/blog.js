const router = require('express').Router();
const Blog = require("../../controllers/app/blogController");


router.get('/list', Blog.GetBlogs);
router.get('/single/:id', Blog.GetSingleBlog);


module.exports = router;
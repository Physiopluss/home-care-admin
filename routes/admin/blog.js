const router = require('express').Router();
const blogController = require('../../controllers/admin/blogController');

router.get('/list', blogController.listBlogs);
router.post('/create', blogController.createBlog);
router.put('/update/:id', blogController.updateBlog);
router.delete('/delete', blogController.deleteBlog);
// router.get('/search', blogController.GetBlogSearchByTitle);

module.exports = router;
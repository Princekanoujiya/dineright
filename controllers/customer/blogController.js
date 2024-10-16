const db = require('../../config');

// getAllBlogsUser
exports.getAllBlogs = (req, res) => {
    const getAllBlogsQuery = `SELECT blog_id, blog_title, blog_description, blog_image FROM blogs WHERE is_deleted = 0`;
  
    db.query(getAllBlogsQuery, (err, results) => {
      if (err) {
        return res.status(200).json({ error_msg: 'Database error while fetching blogs', details: err.message, response: false });
      }
  
      if (results.length === 0) {
        return res.status(200).json({ error_msg: 'No blogs found', response: false });
      }
  
      const blogs = results.map(blog => {
        const blog_image_url = blog.blog_image ? `${process.env.BASE_URL}/uploads/blogs/${blog.blog_id}/${blog.blog_image}` : null;
        return {
          blog_id: blog.blog_id,
          blog_title: blog.blog_title,
          blog_description: blog.blog_description,
          blog_image_url
        };
      });
  
      return res.status(200).json({
        success_msg: 'Blogs fetched successfully',
        blogs,
        response: true
      });
    });
  };
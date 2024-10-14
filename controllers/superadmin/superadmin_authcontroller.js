const db = require('../../config');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

exports.loginSuperadmin = (req, res) => {
    const { superadmin_email, superadmin_password } = req.body;

    // Check if required fields are provided
    if (!superadmin_email || !superadmin_password) {
        return res.status(200).json({ error_msg: "Email and Password are required",response:false });
    }

    // Query to find the superadmin by email
    const query = `SELECT * FROM superadmin_login WHERE superadmin_email = ?`;
    db.query(query, [superadmin_email], (err, result) => {
        if (err) {
            console.error('Database error_msg:', err);
            return res.status(200).json({ error_msg: 'Database error' ,response:false});
        }

        // Check if superadmin exists
        if (result.length === 0) {
            return res.status(200).json({ error_msg: 'Invalid email or password',response:false });
        }

        // Superadmin found, now compare the password
        const superadmin = result[0];

        // Directly compare the password (no bcrypt)
        if (superadmin_password !== superadmin.superadmin_password) {
            return res.status(200).json({ error_msg: 'Invalid email or password' ,response:false});
        }

        // Passwords match, generate JWT token
        const token = jwt.sign(
            { superadmin_id: superadmin.superadmin_id, email: superadmin.superadmin_email },
            process.env.JWT_SECRET,
            { expiresIn: '9h' }     
        );

        // Send success response with token
        return res.status(200).json({
            success_msg: 'Login successful',
            token: token,
            superadmin_id: superadmin.superadmin_id,
            response:true,
        });
    });
};
exports.getGuests = (req, res) => {
    const query = 'SELECT * FROM users';
  
    db.query(query, (err, results) => {
      if (err) {
        console.error('Database error_msg:', err);
        return res.status(200).json({ error_msg: 'Database error', details: err.message,response:false });
      }
  
      if (results.length === 0) {
        return res.status(200).json({ error_msg: 'No users found' ,response:false});
      }
  
      res.status(200).json({ users: results ,response:true,success_msg:true});
    });
};
exports.getGuestsbyID = (req, res) => {
  const { id } = req.body; // Replace userId with id
  let query = 'SELECT * FROM users';
  const queryParams = [];

  if (id) {
      query += ' WHERE id = ?'; // Assuming 'id' is the column in your database
      queryParams.push(id);
  }

  db.query(query, queryParams, (err, results) => {
      if (err) {
          console.error('Database error_msg:', err);
          return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
      }

      if (results.length === 0) {
          return res.status(200).json({ error_msg: id ? 'User not found' : 'No users found', response: false });
      }

      res.status(200).json({ users: results, response: true, success_msg: true });
  });
};
exports.updateUserStatusAndCommission = (req, res) => {
    const { id } = req.params; 
    const { status, commission } = req.body; 
  
    if (!status || commission == null) {
      return res.status(200).json({ error_msg: 'Status and commission are required' ,response:false});
    }
  
    // Update query
    const updateQuery = 'UPDATE users SET status = ?, commission = ? WHERE id = ?';
    
    // Execute the update query
    db.query(updateQuery, [status, commission, id], (err, result) => {
      if (err) {
        console.error('Database error_msg:', err);
        return res.status(200).json({ error_msg: 'Database error', details: err.message,response:false });
      }
  
      if (result.affectedRows === 0) {
        return res.status(200).json({ error_msg: 'User not found' ,response:false});
      }
  
      res.status(200).json({ success_msg: 'User status and commission updated successfully',id ,response:true});
    });
};
exports.updateCommissionStatus = (req, res) => {
    const { id } = req.params; // Get user id from the request parameters
    const { commission_status } = req.body; // Get status and commission from the request body
  
    if (!commission_status == null) {
      return res.status(200).json({ error_msg: 'Commission Status are required' ,response:false});
    }
  
    // Update query
    const updateQuery = 'UPDATE users SET commission_status = ? WHERE id = ?';
    
    // Execute the update query
    db.query(updateQuery, [commission_status, id], (err, result) => {
      if (err) {
        console.error('Database error_msg:', err);
        return res.status(200).json({ error_msg: 'Database error', details: err.message ,response:false});
      }
  
      if (result.affectedRows === 0) {
        return res.status(200).json({ error_msg: 'User not found' ,response:false});
      }
  
      res.status(200).json({ success_msg: 'User commission status updated successfully',id ,response:true});
    });
};  

// Multer setup for image upload, storing images in 'uploads/blogs/blog_id/'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { blog_id } = req.body; // blog_id comes from the request body

    // If blog_id exists, store in the folder 'uploads/blogs/blog_id/'
    const dir = blog_id ? `uploads/blogs/${blog_id}` : null;

    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir ? dir : 'uploads/blogs'); // Fallback to general folder if no blog_id
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage }).single('blog_image');

// Insert or update blog
exports.insertOrUpdateBlog = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError || err) {
      // Handle multer or other errors, but respond with status 200
      return res.status(200).json({ error_msg: 'Error uploading file', details: err?.message, response: false });
    }

    const blog_image = req.file ? req.file.filename : null;
    const { blog_id, blog_title, blog_description } = req.body;

    if (!blog_title || !blog_description) {
      return res.status(200).json({ error_msg: 'Title and description are required', response: false });
    }

    if (blog_id) {
      // Update operation
      const updateQuery = `UPDATE blogs 
                           SET blog_title = ?, blog_description = ?, blog_image = ?
                           WHERE blog_id = ?`;
      db.query(updateQuery, [blog_title, blog_description, blog_image, blog_id], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during update', details: err.message, response: false });
        }

        // Move image to 'uploads/blogs/blog_id/'
        const newDir = `uploads/blogs/${blog_id}`;
        if (blog_image && !fs.existsSync(newDir)) {
          fs.mkdirSync(newDir, { recursive: true });
        }
        if (blog_image && fs.existsSync(req.file.path)) {
          const newImagePath = `${newDir}/${blog_image}`;
          fs.renameSync(req.file.path, newImagePath); // Move file to new directory
        }

        const imageURL = blog_image ? `${process.env.BASE_URL}/uploads/blogs/${blog_id}/${blog_image}` : null;
        return res.status(200).json({ success_msg: 'Blog updated successfully', blog_id, blog_image_url: imageURL, response: true });
      });
    } else {
      // Insert operation if blog_id is not provided
      const insertQuery = `INSERT INTO blogs (blog_title, blog_description, blog_image) VALUES (?, ?, ?)`;
      db.query(insertQuery, [blog_title, blog_description, blog_image], (err, result) => {
        if (err) {
          return res.status(200).json({ error_msg: 'Database error during insertion', details: err.message, response: false });
        }

        const newBlogId = result.insertId;

        // Move image to 'uploads/blogs/newBlogId/'
        const newDir = `uploads/blogs/${newBlogId}`;
        if (blog_image && !fs.existsSync(newDir)) {
          fs.mkdirSync(newDir, { recursive: true });
        }
        if (blog_image && fs.existsSync(req.file.path)) {
          const newImagePath = `${newDir}/${blog_image}`;
          fs.renameSync(req.file.path, newImagePath); // Move file to new directory
        }

        const imageURL = blog_image ? `${process.env.BASE_URL}/uploads/blogs/${newBlogId}/${blog_image}` : null;
        return res.status(200).json({ success_msg: 'Blog inserted successfully', blog_id: newBlogId, blog_image_url: imageURL, response: true });
      });
    }
  });
};

// Delete a blog (mark as deleted)
exports.deleteBlog = (req, res) => {
  const { blog_id } = req.body; // Get blog_id from the request body

  // Check if blog_id is provided
  if (!blog_id) {
      return res.status(200).json({ error_msg: 'Blog ID is required', response: false });
  }

  // Update query to mark the blog as deleted
  const query = `UPDATE blogs SET is_deleted = 1 WHERE blog_id = ?`;
  db.query(query, [blog_id], (err, result) => {
      if (err) {
          console.error('Database error_msg:', err);
          return res.status(200).json({ error_msg: 'Database error', details: err.message, response: false });
      }

      if (result.affectedRows === 0) {
          return res.status(200).json({ error_msg: 'Blog not found or already deleted', response: false });
      }

      res.status(200).json({ success_msg: 'Blog marked as deleted successfully', response: true });
  });
};

require('dotenv').config(); // Load environment variables

exports.getBlog = (req, res) => {
  const { blog_id } = req.body; // Changed to req.body to get blog_id from the request body

  if (!blog_id) {
    return res.status(200).json({ error_msg: 'Blog ID is required', response: false });
  }

  const getBlogQuery = `SELECT blog_id, blog_title, blog_description, blog_image 
                        FROM blogs 
                        WHERE blog_id = ?`;

  db.query(getBlogQuery, [blog_id], (err, result) => {
    if (err) {
      return res.status(200).json({ error_msg: 'Database error while fetching blog', details: err.message, response: false });
    }

    if (result.length === 0) {
      return res.status(200).json({ error_msg: 'Blog not found', response: false });
    }

    const blog = result[0];
    const blog_image_url = blog.blog_image ? `${process.env.BASE_URL}/uploads/blogs/${blog_id}/${blog.blog_image}` : null;

    return res.status(200).json({
      success_msg: 'Blog fetched successfully',
      blog: {
        blog_id: blog.blog_id,
        blog_title: blog.blog_title,
        blog_description: blog.blog_description,
        blog_image_url
      },
      response: true
    });
  });
};

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

const db = require('../config');

// Create or Update a course
exports.createOrUpdateCourse = (req, res) => {
  const { course_id, course_name } = req.body;

  // Validate course_name
  if (!course_name) {
    return res.status(400).json({ success_msg: "Course name is required" });
  }

  if (course_id) {
    // If course_id is provided, update the course
    const updateQuery = 'UPDATE courses SET course_name = ? WHERE course_id = ?';
    db.query(updateQuery, [course_name, course_id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ error_msg: "Course not found" });
      }
      res.json({ success_msg: "Course updated successfully" ,course_id});
    });
  } else {
    // If course_id is not provided, create a new course
    const insertQuery = 'INSERT INTO courses (course_name) VALUES (?)';
    db.query(insertQuery, [course_name], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success_msg: "Course created successfully", course_id: result.insertId });
    });
  }
};
// Get all courses
exports.getAllCourses = (req, res) => {
    const selectQuery = 'SELECT * FROM courses WHERE is_deleted=0';
  
    db.query(selectQuery, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
};
// Soft delete a course (set is_deleted = 1)
exports.DeleteCourse = (req, res) => {
  const { course_id } = req.params;

  // Validate course_id
  if (!course_id) {
    return res.status(400).json({ error_msg: "Course ID is required" });
  }

  console.log("Received course_id:", course_id); // Log the received course_id

  // Check if the course exists and is not already deleted
  const checkQuery = 'SELECT * FROM courses WHERE course_id = ? AND is_deleted= 0';
  db.query(checkQuery, [course_id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    console.log("Query result:", result); // Log the result of the query

    if (result.length === 0) {
      return res.status(404).json({ error_msg: "Course not found or already deleted" });
    }

    // If the course exists and is not deleted, proceed with the soft delete
    const softDeleteQuery = 'UPDATE courses SET is_deleted = 1 WHERE course_id = ?';
    db.query(softDeleteQuery, [course_id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ success_msg: "Course deleted successfully" });
    });
  });
};
  // Get a specific course by ID (excluding deleted courses)
exports.getCourseById = (req, res) => {
    const { course_id } = req.params;
  
    // Validate course_id
    if (!course_id) {
      return res.status(400).json({ error_msg: "Course ID is required" });
    }
  
    const selectQuery = 'SELECT * FROM courses WHERE course_id = ?';
    db.query(selectQuery, [course_id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.length === 0) {
        return res.status(404).json({ error_msg: "Course not found or has been deleted" });
      }
      res.json(result[0]); // Return the first course
    });
  };
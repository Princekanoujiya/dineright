const db = require('../../config');

exports.getCourseMenuAndMenuItems = async (req, res) => {
  try {
    const userId = req.params.userId;

    const query = `SELECT course_id, course_name FROM courses`;

    const [courses] = await db.promise().query(query); // Use promise-based query


    let courseArray = [];
    for (const course of courses) {

      const menuQuery = `
        SELECT  m.menu_id, m.menu_name
        FROM course_menu_static_linking cml
        JOIN menus m ON cml.menu_id = m.menu_id
        WHERE cml.course_id = ?
      `;

      const [menus] = await db.promise().query(menuQuery, [course.course_id]); // Use promise-based query


      // menu items
      let menuItemArray = [];
      for (const menu of menus) {

        const itemQuery = `
        SELECT  mi.*
        FROM menu_item_linking mil
        JOIN master_items mi ON mil.master_item_id = mi.master_item_id
        WHERE mil.menu_id = ? AND mil.userId = ?
      `;

        const [items] = await db.promise().query(itemQuery, [menu.menu_id, userId]); // Use promise-based query

        // Create a new array with updated master_item_image
        const updatedItems = items.map(item => {
          return {
            ...item, // Spread the existing properties of the item
            master_item_image: process.env.BASE_URL + item.master_item_image // Update the master_item_image field
          };
        });

        // Assign the updated items to menu.menu_items
        menu.menu_items = updatedItems;

        menuItemArray.push(menu);
      }

      course.menus = menus;

      courseArray.push(course);

    }

    res.status(200).json({
      success_msg: 'Course menu details retrieved successfully',
      response: true,
      data: courseArray
    });
  } catch (err) {
    res.status(500).json({ error_msg: err.message, response: false });
  }
};
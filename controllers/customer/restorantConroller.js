const db = require('../../config');

exports.getCourseMenuAndMenuItems = async (req, res) => {
  try {
    const userId = req.params.userId;

    const query = `SELECT course_id, course_name FROM courses`;
    const [courses] = await db.promise().query(query); // Use promise-based query

    let courseArray = [];
    for (const course of courses) {
      const menuQuery = `
        SELECT  m.menu_id, m.menu_type, m.menu_name
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

      // beverage
      const beverages = await getBeveragesWithItems(userId);

      menuItemArray.push(beverages);

      course.menus = menuItemArray;
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

// get beverages
const getBeveragesWithItems = async (userId) => {
  try {
    // Fetch the beverage menu
    const menuQuery = `SELECT menu_id, menu_type, menu_name FROM menus WHERE menu_type = 'beverage' AND is_deleted = 0`;
    const [menu] = await db.promise().query(menuQuery);

    // Fetch all beverages
    const beverageQuery = `SELECT * FROM beverages`;
    const [beverages] = await db.promise().query(beverageQuery);

    let beverageArray = [];

    // Loop through each beverage and fetch its linked items
    for (const beverage of beverages) {
      const beverageItemsQuery = `
        SELECT mi.*
        FROM beverages_item_linking bil
        JOIN master_items mi ON mi.master_item_id = bil.master_item_id
        WHERE bil.beverage_id = ? AND bil.userId = ? AND bil.is_deleted = 0
      `;

      const [beverageItems] = await db.promise().query(beverageItemsQuery, [beverage.beverage_id, userId]);

      // Update image URL paths and assign items to the beverage
      const updatedBeverageItems = beverageItems.map(item => ({
        ...item,
        master_item_image: process.env.BASE_URL + item.master_item_image,
      }));

      // Assign the updated items to the beverage
      beverage.beverage_items = updatedBeverageItems;
      beverageArray.push(beverage);
    }

    // Prepare the final menu data
    let menuData = menu.length > 0 ? menu[0] : {};
    menuData.beverages = beverageArray;

    return menuData;
  } catch (error) {
    console.error('Error fetching beverages:', error);
    throw error;
  }
};

exports.getMenuItemsByItemIds = async (req, res) => {
  try {
    const { userId, menu_item_ids } = req.body;

    if (!userId || !menu_item_ids || !Array.isArray(menu_item_ids) || menu_item_ids.length === 0) {
      return res.status(400).json({ error_msg: 'Invalid userId or item_ids provided', response: false });
    }

    const query = `SELECT * FROM master_items WHERE master_item_id IN (?) AND userId = ?`;
    const [menuItems] = await db.promise().query(query, [menu_item_ids, userId]); // Pass item_ids and userId as query parameters

    // Create a new array with updated master_item_image
    const updatedItems = menuItems.map(item => {
      return {
        ...item, // Spread the existing properties of the item
        master_item_image: process.env.BASE_URL + item.master_item_image // Update the master_item_image field
      };
    });

    res.status(200).json({
      success_msg: 'Menu Items details retrieved successfully',
      response: true,
      data: updatedItems
    });
  } catch (err) {
    res.status(500).json({ error_msg: err.message, response: false });
  }
};

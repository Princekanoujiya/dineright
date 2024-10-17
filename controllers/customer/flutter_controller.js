const db = require('../../config');


exports.getMasterBeverageItemsSelectedByRestro = async (req, res) => {
    try {
        const { userId } = req.body; 
        
        // Query all beverages
        const beverageQuery = `SELECT * FROM beverages`;
        const [beverages] = await db.promise().query(beverageQuery);

        let beverageArray = [];
        for (const beverage of beverages) {
            // Query menu items linked to the beverage
            const menuItemsQuery = `
                SELECT mi.* FROM beverages_item_linking bil
                JOIN master_items mi ON bil.master_item_id = mi.master_item_id
                WHERE bil.beverage_id = ? AND bil.userId = ? AND is_deleted = 0
            `;

            const [beverageItems] = await db.promise().query(menuItemsQuery, [beverage.beverage_id, userId]);

            // Update master_item_image for each menu item
            const updatedBeverageItems = beverageItems.map(item => ({
                ...item,
                master_item_image: process.env.BASE_URL + item.master_item_image
            }));

            // Attach the beverage items to each beverage
            beverage.beverage_items = updatedBeverageItems;

            // Only add to the array if beverage_items is not empty
            if (updatedBeverageItems.length > 0) {
                beverageArray.push(beverage);
            }
        }

        // Send the array with beverages that have items
        res.status(200).json(beverageArray);
    } catch (error) {
        // Send an error response with a detailed message
        res.status(500).json({ error: error.message });
    }
};

exports.getCourseMenuByRestroID = async (req, res) => {
    try {
        // Get userId and course_id from request body
        const { userId, course_id } = req.body;

        if (!userId) {
            return res.status(200).json({
                error_msg: 'userId is required',
                response: false
            });
        }

        if (!course_id) {
            return res.status(200).json({
                error_msg: 'course_id is required',
                response: false
            });
        }
        // Modify the query to filter by course_id if provided
        let courseQuery = `SELECT course_id, course_name FROM courses WHERE course_status = 'Yes'`;
        const queryParams = [];

        if (course_id) {
            courseQuery += ' AND course_id = ?';
            queryParams.push(course_id);
        }

        const [courses] = await db.promise().query(courseQuery, queryParams);

        let courseArray = [];
        for (const course of courses) {

            const menuQuery = `
                SELECT m.menu_id, m.menu_name
                FROM course_menu_static_linking cmsl
                JOIN menus m ON cmsl.menu_id = m.menu_id
                WHERE cmsl.course_id = ? AND m.is_deleted = 0
            `;

            const [menus] = await db.promise().query(menuQuery, [course.course_id]);

            // Fetch menu items
            let menuItemArray = [];
            for (const menu of menus) {

                const itemQuery = `
                    SELECT mi.*
                    FROM menu_item_linking mil
                    JOIN master_items mi ON mi.master_item_id = mil.master_item_id
                    WHERE mil.menu_id = ? AND mil.userId = ? AND mil.is_deleted = 0
                `;

                const [items] = await db.promise().query(itemQuery, [menu.menu_id, userId]);

                // Assuming each item in 'items' has a 'master_item_image' property
                if (items.length > 0) {
                    items.forEach(item => {
                        item.master_item_image = `${process.env.BASE_URL}/uploads/menu_items_with_token/${userId}/${item.master_item_image}`;
                    });
                }

                menu.menu_items = items;

                // Now, fetch beverage items related to this menu
                // const beverageQuery = `
                //     SELECT bil.*
                //     FROM beverages_item_linking bil
                //     JOIN master_items mi ON mi.master_item_id = bil.master_item_id
                //     WHERE bil.beverage_id = ? AND bil.userId = ? AND bil.is_deleted = 0
                // `;

                // const [beverages] = await db.promise().query(beverageQuery, [menu.menu_id, userId]);

                // // Assuming each beverage in 'beverages' has a 'beverage_image' property
                // if (beverages.length > 0) {
                //     beverages.forEach(beverage => {
                //         beverage.beverage_image = `${process.env.BASE_URL}/uploads/menu_items_with_token/${userId}/${beverage.beverage_image}`;
                //     });
                // }

                // menu.menu_items = items;
                // menu.beverage_items = beverages; 
                menuItemArray.push(menu);
            }

            course.menus = menuItemArray;
            courseArray.push(course);
        }

        res.status(200).json({
            userId,
            success_msg: 'Course menu details retrieved successfully',
            response: true,
            data: courseArray
        });
    } catch (err) {
        res.status(500).json({ error_msg: err.message, response: false });
    }
};

  
// Get all restaurants filtered by city_name
exports.searchAllRestorantByCityName = async (req, res) => {
    const { city_name } = req.body; // Get the city_name from the request body

    try {
        // Base SQL query to fetch restaurants based on city_name
        let selectQuery = `
            SELECT u.id, u.username, u.email, u.restaurantName, u.restaurantAddress, u.restaurant_rating, u.license_image, c.city_name
            FROM users u
            LEFT JOIN cities c ON u.city_id = c.city_id
            WHERE u.is_deleted = 0 
            AND u.status = 'Activated'
        `;

        // Array to hold query parameters
        let queryParams = [];

        // Add condition for city_name if provided
        if (city_name) {
            selectQuery += ` AND c.city_name LIKE ?`;
            queryParams.push(`%${city_name}%`);
        }

        // Execute the main query
        const [results] = await db.promise().query(selectQuery, queryParams);

        // Process each result and fetch related banner images, galleries, and videos
        let restorantArray = await Promise.all(results.map(async (result) => {
            const userId = result.id; // Use the 'id' from the initial query result

            // Prepend BASE_URL to the license_image field
            result.license_image = `${process.env.BASE_URL}${result.license_image}`;

            // Fetch related data from banner_images, banner_galleries, and banner_videos tables
            const [bannerImages] = await db.promise().query(`SELECT * FROM banner_images WHERE userId = ?`, [userId]);
            const [bannerGallery] = await db.promise().query(`SELECT * FROM banner_galleries WHERE userId = ?`, [userId]);
            const [bannerVideos] = await db.promise().query(`SELECT * FROM banner_videos WHERE userId = ?`, [userId]);

            // Prepend BASE_URL to each banner image URL using map
            result.banner_images = bannerImages.map(image => ({
                ...image,
                banner_image: `${process.env.BASE_URL}${image.banner_image}`
            }));

            // Prepend BASE_URL to each gallery file URL using map
            result.banner_gallery = bannerGallery.map(gallery => ({
                ...gallery,
                files: `${process.env.BASE_URL}${gallery.files}`
            }));

            // Prepend BASE_URL to each banner video URL using map
            result.banner_videos = bannerVideos.map(video => ({
                ...video,
                banner_video: `${process.env.BASE_URL}${video.banner_video}`
            }));

            return result; // Return the processed result
        }));

        // Send the response with the final array of restaurants
        res.status(200).json({
            success_msg: "Data fetched successfully",
            response: true,
            data: restorantArray
        });

    } catch (err) {
        // Handle any errors that occur during the query execution
        return res.status(500).json({ error_msg: err.message, response: false });
    }
};

exports.getBeveragesAndCourseMenuByRestroID = async (req, res) => {
    try {
        const { userId, course_id } = req.body;

        if (!userId) {
            return res.status(200).json({
                error_msg: 'userId is required',
                response: false
            });
        }

        let result = {
            userId,
            success_msg: 'Details retrieved successfully',
            response: true,
            beverages: [],
            courses: []
        };

        // Fetch Beverages and their items
        const beverageQuery = `SELECT * FROM beverages`;
        const [beverages] = await db.promise().query(beverageQuery);

        let beverageArray = [];
        for (const beverage of beverages) {
            const menuItemsQuery = `
                SELECT mi.* FROM beverages_item_linking bil
                JOIN master_items mi ON bil.master_item_id = mi.master_item_id
                WHERE bil.beverage_id = ? AND bil.userId = ? AND is_deleted = 0
            `;

            const [beverageItems] = await db.promise().query(menuItemsQuery, [beverage.beverage_id, userId]);

            const updatedBeverageItems = beverageItems.map(item => ({
                ...item,
                master_item_image: process.env.BASE_URL + item.master_item_image
            }));

            beverage.beverage_items = updatedBeverageItems;

            if (updatedBeverageItems.length > 0) {
                beverageArray.push(beverage);
            }
        }
        result.beverages = beverageArray;

        // Fetch Courses and their menus/items
        let courseQuery = `SELECT course_id, course_name FROM courses WHERE course_status = 'Yes'`;
        const queryParams = [];

        if (course_id) {
            courseQuery += ' AND course_id = ?';
            queryParams.push(course_id);
        }

        const [courses] = await db.promise().query(courseQuery, queryParams);

        let courseArray = [];
        for (const course of courses) {
            const menuQuery = `
                SELECT m.menu_id, m.menu_name
                FROM course_menu_static_linking cmsl
                JOIN menus m ON cmsl.menu_id = m.menu_id
                WHERE cmsl.course_id = ? AND m.is_deleted = 0
            `;

            const [menus] = await db.promise().query(menuQuery, [course.course_id]);

            let menuItemArray = [];
            for (const menu of menus) {
                const itemQuery = `
                    SELECT mi.*
                    FROM menu_item_linking mil
                    JOIN master_items mi ON mi.master_item_id = mil.master_item_id
                    WHERE mil.menu_id = ? AND mil.userId = ? AND mil.is_deleted = 0
                `;

                const [items] = await db.promise().query(itemQuery, [menu.menu_id, userId]);

                if (items.length > 0) {
                    items.forEach(item => {
                        item.master_item_image = `${process.env.BASE_URL}/uploads/menu_items_with_token/${userId}/${item.master_item_image}`;
                    });
                }

                menu.menu_items = items;
                menuItemArray.push(menu);
            }

            course.menus = menuItemArray;
            courseArray.push(course);
        }
        result.courses = courseArray;

        // Send final combined response
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error_msg: err.message, response: false });
    }
};

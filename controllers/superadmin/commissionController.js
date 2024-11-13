const db = require('../../config');

// Get all payments
exports.getAllPayments = async (req, res) => {
    try {
        // Fetch all users who are not deleted
        const userQuery = `SELECT * FROM users WHERE is_deleted = 0`;
        const [users] = await db.promise().query(userQuery);

        // If no users are found, return an empty array
        if (users.length === 0) {
            return res.status(200).json({ message: 'No users found', data: [] });
        }

        // Process each user
        const userPayments = await Promise.all(users.map(async (user) => {

            // Get the summed amounts for the user, replacing NULL with 0
            const sumQuery = `
                SELECT 
                    IFNULL(SUM(payout_balance), 0) AS total_payout_balance,
                    IFNULL(SUM(commition_amount), 0) AS total_commition_amount,
                    IFNULL(SUM(billing_amount), 0) AS total_billing_amount
                FROM 
                    commission_transactions 
                WHERE 
                    userId = ? 
                      AND is_payout = 0 
                      AND status = 'completed'
            `;
            const [totals] = await db.promise().query(sumQuery, [user.id]);

            const withdrawalQuery = `SELECT * FROM withdrawal WHERE userId = ? AND status IN ('pending', 'approved')`;
            const [withdrawalResults] = await db.promise().query(withdrawalQuery, [user.id]);

            const total_withdrawal = withdrawalResults.reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

            let total = totals[0];
            total.total_withdrawal = total_withdrawal;


            // Combine the commission data and summed totals for each user
            return {
                userId: user.id,
                username: user.username,
                restaurantName: user.restaurantName,
                total: totals[0]
            };
        }));

        // Return the processed data
        return res.status(200).json({
            message: 'Payments fetched successfully',
            data: userPayments
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({ error: 'Database error', details: error.message });
    }
};


// get payment by userId
exports.getPaymentsByUserId = (req, res) => {
    const { userId } = req.params;

    const commissionQuery = `
        SELECT * 
        FROM commission_transactions 
        WHERE userId = ? 
        AND is_payout = 0 
        AND status = 'completed'
    `;

    const sumQuery = `
        SELECT 
            SUM(payout_balance) AS total_payout_balance,
            SUM(commition_amount) AS total_commition_amount,
            SUM(billing_amount) AS total_billing_amount
        FROM 
            commission_transactions 
        WHERE 
            userId = ? 
            AND is_payout = 0 
            AND status = 'completed'
    `;

    // Execute the first query to get all data
    db.query(commissionQuery, [userId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error fetching Balance', details: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'No Balance found for this user' });
        }

        // Execute the second query to get the sums
        db.query(sumQuery, [userId], (sumErr, sumResult) => {
            if (sumErr) {
                return res.status(500).json({ error: 'Database error fetching Balance Sum', details: sumErr.message });
            }

            // Return all data along with the summed values
            res.status(200).json({
                total: sumResult[0],
                data: result
            });
        });
    });
};


// Get All Withdrawals
exports.getAllWithdrawalRequests = async (req, res) => {
    try {

        // Query for total withdrawal amount
        const withdrawalQuery = `SELECT * FROM withdrawal`;
        const [withdrawalResults] = await db.promise().query(withdrawalQuery);

        // Calculate total withdrawal for 'pending' or 'approved' status
        const total_withdrawal = withdrawalResults.filter(table => table.status === 'pending' || table.status === 'approved')
            .reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

        const total_pending_withdrawal = withdrawalResults.filter(table => table.status === 'pending')
            .reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

        const total_approved_withdrawal = withdrawalResults.filter(table => table.status === 'approved')
            .reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

        const total_rejected_withdrawal = withdrawalResults.filter(table => table.status === 'rejected')
            .reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

        // Query to get commission transactions data  AND is_payout = 0 
        const commissionQuery = `SELECT * FROM commission_transactions WHERE status = 'completed'`;
        const [commissionResults] = await db.promise().query(commissionQuery);

        // payout
        const total_payout_balance = commissionResults.reduce((total, table) => total + parseInt(table.payout_balance), 0);
        const total_online_payout_balance = commissionResults.filter(table => table.payment_mod === 'online')
            .reduce((total, table) => total + parseInt(table.payout_balance), 0);
        const total_cod_payout_balance = commissionResults.filter(table => table.payment_mod === 'cod')
            .reduce((total, table) => total + parseInt(table.payout_balance), 0);

        // commission
        const total_commition_amount = commissionResults.reduce((total, table) => total + parseInt(table.commition_amount), 0);
        const total_online_commition_amount = commissionResults.filter(table => table.payment_mod === 'online')
            .reduce((total, table) => total + parseInt(table.commition_amount), 0);
        const total_cod_commition_amount = commissionResults.filter(table => table.payment_mod === 'cod')
            .reduce((total, table) => total + parseInt(table.commition_amount), 0);

        // billing
        const billing_amount = commissionResults.reduce((total, table) => total + parseInt(table.billing_amount), 0);
        const online_billing_amount = commissionResults.filter(table => table.payment_mod === 'online')
            .reduce((total, table) => total + parseInt(table.billing_amount), 0);
        const cod_billing_amount = commissionResults.filter(table => table.payment_mod === 'cod')
            .reduce((total, table) => total + parseInt(table.billing_amount), 0);


        const total = {
            total_payout_balance: total_payout_balance || 0,
            total_online_payout_balance: total_online_payout_balance || 0,
            total_cod_payout_balance: total_cod_payout_balance || 0,
            total_commition_amount: total_commition_amount || 0,
            total_online_commition_amount: total_online_commition_amount || 0,
            total_cod_commition_amount: total_cod_commition_amount || 0,
            total_billing_amount: billing_amount || 0,
            total_online_billing_amount: online_billing_amount || 0,
            total_cod_billing_amount: cod_billing_amount || 0,
            total_withdrawal: total_withdrawal || 0,
            total_pending_withdrawal: total_pending_withdrawal || 0,
            total_approved_withdrawal: total_approved_withdrawal || 0,
            total_rejected_withdrawal: total_rejected_withdrawal || 0
        };

        const query = `
        SELECT 
            w.*, 
            u.username,
            u.restaurantName
        FROM 
            withdrawal w
        JOIN 
            users u ON w.userId = u.id
        ORDER BY 
            w.created_at DESC
    `;

        const [withdrawals] = await db.promise().query(query);

        // If no withdrawals are found, return an empty array
        if (withdrawals.length === 0) {
            return res.status(200).json({ message: 'No withdrawals found', data: [] });
        }

        // Return the withdrawals
        res.status(200).json({
            message: 'Withdrawals fetched successfully',
            total,
            data: withdrawals
        });
    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
};

// Get Withdrawals by userId
exports.getWithdrawalRequestsByuserId = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate that 'id' is a number
        if (!userId || isNaN(Number(userId))) {
            return res.status(400).json({ message: 'Invalid or missing "id" parameter. "id" must be a number.' });
        }

        const query = `
        SELECT 
            w.*, 
            u.username,
            u.restaurantName
        FROM 
            withdrawal w
        JOIN 
            users u ON w.userId = u.id
        WHERE w.userId = ?
        ORDER BY 
            w.created_at DESC
    `;

        const [withdrawals] = await db.promise().query(query, [userId]);

        // If no withdrawals are found, return an empty array
        if (withdrawals.length === 0) {
            return res.status(200).json({ message: 'No withdrawals found', data: [] });
        }

        // Return the withdrawals
        res.status(200).json({
            message: 'Withdrawals fetched successfully',
            data: withdrawals
        });
    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
};

// Get Withdrawals by id
exports.getOneWithdrawalRequest = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate that 'id' is a number
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ message: 'Invalid or missing "id" parameter. "id" must be a number.' });
        }

        const query = `
        SELECT 
            w.*, 
            u.username,
            u.restaurantName
        FROM 
            withdrawal w
        JOIN 
            users u ON w.userId = u.id
        WHERE w.id = ?
        ORDER BY 
            w.created_at DESC
    `;

        const [withdrawals] = await db.promise().query(query, [id]);

        // If no withdrawals are found, return an empty array
        if (withdrawals.length === 0) {
            return res.status(200).json({ message: 'No withdrawals found', data: [] });
        }

        // Return the withdrawals
        res.status(200).json({
            message: 'Withdrawals fetched successfully',
            data: withdrawals[0]
        });
    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
};

// Update Withdrawal Request
exports.updateWithdrawalRequest = async (req, res) => {
    try {
        const { id, transaction_id, status, description } = req.body;

        // Validate that all fields are present
        if (!id || !transaction_id || !status || !description) {
            return res.status(400).json({ message: 'Missing required fields: id, transaction_id, status, and description are all required.' });
        }

        // Validate the 'status' field
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status. Status must be either "approved" or "rejected".' });
        }

        // Prepare the query
        const query = `UPDATE withdrawal SET transaction_id = ?, status = ?, description = ? WHERE id = ?;`;

        // Execute the query and update the withdrawal
        const [result] = await db.promise().query(query, [transaction_id, status, description, id]);

        // Check if any rows were updated
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'No withdrawals found with the provided id' });
        }

        // Return success response
        res.status(200).json({
            message: 'Withdrawal updated successfully',
            response: true,
            data: {
                id,
                transaction_id,
                status,
                description
            }
        });
    } catch (error) {
        console.error('Error updating withdrawal:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
};

// Get All dashboard data
exports.getAllDashboardData = async (req, res) => {
    try {

        // Query for total users
        const usersQuery = `SELECT * FROM users`;
        const [users] = await db.promise().query(usersQuery);

        // Count of various types of restaurants
        const total_restaurant = users.filter(table => table.is_deleted === 0 && table.signup_status === 1).length;
        const total_activated_restaurant = users.filter(table => table.is_deleted === 0 && table.signup_status === 1 && table.status === 'Activated').length;
        const total_deactivated_restaurant = users.filter(table => table.is_deleted === 0 && table.signup_status === 1 && table.status === 'Deactivated' && table.timestamp !== null).length;
        const total_deleted_restaurant = users.filter(table => table.is_deleted === 1).length;
        const total_uncompleted_restaurant = users.filter(table => table.is_deleted === 0 && table.signup_status === 0).length;
        const total_new_registered_restaurant = users.filter(table => table.is_deleted === 0 && table.signup_status === 1 && table.timestamp === null && table.status === 'Deactivated').length;

        // Query for total customers
        const customersQuery = `SELECT * FROM customers`;
        const [customers] = await db.promise().query(customersQuery);

        // Count of various types of customers
        const total_customers = customers.filter(table => table.is_deleted === 0).length;
        const total_deleted_customers = customers.filter(table => table.is_deleted === 1).length;

        // Query for total bookings
        const bookingsQuery = `SELECT * FROM bookings`;
        const [bookings] = await db.promise().query(bookingsQuery);

         // Count of various types of customers
         const total_bookings = bookings.length;
         const total_online_pending_bookings = bookings.filter(table => table.payment_mod === 'online' && table.booking_status === 'pending').length;
         const total_cod_pending_bookings = bookings.filter(table => table.payment_mod === 'cod' && table.booking_status === 'pending').length;
         const total_online_upcoming_bookings = bookings.filter(table => table.payment_mod === 'online' && table.booking_status === 'upcoming').length;
         const total_cod_upcoming_bookings = bookings.filter(table => table.payment_mod === 'cod' && table.booking_status === 'upcoming').length;
         const total_online_inprogress_bookings = bookings.filter(table => table.payment_mod === 'online' && table.booking_status === 'inprogress').length;
         const total_cod_inprogress_bookings = bookings.filter(table => table.payment_mod === 'cod' && table.booking_status === 'inprogress').length;
         const total_online_completed_bookings = bookings.filter(table => table.payment_mod === 'online' && table.booking_status === 'completed').length;
         const total_cod_completed_bookings = bookings.filter(table => table.payment_mod === 'cod' && table.booking_status === 'completed').length;          
         const total_online_cancelled_bookings = bookings.filter(table => table.payment_mod === 'online' && table.booking_status === 'cancelled').length;
         const total_cod_cancelled_bookings = bookings.filter(table => table.payment_mod === 'cod' && table.booking_status === 'cancelled').length;

        // Query for total withdrawal amount
        const withdrawalQuery = `SELECT * FROM withdrawal`;
        const [withdrawalResults] = await db.promise().query(withdrawalQuery);

        // Calculate total withdrawal for 'pending' or 'approved' status
        const total_withdrawal = withdrawalResults.filter(table => table.status === 'pending' || table.status === 'approved')
            .reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

        const total_pending_withdrawal = withdrawalResults.filter(table => table.status === 'pending')
            .reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

        const total_approved_withdrawal = withdrawalResults.filter(table => table.status === 'approved')
            .reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

        const total_rejected_withdrawal = withdrawalResults.filter(table => table.status === 'rejected')
            .reduce((total, table) => total + parseInt(table.withdrawal_amount), 0);

        // Query to get commission transactions data  AND is_payout = 0 
        const commissionQuery = `SELECT * FROM commission_transactions WHERE status = 'completed'`;
        const [commissionResults] = await db.promise().query(commissionQuery);

        // payout
        const total_payout_balance = commissionResults.reduce((total, table) => total + parseInt(table.payout_balance), 0);
        const total_online_payout_balance = commissionResults.filter(table => table.payment_mod === 'online')
            .reduce((total, table) => total + parseInt(table.payout_balance), 0);
        const total_cod_payout_balance = commissionResults.filter(table => table.payment_mod === 'cod')
            .reduce((total, table) => total + parseInt(table.payout_balance), 0);

        // commission
        const total_commition_amount = commissionResults.reduce((total, table) => total + parseInt(table.commition_amount), 0);
        const total_online_commition_amount = commissionResults.filter(table => table.payment_mod === 'online')
            .reduce((total, table) => total + parseInt(table.commition_amount), 0);
        const total_cod_commition_amount = commissionResults.filter(table => table.payment_mod === 'cod')
            .reduce((total, table) => total + parseInt(table.commition_amount), 0);

        // billing
        const billing_amount = commissionResults.reduce((total, table) => total + parseInt(table.billing_amount), 0);
        const online_billing_amount = commissionResults.filter(table => table.payment_mod === 'online')
            .reduce((total, table) => total + parseInt(table.billing_amount), 0);
        const cod_billing_amount = commissionResults.filter(table => table.payment_mod === 'cod')
            .reduce((total, table) => total + parseInt(table.billing_amount), 0);


        const total = {
            total_restaurant: total_restaurant || 0,
            total_activated_restaurant: total_activated_restaurant || 0,
            total_deactivated_restaurant: total_deactivated_restaurant || 0,
            total_deleted_restaurant: total_deleted_restaurant || 0,
            total_uncompleted_restaurant: total_uncompleted_restaurant || 0,
            total_new_registered_restaurant: total_new_registered_restaurant || 0,

            total_customers: total_customers || 0,
            total_deleted_customers: total_deleted_customers || 0,

            total_bookings: total_bookings || 0,
            total_online_pending_bookings: total_online_pending_bookings || 0,
            total_cod_pending_bookings: total_cod_pending_bookings || 0,
            total_online_upcoming_bookings: total_online_upcoming_bookings || 0,
            total_cod_upcoming_bookings: total_cod_upcoming_bookings || 0,
            total_online_inprogress_bookings: total_online_inprogress_bookings || 0,
            total_cod_inprogress_bookings: total_cod_inprogress_bookings || 0,
            total_online_completed_bookings: total_online_completed_bookings || 0,
            total_cod_completed_bookings: total_cod_completed_bookings || 0,
            total_online_cancelled_bookings: total_online_cancelled_bookings || 0,
            total_cod_cancelled_bookings: total_cod_cancelled_bookings || 0,

            total_payout_balance: total_payout_balance || 0,
            total_online_payout_balance: total_online_payout_balance || 0,
            total_cod_payout_balance: total_cod_payout_balance || 0,
            total_commition_amount: total_commition_amount || 0,
            total_online_commition_amount: total_online_commition_amount || 0,
            total_cod_commition_amount: total_cod_commition_amount || 0,
            total_billing_amount: billing_amount || 0,
            total_online_billing_amount: online_billing_amount || 0,
            total_cod_billing_amount: cod_billing_amount || 0,
            total_withdrawal: total_withdrawal || 0,
            total_pending_withdrawal: total_pending_withdrawal || 0,
            total_approved_withdrawal: total_approved_withdrawal || 0,
            total_rejected_withdrawal: total_rejected_withdrawal || 0
        };

        // Return the withdrawals
        res.status(200).json({
            message: 'Dashboard data fetched successfully',
            total,
        });
    } catch (error) {
        console.error('Error fetching Dashboard:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
};

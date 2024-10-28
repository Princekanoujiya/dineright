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

            // Combine the commission data and summed totals for each user
            return {
                userId: user.id,
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
            data: withdrawals
        });
    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
};


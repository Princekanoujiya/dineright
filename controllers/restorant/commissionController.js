const db = require('../../config');
const { razorPayCreateOrderUnpaidCommission } = require('../../controllers/razorpayController');

// get balance
exports.getMyPayments = (req, res) => {
    const userId = req.userId;

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
            return res.status(200).json({
                total: 0,
                data: result
            });
        }

        // Execute the second query to get the sums
        db.query(sumQuery, [userId], (sumErr, sumResult) => {
            if (sumErr) {
                return res.status(500).json({ error: 'Database error fetching Balance Sum', details: sumErr.message });
            }

            // Return all data along with the summed values
            return res.status(200).json({
                total: sumResult[0],
                data: result
            });
        });
    });
};


// Withdrawal Payment
exports.withdrawalPayment = async (req, res) => {
    try {
        const userId = req.userId;

        const userQuery = `SELECT * FROM users WHERE id = ?`;
        const [user] = await db.promise().query(userQuery, [userId]);

        if (!user[0].restaurant_bank_name || !user[0].restaurant_bank_account_no || !user[0].restaurant_ifsc_code) {
            return res.status(400).json({ message: 'bank account details not found' })
        }

        // Step 1: Calculate the total payout balance
        const payoutBalanceQuery = `
            SELECT 
                SUM(payout_balance) AS total_payout_balance
            FROM 
                commission_transactions 
            WHERE 
                userId = ?
                AND is_payout = 0
                AND status = 'completed'
        `;
        const [[{ total_payout_balance }]] = await db.promise().query(payoutBalanceQuery, [userId]);

        // If there is no payout balance available, respond with an error
        if (!total_payout_balance || total_payout_balance <= 0) {
            return res.status(400).json({ message: 'No payout balance available for withdrawal' });
        }

        // Step 2: Insert a single record into the withdrawal table with the total payout balance
        const withdrawalQuery = `
            INSERT INTO withdrawal (userId, withdrawal_amount, bank_name, account_no, ifsc_code)
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.promise().query(withdrawalQuery, [userId, total_payout_balance, user[0].restaurant_bank_name, user[0].restaurant_bank_account_no, user[0].restaurant_ifsc_code]);

        // Step 3: Update all commission_transactions to mark them as paid
        const updateCommissionQuery = `
            UPDATE commission_transactions 
            SET is_payout = 1 
            WHERE userId = ? 
                AND is_payout = 0 
                AND status = 'completed'
        `;
        await db.promise().query(updateCommissionQuery, [userId]);

        // Step 4: Respond with a success message
        res.status(200).json({ message: 'Withdrawal processed successfully', totalPayout: total_payout_balance });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
};


// Get All Withdrawals
exports.getAllWithdrawals = async (req, res) => {
    try {
        const userId = req.userId;
        const query = `
        SELECT 
            w.*, 
            u.username,
            u.restaurantName
        FROM 
            withdrawal w
        JOIN 
            users u ON w.userId = u.id
        WHERE 
            w.userId = ?
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


// get my unpaid commission
exports.getMyUnpaidCommission = (req, res) => {
    const userId = req.userId;

    const commissionQuery = `
        SELECT * 
        FROM commission_transactions 
        WHERE userId = ? 
        AND payment_mod = 'cod'
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
            AND payment_mod = 'cod'
            AND is_payout = 0 
            AND status = 'completed'
    `;

    // Execute the first query to get all data
    db.query(commissionQuery, [userId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error fetching Unpain Commission', details: err.message });
        }

        if (result.length === 0) {
            return res.status(200).json({
                total: 0,
                data: result
            });
        }

        // Execute the second query to get the sums
        db.query(sumQuery, [userId], (sumErr, sumResult) => {
            if (sumErr) {
                return res.status(500).json({ error: 'Database error fetching Unpain Commission Sum', details: sumErr.message });
            }

            // Return all data along with the summed values
            return res.status(200).json({
                total: sumResult[0],
                data: result
            });
        });
    });
};


// Pay unpaid commission
exports.PayMyUnpaidCommission = async (req, res) => {
    const userId = req.userId;

    const userQuery = `SELECT * FROM users WHERE id = ?`;
    const [user] = await db.promise().query(userQuery, [userId]);

    const { username, email, phone } = user[0];

    const sumQuery = `
        SELECT 
            SUM(payout_balance) AS total_payout_balance,
            SUM(commition_amount) AS total_commission_amount,
            SUM(billing_amount) AS total_billing_amount
        FROM 
            commission_transactions 
        WHERE 
            userId = ? 
            AND payment_mod = 'cod'
            AND is_payout = 0 
            AND status = 'completed'
    `;

    // Execute the query to get the sums
    db.query(sumQuery, [userId], async (sumErr, sumResult) => {
        if (sumErr) {
            return res.status(500).json({ error: 'Database error fetching unpaid commission sum', details: sumErr.message });
        }

        // Check if there is a valid result and unpaid commissions exist
        if (!sumResult.length || !sumResult[0].total_payout_balance || sumResult[0].total_payout_balance >= 0) {
            return res.status(200).json({
                message: 'No unpaid commission found',
                total: 0
            });
        }

        const commitionAmount = sumResult[0].total_commission_amount;

        const data = { amount: commitionAmount, name: username, email, phone };
        const order = await razorPayCreateOrderUnpaidCommission(data);

        const commissiondepositquery = `INSERT INTO commission_deposit (userId, deposit_amount, payment_mode, razorpay_order_id) 
          VALUES ( ?, ?, ?, ?)`;
        const [commissiondeposit] = await db.promise().query(commissiondepositquery, [userId, commitionAmount, 'online', order.id]);

        // Return all data along with the summed values
        return res.status(200).json({
            message: 'Unpaid commissions found',
            total: sumResult[0],
            order,
        });
    });
};



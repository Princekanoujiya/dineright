const db = require('../../config');

// Get All dashboard data
exports.restaurantDashboard = async (req, res) => {
    try {
        const userId = req.userId;

        console.log("userId", userId)

        // Query for total bookings
        const bookingsQuery = `SELECT * FROM bookings WHERE userId = ? AND booking_status IN ('upcoming','inprogress','completed','cancelled')`;
        const [bookings] = await db.promise().query(bookingsQuery, [userId]);

         // Count of various types of customers
         const total_bookings = bookings.length;
         const total_online_bookings = bookings.filter(table => table.payment_mod === 'online').length;
         const total_cod_bookings = bookings.filter(table => table.payment_mod === 'cod').length;
         const total_upcoming_bookings = bookings.filter(table => table.booking_status === 'upcoming').length;        
         const total_inprogress_bookings = bookings.filter(table => table.booking_status === 'inprogress').length;
         const total_completed_bookings = bookings.filter(table => table.booking_status === 'completed').length;
         const total_cancelled_bookings = bookings.filter(table => table.booking_status === 'cancelled').length;

        // Query for total withdrawal amount
        const withdrawalQuery = `SELECT * FROM withdrawal WHERE userId = ?`;
        const [withdrawalResults] = await db.promise().query(withdrawalQuery, [userId]);

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
        const commissionQuery = `SELECT * FROM commission_transactions WHERE userId = ? AND status = 'completed'`;
        const [commissionResults] = await db.promise().query(commissionQuery, [userId]);

        // payout
        const total_payout_balance = commissionResults.reduce((total, table) => total + parseInt(table.payout_balance), 0);

        // commission
        const total_commition_amount = commissionResults.reduce((total, table) => total + parseInt(table.commition_amount), 0);

        // billing
        const billing_amount = commissionResults.reduce((total, table) => total + parseInt(table.billing_amount), 0);


        const total = {

            total_bookings: total_bookings || 0,
            total_online_bookings: total_online_bookings || 0,
            total_cod_bookings: total_cod_bookings || 0,
            total_upcoming_bookings: total_upcoming_bookings || 0,
            total_inprogress_bookings: total_inprogress_bookings || 0,
            total_completed_bookings: total_completed_bookings || 0,
            total_cancelled_bookings: total_cancelled_bookings || 0,

            total_payout_balance: total_payout_balance || 0,
            total_commition_amount: total_commition_amount || 0,
            total_billing_amount: billing_amount || 0,
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
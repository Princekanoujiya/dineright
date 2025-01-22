 // Step 3: Update all commission_transactions to mark them as paid
 const updateCommissionQuery = `
 UPDATE commission_transactions 
 SET is_payout = 1, uuid = ?
 WHERE userId = ? 
     AND is_payout = 0 
     AND status = 'completed'
`;
await db.promise().query(updateCommissionQuery, [uuId, userId]);
const moment = require('moment-timezone');

// Get the current date and time in IST
const indiaDateTime = moment.tz('Asia/Kolkata');

// Format and display the current date and time
const currentDate = indiaDateTime.format('YYYY-MM-DD');
// Get the current time in IST
const currentTime = indiaDateTime.format('HH:mm:ss');

console.log('Current Date (IST):', currentDate);
console.log('Current Time (IST):', currentTime);

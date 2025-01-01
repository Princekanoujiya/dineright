const moment = require('moment-timezone');

// Example booking time
let bookingTime = '2024-11-15 17:34:56';

// Parse the booking time and set it to IST
let bookingMoment = moment.tz(bookingTime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');

// Get the current time in IST
let currentTime = moment.tz('Asia/Kolkata');

// Subtract 2 hours from the booking time
let timeBeforeTwoHours = bookingMoment.clone().subtract(2, 'hours');

// Print the current time, booking time, and time before 2 hours in IST
console.log("Current Time (IST): " + currentTime.format('YYYY-MM-DD HH:mm:ss'));
console.log("Booking Time (IST): " + bookingMoment.format('YYYY-MM-DD HH:mm:ss'));
console.log("Time Before 2 Hours (IST): " + timeBeforeTwoHours.format('YYYY-MM-DD HH:mm:ss'));

if(timeBeforeTwoHours > currentTime){
    console.log('booton', true)
} else {
    console.log('booton', false)
}

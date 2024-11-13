const moment = require('moment-timezone');

// // Get the current date and time in IST
// const indiaDateTime = moment.tz('Asia/Kolkata');

// // Format and display the current date and time
// const currentDate = indiaDateTime.format('YYYY-MM-DD');
// // Get the current time in IST
// const currentTime = indiaDateTime.format('HH:mm:ss');

// console.log('Current Date (IST):', currentDate);
// console.log('Current Time (IST):', currentTime);

// const time1 = '19:16';

// const time2 = '19:15';

// if(time1 <= time2){
//     console.log('true ',time1, ': ', time2)
// }

function getBookingAndUpdatedTimestamp(booking_date, booking_time, minutesToAdd) {
    // Combine booking_date and booking_time into a single string
    let bookingDateTime = `${booking_date} ${booking_time}`;

    // Create a moment object from the combined string in IST (India Standard Time)
    let indiaTime = moment.tz(bookingDateTime, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');

    // Format the initial booking timestamp in ISO 8601 format with IST timezone offset (+05:30)
    let bookingTimestamp = indiaTime.format('YYYY-MM-DDTHH:mm:ss.SSSZ');

    // Add the specified number of minutes to the booking time
    indiaTime.add(minutesToAdd, 'minutes');

    // Format the updated timestamp in ISO 8601 format with IST timezone offset (+05:30)
    let updatedTimestamp = indiaTime.format('YYYY-MM-DDTHH:mm:ss.SSSZ');

    // Return both booking timestamp and updated timestamp
    return {
        bookingTimestamp,
        updatedTimestamp
    };
}



const time = getBookingAndUpdatedTimestamp('2024-11-13','18:00', 45)
console.log('time', time)

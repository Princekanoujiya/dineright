function addHoursToTime(booking_time, hoursToAdd) {
  // Split the booking_time into hours and minutes
  let [hours, minutes] = booking_time.split(':').map(Number);

  // Create a new Date object for today and set the hours and minutes
  let bookingDate = new Date();
  bookingDate.setHours(hours);
  bookingDate.setMinutes(minutes);

  // Add the specified number of hours (in this case 4 hours)
  bookingDate.setHours(bookingDate.getHours() + hoursToAdd);

  // Format the new time back to "HH:mm"
  let newHours = bookingDate.getHours().toString().padStart(2, '0');
  let newMinutes = bookingDate.getMinutes().toString().padStart(2, '0');

  return `${newHours}:${newMinutes}`;
}

// Example usage:
let booking_time = "12:30";
let updatedTime = addHoursToTime(booking_time, 4);

console.log(updatedTime);  // Outputs "22:30" if the original time is "18:30"

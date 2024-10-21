let defaultSpendingTime = 60;

    const spendingTimeQuery = `SELECT restro_spending_time FROM restro_guest_time_duration restro_guest = ? AND userId = ?`;
    const allSpendingTimeQuery = `SELECT restro_spending_time FROM restro_guest_time_duration restro_guest = ? AND userId = ?`;

    const [spendingTime] = await db.promise().query(spendingTimeQuery, [booking_no_of_guest, userId]);

    console.log('defaultSpendingTime', spendingTime)

    return;

    if(spendingTime.length === 0){
      const [allSpendingTime] = await db.promise().query(allSpendingTimeQuery, [userId]);

      if(allResponseTime.length > 0){
        defaultSpendingTime = Math.max(...allSpendingTime);
      } else {
        defaultSpendingTime = 180;
      }
    }

    console.log('defaultSpendingTime', defaultSpendingTime)

    return;



    bannerImages , bannerImages.banner_image = process.env.BASE_URL + bannerImages.banner_image,
    bannerGallery , bannerGallery.files = process.env.BASE_URL + bannerGallery.files,
    bannerVideos, bannerVideos.banner_video = process.env.BASE_URL + bannerVideos.banner_video

    'Activated','Deactivated'
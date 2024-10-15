const express = require('express');

// validations
const { validateBookingPayment } = require('../validations');
//superadmin
const { loginSuperadmin,getGuests ,getGuestsbyID,insertOrUpdateBlog,deleteBlog,getAllBlogs,getBlog,updateUserStatusAndCommission,updateCommissionStatus ,getDeactivatedRestaurants} = require('../controllers/superadmin/superadmin_authcontroller');

const { insertOrUpdateBannerSection,getAllBannerSections, getBannerSectionById} = require('../controllers/superadmin/uploadController');
const { insertOrUpdateCuisineSection,getAllCuisinsSections ,getCuisionSectionById} = require('../controllers/superadmin/cuisinsController');


//restroadmin
const { getAllBookings, getOneBooking, getAllDiningAreaAndAllocatedTables, newBookingInsert, updateBookingPayment, getBookingDetails } = require('../controllers/restorant/restorantBookingController');
const { 
    createOrUpdateOneStep, stepTwo, getAllDiningAreas,getAllCities,resendrestaurantOtp,
    getDaysListing,sendOtp, login, verifyOtp, setPassword, insertTimingData ,insertDiningArea, 
    loginWithOtp,verifyLoginOtp,stepTwoAndSendOtp,insertOrUpdateTimingData,restro_guest_time_duration,
    insertDiningTable,getUserInfo,getTimingData,getDiningAreas,getDiningTables,getUsersInfo,getSelectedCuisines,
    getSelectedRestaurantTypes,getRestroInfo,getUserInfoWithCuisinesAndRestaurantTypes
} = require('../controllers/authController');



const { createOrUpdateCourse,getAllCourses,DeleteCourse,getCourseById} = require('../controllers/coursesController');
const { createOrUpdateMenu,getMenu,DeleteMenu} = require('../controllers/menusController');
const { createOrUpdateMenuItem,getMenuItem,deleteMenuItem,softDeleteMenuItem} = require('../controllers/menuItemsController');
const { getCourseMenu,getCourseMenuGroupByCourseId} = require('../controllers/master_card');
const { insertOrUpdateBookingTable,getMasterCard,getMasterBeverage,book_product} = require('../controllers/booking_controller');
const { enquiry} = require('../controllers/enquiryController');
const { getRestaurantType,getCuisines,getUserIdsByFilters} = require('../controllers/filtersController');


const menuItemsController = require('../controllers/menuItems_with_token');
const uploadsController = require('../controllers/uploadsController');
const uploadsVideoController = require('../controllers/uploadVideosController');
const uploadGalleryController = require('../controllers/uploadGalleryController');
const master_card = require('../controllers/master_card');
const beverage_itemController = require('../controllers/beverage_itemController');
const { getRazorpayKey, razorPayCreateOrder, razorpayVerifyPayment } = require('../controllers/razorpayController');
const enquiryController = require('../controllers/enquiryController');

// const booking_controller = require('../controllers/booking_controller');

//user
const { getAllCustomers,createOrUpdateCustomer, verifyCustomerOtp,getCustomerInfo,loginWithEmail,resendOtp,getAllRestaurantWithTime,getrestrodaydetails} = require('../controllers/app_user_authcontroller');





const { verifyCustomerToken } = require('../middlewares/userMiddleware');

const { verifyToken } = require('../middlewares/authMiddleware');


const router = express.Router();

router.post('/createOrUpdate', createOrUpdateOneStep);
router.post('/step-two', stepTwo);
router.post('/send-otp', sendOtp);
router.post('/stepTwoAndSendOtp', stepTwoAndSendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/set-password', setPassword);
router.post('/restro_guest_time_duration', restro_guest_time_duration);
router.post('/insert-service', insertTimingData);
router.post('/insertDiningArea', insertDiningArea);
router.post('/insert-dining-table', insertDiningTable);
router.post('/insertOrUpdateTimingData', insertOrUpdateTimingData);
router.get('/getUsersInfo', getUsersInfo);
router.post('/loginWithOtp', loginWithOtp);
router.post('/verifyLoginOtp', verifyLoginOtp);
router.post('/login', login);
router.post('/resendrestaurantOtp', resendrestaurantOtp);
router.get('/getSelectedCuisines', getSelectedCuisines);
router.get('/getDaysListing', getDaysListing);
router.get('/getAllDiningAreas', getAllDiningAreas);
router.get('/getAllCities', getAllCities);

router.get('/user/:userId', getUserInfo);//done
router.get('/timing/:userId',getTimingData);//done
router.get('/dining-areas/:userId',getDiningAreas);//done
router.get('/dining-tables/:userId', getDiningTables);//done

router.post('/courses', createOrUpdateCourse);//done
router.get('/courses', getAllCourses);//done
router.get('/courses/:course_id', getCourseById);//done
router.patch('/courses/:course_id', DeleteCourse);//done

router.post('/menus', createOrUpdateMenu); //done
router.get('/menus/:menu_id?', getMenu); //done
router.patch('/menus/:menu_id', DeleteMenu);//done


router.post('/menu_item', createOrUpdateMenuItem);//done
router.get('/menu_item/:menu_item_id?', getMenuItem);//done
router.delete('/menu_item/:menu_item_id?', deleteMenuItem);//-----------------
router.delete('/menu_item/:menu_item_id?', softDeleteMenuItem);//---------------

router.post('/menu_item_token', verifyToken, menuItemsController.insertOrUpdateMenuItem);//done
router.get('/getMenuItemsbyId/:menuId',  menuItemsController.getMenuItemsbyId);
router.get('/menu_item_token/active', verifyToken, menuItemsController.getActiveMenuItems);
router.get('/menu_item_token', verifyToken, menuItemsController.getMenuItems);
router.delete('/menu_item_token/:menu_item_id', verifyToken, menuItemsController.deleteMenuItem);


router.get('/getCourseMenu', getCourseMenu);
router.get('/getAllMasterMenus', verifyToken, master_card.getAllMasterMenus);
router.get('/getCourseMenuGroupByCourseId', getCourseMenuGroupByCourseId);

router.post('/insertMasterMenuItem', verifyToken, master_card.insertMasterMenuItem);
router.get('/getMasterMenuItems', verifyToken, master_card.getMasterMenuItems);
router.delete('/deleteMasterMenuItem', verifyToken, master_card.deleteMasterMenuItem);


router.get('/getAllBeverages', verifyToken, beverage_itemController.getAllBeverages);
router.get('/getBeverageItemsbyId/:beverageId',  beverage_itemController.getBeverageItemsbyId);
router.post('/insertMasterBeverageItem', verifyToken, beverage_itemController.insertMasterBeverageItem);
router.get('/getMasterBeverageItems', verifyToken, beverage_itemController.getMasterBeverageItems);
router.delete('/deleteMasterBeverageItem', verifyToken, beverage_itemController.deleteMasterBeverageItem);




router.post('/banner_image', verifyToken, uploadsController.insertOrUpdateBannerImage);//done
router.get('/banner_image', verifyToken, uploadsController.getBannerImages);//done
router.delete('/banner_image/:banner_image_id', verifyToken, uploadsController.deleteBannerImage);//done

router.post('/banner_video', verifyToken, uploadsVideoController.insertOrUpdateBannerVideo);//done
router.get('/banner_video', verifyToken, uploadsVideoController.getBannerVideos);//done
router.delete('/banner_video/:banner_video_id', verifyToken, uploadsVideoController.deleteBannerVideo);//done
router.post('/gallery', verifyToken, uploadGalleryController.insertOrUpdateBannerGallery);//done
router.delete('/banner_gallery/:banner_gallery_id', verifyToken, uploadGalleryController.deleteBannerGalleryItem);//done


// restorant routes
router.get('/getAllbookings', verifyToken, getAllBookings);
router.get('/getOneBooking/:booking_id', verifyToken, getOneBooking);
router.get('/getAllocatedTables', verifyToken, getAllDiningAreaAndAllocatedTables);
router.post('/insertNewBooking', verifyToken, newBookingInsert);
router.patch('/updateBookingPayment', verifyToken, updateBookingPayment);
router.get('/getBookingDetails/:booking_id', verifyToken, getBookingDetails);


//user side api
router.post('/customers', createOrUpdateCustomer); //done
router.get('/customers', getAllCustomers); //done
router.post('/customers/verifyOtp', verifyCustomerOtp); //done
router.get('/customers/:customer_id', getCustomerInfo); //done
router.post('/customer_login', loginWithEmail); //done
router.post('/customer_resend_otp', resendOtp); //done
// router.post('/insertOrUpdateBookingTable',verifyCustomerToken,insertOrUpdateBookingTable);
router.get('/getMasterCard',getMasterCard);
router.get('/getMasterBeverage',getMasterBeverage);
router.post('/book_product',verifyCustomerToken,book_product);
router.get('/getrestrodaydetails',getrestrodaydetails);
router.get('/getAllRestaurantWithTime',getAllRestaurantWithTime);
router.get('/getDaysListing', verifyCustomerToken,getDaysListing);



router.post('/enquiry',enquiry);

//superadmin
router.post('/superadminlogin', loginSuperadmin);
router.get('/getGuests', getGuests);
router.get('/getGuestsbyID', getGuestsbyID);
router.put('/updateUserStatusAndCommission/:id', updateUserStatusAndCommission );
router.put('/updateCommissionStatus/:id', updateCommissionStatus);
router.post('/insertOrUpdateBlog', insertOrUpdateBlog);
router.post('/deleteBlog', deleteBlog);
router.get('/getAllBlogs', getAllBlogs);
router.post('/getBlog', getBlog);
router.get('/getDeactivatedRestaurants', getDeactivatedRestaurants);


router.post('/insertOrUpdateBannerSection', insertOrUpdateBannerSection);
router.get('/banners', getAllBannerSections);
router.get('/banners/:frontend_banner_section_id', getBannerSectionById);
// router.delete('/banners/:frontend_banner_section_id', deleteBannerSection);

router.post('/insertOrUpdateCuisineSection', insertOrUpdateCuisineSection);
router.get('/cuisins', getAllCuisinsSections);
router.get('/cuisins/:frontend_cuisins_section_id', getCuisionSectionById);
// router.delete('/cuisins/:frontend_cuisins_section_id', deleteBannerSection);




// Razorpay Routes
router.get('/razorpay_key', getRazorpayKey);
router.post('/verify_payment', razorpayVerifyPayment);


//filters
router.get('/getRestaurantType',getRestaurantType);
router.get('/getcuisines',getCuisines);
router.get('/getSelectedRestaurantTypes',getSelectedRestaurantTypes);
router.get('/getRestroInfo',getRestroInfo);
router.get('/getUserInfoWithCuisinesAndRestaurantTypes',getUserInfoWithCuisinesAndRestaurantTypes);
router.get('/getUserIdsByFilters',getUserIdsByFilters);
module.exports = router;
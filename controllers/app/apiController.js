const HelpContact = require('../../models/Help_Contact');
const Coupon = require('../../models/coupon');
const Patient = require('../../models/patient');
const Physio = require('../../models/physio');
const Notification = require('../../models/notification');
const Appointment = require('../../models/appointment');
const Transaction = require('../../models/transaction');
const moment = require('moment-timezone');

// Add Review
exports.AddReview = async (req, res) => {

  try {
    const {
      appointmentId,
      patientId,
      physioId,
      rating,
      comment
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        message: "Patient Id is required",
        status: 400,
        success: false
      });
    }

    if (!physioId) {
      return res.status(400).json({
        message: "Physio Id is required",
        status: 400,
        success: false
      });
    }

    if (!rating) {
      return res.status(400).json({
        message: "Rating is required",
        status: 400,
        success: false
      });
    }

    if (!appointmentId) {
      return res.status(400).json({
        message: "Appointment Id is required",
        status: 400,
        success: false
      });
    }

    // Validate Patient Id
    const checkPatient = await Patient.findById(patientId);
    if (!checkPatient) {
      return res.status(400).json({
        message: "Invalid Patient Id",
        status: 400,
        success: false
      });
    }

    // Validate Physio Id
    const checkPhysio = await Physio.findById(physioId);
    if (!checkPhysio) {
      return res.status(400).json({
        message: "Invalid Physio Id",
        status: 400,
        success: false
      });
    }



    // Check if the patient has already reviewed the physio
    const checkReview = await Review.findOne({
      patientId,
      physioId,
      appointmentId,
      comment: { $exists: true, $ne: "" }
    });

    if (checkReview) {

      return res.status(400).json({
        message: "You have already reviewed this appointment",
        status: 400,
        success: false
      });
    }

    // Add the review
    const review = new Review({
      patientId,
      physioId,
      rating: Number(rating),
      comment,
      appointmentId
    });
    await review.save();

    // We will initially set the physio's rating to zero because it might have been 
    // added by the admin earlier. 
    // This way, there won’t be any conflicts 
    // when the real rating comes in from the patient.
    checkPhysio.rating = 0
    await checkPhysio.save()
    // Update physio's average rating
    const reviews = await Review.find({ physioId });
    const totalCountRating = reviews.length;
    const totalRatingCount = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = (totalRatingCount / totalCountRating).toFixed(1);

    await Physio.findByIdAndUpdate(physioId, { rating: averageRating });

    return res.status(201).json({
      message: "Review added successfully and physio rating updated",
      status: 201,
      success: true,
      data: review
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Something went wrong. Please try again.",
      status: 500,
      success: false
    });
  }
};


// This funtion is getting unreadNotifications in patient site
exports.getUnreadNotification = async (req, res) => {
  try {
    const { patientId } = req.query;

    // Validate patientId
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "patientId is required"
      });
    }

    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    // Get unread notifications
    const unreadNotifications = await Notification.find({
      patientId,
      isRead: false,
      from: { $in: ["admin", "physio"] },
      to: "patient"
    }).populate("physioId patientId");

    return res.status(200).json({
      success: true,
      message: "Unread notifications fetched successfully",
      data: unreadNotifications
    });

  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message || error
    });
  }
};


// update notifications from patinet side 
exports.getUnreadNotificationUpdate = async (req, res) => {
  try {
    const { patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({ success: false, message: "patientId is required" });
    }

    const result = await Notification.updateMany(
      {
        patientId,
        to: "patient",
        from: { $in: ["admin", "physio"] },
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message || error,
    });
  }
};

// give physio like and dislike
exports.likePatientByPhysio = async (req, res) => {
  try {

    // give physio like and dislike
    const patientId = req.body.patientId;
    const physioId = req.body.physioId;
    const thePatient = await Patient.findById(patientId);
    const thePhysio = await Physio.findById(physioId);

    if (!thePatient) {
      return res.status(400).json({
        status: false,
        message: "No patient exists with this Id"
      });
    }


    if (!thePhysio) {
      return res.status(400).json({
        status: false,
        message: "No physio exists with this Id"
      });
    }

    const theLike = await Like.findOne({
      patientId: patientId,
      physioId: physioId
    });

    if (theLike) {
      // if already liked then dislike the delete the like
      await Like.findByIdAndDelete(theLike._id);
      return res.status(200).json({
        status: true,
        message: "Disliked Successfully"
      })

    } else {
      // if not liked then like the physio
      const newLike = await new Like({
        patientId: patientId,
        physioId: physioId,
        like: true,
      });
      await newLike.save();
      return res.status(200).json({
        status: true,
        message: "Liked Successfully"
      })
    }


  } catch (error) {
    return res.status(400).json({
      message: "Semething went wrong",
      status: 500,
      success: false
    })
  }
};

// Get Patient likes by physio {Favorit Physio}
exports.getPatientLikesByPhysio = async (req, res) => {
  try {
    const {
      patientId
    } = req.query;

    if (!patientId) {
      return res.status(400).json({
        status: false,
        message: "patientId is required"
      });
    }

    const likes = await Like.find({
      patientId
    }).populate("physioId patientId");

    return res.status(200).json({
      status: true,
      message: "Likes fetched successfully",
      data: likes
    })

  } catch (error) {
    return res.status(400).json({
      message: "Semething went wrong",
      status: 500,
      success: false
    })
  }
}

exports.AllBlogs = async (req, res) => {
  try {
    // Fetch all blogs
    const blogs = await Blog.find();

    // If no blogs found
    if (!blogs || blogs.length === 0) {
      return res.status(404).json({
        message: "No blogs found",
        status: 404,
        success: false,
      });
    }

    // Set the start date as January 13, 2022
    let startDate = moment("2022-01-13");

    // Update each blog with the new date and random views
    const updatedBlogs = await Promise.all(
      blogs.map(async (blog, index) => {
        // Increment date by 8 days for each blog
        let blogDate = moment(startDate).add(index * 8, 'days');

        // Format the date to the required format
        const formattedDate = blogDate.format("YYYY-MM-DDTHH:mm:ss.SSSSSS");

        // Generate random views between 50 and 250
        // const randomViews = Math.floor(Math.random() * (250 - 50 + 1)) + 50;

        // Update blog's date and views
        blog.date = formattedDate;
        // blog.views = randomViews;

        // Save the updated blog
        await blog.save();

        return blog; // Return the updated blog for reference
      })
    );

    return res.status(200).json({
      message: "Blogs updated successfully",
      status: 200,
      success: true,
      data: updatedBlogs, // Return updated blogs data if needed
    });

  } catch (error) {
    console.error(error); // Log the error for debugging
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }

};

// coupon find coupon name is exixt or not 
exports.coupon = async (req, res) => {
  try {
    const { couponName, patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({
        message: "patientId is required",
        status: 400,
        success: false,
      });
    }


    if (!couponName) {
      return res.status(400).json({
        message: "couponName is required",
        status: 400,
        success: false,
      });
    }

    const coupon = await Coupon.findOne({ couponName }).populate("patientId physioId");
    if (!coupon) {
      return res.status(200).json({
        message: "No coupon found",
        status: 400,
        success: false,
      });
    }

    const constAlreadyUsed = coupon.patientId.some((id) => id.equals(patientId))
    if (constAlreadyUsed) {
      return res.status(400).json({
        message: "Coupon code is alreadyuse by this patientid",
        status: 400,
        success: false
      });
    }

    return res.status(200).json({
      message: "Coupon found",
      status: 200,
      success: true,
      data: coupon,
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }
}

// GET notification to Patient
exports.getNotificationPatient = async (req, res) => {
  try {
    const { patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({
        status: false,
        message: "patientId is required"
      });
    }

    const notifications = await Notification.find({
      patientId,
      to: "patient",
      from: { $in: ["admin", "physio"] },
      isRead: true
    }).populate("physioId patientId");

    return res.status(200).json({
      status: true,
      message: "Notifications fetched successfully",
      data: notifications,
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }
}

// Get Physio By total Appointments
exports.getPhysioByTotalAppointments = async (req, res) => {
  try {
    const {
      physioId
    } = req.query;

    if (!physioId) {
      return res.status(400).json({
        status: false,
        message: "physioId is required"
      });
    }

    const count = await Appointment.find({ physioId }).countDocuments();

    // const count = await Subscription.find(
    //   { physioId },
    //   'patientCount'
    // );

    return res.status(200).json({
      status: true,
      message: "Appointments fetched successfully",
      data: count,
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }
}

// Get Physio By total Reviews  
exports.getPhysioByTotalReviews = async (req, res) => {
  // try {
  //   const {
  //     physioId
  //   } = req.query;

  //   if (!physioId) {
  //     return res.status(400).json({
  //       status: false,
  //       message: "physioId is required"
  //     });
  //   }

  //   const reviews = await Review.find({
  //     physioId
  //   }).countDocuments();
  //   // if (!reviews || reviews.length === 0) {
  //   //   return res.status(404).json({
  //   //     message: "No reviews found",
  //   //     status: 404,
  //   //     success: false,
  //   //   });
  //   // }

  //   return res.status(200).json({
  //     status: true,
  //     message: "Reviews fetched successfully",
  //     data: reviews,
  //   });

  // } catch (error) {
  //   console.log(error);
  //   return res.status(500).json({
  //     message: "Something went wrong",
  //     status: 500,
  //     success: false,
  //   });
  // }
}

// VoucherRequest method
exports.voucherRequest = async (req, res) => {
  try {
    const {
      bannerId,
      patientId,
      name,
      age,
      participation,

    } = req.body;
    if (!bannerId || !patientId || !age || !name) {
      return res.status(400).json({
        message: "All fields are required",
        status: 400,
        success: false
      });
    }


    // check if patient exists
    // const voucher = await VoucherRequest.find({
    //   patientId: patientId
    // })

    // if (voucher) {
    //   return res.status(401).json({
    //     message: "Voucher already exists",
    //     status: 401,
    //     success: false
    //   });
    // } 
    let date = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')

    // return console.log(date, 'voucher')

    // add banner patientId to the 
    await Banner.findByIdAndUpdate(
      bannerId,
      { $push: { patientId: patientId } }
    );

    const voucherRequest = new VoucherRequest({
      bannerId,
      patientId,
      age,
      name,
      participation,
      createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
      updatedAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.ssssSS'),
    });
    await voucherRequest.save();

    // Set Patient add coin banner to false
    const patient = await Patient.findById(patientId);
    if (patient) {
      patient.addCoinBanner = false;
      await patient.save();
    }

    return res.status(201).json({
      message: "Voucher request sent successfully",
      status: 201,
      success: true
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }
};

// patent Add coupon request
exports.patientAddCouponRequest = async (req, res) => {
  try {
    const {
      patientId,
      couponName,
    } = req.query;

    // console.log(req.query, 'patientAddCouponRequest')

    if (!patientId || !couponName) {
      return res.status(400).json({
        message: "All fields are required",
        status: 400,
        success: false
      });
    }

    // check if patient exists
    const checkPatient = await Patient.findById(patientId);
    if (!checkPatient) {
      return res.status(401).json({
        message: "Invalid Patient Id",
        status: 401,
        success: false
      });
    }

    // check if coupon exists
    const checkCoupon = await Coupon.findOne({ couponName });
    if (!checkCoupon) {
      return res.status(401).json({
        message: "Invalid Coupon Id",
        status: 401,
        success: false
      });
    }

    // patient check if coupon already exists
    const checkPatientCoupon = await Coupon.findOne({
      patientId: patientId,
      couponName: couponName
    });
    if (checkPatientCoupon) {
      return res.status(401).json({
        message: "Coupon already exists",
        status: 401,
        success: false
      });
    }

    // coupen Add patientId to the
    await Coupon.findByIdAndUpdate(
      checkCoupon._id,
      {
        $addToSet: { patientId: checkPatient._id }, // Add physioId to the array if not already present
        $inc: { usageCount: 1 }             // Increment usageCount by 1
      },
      { new: true } // Return the updated document
    );

    // patent Add wallet amount in coupon
    await Patient.findByIdAndUpdate(
      checkPatient._id,
      {
        $inc: { wallet: checkCoupon.discount } // Increment wallet by coupon value
      }
    );

    // transaction transaction
    const transaction = new Transaction({
      patientId: patientId,
      amount: checkCoupon.discount,
      patientTransactionType: 0,
      paymentMode: "offline",
      paymentStatus: "paid",
    });
    await transaction.save();

    return res.status(201).json({
      message: "Coupon added to patient successfully",
      status: 201,
      success: true
      // data: checkCoupon,
    });


  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }
};

exports.getPatientAddCouponRequest = async (req, res) => {
  try {
    const { patientId } = req.query;

    if (!patientId) return res.status(400).json({
      message: 'PatientId is required',
      success: false,
      status: 400
    });

    const patient = await Patient.findById({ _id: patientId });
    if (!patient) return res.status(400).json({
      message: 'Patient not found',
      success: false,
      status: 400
    });

    const transactions = await Transaction.find({
      patientId: patientId,
      paymentMode: { $in: ['coin', 'online/coin'] }
    }).lean();

    const voucherRequests = await VoucherRequest.find({
      patientId: patientId
    }).lean();

    transactions.forEach(tx => tx.transactionType = "debit");
    voucherRequests.forEach(vr => vr.transactionType = "credit");

    const combinedData = [...transactions, ...voucherRequests];
    combinedData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.status(200).json({ message: 'All voucher requests for the patient', status: 200, Success: true, CoinTransactions: combinedData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching voucher requests', status: 500, Success: false });
  }
};

// Get patent By coupon 
exports.getPatientByCoupon = async (req, res) => {
  try {
    const {
      patientId,
      couponId,
    } = req.query;
    if (!patientId || !couponId) {
      return res.status(400).json({
        message: "All fields are required",
        status: 400,
        success: false
      });

    }
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        message: "Patient not found",
        status: 404,
        success: false
      });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        message: "Coupon not found",
        status: 404,
        success: false
      });

    }

    // check if patient exists in the database coupon
    const checkPatientCoupon = await Coupon.findOne({
      patientId: patientId,
      couponId: couponId
    });

    return res.status(200).json({
      message: "Patient found by coupon",
      status: 200,
      success: true,
      data: checkPatientCoupon
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }
};


// get Help information
exports.getHelpContact = async (req, res) => {
  try {

    let patientId = req.query.patientId;
    if (!patientId) {
      return res.status(400).json({
        message: "Patient Id is required",
        status: 400,
        success: false
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(400).json({
        message: "Invalid Patient Id",
        status: 400,
        success: false
      });
    }

    const helpContact = await HelpContact.find({
      patientId: req.query.patientId,
      type: 2
    });
    return res.status(200).json({
      message: "Help Contact fetched successfully",
      status: 200,
      success: true,
      data: helpContact
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }
};

// Add Help Contact
exports.AddHelpContact = async (req, res) => {
  try {
    // console.log("Add Help Contact", req.body); 
    const helpContact = new HelpContact({
      email: req.body.email,
      messages: {
        message: req.body.message
      },
      patientId: req.body.patientId,
      type: 2,
      createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
      updatedAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    });

    await helpContact.save();
    return res.status(200).json({
      message: "Help Contact added successfully",
      status: 200,
      success: true,
      data: helpContact
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false
    });
  }
};

// resend message to Help Contact
exports.resendMessage = async (req, res) => {
  try {
    // console.log("Resend Message", req.body);

    const { message, helpContactId } = req.body;

    if (!message || !helpContactId) {
      return res.status(400).json({
        message: "Message and Help Contact Id are required",
        status: 400,
        success: false
      });
    }

    const newMessage = {
      message: message,
      date: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
    };

    const helpContact = await HelpContact.findByIdAndUpdate(
      helpContactId,
      {
        $push: {
          "messages": newMessage // Append the new message to the `messages` array
        },
        $set: {
          "status": 0 // Update the `status` field
        }
      },
      { new: true }
    );

    return res.status(200).json({
      message: "Help Contact message resent successfully",
      status: 200,
      success: true,
      data: helpContact
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      message: "Something went wrong",
      status: 500,
      success: false
    });
  }
};



// getting review and rating  of physio after completed  treament 

exports.getPhysioTreatmentRatingReview = async (req, res) => {

  try {

    const { physioId, Israting } = req.query


    if (!physioId) {
      return res.status(400).json({
        message: "physioId is required",
        status: 400,
        success: false
      });
    }

    let query = {
      physioId,
      rating: { $exists: true },
      comment: { $exists: true },
    }
    if (Israting) {
      query.rating = { $eq: Israting }
    }
    const physioRatingandReview = await Review.find(query).populate('patientId physioId')

    if (physioRatingandReview.length > 0) {

      return res.status(200).json({
        message: "physio review and rartings",
        status: 200,
        success: physioRatingandReview
      });

    }



    else {

      return res.status(404).json({
        message: "No rating & review found of this physio ",
        status: 404,
        success: false
      });
    }

  } catch (error) {
    return res.status(500).json({
      message: "Internal server Error From raating Review " + error,
      status: 500,
      success: false
    });
  }
}
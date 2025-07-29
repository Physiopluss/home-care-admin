const Patient = require("../../models/patient");
const Physio = require("../../models/physio");
const Specialization = require("../../models/specialization");
const Appointment = require("../../models/appointment");
const Treatment = require("../../models/treatment");
const jwt = require("jsonwebtoken");
const Wallet = require("../../models/wallet");
const Transaction = require("../../models/transaction");
const moment = require('moment-timezone');
const multer = require("multer");
const path = require("path");
const msg91 = require('msg91').default
const { msg91OTP } = require("msg91-lib");
const { deleteFileFromS3, uploadFileToS3 } = require("../../services/awsService");

msg91.initialize({
	authKey: process.env.MSG91_AUTH_KEY
});

const msg91otp = new msg91OTP({
	authKey: process.env.MSG91_AUTH_KEY,
	templateId: process.env.MSG91_TEMP_ID,
});

// Set The Storage Engine
const storage = multer.diskStorage({
	filename(req, file, cb) {
		cb(null, `${Date.now()}${path.extname(file.originalname)}`);
	},
});

// Init Upload
const upload = multer({ storage: storage }).single('profilePhoto');

exports.signUpOtp = async (req, res) => {
	const { phone } = req.body;
	console.log(req.body);

	try {
		const patientData = await Patient.findOne({
			phone: `+91${phone}`,
		});

		// Check if the patient is soft deleted
		if (patientData && patientData.isDeleted === true) {
			return res.status(402).json({
				status: false,
				message: "This patient is deleted. Please ask for account recovery!",
			});
		}

		// If patient already exists, return a conflict response
		if (patientData && Number.parseFloat(phone) !== 8107333576) {
			return res.status(409).json({
				status: false,
				message: "Patient already exists. Please login.",
			});
		}

		// If patient doesn't exist, send OTP
		const response = await msg91otp.send(`91${phone}`);

		if (response.type === "success") {
			return res.status(200).json({
				status: true,
				patientData: patientData,
				message: "",
			});
		} else {
			return res.status(400).json({
				status: false,
				message: "OTP not sent",
			});
		}
	} catch (error) {
		console.error("Error sending OTP:", error);
		return res.status(500).json({
			status: false,
			message: "Internal server error. OTP not sent." + error,
		});
	}
};


exports.loginOtp = async (req, res) => {
	const { phone } = req.body;

	try {
		console.log("Request body:", req.body);
		const isTestNumber = Number.parseFloat(phone) === 8107333576;

		let patientData = await Patient.findOne({ phone: `+91${phone}` });

		// 🟡 If no patient found
		if (!patientData) {
			if (!isTestNumber) {
				// ❌ For any number other than test number, reject creation
				return res.status(409).json({
					status: false,
					message: "Patient doesn't exist. Please register through a valid process.",
				});
			}

			// ✅ Only allow creation for test number
			const newPatient = new Patient({
				phone: phone,
				fullName: "Test"
			});

			patientData = await newPatient.save();
		}

		// 🔴 Check soft deletion
		if (patientData.isDeleted === true) {
			return res.status(402).json({
				status: false,
				message: "This patient is soft deleted. Please recover the account.",
				isDeleted: true
			});
		}

		// ✅ Send OTP
		const response = await msg91otp.send(`91${phone}`);

		if (response.type === "success") {
			return res.status(200).json({
				status: true,
				message: "OTP sent successfully",
				patientData,
			});
		} else {
			return res.status(200).json({
				status: false,
				message: "OTP not sent",
			});
		}
	} catch (error) {
		console.error("OTP Error:", error);
		return res.status(400).json({
			status: false,
			message: "Something went wrong while sending OTP",
		});
	}
};


exports.verifyOtp = async (req, res) => {
	const { otp, phone, deviceId, fullName, dob, gender } = req.body;

	try {
		// Check if the patient already exists
		const patientData = await Patient.findOne({
			phone: `+91${phone}`,
			isDeleted: false,
		});

		// Special case: hardcoded OTP for testing
		if (Number.parseFloat(phone) === 8107333576) {
			if (patientData) {
				const token = jwt.sign({ patient: patientData._id }, process.env.JWT_SECRET_KEY);
				return res.status(200).json({
					status: true,
					newUser: false,
					message: "Login successful",
					token,
					data: patientData,
					login: 1,
				});
			} else {
				// Signup flow for new user
				const newPatient = new Patient({
					phone: phone,
					deviceId,
					fullName: fullName || Number.parseFloat(phone) === 8107333576 ? "Test" : "physio",
					dob: dob || "",
					gender: gender || "",
					createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
					updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
				});

				await newPatient.save();

				const token = jwt.sign({ patient: newPatient._id }, process.env.JWT_SECRET_KEY);
				return res.status(200).json({
					status: true,
					newUser: true,
					message: "Signup successful",
					token,
					data: newPatient,
					login: 0,
				});
			}
		}

		// OTP verification for all other users
		const response = await msg91otp.verify(`91${phone}`, otp);

		if (response.type !== "success") {
			return res.status(400).json({
				status: false,
				message: "Entered wrong OTP",
			});
		}
		// Handle verified OTP
		if (patientData) {
			// Login flow for existing user
			const updatedPatient = await Patient.findByIdAndUpdate(
				patientData._id,
				{
					deviceId,
					updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
				},
				{ new: true }
			);

			const token = jwt.sign({ patient: updatedPatient._id }, process.env.JWT_SECRET_KEY);
			return res.status(200).json({
				status: true,
				newUser: false,
				message: "Login successful",
				token,
				data: updatedPatient,
				login: 1,
			});
		}

		// Signup flow for new user
		const newPatient = new Patient({
			phone: `+91${phone}`,
			deviceId,
			fullName: fullName || "",
			dob: dob || "",
			gender: gender || "",
		});

		await newPatient.save();

		const token = jwt.sign({ patient: newPatient._id }, process.env.JWT_SECRET_KEY);
		return res.status(200).json({
			status: true,
			newUser: true,
			message: "Signup successful",
			token,
			data: newPatient,
			login: 0,
		});
	} catch (err) {
		console.error("Error during OTP verification:", err.message);
		return res.status(500).json({
			status: false,
			message: `An error occurred while verifying OTP ${err}`,
			error: err.message,
		});
	}
};


exports.addPersonalDetails = async (req, res) => {
	const {
		fullName,
		phone,
		dob,
		gender,
		profilePhoto,
		address,
		userId,
		deviceId,
		latitude,
		longitude
	} = req.body;
	Patient.findOne({
		phone: `+91${phone}`
	})
		.then(async (patientData) => {
			if (patientData) {
				res
					.status(400)
					.json({
						status: true,
						message: "patient already exists please login",
					});
			}

			const newPatient = await new Patient({
				fullName: fullName,
				phone: `+91${phone}`,
				dob: dob,
				gender: gender,
				profilePhoto: profilePhoto,
				address: address,
				userId: userId,
				status: 0,
				deviceId: deviceId,
				latitude: latitude,
				longitude: longitude,
				liked: [],
			});
			await newPatient.save();
			jwt.sign({
				patient: newPatient
			},
				process.env.JWT_SECRET_KEY,
				(err, token) => {
					return res.json({
						status: true,
						message: "Signup successful",
						data: newPatient,
						token: token,
					});
				}
			);
			const newCart = await new Cart({
				userId: newPatient._id,
				createdAt: new Date()
			})
			await newCart.save()
		})
		.catch((err) => console.log(err));
};

// google login
exports.googleLogin = async (req, res) => {
	try {
		const { googleId } = req.body;
		const patient = await Patient.findOne({ googleId });
		if (patient) {
			jwt.sign({ patient: patient._id }, process.env.JWT_SECRET_KEY, (err, token) => {
				res.status(200).json({ status: 200, message: "Login successful", token: token, data: patient })
			})
		} else {
			const newPatient = await new Patient({
				googleId: googleId,
			});

			await newPatient.save();

			jwt.sign({ patient: newPatient._id }, process.env.JWT_SECRET_KEY, (err, token) => {
				res.status(200).json({ status: 201, message: "Signup successful", token: token, data: newPatient })
			})
		}
	} catch (err) {
		console.log(err);
		res.status(400).json({ message: "Something went wrong", status: false, success: false })
	}
};

exports.editProfile = async (req, res) => {
	try {
		const patientId = req.params.patientId;
		const thePatient = await Patient.findOne({ _id: patientId });

		if (!thePatient) {
			return res.status(400).json({
				status: false,
				message: "No patient exists with this Id",
			});
		}

		const updatedPatient = await Patient.findByIdAndUpdate(
			patientId,
			{
				profilePhoto: req.body.profilePhoto || thePatient.profilePhoto,
				fullName: req.body.fullName || thePatient.fullName,
				dob: req.body.dob || thePatient.dob,
				gender: req.body.gender || thePatient.gender,
				address: req.body.address || thePatient.address,
				latitude: req.body.latitude || thePatient.latitude,
				longitude: req.body.longitude || thePatient.longitude,
				physioId: req.body.physioId || thePatient.physioId,
				country: req.body.country?.toLowerCase() || thePatient.country,
				state: req.body.state?.toLowerCase() || thePatient.state,
				city: req.body.city?.toLowerCase() || thePatient.city,
				zipCode: req.body.zipCode || thePatient.zipCode,
				onboardedFrom: "mobile",
			},
			{ new: true }
		);

		return res.status(200).json({
			status: true,
			message: "Profile updated successfully",
			data: updatedPatient,
		});
	}
	catch (error) {
		console.error("Error in editProfile:", error);
		return res.status(500).json({
			status: false,
			message: "Something went wrong",
		});
	}
};


exports.getSinglePatient = async (req, res) => {
	console.log(req.params.patientId)
	const patientId = req.params.patientId;

	const thePatient = await Patient.findById(patientId).catch((e) => {
		console.log(e);

		return res
			.status(400)
			.json({
				status: false,
				message: `Error ${e}`
			});
	});
	if (!thePatient) {
		res
			.status(400)
			.json({
				status: false,
				message: "no patient exists with this Id"
			});
	} else {
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				data: thePatient
			});
	}
};

exports.getAllPatient = async (req, res) => {
	const skip = req.query.skip || 0;
	const limit = req.query.limit || 0;
	const thePhysios = await Patient.find().skip(skip).limit(limit);
	const reversed = await thePhysios.reverse();
	res.json({
		status: true,
		message: "data Returned",
		data: reversed
	});
};

exports.AllPhysioHomeVisit = async (req, res) => {
	const seacrhQuery = req.query.seacrhQuery;
	Physio.find({
		serviceType: {
			$in: ["home"]
		},
		fullName: {
			$regex: new RegExp(seacrhQuery, "i")
		},
	}).then(async (physioData) => {
		if (!physioData) {
			res.status(400).json({
				status: false,
				message: "no physio Found"
			});
		} else {
			const promises = physioData.map(async (i) => {
				const theReviews = await Review.find({
					physioId: i._id
				});
				if (theReviews.length === 0) {
					i.starRating = 0; // To handle cases where there are no theReviews
					i.totalReviews = theReviews.length;
				} else {
					const totalStars = theReviews.reduce(
						(sum, review) => sum + review.stars,
						0
					);
					i.starRating = totalStars / theReviews.length;
					i.totalReviews = theReviews.length;
				}
			});
			await Promise.all(promises);

			res
				.status(200)
				.json({
					status: true,
					message: "data Returned",
					data: physioData
				});
		}
	});
};

exports.AllPhysioClinicVisit = async (req, res) => {
	const seacrhQuery = req.query.seacrhQuery;
	Physio.find({
		serviceType: {
			$in: ["clinic"]
		},
		fullName: {
			$regex: new RegExp(seacrhQuery, "i")
		},
	}).then(async (physioData) => {
		if (!physioData) {
			res.status(400).json({
				status: false,
				message: "no physio Found"
			});
		} else {
			const promises = physioData.map(async (i) => {
				const theReviews = await Review.find({
					physioId: i._id
				});
				if (theReviews.length === 0) {
					i.starRating = 0; // To handle cases where there are no theReviews
					i.totalReviews = theReviews.length;
				} else {
					const totalStars = theReviews.reduce(
						(sum, review) => sum + review.stars,
						0
					);
					i.starRating = totalStars / theReviews.length;
					i.totalReviews = theReviews.length;
				}
			});
			await Promise.all(promises);

			res
				.status(200)
				.json({
					status: true,
					message: "data Returned",
					data: physioData
				});
		}
	});
};

exports.AllPhysioConsult = async (req, res) => {
	const seacrhQuery = req.query.seacrhQuery;
	Physio.find({
		serviceType: {
			$in: ["online"]
		},
		fullName: {
			$regex: new RegExp(seacrhQuery, "i")
		},
	}).then(async (physioData) => {
		if (!physioData) {
			res.status(400).json({
				status: false,
				message: "no physio Found"
			});
		} else {
			const promises = physioData.map(async (i) => {
				const theReviews = await Review.find({
					physioId: i._id
				});
				if (theReviews.length === 0) {
					i.starRating = 0; // To handle cases where there are no theReviews
					i.totalReviews = theReviews.length;
				} else {
					const totalStars = theReviews.reduce(
						(sum, review) => sum + review.stars,
						0
					);
					i.starRating = totalStars / theReviews.length;
					i.totalReviews = theReviews.length;
				}
			});
			await Promise.all(promises);

			res
				.status(200)
				.json({
					status: true,
					message: "data Returned",
					data: physioData
				});
		}
	});
};

exports.getAllPhysioBySpecialization = async (req, res) => {
	const specialization = req.query.specialization;
	const thePhysio = await Physio.find({
		specialization: {
			$elemMatch: {
				$regex: new RegExp(specialization, 'i')
			}
		}
	})

	const promises = thePhysio.map(async (i) => {
		const theReviews = await Review.find({
			physioId: i._id
		});
		if (theReviews.length === 0) {
			i.starRating = 0; // To handle cases where there are no theReviews
			i.totalReviews = theReviews.length;
		} else {
			const totalStars = theReviews.reduce(
				(sum, review) => sum + review.stars,
				0
			);
			i.starRating = totalStars / theReviews.length;
			i.totalReviews = theReviews.length;
		}
	});
	await Promise.all(promises);

	res
		.status(200)
		.json({
			status: true,
			message: "data Returned",
			data: thePhysio
		});
}


// get all Banner
exports.AllBanners = async (req, res) => {
	try {
		const patientId = req.query.patientId;

		if (!patientId) {
			return res.status(400).json({
				message: "Patient Id is required",
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
		const patientZipCode = patient.zipCode;

		let banners1 = [];

		if (patientZipCode) {
			banners1 = await Banner.find({
				zipCode: {
					$in: null,
				}
			});
		}

		let banners3 = await Banner.find({ zipCode: patientZipCode });

		let banners2 = banners3.filter(banner => {
			// Check if patientId array does not include the provided patientId
			return !banner.patientId.some(id => id.toString() === patientId.toString());
		});

		// console.log('Banners to Show:', banners2);


		// Combine banners and banner2
		let banners = [...banners1, ...banners2];


		res.status(200).json({
			message: "Banners fetched successfully",
			status: 200,
			success: true,
			data: banners
		});

	} catch (e) {
		console.log(e);
		res.status(500).send({
			message: 'Error fetching banners',
			status: 500,
			success: false
		});
	}
};

exports.AllBlogs = async (req, res) => {
	Blog.find().then((blogData) => {
		if (!blogData) {
			res.status(400).json({
				status: false,
				message: "no banner Found"
			});
		}
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				data: blogData
			});
	});
};

exports.searchBlogs = async (req, res) => {
	const query = req.body.query;
	const blogs = await Blog.find();
	const filteredBlogs = await blogs.filter((i) => {
		return i.tags.includes(query);
	});
	res
		.status(200)
		.json({
			status: true,
			message: "data Returned",
			data: filteredBlogs
		});
};

exports.searchPhysios = async (req, res) => {
	try {
		const query = req.body.query;
		let rating = req.body.rating;
		let filteredPhysios;

		if (!rating && !query) {
			filteredPhysios = await Physio.find({});
		} else if (rating && !query) {
			filteredPhysios = await Physio.find({
				starRating: {
					$gte: rating
				}
			}).populate("specialization");
		} else if (query && !rating) {
			filteredPhysios = await Physio.find({
				fullName: {
					$regex: new RegExp(query, "i")
				}
			}).populate("specialization");
		} else {
			filteredPhysios = await Physio.find({
				fullName: { $regex: new RegExp(query, "i") },
				starRating: { $gte: rating }
			}).populate("specialization");
		}

		res.status(200).json({
			status: true,
			message: "data Returned",
			data: filteredPhysios
		});


	} catch (error) {
		return res.status(400).json({ status: false, message: "Something went wrong" })
	}
};

exports.bookAppointment = async (req, res) => {
	const patientId = req.params.patientId;
	const {
		physioId,
		date,
		time,
		fullName,
		age,
		phone,
		gender,
		type,
		amount,
		problem
	} =
		req.body;
	const thePatient = await Patient.findById(patientId);
	const thePhysio = await Physio.findById(physioId);
	const theSlot = await Slot.find({
		date: date,
		physioId: physioId
	});
	// const filteredSlots=await theSlot.filter(i=>{
	//   return  new Date(i.date*1000).getDate()===new Date(date*1000).getDate()
	// })
	if (!thePatient) {
		res
			.status(400)
			.json({
				status: false,
				message: "no patient exists with this id"
			});
	}
	if (!thePhysio) {
		res
			.status(400)
			.json({
				status: false,
				message: "no physio exists with this id"
			});
	}
	if (theSlot.length !== 0) {
		res.status(400).json({
			status: false,
			message: "slot already booked"
		});
		//console.log(filteredSlots)
	} else {
		const newSlot = await new Slot({
			patientId: patientId,
			physioId: physioId,
			date: date,
			time: time,
			status: 0,
			createdAt: new Date(),
		});
		await newSlot.save();
		const newAppointment = await new Appointment({
			patientId: patientId,
			physioId: physioId,
			status: 0,
			date: date,
			time: time,
			fullName: fullName,
			physioName: thePhysio.fullName,
			age: age,
			problem: problem,
			phone: `+91${phone}`,
			gender: gender,
			notes: "",
			type: type,
			amount: amount,
			isRated: false,
			// status: 1,
			isTreatmentScheduled: false,
			createdAt: new Date(),
		});
		await newAppointment.save();
		const theWallet = await Wallet.findOne({
			physioId: physioId
		});
		const updatedwlaeet = await Wallet.findByIdAndUpdate(
			theWallet._id, {
			balance: theWallet.balance + (Number(amount) - (Number(amount) * 10) / 100),
		}, {
			new: true
		}
		);
		// console.log(updatedwlaeet);
		const newTransion = await new Transaction({
			walletId: theWallet._id,
			patientId: patientId,
			paymentMode: "online",
			amount: amount,
			type: 0,
			from: 0,
			transactionType: 1,
			createdAt: new Date(),
		});
		await newTransion.save();
		const newTransion2 = await new Transaction({
			walletId: theWallet._id,
			patientId: patientId,
			paymentMode: "online",
			amount: (Number(amount) * 20) / 100,
			type: 1,
			from: 1,
			transactionType: 0,
			createdAt: new Date(),
		});
		await newTransion2.save();
		let title = "Appointment booked"
		let body = `${thePatient.fullName} just booked a Appointment on ${time}`
		let title2 = "Appointment booked"
		let body2 = `Your Appointment Booked Successfully With ${thePhysio.fullName}`
		await sendNotification(thePhysio.deviceId, physioId, title, body, newAppointment._id)
		// await  sendNotification(thePatient.deviceId,patientId,title2,body2,newAppointment._id)
		res
			.status(201)
			.json({
				status: true,
				message: "appointment booked Successfully",
				data: newAppointment,
			});
	}
};

exports.getAllSlots = async (req, res) => {
	const theSlots = await Slot.find();
	if (theSlots.length == 0) {
		res.status(400).json({
			status: false,
			message: "no slots find"
		});
	}
	res
		.status(200)
		.json({
			status: true,
			message: "data Returned",
			data: theSlots
		});
};

exports.getAllSlotsByPhysioId = async (req, res) => {
	const physioId = req.params.physioId;
	const theSlots = await Slot.find({
		physioId: physioId
	});
	await console.log(theSlots);
	if (theSlots.length == 0) {
		res.status(400).json({
			status: false,
			message: "no slots find"
		});
	}
	res
		.status(200)
		.json({
			status: true,
			message: "data Returned",
			data: theSlots
		});
};

exports.getAllAppointmentsByPatient = async (req, res) => {
	const seacrhQuery = req.query.seacrhQuery;
	const patientId = req.params.patientId;
	const thePatient = await Patient.findById(patientId);
	if (!thePatient) {
		res
			.status(400)
			.json({
				status: false,
				message: "no patient exists with this Id"
			});
	} else {
		const theAppointment = await Appointment.find({
			patientId: patientId,
			status: 0,
			physioName: {
				$regex: new RegExp(seacrhQuery, "i")
			},
		}).lean();

		const promises = theAppointment.map(async (i) => {
			const thePhysio = await Physio.findById(i.physioId);
			i.physioName = thePhysio.fullName;
			i.profileImage = thePhysio.profileImage;
			i.clinicName = thePhysio.clinic.clinicName;
			i.specialization = thePhysio.specialization; F
				(i.address = thePhysio.clinic.address),
				(i.city = thePhysio.clinic.city),
				(i.state = thePhysio.clinic.state),
				(i.zipCode = thePhysio.clinic.zipCode);
			//
		});
		const updatedAppData = await Promise.all(promises);
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				data: theAppointment
			});
	}
};

exports.getAllAppointmentsRunningAppointments = async (req, res) => {
	const seacrhQuery = req.query.seacrhQuery;
	const patientId = req.params.patientId;
	const thePatient = await Patient.findById(patientId);
	if (!thePatient) {
		res
			.status(400)
			.json({
				status: false,
				message: "no patient exists with this Id"
			});
	} else {
		const theAppointment = await Appointment.find({
			patientId: patientId,
			physioName: {
				$regex: new RegExp(seacrhQuery, "i")
			},
			status: 0
		}).lean();

		const promises = theAppointment.map(async (i) => {
			const thePhysio = await Physio.findById(i.physioId);
			i.physioName = thePhysio.fullName;
			i.profileImage = thePhysio.profileImage;
			i.clinicName = thePhysio.clinic.clinicName;
			i.specialization = thePhysio.specialization;
			(i.address = thePhysio.clinic.address),
				(i.city = thePhysio.clinic.city),
				(i.state = thePhysio.clinic.state),
				(i.zipCode = thePhysio.clinic.zipCode);
			//
		});
		const updatedAppData = await Promise.all(promises);
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				data: theAppointment
			});
	}
};

exports.getAllAppointmentsCompletedAppointments = async (req, res) => {
	const seacrhQuery = req.query.seacrhQuery;
	const patientId = req.params.patientId;
	const thePatient = await Patient.findById(patientId);
	if (!thePatient) {
		res
			.status(400)
			.json({
				status: false,
				message: "no patient exists with this Id"
			});
	} else {
		const theAppointment = await Appointment.find({
			patientId: patientId,
			physioName: {
				$regex: new RegExp(seacrhQuery, "i")
			},
			status: 1
		}).lean();

		const promises = theAppointment.map(async (i) => {
			const thePhysio = await Physio.findById(i.physioId);
			i.physioName = thePhysio.fullName;
			i.profileImage = thePhysio.profileImage;
			i.clinicName = thePhysio.clinic.clinicName;
			i.specialization = thePhysio.specialization;
			(i.address = thePhysio.clinic.address),
				(i.city = thePhysio.clinic.city),
				(i.state = thePhysio.clinic.state),
				(i.zipCode = thePhysio.clinic.zipCode);
			//
		});
		const updatedAppData = await Promise.all(promises);
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				data: theAppointment
			});
	}
};
exports.findPatientByPhone = async (req, res) => {
	const phone = req.body.phone;
	const thePatient = await Patient.findOne({
		phone: `+91${phone}`
	});
	if (!thePatient) {
		res
			.status(400)
			.json({
				status: false,
				message: "no patient exists with this phone"
			});
	}
	res
		.status(200)
		.json({
			status: true,
			message: "data Returned",
			data: thePatient
		});
};

exports.getTreatment = async (req, res) => {
	const patientId = req.params.patientId;
	const thePatient = await Patient.findById(patientId);
	if (!thePatient) {
		res
			.status(400)
			.json({
				status: false,
				message: "no patient exists with this Id"
			});
	} else {
		const theTreatment = await Treatment.find({
			patientId: patientId,
			status: 0
		}).lean();
		const promises = theTreatment.map(async (i) => {
			const thePhysio = await Physio.findById(i.physioId);
			const theAppointment = await Appointment.findById(i.appointmentId);
			i.physioName = thePhysio.fullName;
			i.physioImage = thePhysio.profileImage;
			i.physioDetails = thePhysio
			i.appointmentDetails = theAppointment
		});
		await Promise.all(promises);
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				data: theTreatment
			});
	}
};


exports.getTreatmentByAppointmentId = async (req, res) => {
	const appointmentId = req.params.appointmentId
	const theTreatment = await Treatment.find({
		appointmentId: appointmentId
	})
	res.json({
		status: true,
		message: "data returned",
		data: theTreatment
	})
}


exports.getAppointmentByPreferId = async (req, res) => {
	const patientId = req.params.patientId
	const preferId = req.query.preferId
	const thePhysio = await Physio.findOne({
		preferId: preferId
	})
	const thePatient = await Patient.findById(patientId)
	if (!thePatient) {
		res.json({
			status: false,
			message: "patient not found"
		})
	} else {
		if (!thePhysio) {
			res.json({
				status: false,
				message: "physio not found"
			})
		} else {
			const theAppointment = await Appointment.find({
				patientId: patientId,
				physioId: thePhysio._id
			}).lean()
			res.json({
				status: true,
				message: "data returned",
				appointment: theAppointment,
				physio: thePhysio,
				patient: thePatient
			})
		}
	}
}


exports.getTreatmentByPreferId = async (req, res) => {
	const patientId = req.params.patientId
	const preferId = req.query.preferId
	const thePhysio = await Physio.findOne({
		preferId: preferId
	})
	const thePatient = await Patient.findById(patientId)
	if (!thePatient) {
		res.json({
			status: false,
			message: "patient not found"
		})
	} else {
		if (!thePhysio) {
			res.json({
				status: false,
				message: "physio not found"
			})
		} else {
			const theAppointment = await Treatment.find({
				patientId: patientId,
				physioId: thePhysio._id
			}).lean()
			res.json({
				status: true,
				message: "data returned",
				treatment: theAppointment,
				physio: thePhysio,
				patient: thePatient
			})
		}
	}
}


exports.getSingleAppointment = async (req, res) => {
	const appointmentId = req.params.appointmentId
	const theAppointment = await Appointment.findById(appointmentId)
	if (!theAppointment) {
		res.json({
			status: false,
			message: "appointment not found"
		})
	} else {
		res.json({
			status: true,
			message: "data returned",
			data: theAppointment
		})
	}
}


exports.getScheduleForTreatment = async (req, res) => {
	const treatmentId = req.params.treatmentId;
	const theTreatment = await Treatment.findById(treatmentId);
	const scheduleData = [];
	if (!theTreatment) {
		res
			.status(400)
			.json({
				status: false,
				message: "no treatment exists with this Id"
			});
	}
	const appointmentId = theTreatment.appointmentId;
	const doctorId = theTreatment.doctorId;
	const patientId = theTreatment.patientId;
	const timing = theTreatment.timing;
	const mode = theTreatment.mode;
	const feePerDay = theTreatment.feePerDay;
	const dates = theTreatment.dates;
	const paidPayments = theTreatment.paidPayments;
	dates?.map((date) => {
		if (paidPayments.some((i) => date.includes(i)) === true) {
			const newObj = {
				appointmentId: appointmentId,
				doctorId: doctorId,
				patientId: patientId,
				date: date,
				timing: {
					from: timing.from,
					to: timing.to,
				},
				mode: mode,
				feePerDay: feePerDay,
				status: true,
				fullAmount: feePerDay * (dates.length - paidPayments.length),
			};
			scheduleData.push(newObj);
		} else {
			const newObj = {
				appointmentId: appointmentId,
				doctorId: doctorId,
				patientId: patientId,
				date: date,
				timing: {
					from: timing.from,
					to: timing.to,
				},
				mode: mode,
				feePerDay: feePerDay,
				status: false,
				fullAmount: feePerDay * (dates.length - paidPayments.length),
			};
			scheduleData.push(newObj);
		}
	});
	if (paidPayments.length === theTreatment.dates.length) {
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				isPaid: true,
				fullAmount: feePerDay * (dates.length - paidPayments.length),
				data: scheduleData,
			});
	} else {
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				isPaid: false,
				fullAmount: feePerDay * (dates.length - paidPayments.length),
				data: scheduleData,
			});
	}
};


exports.writeReview = async (req, res) => {
	const patientId = req.params.patientId;
	const {
		physioId,
		appointmentId,
		stars,
		comment,
		isRecomended
	} = req.body;
	const thePatient = await Patient.findById(patientId);
	if (!thePatient) {
		res
			.status(400)
			.json({
				status: false,
				message: "no patient exists with this Id"
			});
	} else {
		const theAppointment = await Appointment.findById(appointmentId);
		if (theAppointment.isRated === true) {
			res
				.status(400)
				.json({
					status: false,
					message: "you already rated this appointment"
				});
		}
		const newReview = await new Review({
			physioId: physioId,
			reviewBy: patientId,
			userName: thePatient.fullName,
			stars: stars,
			comment: comment,
			isRecomended: isRecomended,
			createdAt: new Date(),
		});
		await newReview.save();
		await Appointment.findByIdAndUpdate(
			appointmentId, {
			isRated: true,
		}, {
			new: true
		}
		);
		res
			.status(201)
			.json({
				status: true,
				message: "review added successfully",
				data: newReview,
			});
	}
};


exports.getReviewForDoctor = async (req, res) => {
	const physioId = req.params.physioId;
	const thePhysio = await Physio.findById(physioId);
	if (!thePhysio) {
		res
			.status(400)
			.json({
				status: false,
				message: "no physio exists with this id"
			});
	} else {
		const theReview = await Review.find({
			physioId: physioId
		});
		res
			.status(200)
			.json({
				status: true,
				message: "data Returned",
				data: theReview
			});
	}
};


exports.payForAppointment = async (req, res) => {
	const physioId = req.params.physioId;
	const amount = req.body.amount;
	const theWallet = await Wallet.findOne({
		physioId: physioId
	});
};


exports.payForTreatment = async (req, res) => {
	const treatmentId = req.params.treatmentId;
	const dates = req.body.dates;
	const physioId = req.body.physioId;
	const updatedDates = [];
	const theTreatment = await Treatment.findById(treatmentId);
	const thePatient = await Patient.findById(theTreatment.patientId);
	const thePhysio = await Physio.findById(physioId);
	if (!theTreatment) {
		res.status(400).json({
			status: false,
			message: "no treatment exist "
		});
	} else {
		theTreatment.paidPayments.map((j) => {
			updatedDates.push(j);
		});
		dates.map((i) => {
			updatedDates.push(i);
		});

		const updatedTreatment = await Treatment.findByIdAndUpdate(
			treatmentId, {
			paidPayments: updatedDates,
		}, {
			new: true
		}
		);
		//  const thePhysio=await Physio.findById(physioId)
		const theWallet = await Wallet.findOne({
			physioId: physioId
		});
		if (theWallet) {
			const newTransion = await new Transaction({
				walletId: theWallet._id,
				patientId: theTreatment.patientId,
				paymentMode: "online",
				amount: theTreatment.feePerDay,
				type: 0,
				from: 0,
				transactionType: 0,
				createdAt: new Date(),
			});
			await newTransion.save();
			const newTransion2 = await new Transaction({
				walletId: theWallet._id,
				patientId: theTreatment.patientId,
				paymentMode: "online",
				amount: (Number(theTreatment.feePerDay) * 20) / 100,
				type: 1,
				from: 1,
				transactionType: 1,
				createdAt: new Date(),
			});
			await newTransion2.save();
		}
		let title = `Payment Recived`;
		let body = `${thePatient.fullName} has paid for your Treatment for ${dates}`;
		// sendNotification(thePhysio.deviceId, physioId, title, body, treatmentId);
		res
			.status(200)
			.json({
				status: true,
				message: "payment successfully",
				data: updatedTreatment,
			});
	}
};


exports.verifyCoupon = async (req, res) => {
	const couponCode = req.body.couponCode;
	const theCoupon = await Coupon.findOne({
		couponCode: couponCode
	});
	if (theCoupon) {
		res
			.status(200)
			.json({
				status: true,
				message: "coupon find Successfully",
				data: theCoupon,
			});
	} else {
		res.status(400).json({
			status: false,
			message: "coundn't find coupon"
		});
	}
};


exports.verifyFTP = async (req, res) => {
	const phone = req.body.phone;
	const theFtp = await FTP.findOne({
		phone: `+91${phone}`
	});
	if (theFtp) {
		res
			.status(200)
			.json({
				status: true,
				message: "member exists",
				data: theFtp
			});
	} else {
		res
			.status(400)
			.json({
				status: false,
				message: "this phone doest registerd with FTP"
			});
	}
};


exports.upgradePlan = async (req, res) => {
	const patientId = req.params.patientId;
	const {
		planName,
		benifits,
		price,
		planType,
		discountPrice
	} = req.body;
	const thePatient = await Patient.findById(patientId);
	if (!thePatient) {
		res.json({
			status: false,
			message: "no patient exists with this id"
		});
	} else {
		let plan = {
			planName: planName,
			benifits: benifits,
			price: price,
			planType: planType,
			discountPrice: discountPrice,
			createdAt: new Date(),
		};
		const updatedData = await Patient.findByIdAndUpdate(
			patientId, {
			plan: plan,
		}, {
			new: true
		}
		);
		res.json({
			status: true,
			message: "plan upgraded successfuly",
			data: updatedData,
		});
	}
};


exports.deletePatient = async (req, res) => {
	try {
		const { patientId } = req.query;

		if (!patientId) {
			return res.status(401).json({
				message: "patientId Is Required",
				success: false,
				status: 401
			});
		}

		const patient = await Patient.findById(patientId);

		if (!patient) {
			return res.status(404).json({
				message: 'Patient not found',
				success: false,
				status: 404,
			});
		}

		// Soft delete patient
		await Patient.findByIdAndUpdate(
			patientId,
			{ isDeleted: true },
			{ new: true }
		);

		res.status(200).json({
			message: 'Patient deleted successfully',
			success: true,
			status: 200,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({
			success: false,
			message: 'Server error',
		});
	}
};


// Get All specialization 
exports.getAllSpecialization = async (req, res) => {
	try {
		const theSpecialization = await Specialization.find();
		res.json({
			status: true,
			message: "data returned",
			data: theSpecialization
		})
	} catch (error) {
		return res.status(400).json({ status: false, message: "Something went wrong" })
	}
}


exports.recoverDeletedPatient = async (req, res) => {

	try {
		const { phone, isWantToRecover } = req.body;

		if (!phone && !isWantToRecover) {

			return res.status(400).json({
				status: false,
				message: "please provide phone and isWantToRecover "
			});
		}

		const userData = await Patient.findOne({
			phone: `+91${phone}`,
		})

		if (!userData) {
			return res.status(400).json({
				status: false,
				message: "User with this Phone does not exist"
			});
		}


		if (userData.isDeleted === false) {
			return res.status(400).json({
				status: false,
				message: "This physio not soft Deleted please login normally"
			});
		}

		else if (isWantToRecover) {

			userData.isDeleted = false;

			await userData.save();
			isDeltedPhysio = true

			return res.status(200).json({
				status: true,
				message: "This update Physio Status you can procced"
			});

		}

		else {

			return res.status(402).json({
				status: false,
				message: "no changes are apply"
			});

		}

	} catch (error) {

		res.status(400).json({
			status: false,
			message: "something went wrong",
			err: error
		});
	}
}

const Admin = require('../../models/admin')
const AppSetting = require('../../models/appSetting')
const Coupon = require('../../models/coupon')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const admin = require('firebase-admin');
const Patient = require('../../models/patient')
const Physio = require('../../models/physio')
const Notification = require('../../models/notification')
const Transaction = require('../../models/transaction')
const Wallet = require('../../models/wallet')
const crypto = require('crypto');
const Specialization = require("../../models/specialization")
const Appointment = require("../../models/appointment")

require('dotenv')

const Degree = require('../../models/Degree');

const multer = require("multer");
const path = require("path");
const root = process.cwd();
const fs = require("fs");

const {
	msg91OTP
} = require('msg91-lib');
const { addTravelDistance } = require('../../utility/locationUtils')
const { default: axios } = require('axios')
const { redisClient } = require('../../utility/redisClient')

const msg91otp = new msg91OTP({
	authKey: process.env.MSG91_AUTH_KEY,
	templateId: process.env.MSG91_TEMP_ID,
});


// Set The Storage Engine
const storage = multer.diskStorage({
	destination: path.join(root, "/public/uploads/specialization"),
	filename: function (req, file, cb) {
		cb(null, `${Date.now()}.jpg`);
	},
});

const upload = multer({
	storage: storage
}).single('icon')

// bamer upload
const storage2 = multer.diskStorage({
	destination: path.join(root, "/public/uploads/banner"),
	filename: function (req, file, cb) {
		cb(null, `${Date.now()}${path.extname(file.originalname)}`);
	},
});

const upload2 = multer({
	storage: storage2
}).single('bannerImage')


function convertDataToStrings(data) {
	const convertedData = {};
	for (const key in data) {
		if (data.hasOwnProperty(key)) {
			convertedData[key] = String(data[key]);
		}
	}
	return convertedData;
}




exports.getPhysiosByZipCode = async (req, res) => {
	try {
		const { zipCode } = req.query;

		if (!zipCode || !/^\d{6}$/.test(zipCode)) {
			return res.status(400).json({
				message: "Invalid or missing zip code",
				success: false,
				status: 400
			});
		}

		// 🔐 Generate unique Redis cache key
		const keys = { zipCode };
		const hash = crypto.createHash("sha256").update(JSON.stringify(keys)).digest("hex");
		const cacheKey = `admin:AllPhysio:${hash}`;

		// 🔄 Check Redis cache
		const cachedData = await redisClient.get(cacheKey);
		if (cachedData) {
			console.log("✅ Returning cached data (ZipCode AllPhysio)");
			const { updatedPhysios } = JSON.parse(cachedData);

			return res.status(200).json({
				message: "Physios from cache",
				status: 200,
				success: true,
				updatedPhysios
			});
		}
		// 🌍 Geocode the zip code to get lat/lng & city
		const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${zipCode}&key=${'AIzaSyD_siVrqpxKwm4Eh7wwqbJV7wibyL9ZI7c'}`;
		const response = await axios.get(url);
		const result = response?.data?.results?.[0];

		if (!result) {
			return res.status(400).json({
				message: "Unknown address from Google Maps API",
				status: 400,
				success: false
			});
		}

		const newLocation = result.geometry?.location;
		const lat = newLocation?.lat;
		const lng = newLocation?.lng;

		const cityComponent = result.address_components?.find(component =>
			component.types.includes("locality") || component.types.includes("administrative_area_level_2")
		);
		const city = cityComponent?.long_name || "Unknown";



		// 📍 Find physios based on city
		if (lat && lng && city) {
			const getPhysios = await Physio.find({
				city: new RegExp(city, "i"),
				accountStatus: 1
			});

			if (getPhysios && getPhysios.length > 0) {
				const updatedPhysios = addTravelDistance(getPhysios, lat, lng, true);

				// 🧠 Store in Redis with 10-minute expiry
				await redisClient.set(
					cacheKey,
					JSON.stringify({ updatedPhysios }),
					{ EX: 60 * 10 }
				);

				return res.status(200).json({
					message: "Success",
					status: 200,
					success: true,
					updatedPhysios
				});
			} else {
				return res.status(404).json({
					message: "No physios found for this city",
					success: false,
					status: 404
				});
			}
		}

		return res.status(400).json({
			message: "Could not resolve location properly",
			status: 400,
			success: false
		});

	} catch (error) {
		console.error("❌ Error in getPhysiosByZipCode:", error);
		return res.status(500).json({
			message: "Server error",
			success: false,
			error: error.message || error
		});
	}
};


exports.addSpecialization = async (req, res) => {
	try {
		upload(req, res, async (err) => {

			const {
				name
			} = req.body

			// if category already exists
			const theCategory = await Specialization.findOne({
				name: name
			})
			if (theCategory) {
				res.json({
					status: false,
					message: "Category already exists"
				})
			}

			const newCategory = await new Specialization({
				name: name,
				icon: req.file ? req.file.filename : "",
				createdAt: new Date()
			})
			await newCategory.save()
			res.json({
				status: true,
				message: "Category added successfully",
				data: newCategory
			})
		})
	} catch (error) {
		res.json({
			status: false,
			message: "error"
		})
	}
}




exports.getSpecialization = async (req, res) => {
	const skip = req.query.skip || 0
	const limit = req.query.limit || 0
	const theCategory = await Specialization.find().skip(skip).limit(limit)
	res.json({
		status: true,
		message: "data Returned",
		data: theCategory
	})
}

exports.getSingleCategory = async (req, res) => {
	const categoryId = req.params.categoryId
	const theBanner = await Specialization.findById(categoryId)
	if (!theBanner) {
		res.json({
			status: false,
			message: "no category exists with this id"
		})
	} else {
		res.json({
			status: true,
			message: "data returned",
			data: theBanner
		})
	}
}



exports.editSpecialization = async (req, res) => {
	try {

		upload(req, res, async (err) => {

			const categoryId = req.params.specializationId
			const {
				name
			} = req.body
			const theSpecialization = await Specialization.findById(categoryId)
			// return console.log(theSpecialization)
			if (!theSpecialization) {
				res.json({
					status: false,
					message: "no category exists with this ID"
				})
			} else {
				// uplode new icon and old icon delete
				if (req.file.filename) {
					if (theSpecialization.icon) {
						fs.unlink(path.join(root, `/public/uploads/specialization/${theSpecialization.icon}`), (err) => {
							if (err) {
								console.error(err)
								return
							}
						});
					}
				}
				const updated = await Specialization.findByIdAndUpdate(categoryId, {
					name: name,
					icon: req.file ? req.file.filename : theSpecialization.icon
				}, {
					new: true
				})
				res.json({
					status: true,
					message: "Category updated successfully",
					data: updated
				})
			}
		})
	} catch (error) {
		res.json({
			status: false,
			message: "Semething went wrong"
		})
	}
}

exports.deleteSpecialization = async (req, res) => {
	try {
		const categoryId = req.params.specializationId;
		// const { bannerName, bannerUrl, bannerImage, bannerType } = req.body
		const theBanner = await Specialization.findById(categoryId)
		if (!theBanner) {
			res.json({
				status: false,
				message: "no category exists with this ID"
			})
		} else {
			await Specialization.findByIdAndDelete(categoryId)

			if (theBanner.icon) {
				fs.unlink(path.join(root, `/public/uploads/specialization/${theBanner.icon}`), (err) => {
					if (err) {
						console.error(err)
						return
					}
				});
			}

			res.json({
				status: true,
				message: "Banner deleted Successfully"
			})
		}
	} catch (error) {
		res.json({
			status: false,
			message: "Something went wrong"
		})
	}
}

exports.addDegreeData = async (req, res) => {
	const degree = req.body.degree
	const dep = req.body.dep
	const theData = await new Data({
		degree: degree,
		dep: dep,
		createdAt: new Date()
	})
	await theData.save()
	res.json({
		status: true,
		message: "degree Added success",
		data: theData
	})
}


exports.getData = async (req, res) => {
	const theData = await Data.findOne()
	res.json({
		status: true,
		message: "Data returned",
		data: theData
	})
}

exports.editDegree = async (req, res) => {
	const degreeId = req.params.degreeId
	await Data.findById(degreeId)
	await Data.findByIdAndUpdate(degreeId, {
		degree: req.body.degree,
		dep: req.body.dep
	}, {
		new: true
	})
	res.json({
		status: true,
		message: "degree updated successfully"
	})
}

exports.AddBanners = async (req, res) => {
	try {
		upload2(req, res, async (err) => {
			const {
				bannerName,
				bannerUrl,
				bannerType,
				bannerStatus
			} = req.body
			const newBanner = await new Banner({
				bannerName: bannerName,
				bannerUrl: bannerUrl,
				bannerImage: req.file ? req.file.filename : "",
				bannerStatus: Number(bannerStatus),
				bannerType: Number(bannerType),
			})
			await newBanner.save()
			res.status(201).json({
				status: true,
				message: "banner created successfully",
				data: newBanner
			})
		})
	} catch (error) {
		return res.json({
			status: false,
			message: "Something went wrong"
		})
	}
}

exports.getAllBanner = async (req, res) => {
	const theBanner = await Banner.find()
	res.json({
		status: true,
		message: "data Returned",
		data: theBanner
	})
}

exports.editBanner = async (req, res) => {
	try {
		upload2(req, res, async (err) => {
			const bannerId = req.params.bannerId
			const {
				bannerName,
				bannerUrl,
				bannerImage,
				bannerType,
				bannerStatus
			} = req.body
			const theBanner = await Banner.findById(bannerId)
			if (!theBanner) {
				res.json({
					status: false,
					message: "no blog exists with this ID"
				})
			} else {
				if (req.file.filename) {
					if (theBanner.bannerImage) {
						fs.unlink(path.join(root, `/public/uploads/banner/${theBanner.bannerImage}`), (err) => {
							if (err) {
								console.error(err)
								return
							}
						});
					}
				}
				const updated = await Banner.findByIdAndUpdate(bannerId, {
					bannerName: bannerName,
					bannerUrl: bannerUrl,
					bannerImage: req.file ? req.file.filename : theBanner.bannerImage,
					bannerType: Number(bannerType),
					bannerStatus: Number(bannerStatus)
				}, {
					new: true
				})
				res.json({
					status: true,
					message: "Banner Updated Successfully",
					data: updated
				})
			}
		})
	} catch (error) {
		return res.json({
			status: false,
			message: "Something went wrong"
		})
	}
}


exports.deleteBanner = async (req, res) => {
	try {
		const bannerId = req.params.bannerId
		const theBanner = await Banner.findById(bannerId)
		if (!theBanner) {
			res.json({
				status: false,
				message: "no blog exists with this ID"
			})
		} else {
			await Banner.findByIdAndDelete(bannerId)
			if (theBanner.bannerImage) {
				fs.unlink(path.join(root, `/public/uploads/banner/${theBanner.bannerImage}`), (err) => {
					if (err) {
						console.error(err)
						return
					}
				});
			}
			res.json({
				status: true,
				message: "Banner deleted Successfully"
			})
		}
	} catch (error) {
		console.log(error)
		return res.json({
			status: false,
			message: "Something went wrong"
		})
	}
}

exports.AddBlogs = async (req, res) => {
	const {
		title,
		description,
		youTubeLink,
		image,
		tags
	} = req.body
	const newBlog = await new Blog({
		title: title,
		description: description,
		youTubeLink: youTubeLink,
		image: image,
		tags: tags,
		status: 0,
		createdAt: new Date()
	})

	await newBlog.save()
	res.status(201).json({
		status: true,
		message: "blog created successfully",
		data: newBlog
	})
}

exports.getAllBlogs = async (req, res) => {
	const theBlogs = await Blog.find()
	res.json({
		status: true,
		message: "data Returned",
		data: theBlogs
	})
}

exports.editBlogs = async (req, res) => {
	const blogId = req.params.blogId
	const {
		title,
		description,
		youTubeLink,
		image,
		tags,
		status
	} = req.body
	const theBlog = await Blog.findById(blogId)
	if (!theBlog) {
		res.json({
			status: false,
			message: "no blog exists with this ID"
		})
	} else {
		const updatedData = await Blog.findByIdAndUpdate(blogId, {
			title: title,
			description: description,
			youTubeLink: youTubeLink,
			image: image,
			tags: tags,
			status: Number(status)
		}, {
			new: true
		})
		res.json({
			status: true,
			message: "blog updated Successfully",
			data: updatedData
		})
	}
}

exports.deleteBlog = async (req, res) => {
	const blogId = req.params.blogId
	const theBlog = await Blog.findById(blogId)
	if (!theBlog) {
		res.json({
			status: false,
			message: "no blog exists with this ID"
		})
	} else {
		await Blog.findByIdAndDelete(blogId)
		res.json({
			status: true,
			message: "Blog Deleted Successfully"
		})
	}
}

exports.registerAdmin = async (req, res) => {
	const {
		email,
		password,
		adminName,
		adminImage
	} = req.body
	const theAdmin = await Admin.findOne({
		email: email
	})
	if (theAdmin) {
		res.json({
			status: false,
			message: "admin with this email already registered"
		})
	} else {
		const hex = await bcrypt.hash(password, 10)
		const theAdmin = await new Admin({
			email: email,
			password: hex,
			adminName: adminName,
			adminImage: adminImage
		})
		await theAdmin.save()
		res.json({
			status: true,
			message: "admin registerd successfully",
			data: theAdmin
		})
	}
}


exports.addAppsettingData = async (req, res) => {
	const {
		privarcyPolicy,
		termAndCondition
	} = req.body
	const newData = await new AppSetting({
		privarcyPolicy: privarcyPolicy,
		termAndCondition: termAndCondition
	})
	await newData.save()
	res.json({
		status: true,
		message: "data added",
		data: newData
	})
}

exports.getAppSettingData = async (req, res) => {
	const data = await AppSetting.findOne()
	res.status(200).json({
		status: true,
		message: "data Returned",
		data: data
	})
}

exports.createCoupon = async (req, res) => {
	const {
		couponCode,
		discount,
		status
	} = req.body
	const newCoupon = await new Coupon({
		couponCode: couponCode,
		discount: Number(discount),
		status: Number(status),
		createdAt: new Date()
	})
	await newCoupon.save()
	res.json({
		status: true,
		message: "coupon created successfully",
		data: newCoupon
	})
}

exports.getAllCoupon = async (req, res) => {
	const skip = req.query.skip || 0
	const limit = req.query.limit || 0
	const theCoupons = await Coupon.find().skip().limit()
	res.json({
		status: true,
		message: "Data Returned",
		data: theCoupons
	})
}

exports.editCoupon = async (req, res) => {
	const couponId = req.params.couponId
	const {
		couponCode,
		discount,
		status
	} = req.body
	const theCoupon = await Coupon.findById(couponId)
	if (!theCoupon) {
		res.json({
			status: false,
			message: "no blog exists with this ID"
		})
	} else {
		const updated = await Coupon.findByIdAndUpdate(couponId, {
			couponCode: couponCode,
			discount: Number(discount),
			status: Number(status),
		}, {
			new: true
		})
		res.json({
			status: true,
			message: "Coupon Updated Successfully",
			data: updated
		})
	}
}

exports.deleteCoupon = async (req, res) => {
	const couponId = req.params.couponId
	const theCoupon = await Coupon.findById(couponId)
	if (!theCoupon) {
		res.json({
			status: false,
			message: "no blog exists with this ID"
		})
	} else {
		await Coupon.findByIdAndDelete(couponId)
		res.json({
			status: true,
			message: "Coupon Deleted Successfully"
		})
	}
}

exports.addFtpMember = async (req, res) => {
	const {
		phone,
		pdfUrl,
		expiry,
		amount
	} = req.body
	const newFtpMember = await new FTP({
		phone: `+91${phone}`,
		pdfUrl: pdfUrl,
		expiry: Number(expiry),
		amount: Number(amount),
		paymentStatus: 1,
		createdAt: new Date()
	})
	await newFtpMember.save()
	res.json({
		status: true,
		message: "member added successfully",
		data: newFtpMember
	})
}

exports.getAllFtpMembers = async (req, res) => {
	const allFtpMembers = await FTP.find()
	res.json({
		status: true,
		message: "data Returned",
		data: allFtpMembers
	})
}

exports.editFtpMember = async (req, res) => {
	const ftpId = req.params.ftpId
	const {
		phone,
		pdfUrl,
		expiry,
		amount
	} = req.body
	const theFtp = await FTP.findById(ftpId)
	if (!theFtp) {
		res.json({
			status: false,
			message: "no ftp member with this Id"
		})
	} else {
		const updatedData = await FTP.findByIdAndUpdate(ftpId, {
			phone: `+91${phone}`,
			pdfUrl: pdfUrl,
			expiry: Number(expiry),
			amount: Number(amount),
		}, {
			new: true
		})
		res.json({
			status: true,
			message: "details edit successfully",
			data: updatedData
		})
	}
}

exports.deleteFtp = async (req, res) => {
	const ftpId = req.params.ftpId
	const theFtp = await FTP.findById(ftpId)
	if (!theFtp) {
		res.json({
			status: false,
			message: "no ftp member with this Id"
		})
	} else {
		await FTP.findByIdAndDelete(ftpId)
		res.json({
			status: true,
			message: "member deleted successfully"
		})
	}
}

exports.addTags = async (req, res) => {
	const newTags = await new Tags({
		tags: req.body.tags
	})
	await newTags.save()
	res.json({
		status: true,
		message: "tags created successfully",
		data: newTags
	})
}

exports.getAllTags = async (req, res) => {
	const tags = await Tags.findOne()
	res.json({
		status: true,
		message: "data Returned",
		data: tags
	})
}

exports.sendNotificationSocket = (deviceId, reciverId, title, body, actionId, data) => {
	console.log(data.physioId)
	const custom = {
		patientId: data.patientId,
		physioId: data.physioId,
		date: data.date,
		time: data.time,
		fullName: data.fullName,
		age: data.age,
		phone: data.phone,
		gender: data.gender,
		notes: data.notes,
		type: data.type,
		amount: data.amount,
		address: data.address,
		landmark: data.landmark,
		zipCode: data.zipCode,
		city: data.city,
		state: data.state,
		socketId: data.socketId
	}

	const customData = convertDataToStrings(custom)
	const message = {
		token: deviceId,
		notification: {
			title: title,
			body: body,
		},

		data: customData

	};

	// Send the message
	admin
		.messaging()
		.send(message)
		.then(async (response) => {
			console.log('Successfully sent message:', response);
			const newNotification = await new Notification({
				userId: reciverId,
				title: title,
				body: body,
				actionId: actionId,
				isRead: false,
				notificationDate: new Date(),

			})
			await newNotification.save()
		})
		.catch((error) => {
			console.error('Error sending message:', error);
		});

}

exports.sendNotification = (deviceId, reciverId, title, body, actionId) => {
	// console.log(data)
	const message = {

		notification: {
			title: title,
			body: body,
		},
		token: deviceId


	};

	// Send the message
	admin
		.messaging()
		.send(message)
		.then(async (response) => {
			console.log('Successfully sent message:', response);
			const newNotification = await new Notification({
				userId: reciverId,
				title: title,
				body: body,
				actionId: actionId,
				isRead: false,
				notificationDate: new Date(),

			})
			await newNotification.save()
		})
		.catch((error) => {
			console.error('Error sending message:', error);
		});
}

exports.sendNotificationToAllPhysios = async (req, res) => {
	const {
		title,
		body
	} = req.body
	const message = {

		notification: {
			title: title,
			body: body,
		},
		data: {




			refresh: "true"
		}
	}
	admin
		.messaging()
		.sendToTopic("physio", message)
		.then(async (response) => {
			// console.log('Successfully sent message:', response);
			//   const newNotification = await new Notification({
			//   userId: reciverId,
			//   title: title,
			//   body: body,
			//   actionId: actionId,
			//   isRead: false,
			//   notificationDate: new Date(),

			// })
			// await newNotification.save()
			res.json({
				status: true,
				message: "notification Sent"
			})
		})
		.catch((error) => {
			// console.error('Error sending message:', error);
			res.json({
				status: false,
				message: "notification not Sent"
			})
		});
}



exports.sendNotificationToAllPatients = async (req, res) => {
	const {
		title,
		body
	} = req.body
	const message = {

		notification: {
			title: title,
			body: body,
		},
		data: {




			refresh: "true"
		}
	}
	admin
		.messaging()
		.sendToTopic("user", message)
		.then(async (response) => {
			console.log('Successfully sent message:', response);
			//  await reciverId.map(async i=>{
			//     const newNotification=await  new Notification({ 
			//       userId:i,
			//     title:title,
			//     body:body,
			//     notificationDate:new Date()
			//     })
			//     await newNotification.save()
			//   })
			res.json({
				status: true,
				message: "notification Sent"
			})
		})
		.catch((error) => {
			// console.error('Error sending message:', error);
			res.json({
				status: true,
				message: "notification not Sent"
			})
		});
}


exports.getAllPlan = async (req, res) => {
	const skip = req.query.skip || 0
	const limit = req.query.limit || 0
	const theplans = await Plan.find().skip(skip).limit(limit)
	res.json({
		status: true,
		message: "data Returend",
		data: theplans
	})
}

exports.editPlan = async (req, res) => {
	const planId = req.params.planId
	const theplan = await Plan.findById(planId)
	const {
		planName,
		benifits,
		price,
		discountPrice,
		planType
	} = req.body
	if (!theplan) {
		res.json({
			status: false,
			message: "plan doesn't exists"
		})
	} else {
		const updated = await Plan.findByIdAndUpdate(planId, {
			planName: planName,
			benifits: benifits,
			price: Number(price),
			discountPrice: Number(discountPrice),
			planType: Number(planType),
		}, {
			new: true
		})
		res.json({
			status: true,
			message: "Plan Updated successfully",
			data: updated
		})
	}
}

exports.deletePlan = async (req, res) => {
	const planId = req.params.planId
	const theplan = await Plan.findById(planId)
	if (!theplan) {
		res.json({
			status: false,
			message: "plan doesn't exists"
		})
	} else {
		const updated = await Plan.findByIdAndDelete(planId)
		res.json({
			status: true,
			message: "Plan Deleted successfully",
			data: updated
		})
	}
}

exports.getSinglePlan = async (req, res) => {
	const planId = req.params.planId
	const theplan = await Plan.findById(planId)
	if (!theplan) {
		res.json({
			status: false,
			message: "plan doesn't exists"
		})
	} else {
		res.json({
			status: true,
			message: "data Returend",
			data: theplan
		})
	}

}

exports.getNotificationByUserId = async (req, res) => {
	const userId = req.params.userId
	const theNotifications = await Notification.find({
		userId: userId
	})
	res.json({
		status: true,
		message: "data Returned",
		data: theNotifications
	})
}

exports.readNotification = async (req, res) => {
	const userId = req.params.userId
	const allNotification = []
	const theNotifications = await Notification.find({
		userId: userId
	})
	const updatedData = await Notification.updateMany({
		userId: userId
	}, {
		$set: {
			isRead: true
		}
	})
	res.json({
		status: true,
		message: "all notification Viewed",
		data: updatedData
	})
}

exports.deleteSingleNotification = async (req, res) => {
	const notificationId = req.params.notificationId
	const theNotification = await Notification.findById(notificationId)
	if (!theNotification) {
		res.json({
			status: false,
			message: "notification doesn't exists"
		})
	} else {
		await Notification.findByIdAndDelete(notificationId)
		res.json({
			status: true,
			message: "notification deleted successfully"
		})
	}
}

exports.deleteAllNotification = async (req, res) => {
	const userId = req.params.userId
	await Notification.deleteMany({
		userId: userId
	})
	res.json({
		status: true,
		message: "notification deleted successfully"
	})
}


exports.getAllTransactions = async (req, res) => {
	const skip = req.query.skip || 0
	const limit = req.query.limit || 0
	const theTransactions = await Transaction.find().skip(skip).limit(limit).lean()
	const promis = await theTransactions.map(async i => {
		const thePatient = await Patient.findById(i.patientId)
		const theWallet = await Wallet.findById(i.walletId)
		const thePhysio = await Physio.findById(theWallet.physioId)
		if (thePatient) {
			i.from = thePatient.phone
		} else {
			i.from = null
		}

		if (thePhysio) {
			i.to = thePhysio.phone
		} else {
			i.to = null
		}
	})
	await Promise.all(promis)
	res.json({
		status: true,
		message: "Data Returned",
		data: theTransactions
	})
}

exports.addProductCategory = async (req, res) => {
	const {
		categoryName,
		categoryImage,
		status
	} = req.body
	const newCategory = await new Category2({
		categoryName: categoryName,
		categoryImage: categoryImage,
		status: status,
		createdAt: new Date()
	})
	await newCategory.save()
	res.json({
		status: true,
		message: "category added successfully",
		data: newCategory
	})
}

exports.deleteProductCategory = async (req, res) => {
	const categoryId = req.params.categoryId

	const theCategory = await Category2.findById(categoryId)
	if (!theCategory) {
		res.json({
			status: false,
			message: "category not found"
		})
	} else {
		await Category2.findByIdAndDelete(categoryId)
		res.json({
			status: true,
			message: "category deleted successfully"
		})
	}
}

exports.editProductCategory = async (req, res) => {
	const categoryId = req.params.categoryId
	const {
		categoryName,
		categoryImage,
		status
	} = req.body
	const theCategory = await Category2.findById(categoryId)
	if (!theCategory) {
		res.json({
			status: false,
			message: "category not found"
		})
	} else {
		await Category2.findByIdAndUpdate(categoryId, {
			categoryName: categoryName,
			categoryImage: categoryImage
		}, {
			new: true
		})
		res.json({
			status: true,
			message: "category updated successfully"
		})
	}
}


exports.addProduct = async (req, res) => {
	const {
		categoryId,
		productName,
		productImage,
		productDesc,
		price
	} = req.body
	const theCategory = await Category2.findById(categoryId)
	if (!theCategory) {
		res.json({
			status: false,
			message: "category  not exists"
		})
	} else {
		const newProduct = await new Product({
			categoryId: categoryId,
			productName: productName,
			productImage: productImage,
			productDesc: productDesc,
			price: price,
			status: 0,
			createdAt: new Date()
		})
		await newProduct.save()
		res.json({
			status: true,
			message: "product added successfully",
			data: newProduct
		})
	}
}

exports.editProduct = async (req, res) => {
	const {
		categoryId,
		productName,
		productImage,
		productDesc,
		price
	} = req.body
	const productId = req.params.productId
	const theProduct = await Product.findById(productId)
	if (!theProduct) {
		res.json({
			status: false,
			message: "product not found",
			data: theProduct
		})
	} else {
		await Product.findByIdAndUpdate(productId, {
			categoryId: categoryId,
			productName: productName,
			productImage: productImage,
			productDesc: productDesc,
			price: price
		}, {
			new: true
		})
		res.json({
			status: true,
			message: "product updated successfully"
		})
	}
}

exports.deleteProduct = async (req, res) => {
	// const {categoryId, productName,  productImage, productDesc,price}=req.body
	const productId = req.params.productId
	const theProduct = await Product.findById(productId)
	if (!theProduct) {
		res.json({
			status: false,
			message: "product not found",
			data: theProduct
		})
	} else {
		await Product.findByIdAndDelete(productId)
		res.json({
			status: true,
			message: "product deleted successfully"
		})
	}
}

exports.adminkpisData = async (req, res) => {
	const thePhysio = await Physio.find().count()
	const thePatient = await Patient.find().count()
	const pipeline = [{
		$group: {
			_id: null,
			totalAmount: {
				$sum: "$amount"
			}
		}
	}];
	const theEarning = await Appointment.aggregate(pipeline)
	res.json({
		status: true,
		message: "data returned",
		totalPhysio: thePhysio,
		totalPatient: thePatient,
		totalEarning: theEarning[0].totalAmount
	})
}

exports.ApproveRejectPhysios = async (req, res) => {
	const {
		accountStatus,
		physioId
	} = req.body
	const thePhysio = await Physio.findById(physioId)
	if (!thePhysio) {
		res.json({
			status: false,
			message: "physio not found"
		})
	} else {
		await Physio.findByIdAndUpdate(physioId, {
			accountStatus: accountStatus
		}, {
			new: true
		})
		res.json({
			status: true,
			message: "Status Updated suucessfully"
		})
	}
}

exports.getAllOrdersAdmin = async (req, res) => {
	const theOrders = await Order.find()
	res.json({
		status: true,
		message: "data returned",
		data: theOrders
	})
}

exports.updateOrderStatus = async (req, res) => {
	const orderId = req.params.orderId

	const theOrder = await Order.findById(orderId)
	if (!theOrder) {
		res.json({
			status: false,
			message: "order not found"
		})
	} else {
		if (theOrder.status == 1) {
			res.json({
				status: true,
				message: "Order Already Delivered"
			})
		}
		await Order.findByIdAndUpdate(orderId, {
			orderStatus: 1,
			deliveredAt: new Date()
		}, {
			new: true
		})
		res.json({
			status: true,
			message: "Status Updated"
		})
	}
}

// login page for admin
exports.loginPage = async (req, res) => {
	try {
		return res.render("admin/login")
	} catch (error) {
		return res.send({
			message: "error",
			error: true
		})
	}
}

// login for admin
exports.login = async (req, res) => {
	try {
		const email = req.body.email;
		const password = req.body.password;

		if (!email || !password) {
			return res.status(401).send("Invalid email or password")
		}

		const user = await Admin.findOne({
			email: email
		})
		// console.log(user,"user")
		if (!user) {
			return res.status(401).send("Invalid Admin")
		}

		const passwordMatch = await bcrypt.compare(password, user.password)
		if (!passwordMatch) {
			return res.status(401).send("Invalid password")
		}

		let token = jwt.sign({
			email: user._id
		}, process.env.JWT_SECRET_KEY)

		return res.status(201).send({
			message: "Login Success",
			status: 200,
			success: true,
			token
		})

	} catch (error) {
		console.log(error)
		return res.status(500).json({
			message: "Something went wrong Please try again later",
			status: 500,
			success: false
		})
	}
}


// Dashboard for admin
exports.dashboard = async (req, res) => {
	try {
		const admin = await Admin.find()
		// let email = req.session.user;
		const physio = await Physio.find().count()
		const patient = await Patient.find().count()
		return res.render("admin/dashboard", {
			admin,
			physio,
			patient
		})
	} catch (error) {
		return res.send({
			message: "error",
			error: true
		})
	}
}


// Add a degree
exports.addDegree = async (req, res) => {
	try {

		// return console.log(req.body, 'req.body');

		let name = req.body.name;
		if (!name) {
			return res.status(400).json({
				status: false,
				message: 'Degree name is required'
			});
		}

		const degree = new Degree({
			name: name
		});
		await degree.save();
		res.status(201).json({
			status: true,
			message: 'Degree added successfully',
			degree: degree
		});
	} catch (err) {
		res.status(400).json({
			status: false,
			message: err
		});
	}
}

// Get all degrees
exports.getDegrees = async (req, res) => {
	try {
		const degrees = await Degree.find();
		res.status(200).json({
			status: true,
			degrees: degrees
		});
	} catch (err) {
		res.status(400).json({
			status: false,
			message: err
		});
	}
}

// delete degree
exports.deleteDegree = async (req, res) => {
	try {
		let degreeId = req.params.degreeId;
		if (!degreeId) {
			return res.status(400).json({
				status: false,
				message: 'Degree ID is required'
			});
		}

		let degree = await Degree.findById(degreeId);
		if (!degree) {
			return res.status(404).json({
				status: false,
				message: 'Degree not found'
			});
		}

		let deletedDegree = await Degree.findByIdAndDelete(degreeId);
		res.status(200).json({
			status: true,
			message: 'Degree deleted successfully'
		});

	} catch (err) {
		res.status(400).json({
			status: false,
			message: err
		});
	}
}
// ==================================================================================

exports.loginAdmin = async (req, res) => {
	try {
		const email = req.body.email;
		const password = req.body.password;

		if (!email || !password)
			return res.send({
				message: "All Field required",
				status: 401,
				success: false
			});
		const user = await Admin.findOne({
			email: email,
		});
		if (!user) return res.status(401).send("Account not found");
		const validPassword = await bcrypt.compare(password, user.password);
		if (!validPassword) return res.status(401).json({
			message: "Invalid password",
			status: 401,
			success: false
		});

		let token = jwt.sign({
			Id: user._id
		}, process.env.JWT_SECRET_KEY)
		return res.status(201).json({
			message: "Login Success",
			status: 200,
			success: true,
			token
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json({
			message: "Something went wrong",
			error: true
		})
	}
}


exports.GetAllphysio = async (req, res) => {
	try {
		const admin = await Admin.find()
		const physio = await Physio.find()
		return res.render("admin/physio_list", {
			admin,
			physio
		})

	} catch (error) {
		console.log(error)
		return res.send({
			message: "Something went wrong",
			error: true
		})
	}
};

// admin send Otp
exports.sendOtpToAdmin = async (req, res) => {
	try {
		const {
			phone
		} = req.body;

		if (!phone) {
			return res.status(400).json({
				message: "Phone number is required",
				status: 400,
				success: false,
			});
		}

		const admin = await Admin.findOne({
			phone: phone
		});
		if (!admin) {
			return res.status(400).json({
				message: "Admin not found",
				status: 400,
				success: false,
			});
		}
		// console.log(admin, phone);
		let otp = Math.floor(1000 + Math.random() * 9000);
		let otpExpiry = new Date(Date.now() + 300000); // 5 minute expiry

		// msg91
		const otpResponse = await msg91otp.send(`91${phone}`);
		console.log(otpResponse);
		if (otpResponse.type === "success") {
			return res.status(200).json({
				message: "OTP sent successfully",
				status: 200,
				success: true,
			})
		} else {
			return res.status(400).json({
				message: "Failed to send OTP",
				status: 400,
				success: false,
			})
		}

	} catch (error) {
		console.error(error);
		return res.status(500).json({
			message: "Something went wrong, please try again later",
			status: 500,
			success: false,
		});
	}
}

// verify otp
exports.verifyOtp = async (req, res) => {
	try {
		const {
			phone,
			otp
		} = req.body;

		if (!phone || !otp) {
			return res.status(400).json({
				message: "Phone number and OTP are required",
				status: 400,
				success: false,
			});
		}

		const admin = await Admin.findOne({
			phone: phone
		});
		if (!admin) {
			return res.status(400).json({
				message: "Admin not found",
				status: 400,
				success: false,
			});
		}

		const response = await msg91otp.verify(`91${phone}`, otp);
		if (response.type === "success") {

			let token = jwt.sign({
				Id: admin._id
			}, process.env.JWT_SECRET_KEY)

			return res.status(201).json({
				message: "OTP verified successfully",
				status: 201,
				success: true,
				token
			});
		} else {
			return res.status(400).json({
				message: "Invalid OTP",
				status: 400,
				success: false,
			});
		}

	} catch (error) {
		console.log(error);
		return res.status(400).json({
			message: "Invalid OTP",
			status: 400,
			success: false,
		});
	}
}

// reset password
exports.resetPassword = async (req, res) => {
	try {
		const {
			password
		} = req.body;

		const { authorization } = req.headers;
		if (!authorization) {
			return res.status(400).json({ status: false, message: "token not find" });
		}

		if (!password) {
			return res.status(400).json({
				message: " password are required",
				status: 400,
				success: false,
			});
		}

		const token = authorization.replace("Bearer ", "");
		const userId = jwt.verify(token, process.env.JWT_SECRET_KEY);
		// return  console.log(userId)
		const admin = await Admin.findById(userId.Id);

		if (!admin) {
			return res.status(400).json({
				message: "Admin not found",
				status: 400,
				success: false,
			});
		}

		// password hashing
		const salt = await bcrypt.genSalt(Number(process.env.SALT_ROUNDS))
		const hash = await bcrypt.hash(password, salt)

		await Admin.findByIdAndUpdate(admin._id, {
			password: hash
		}, {
			new: true
		});

		return res.status(200).json({
			message: "Password reset successfully",
			status: 200,
			success: true,
		});

	} catch (error) {
		console.log(error);
		return res.status(500).json({
			message: "Something went wrong, please try again later",
			status: 500,
			success: false,
		});
	}
}
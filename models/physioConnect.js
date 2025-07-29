const mongoose = require('mongoose')

const physioConnect = mongoose.Schema({
    preferId: {
        type: String,
        unique: true,
        trim: true,
        default: null
    },
    googleId: {
        type: String,
        // unique: true,
        trim: true,
        default: null
    },
    fullName: {
        type: String,
        trim: true,
        default: null
    },
    phone: {
        type: String,
        // unique: true,
        trim: true,
        default: null
    },
    dob: {
        type: String,
        default: null
    },
    profileImage: {
        type: String,
        default: null,
        trim: true
    },
    email: {
        type: String,
        default: null,
    },
    about: {
        type: String,
        default: null,
        trim: true
    },
    rating: {
        type: Number,
        default: 0
    }, // 1-5
    specialization: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Specialization',
        default: null
    }],
    subspecializationId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subspecialization',
        default: null
    }],
    workExperience: {
        type: Number,
        default: 0
    },

    mpt: {
        type: Boolean,
        default: false
    },
    degree: {
        title: {
            type: String,
            default: null
        },
        degreeId: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Degree',
            default: null
        }],
        degreeImage: [{
            type: String,
            default: null
        }],
    },
    bptDegree: {
        degreeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Degree',
            default: null
        },
        image: {
            type: String,
            default: null
        }
    },
    mptDegree: {
        degreeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Degree',
            default: null
        },
        image: {
            type: String,
            default: null
        }
    },
    iapMember: {
        type: Number,
        default: 0
    }, // 0--> no , 1-->yes
    iapNumber: {
        type: String,
        default: null
    },
    iapImage: {
        type: String,
        default: null
    },
    serviceType: [{
        type: String,
        enum: ['home', 'clinic', 'online'],
        default: null
    }],
    country: {
        type: String,
        default: null
    },
    city: {
        type: String,
        default: null
    },
    state: {
        type: String,
        default: null,
    },
    achievement: [
        {
            title: { type: String, default: null },
            achievementImage: { type: String, default: null }
        }
    ],
    clinic: {
        status: Number, // 0-on  1-off 
        name: {
            type: String,
            default: null
        },
        imagesClinic: [{
            type: String,
            default: null
        }],
        address: {
            type: String,
            default: null
        },
        area: {
            type: String,
            default: null
        },
        zipCode: {
            type: Number,
            default: 0
        },
        workingDays: [{
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        }],
        timings: {
            start: {
                type: String,
                default: null
            },
            end: {
                type: String,
                default: null
            }
        },
        duration: {
            type: Number,
            default: 0
        },
        charges: {
            type: Number,
            default: 0
        },
        // consultationCharges: {
        //     type: Number,
        //     default: 0
        // }
    },
    home: {
        status: Number, // 0-on  1-off
        workingDays: [{
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        }],
        mode: Array,
        morningTimings: {
            start: {
                type: String,
                default: null
            },
            end: {
                type: String,
                default: null
            }
        },
        eveningTimings: {
            start: {
                type: String,
                default: null
            },
            end: {
                type: String,
                default: null
            }
        },
        duration: {
            type: Number,
            default: 0
        },
        zipCode: {
            type: Number,
            default: 0
        },
        homeCity: {
            type: String,
            default: null
        },
        homeState: {
            type: String,
            default: null
        },
        charges: {
            type: Number,
            default: 0
        },
        consultationCharges5Km: {
            type: Number,
            default: 0
        },
        consultationCharges10Km: {
            type: Number,
            default: 0
        },
    },
    online: {
        status: Number, // 0-on  1-off
        workingDays: Array,
        timings: {
            start: {
                type: String,
                default: null
            },
            end: {
                type: String,
                default: null
            }
        },
        duration: {
            type: Number,
            default: 0
        },
        charges: {
            type: Number,
            default: 0
        }
    },
    latitude: {
        type: String,
        default: null
    },
    longitude: {
        type: String,
        default: null
    },
    // location: {
    //     type: { type: String, enum: ['Point'], default: 'Point' },
    //     coordinates: {
    //         type: [Number],  // [longitude, latitude]
    //         required: true,
    //         default: [0, 0]  // Default coordinates, e.g., [longitude, latitude]
    //     }
    // },
    activeStatus: {
        type: Number,
        default: 1
    }, // 0-online 1-offline
    accountStatus: {
        type: Number,
        default: 0
    }, // 0-pending, 1--approved
    wallet: {
        type: Number,
        default: 0
    },
    gender: {
        type: Number,
        enum: [0, 1, 2], // 0-female 1-male 2-other
        default: 0
    },
    language: {
        type: String,
        enum: ['english', 'hindi'],
    },
    token: {
        type: String,
        default: null
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        default: null
    },
    subscriptionCount: {
        type: Number,
        default: 0          // Require to identify subscription expired
    },
    deviceId: {
        type: String,
        default: null
    },
    onboardedFrom: {
        type: String,
        enum: ['web', 'mobile', 'admin', 'other'],
        default: 'other'
    },
    patientCount: {
        type: Number,
        default: 0
    },
    edit: {
        type: Boolean,
        default: false
    },
    slug: {
        type: String,
        default: null
    },
    isPhysioConnect: {
        type: Boolean,
        default: false
    },
    isPhysioConnectPaid: {
        type: Boolean,
        default: false
    },
    isPhysioConnectPaidDate: {
        type: Date,
        default: null
    },
    isPhysioConnectPayment: {
        type: Number,
        default: 0
    },
    isPhysioConnectCoupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    },
    isPhysioConnectRefundRequest: {
        type: Boolean,
        default: false
    },
    isPhysioConnectRefundRequestUpiId: {
        type: String,
        default: null
    },
    isPhysioConnectProfileCompleted: {
        type: Boolean,
        default: false
    },
    isPhysioConnectTransferred: {
        type: Boolean,
        default: false
    },
    applicationVersion: {
        type: String,
    }
}, { timestamps: true })

physioConnect.index({ location: '2dsphere' });

module.exports = mongoose.model('PhysioConnect', physioConnect)

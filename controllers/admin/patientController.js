const Patient = require('../../models/patient');
const moment = require('moment-timezone');
const Appointment = require('../../models/appointment');
const Physio = require('../../models/physio');
const CashBack = require('../../models/cashBack');
const { sendFCMNotification } = require('../../services/fcmService');


// Get All Patients
exports.getAllPatientsDate = async (req, res) => {
    try {

        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        const patient = await Patient.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by date
                }
            },
            {
                $project: {
                    createdAtDate: { $toDate: "$createdAt" }, // Convert createdAt to Date format
                }
            },
            {
                $project: {
                    year: { $year: "$createdAtDate" },
                    month: { $month: "$createdAtDate" },
                    day: { $dayOfMonth: "$createdAtDate" },
                    time: {
                        $dateToString: { format: "%H:%M:%S", date: "$createdAtDate" }
                    },
                }
            },
            {
                $group: {
                    _id: {
                        year: "$year",
                        month: "$month",
                        // day: "$day",
                        // time: "$time"
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: {
                    "_id.year": 1,
                    "_id.month": 1,
                    // "_id.day": 1,
                    // "_id.time": 1
                }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    // date: "$_id.date",
                    // time: "$_id.time",
                    count: 1,
                    monthName: {
                        $arrayElemAt: [
                            [
                                "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
                            ],
                            { $subtract: ["$_id.month", 1] } // Convert month number to month name
                        ]
                    }
                }
            }
        ]);

        return res.send({
            success: true,
            data: patient
        })

    } catch (error) {
        console.log(error)
        return res.send({
            message: "Something went wrong",
            error: true
        })
    }
}

// Get Patient Acivity And Inactivity Count
exports.getPatientActivityAndInactivityCount = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        // Query to get active physios (updated within last 3 months)
        const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        const totalPatient = await Patient.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        const activePatient = await Patient.aggregate([
            {
                $match: {
                    updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        //  Query to get total physios created within the last 6 months
        //  const totalPhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
        //         }
        //     },
        //     {
        //         $count: "totalPhysioCount" // Count the total number of physios
        //     }
        // ]);

        // Query to get active physios (updated within last 3 months)
        // const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        // const activePhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by updatedAt range
        //         }
        //     },
        //     {
        //         $count: "activePhysioCount" // Count the number of active physios
        //     }
        // ]);

        return res.status(200).json({
            message: "Patient Data successfully",
            status: 200,
            success: true,
            totalPatient,
            activePatient
        });

    } catch (error) {
        console.error("Error while processing Patient counts:", error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get Patient State Count
exports.getPatientStateCount = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering


        // Aggregation pipeline to count Physios by clinic.state
        const patientCountByState = await Patient.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }
                }
            },
            // {
            //     $unwind: "$clinic" // Unwind the clinic array to work with each clinic separately
            // },
            {
                $group: {
                    _id: "$state", // Group by clinic.state
                    count: { $sum: 1 } // Count the number of Patient in each state
                }
            },
            {
                $sort: { count: -1 } // Sort by count in descending order
            }
        ]);

        res.status(200).json({
            success: true,
            data: patientCountByState,
        });
    } catch (error) {
        console.error("Error while processing Patient counts:", error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};


// =============================== State Wise Patient Count ===============================

// Get Patent State Count Signup
exports.getPatientStateCountSignup = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        let state = req.query.state;
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        // Aggregation pipeline to filter users by date
        const usersCountByMonth = await Patient.aggregate([
            {
                $match: {
                    state: state, // Filter by state
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
            {
                $project: {
                    // Convert createdAt to Date (if not already in Date format)
                    createdAtDate: { $toDate: "$createdAt" },
                }
            },
            {
                $project: {
                    year: { $year: "$createdAtDate" },
                    month: { $month: "$createdAtDate" },
                }
            },
            {
                $group: {
                    _id: { year: "$year", month: "$month" }, // Group by year and month
                    count: { $sum: 1 } // Count the number of users in each group
                }
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 } // Sort by year and month in descending order
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    count: 1,
                    monthName: {
                        $arrayElemAt: [
                            [
                                "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
                            ],
                            { $subtract: ["$_id.month", 1] } // Convert month number to month name
                        ]
                    }
                }
            }
        ]);

        res.status(200).json({
            message: "Patient Data successfully",
            success: true,
            status: 200,
            data: usersCountByMonth,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Get Patient State Activity and Inactivity Count
exports.getPatientStateActivityAndInactivityCount = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        // Query to get active Patients (updated within last 3 months)
        const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        let state = req.query.state;
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        const totalPatient = await Patient.aggregate([
            {
                $match: {
                    state: state,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        const activePatient = await Patient.aggregate([
            {
                $match: {
                    state: state,
                    updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        //  Query to get total Patients created within the last 6 months
        //  const totalPatient = await Patient.aggregate([
        //     {
        //         $match: {
        //             createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
        //         }
        //     },
        //     {
        //         $count: "totalPatientCount" // Count the total number of Patients
        //     }
        // ]);

        // Query to get active Patients (updated within last 3 months)
        // const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        // const activePatient = await Patient.aggregate([
        //     {
        //         $match: {
        //             updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by updatedAt range
        //         }
        //     },
        //     {
        //         $count: "activePatientCount" // Count the number of active Patients
        //     }
        // ]);

        return res.status(200).json({
            message: "Patient Data successfully",
            status: 200,
            success: true,
            totalPatient,
            activePatient
        });

    } catch (error) {
        console.error("Error while processing Patient counts:", error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
}

// Get Patient city Count
exports.getPatientCityCount = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        let state = req.query.state;
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        // Aggregation pipeline to count Patients by clinic.state
        const PatientCountByState = await Patient.aggregate([
            {
                $match: {
                    state: state,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }
                }
            },
            // {
            //     $unwind: "$clinic" // Unwind the clinic array to work with each clinic separately
            // },
            {
                $group: {
                    _id: "$city", // Group by clinic.state
                    count: { $sum: 1 } // Count the number of Patients in each state
                }
            },
            {
                $sort: { count: -1 } // Sort by count in descending order
            }
        ]);

        res.status(200).json({
            message: "Patient Data successfully",
            success: true,
            status: 200,
            data: PatientCountByState,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Semthing went wrong Please try again',
            success: false,
            error: error.message
        });
    }
};

// ================================ City Wise Patient Count ================================
// Get Patient city Count
exports.getPatientCityCountSignup = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        let state = req.query.state;
        let city = req.query.city;

        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }



        // Aggregation pipeline to filter users by date
        const usersCountByMonth = await Patient.aggregate([
            {
                $match: {
                    state: state, // Filter by state
                    city: city, // Filter by city
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
            {
                $project: {
                    // Convert createdAt to Date (if not already in Date format)
                    createdAtDate: { $toDate: "$createdAt" },
                }
            },
            {
                $project: {
                    year: { $year: "$createdAtDate" },
                    month: { $month: "$createdAtDate" },
                }
            },
            {
                $group: {
                    _id: { year: "$year", month: "$month" }, // Group by year and month
                    count: { $sum: 1 } // Count the number of users in each group
                }
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 } // Sort by year and month in descending order
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    count: 1,
                    monthName: {
                        $arrayElemAt: [
                            [
                                "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
                            ],
                            { $subtract: ["$_id.month", 1] } // Convert month number to month name
                        ]
                    }
                }
            }
        ]);

        // console.log(usersCountByMonth);

        res.status(200).json({
            message: "Patient Data successfully",
            success: true,
            status: 200,
            data: usersCountByMonth,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Semthing went wrong Please try again',
            success: false,
            error: error.message
        });
    }
}

// Get Patient city Count Active And Inactive
exports.getPatientCityCountActiveAndInactive = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        // Query to get active physios (updated within last 3 months)
        const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        let state = req.query.state;
        let city = req.query.city;

        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }

        const totalPatient = await Patient.aggregate([
            {
                $match: {
                    state: state,
                    city: city,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        const activePatient = await Patient.aggregate([
            {
                $match: {
                    state: state,
                    city: city,
                    updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        //  Query to get total Patients created within the last 6 months
        //  const totalPatient = await Patient.aggregate([
        //     {
        //         $match: {
        //             createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
        //         }
        //     },
        //     {
        //         $count: "totalPatientCount" // Count the total number of Patients
        //     }
        // ]);

        // Query to get active Patients (updated within last 3 months)
        // const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        // const activePatient = await Patient.aggregate([
        //     {
        //         $match: {
        //             updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by updatedAt range
        //         }
        //     },
        //     {
        //         $count: "activePatientCount" // Count the number of active Patients
        //     }
        // ]);

        return res.status(200).json({
            message: "Patient Data successfully",
            status: 200,
            success: true,
            totalPatient,
            activePatient
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Semthing went wrong Please try again',
            success: false,
            error: error.message
        });
    }
};

// Get Patient city Pincode 
exports.getPatientCityPincode = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        let state = req.query.state;
        let city = req.query.city;
        // let serviceType = req.query.serviceType;

        // Validate required fields
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }

        // Aggregation pipeline to count Patients by clinic.zipCode
        const PatientCountByState = await Patient.aggregate([
            {
                $match: {
                    state: state,
                    city: city,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate },

                }
            },
            // {
            //     $unwind: "$clinic" // Unwind the clinic array to work with each clinic separately
            // },
            {
                $group: {
                    _id: "$zipCode", // Group by clinic.zipCode
                    count: { $sum: 1 } // Count the number of Patients in each zipCode
                }
            },
            {
                $sort: { count: -1 } // Sort by count in descending order
            }
        ]);

        res.status(200).json({
            message: "Patient Data successfully retrieved",
            success: true,
            status: 200,
            data: PatientCountByState,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Semthing went wrong Please try again',
            success: false,
            error: error.message
        });
    }
};

// ====================================== PinCode ====================
// Get Patient Pincode
exports.getPatientPincode = async (req, res) => {
    try {
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').toISOString();
        const currentDate = moment().tz('Asia/Kolkata').endOf('day').toISOString();

        const { state, city, serviceType, zipCode } = req.query;

        // Validate required fields
        if (!state || !city || !zipCode) {
            return res.status(400).json({
                message: 'Please provide state, city, serviceType, and zipCode for filtering',
                success: false,
                status: 400,
            });
        }


        // Aggregation pipeline
        const usersCountByMonth = await Patient.aggregate([
            {
                $match: {
                    state,
                    city,
                    zipCode: parseInt(zipCode), // Dynamically match based on zipCodeField
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }, // Filter by createdAt range
                },
            },
            {
                $project: {
                    createdAtDate: { $toDate: "$createdAt" }, // Ensure createdAt is treated as a Date
                },
            },
            {
                $project: {
                    year: { $year: "$createdAtDate" },
                    month: { $month: "$createdAtDate" },
                },
            },
            {
                $group: {
                    _id: { year: "$year", month: "$month" }, // Group by year and month
                    count: { $sum: 1 }, // Count the number of users in each group
                },
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 }, // Sort by year and month in descending order
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    count: 1,
                    monthName: {
                        $arrayElemAt: [
                            [
                                "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
                            ],
                            { $subtract: ["$_id.month", 1] }, // Convert month number to month name
                        ],
                    },
                },
            },
        ]);

        res.status(200).json({
            message: "Patient Data retrieved successfully",
            success: true,
            status: 200,
            data: usersCountByMonth,
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};


// Get Patient Pincode Active and In active
exports.getPatientPincodeActiveInactive = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        const { state, city, serviceType, zipCode } = req.query;

        // Validate required fields
        if (!state || !city || !zipCode) {
            return res.status(400).json({
                message: 'Please provide state, city, serviceType, and zipCode for filtering',
                success: false,
                status: 400,
            });
        }

        // Determine the zipCode field based on serviceType
        // const zipCodeField = serviceType === 'clinic' ? 'clinic.zipCode' : 'home.zipCode';


        const totalPatient = await Patient.aggregate([
            {
                $match: {
                    state,
                    city,
                    zipCode: parseInt(zipCode), // Dynamically match based on zipCodeField
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }, // Filter by createdAt range
                },
            },
        ])

        const activePatient = await Patient.aggregate([
            {
                $match: {
                    state,
                    city,
                    zipCode: parseInt(zipCode), // Dynamically match based on zipCodeField
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }, // Filter by createdAt range
                },
            },
        ])

        //  Query to get total Patients created within the last 6 months
        //  const totalPatient = await Patient.aggregate([
        //     {
        //         $match: {
        //             createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
        //         }
        //     },
        //     {
        //         $count: "totalPatientCount" // Count the total number of Patients
        //     }
        // ]);

        // Query to get active Patients (updated within last 3 months)
        // const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        // const activePatient = await Patient.aggregate([
        //     {
        //         $match: {
        //             updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by updatedAt range
        //         }
        //     },
        //     {
        //         $count: "activePatientCount" // Count the number of active Patients
        //     }
        // ]);

        return res.status(200).json({
            message: "Patient Data successfully",
            status: 200,
            success: true,
            totalPatient,
            activePatient
        });

    } catch (error) {
        console.error("Error while processing physio counts:", error);
        res.status(500).json({
            message: 'Server error',
            status: 500,
            success: false,
            error: error.message
        });
    }
}

// Get Patient 
exports.getPatientCountByPatent = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        const { state, city, serviceType, zipCode } = req.query;

        // Validate required fields
        if (!state || !city || !zipCode) {
            return res.status(400).json({
                message: 'Please provide state, city, serviceType, and zipCode for filtering',
                success: false,
                status: 400,
            });
        }

        // Determine the zipCode field based on serviceType
        // const zipCodeField = serviceType === 'clinic' ? 'clinic.zipCode' : 'home.zipCode';


        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }

        // Aggregation pipeline to count Patients by clinic.state
        const patientCountByState = await Patient.aggregate([
            {
                $match: {
                    state: state,
                    city: city,
                    zipCode: parseInt(zipCode),
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }
                }
            },
            {
                $sort: { count: -1 } // Sort by count in descending order
            }
        ]);

        res.status(200).json({
            message: "Patient Data successfully",
            success: true,
            status: 200,
            data: patientCountByState,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
}


// Patient By Id
exports.getPhysioByPatientId = async (req, res) => {
    try {
        const { patientId } = req.query;

        const patient = await Patient.findById(patientId);
        if (!Patient) {
            return res.status(404).json({
                message: 'Patient data not found',
                success: false,
                status: 404,
            });
        }

        res.status(200).json({
            message: 'Patient data retrieved successfully',
            success: true,
            status: 200,
            data: patient,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Patient By Appointment
exports.getPatientByAppointment = async (req, res) => {
    try {
        const { patientId } = req.query;

        if (!patientId) {
            return res.status(400).json({
                message: 'Please provide patientId',
                success: false,
                status: 400,
            });
        }

        // if check valid Patient id
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({
                message: 'Patient data not found',
                success: false,
                status: 404,
            });
        }

        // Query to get appointments
        const appointments = await Appointment.find({ patientId }).populate('physioId patientId');

        if (!appointments) {
            return res.status(404).json({
                message: 'Patient appointments not found',
                success: false,
                status: 404,
            });
        }

        res.status(200).json({
            message: 'Patient appointments retrieved successfully',
            success: true,
            status: 200,
            data: appointments,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
}

// Patient and Physio Chat
exports.getPatientAndPhysioChat = async (req, res) => {
    try {
        const { patientId, physioId } = req.query;

        if (!patientId || !physioId) {
            return res.status(400).json({
                message: 'Please provide patientId and physioId',
                success: false,
                status: 400,
            });
        }

        // if check valid Patient id
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({
                message: 'Patient data not found',
                success: false,
                status: 404,
            });
        }

        // if check valid Physio id
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: 'Physio data not found',
                success: false,
                status: 404,
            });
        }

        // Query to get chat logs
        const chatLogs = await Chat.find({ $and: [{ patientId: patientId }, { physioId: physioId }] });
        if (!chatLogs) {
            return res.status(404).json({
                message: 'No chat logs found',
                success: false,
                status: 404,
            });
        }

        res.status(200).json({
            message: 'Patient and Physio chat logs retrieved successfully',
            success: true,
            status: 200,
            data: chatLogs,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// get Patient 
exports.getAllPatients = async (req, res) => {
    try {
        const { name, onboardedFrom, date } = req.query;

        let query = { isDeleted: false };

        if (name) {
            query.fullName = { $regex: name.toLowerCase().trim(), $options: 'i' };
        }

        if (onboardedFrom === 'mobile' || onboardedFrom === 'web') {
            query.onboardedFrom = onboardedFrom;
        }

        if (date) {
            const startOfDay = moment(date).startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
            const endOfDay = moment(date).endOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
            query.createdAt = { $gte: startOfDay, $lte: endOfDay }
        }
        const patients = await Patient.find(query)

        return res.status(200).json({
            message: "Successfully retrieved all patients",
            success: true,
            status: 200,
            data: patients
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
}


exports.getDeletedPatient = async (req, res) => {
    try {
        const { name } = req.query;
        let query = { isDeleted: true };

        if (name) {
            query.fullName = { $regex: name.toLowerCase().trim(), $options: 'i' };
        }

        const deletedPatients = await Patient.find(query);

        return res.status(200).json({
            message: 'Deleted patients fetched successfully',
            success: true,
            status: 200,
            data: deletedPatients
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Server error',
            success: false
        });
    }
}


// Delete Patient
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


// Restore Patient
exports.restorePatient = async (req, res) => {
    try {


        const { patientId } = req.query;

        if (!patientId) {
            return res.status(400).json({
                message: "patientId is required",
                success: false,
                status: 400,
            });
        }

        const patient = await Patient.findById(patientId);

        if (!patient) {
            return res.status(404).json({
                message: "Patient not found",
                success: false,
                status: 404,
            });
        }

        if (!patient.isDeleted) {
            return res.status(400).json({
                message: "Patient is not soft deleted",
                success: false,
                status: 400,
            });
        }

        await Patient.findByIdAndUpdate(patientId, { isDeleted: false },
            { new: true });

        res.status(200).json({
            message: "Patient restored successfully",
            success: true,
            status: 200,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Server error",
            success: false,
            status: 500,
        });
    }
};




// delete patient permanently
exports.purgePatient = async (req, res) => {
    try {
        const { patientId } = req.query;

        if (!patientId) {
            return res.status(401).json({
                message: "patientId Is Required",
                success: false,
                status: 401
            });
        }

        const patient = await Patient.findByIdAndDelete(patientId);

        if (!patient) {
            return res.status(404).json({
                message: 'Patient not found',
                success: false,
                status: 404,
            });
        }

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


// Today patient counts

exports.getTodayPatients = async (req, res) => {
    try {
        const today = moment().tz('Asia/Kolkata').startOf('day').format('YYYY-MM-DDTHH:mm:ss.ssssSS');

        const patients = await Patient.find({
            createdAt: { $gte: today },
        });

        res.status(200).json({
            message: 'Today patient counts',
            success: true,
            status: 200,
            data: patients.length,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};


exports.getCashback = async (req, res) => {
    try {
        const cashback = await CashBack.find().populate('userId transactionId').sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Cashback fetched successfully',
            success: true,
            status: 200,
            data: cashback,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};


exports.payCashback = async (req, res) => {
    try {
        const { cashbackId } = req.body;

        const cashback = await CashBack.findById(cashbackId);

        if (!cashback) {
            return res.status(404).json({
                message: 'Cashback not found',
                success: false,
                status: 404,
            });
        }


        // if (cashback.status === 'success') {
        //     return res.status(400).json({
        //         message: 'Cashback already paid',
        //         success: false,
        //         status: 400,
        //     });
        // }

        if (cashback.status === 'pending' || cashback.userUpiId === null) {
            return res.status(400).json({
                message: 'Cashback already paid or user UPI ID not found',
                success: false,
                status: 400,
            });
        }

        cashback.status = 'success';
        await cashback.save();

        // Send Notification
        const patient = await Patient.findById(cashback.userId);
        const data = {
            patientId: patient._id.toString(),
            title: "Cashback Paid",
            body: "Your cashback has been sent. Thank you!",
            type: "other",
            from: "admin",
            to: "patient",
            for: "patient"
        }

        const result = await sendFCMNotification(patient.deviceId, data);
        if (!result.success) {
            console.log("Error sending notification to patient", result);
        }

        res.status(200).json({
            message: 'Cashback paid successfully',
            success: true,
            status: 200,
            data: cashback,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};


/**
 * @route GET /api/admin/patient/treatment-request
 * @description Get appointments with treatment requests
 */
exports.getTreatmentRequest = async (req, res) => {
    try {
        const treatmentRequest = await Appointment.find({
            isTreatmentRequested: true,
            "isTreatmentScheduled.treatmentDate": []
        }).populate('patientId physioId').sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Treatment request fetched successfully',
            success: true,
            status: 200,
            data: treatmentRequest,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

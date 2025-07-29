const Transaction = require('../../models/transaction')
const Physio = require('../../models/physio')
const moment = require('moment');
const PhysioHelper = require('../../utility/physioHelper');
const sendNotification = require('../../app');
const { sendFCMNotification } = require('../../services/fcmService');
const appointment = require('../../models/appointment');
const { createAppointmentInvoice } = require('../app/appointmentController');
const invoice = require('../../models/invoice');

// Get Withdrawal Request
exports.getPhysioWithdrawalRequest = async (req, res) => {
    try {
        const transactions = await Transaction.find({ physioTransactionType: 'withdraw' }).populate('physioId').sort({ createdAt: -1 })
        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: transactions
        })
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}

// Get physti withdrawal request
exports.getPhystiWithdrawalRequest = async (req, res) => {
    try {

        const physioId = req.query.physioId;
        // const amount = req.query.amount;

        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }

        // if(!amount){
        //     return res.status(400).json({
        //         message: 'Amount is required',
        //         success: false,
        //         status: 400
        //     });
        // }

        // if check physio

        const physio = await Physio.findOne({ _id: physioId });
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        // if check amount minimum 100
        // if (amount < 100) {
        //     return res.status(400).json({
        //         message: 'Minimum amount is 100',
        //         success: false,
        //         status: 400
        //     });
        // }


        const transactions = await Transaction.find({
            physioId,
            // amount,
            physioTransactionType: 'withdraw'
        }).populate('physioId').sort({ createdAt: -1 })
        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: transactions
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}

// Get physio Transaction
exports.getPhysioOnlineTransaction = async (req, res) => {
    try {
        let physioId = req.query.physioId;
        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }


        const transactions = await Transaction.find({
            paymentMode: "online",
        }).populate('patientId physioId couponId').populate({
            path: 'couponId',
            select: 'couponName couponCode discount status couponPlace'
        })
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: transactions
        });

    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}
exports.getPhysioCashTransaction = async (req, res) => {
    try {
        let physioId = req.query.physioId;
        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }


        const transactions = await Transaction.find({
            paymentMode: "cash",
        }).populate('patientId physioId couponId').populate({
            path: 'couponId',
            select: 'couponName couponCode discount status couponPlace'
        })
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: transactions
        });

    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}

// get physio withdrawal request
exports.getPhysioWithdrawalRequestByDate = async (req, res) => {
    try {
        const { physioId } = req.query;

        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }
        // if check physio
        const physio = await Physio.findOne({ _id: physioId, });
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        const transactions = await Transaction.find({
            physioId,
            physioTransactionType: 'withdraw',
        }).sort({ createdAt: -1 })

        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: transactions
        });
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}

exports.withdrawalInvoice = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({
                message: 'id is required',
                success: false,
                status: 400
            });
        }
        // if check physio
        const Invoice = await invoice.findOne({
            transactionId: id,

        }).populate('physioId  transactionId');
        if (!Invoice) {
            return res.status(404).json({
                message: 'invoice not found',
                success: false,
                status: 404
            });
        }
        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: Invoice
        });
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}

exports.updateWithdrawStatus = async (req, res) => {
    try {
        const { id, status } = req.body;
        const paymentStatus = status === "Rejected" ? "failed" : (status === "Completed" ? "paid" : "pending");

        const txn = await Transaction.findById(id);
        if (!txn) {
            return res.status(400).json({
                message: 'Transaction not found',
                success: false,
                status: 400,
            });
        }

        txn.paymentStatus = paymentStatus;

        let newInvoice = null;
        if (status === "Completed") {
            newInvoice = new invoice({
                appointmentId: txn.appointmentId,  // FIXED: pulled from txn
                type: "withdraw",
                transactionId: txn._id,
                physioId: txn.physioId,
                amount: txn.amount,
                paymentMode: txn.paymentMode
            });

            await newInvoice.save();  // only save if it was created
        }

        await txn.save();

        return res.status(200).json({
            message: 'Status updated',
            success: true,
            data: newInvoice,
            status: 200,
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error',
            success: false,
            status: 500,
            error: error.message || error
        });
    }
};

exports.payToPhysioPlusHistory = async (req, res) => {
    try {

        const { physioId } = req.query;

        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });
        const physio = await Physio.findById({ _id: physioId });
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });
        const transactions = await Transaction.find({
            physioId,
            paidTo: 'physioPlus',
            paidFor: "debt"
        }).populate('physioId');
        return res.status(200).json({
            message: 'Transactions fetched',
            success: true,
            status: 200,
            data: transactions
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        });
    }
};


// Approve physio withdrawal request
exports.approvePhysioWithdrawalRequest = async (req, res) => {
    try {

        const { transactionId, physioId } = req.body;

        if (!transactionId || !physioId) {
            return res.status(400).json({
                message: 'transactionId and physioId are required',
                success: false,
                status: 400
            });
        }

        const physio = await Physio.findById(physioId)
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        // if check transaction
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({
                message: 'Transaction not found',
                success: false,
                status: 404
            });
        }

        await Transaction.updateOne({ _id: transactionId }, {
            $set: {
                paymentStatus: "paid"
            }
        });

        // send notification to physio
        if (physio) {
            const data = {
                title: 'Withdrawal Approved',
                body: `Your funds have been successfully processed ₹${transaction.amount}`,
                physioId: physio._id.toString(),
                type: 'withdrawal',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            }

            const result = await sendFCMNotification(physio.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }
        }

        res.status(200).json({
            message: 'Transaction updated',
            status: 200,
            success: true
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
};

// patient Transaction
exports.getPatientTransaction = async (req, res) => {
    try {
        const { patientId } = req.query;
        if (!patientId) {
            return res.status(400).json({
                message: 'PatientId is required',
                success: false,
                status: 400
            });
        }
        const transactions = await Transaction.find({
            patientId,
        }).populate('couponId').sort({ createdAt: -1 })

        if (!transactions) {
            return res.status(404).json({
                message: 'Transactions not found',
                success: false,
                status: 404
            });
        }

        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            data: transactions
        })
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong Please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}


// physioAmount Transaction
exports.physioRevenue = async (req, res) => {
    try {
        const { physioId } = req.query;
        console.log(req.query);
        console.log(req.query);


        console.log(req.body, "body");
        if (!physioId) {
            return res.status(400).json({
                data: req.query,
                dat: req.params,
                message: "Required physioId",
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false,
            });
        }

        const transactions = await Transaction.find({
            physioId: physioId,
            physioTransactionType: { $in: ["credit", "debit", "withdraw"] },
            paidFor: { $in: ['appointment', 'treatment'] },
        })


        const [totalAppointment, totalTreatment] = await Promise.all([

            appointment.find({ physioId: physioId, appointmentStatus: 0 }).countDocuments(),
            appointment.find({ physioId: physioId, appointmentStatus: 1 }).countDocuments()
        ])

        let consultationAmt = 0;
        let treatmentAmt = 0;
        let cashAmount = 0
        let onlineAmount = 0;
        let totalGst = 0;
        let platformCharges = 0
        let onlineGst = 0
        let onlinePlatFormCharges = 0
        let cashGst = 0
        let cashPlatFormCharges = 0
        transactions.map(txn => {
            totalGst += txn.gstAmount
            platformCharges += txn.platformCharges

            if (txn.paymentMode === 'online') {
                onlineAmount += txn.physioAmount
                onlineGst += txn.gstAmount
                onlinePlatFormCharges += txn.platformCharges

            }
            else if (txn.paymentMode === 'cash') {
                cashAmount += txn.physioAmount
                cashGst += txn.gstAmount
                cashPlatFormCharges += txn.platformCharges
            }
            if (txn.paidFor === "appointment") {
                consultationAmt += txn.physioAmount
            }
            else if (txn.paidFor === "treatment") {
                treatmentAmt += txn.physioAmount
            }
        })

        return res.status(200).json({
            message: "physio Revenue",
            status: 200,
            success: true,
            data: {
                totalRevenue: (consultationAmt + treatmentAmt + totalGst + platformCharges),
                physioEarning: consultationAmt + treatmentAmt,
                physioPlusEarning: platformCharges,
                gstAmount: totalGst,
                treatmentAmt,
                onlineAmount,
                cashAmount,
                totalAppointment,
                totalTreatment,
                physioWalletAmt: physio?.wallet,
                commission: {
                    online: {
                        onlineAmount: onlineAmount + onlineGst + onlinePlatFormCharges,
                        onlineGst,
                        onlinePlatFormCharges,
                        totalCommission: onlinePlatFormCharges + onlineGst
                    },
                    cash: {
                        cashAmount: cashAmount + cashGst + cashPlatFormCharges,
                        cashGst,
                        cashPlatFormCharges,
                        totalCommission: cashPlatFormCharges + cashGst
                    }
                }


            },
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}
// adminAmount Transaction
exports.getAdminAmountTransaction = async (req, res) => {
    try {
        const { adminId } = req.query;
        if (!adminId) {
            return res.status(400).json({
                message: 'AdminId is required',
                success: false,
                status: 400
            });
        }
        // Fetch transactions
        const transactions = await Transaction.find({ adminId });
        if (!transactions) {
            return res.status(404).json({
                message: 'Transactions not found',
                success: false,
                status: 404
            });
        }
        // Calculate total admin amount
        const adminAmount = transactions.reduce((total, txn) => total + (txn.amount || 0), 0);
        res.status(200).json({
            message: 'Transactions fetched',
            status: 200,
            success: true,
            adminAmount,
            // adminAmount  // Include total admin amount
        });

    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong. Please try again.',
            status: 500,
            success: false,
            error: error.message
        });
    }
};

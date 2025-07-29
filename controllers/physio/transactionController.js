const Transaction = require('../../models/transaction')
const Physio = require('../../models/physio')
const generateRandomCode = require('../../utility/generateRandomCode');
const Appointment = require('../../models/appointment');
const { sendFCMNotification } = require('../../services/fcmService');

// Get Physios with transactions
exports.getPhysioTransactions = async (req, res) => {
	try {
		const { physioId, paymentMode } = req.query;

		console.log(req.query);

		// if (!physioId) return res.status(400).json({
		// 	message: 'PhysioId is required',
		// 	success: false,
		// 	status: 400
		// });

		const physio = await Physio.findById({ _id: physioId });
		if (!physio) return res.status(400).json({
			message: 'Physio not found',
			success: false,
			status: 400
		});

		let modes = ['online', 'online/voucher', 'online/coin'];

		if (paymentMode == 'cash') {
			modes = ['cash'];
		}

		const transactions = await Transaction.find({
			physioId,
			paymentMode: { $in: modes },
			paidFor: { $nin: ['debt', 'subscription'] }
		}).populate('patientId appointmentId couponId')
			.populate({
				path: 'appointmentId',
				populate: {
					path: 'patientId',
					select: 'fullName profilePhoto',
				}
			});

		return res.status(200).json({
			Message: 'Transactions fetched',
			status: 200,
			success: true,
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
}

// Physios wallet withdraw transactions
exports.PhysioWalletWithdrawTransactions = async (req, res) => {
	try {
		const { physioId, amount } = req.body;

		if (!physioId) return res.status(400).json({
			message: 'PhysioId is required',
			success: false,
			status: 400
		});

		if (!amount) return res.status(400).json({
			message: 'Amount is required',
			success: false,
			status: 400
		});

		const physio = await Physio.findById({ _id: physioId });
		if (!physio) return res.status(400).json({
			message: 'Physio not found',
			success: false,
			status: 400
		});

		// if check balance
		if (amount > physio.wallet) return res.status(400).json({
			message: 'Insufficient balance',
			success: false,
			status: 400
		});


		// Calculate Total Revenue using derived formula
		const totalRevenue = amount / 0.76;
		const platformEarning = totalRevenue * 0.22;
		const gst = platformEarning * 0.18;

		// transaction details
		const transaction = new Transaction({
			physioId: physioId,
			amount: totalRevenue,
			wallet: amount,
			physioTransactionType: "withdraw",
			transactionId: `PHWID_${generateRandomCode()}`,
			paymentMode: 'wallet',
			paymentStatus: 'pending',
			paidTo: "physioPlus",
			gstAmount: gst,
			physioAmount: amount,
			physioPlusAmount: platformEarning
		});
		await transaction.save();

		// physio wallet update
		const physioWallet = await Physio.findById({ _id: physioId });
		await physioWallet.updateOne({ $inc: { wallet: - amount } });

		const data = {
			physioId: physio._id.toString(),
			title: "Withdraw Request",
			body: `${physio.fullName} has requested to withdraw ₹${amount} from wallet`,
			type: 'withdrawal',
			from: 'admin',
			to: 'admin',
			for: 'admin'
		}

		await sendFCMNotification(physio.deviceId, data, true);

		return res.status(200).json({
			message: 'Transaction created',
			success: true,
			status: 200,
			data: transaction
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

// get physio withdraw history
exports.getWithdrawHistory = async (req, res) => {
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
			physioTransactionType: 'withdraw'
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
exports.payToPhysioPlus = async (req, res) => {
	try {
		// {physioId , amount} = req.body



	} catch (error) {

	}
}

// physio count
exports.getPhysioCount = async (req, res) => {
	try {
		const count = await Physio.countDocuments({});
		return res.status(200).json({
			message: 'Physio count fetched',
			success: true,
			status: 200,
			data: count
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

// get transactions BY applicationid
exports.getTransactionByAppId = async (req, res) => {
	try {
		const { appointmentId, physioId } = req.query;

		if (!appointmentId) return res.status(400).json({
			message: 'Application Id is required',
			success: false,
			status: 400
		});

		if (!physioId) return res.status(400).json({
			message: 'Physio Id is required',
			success: false,
			status: 400
		});

		const appointment = await Appointment.findById({ _id: appointmentId });
		if (!appointment) return res.status(400).json({
			message: 'Appointment not found',
			success: false,
			status: 400
		});

		const physio = await Physio.findById({ _id: physioId });

		const transactions = await Transaction.find({
			appointmentId,
			physioId
		}).populate('patientId appointmentId couponId');

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
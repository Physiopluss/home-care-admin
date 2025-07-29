const Invoice = require('../../models/invoice');

exports.getInvoice = async (req, res) => {
    try {
        const { physioId, patientId, transactionId, subscriptionId, type } = req.query;

        const filter = {};
        if (physioId) filter.physioId = physioId;
        if (patientId) filter.patientId = patientId;
        if (transactionId) filter.transactionId = transactionId;
        if (subscriptionId) filter.subscriptionId = subscriptionId;
        if (type) filter.type = type;

        const invoices = await Invoice.find(filter);

        return res.status(200).json({
            message: 'Invoices fetched',
            success: true,
            status: 200,
            data: invoices
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Something went wrong, please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}


exports.getSubscriptionInvoice = async (req, res) => {
    try {
        const { subscriptionId } = req.query;

        if (!subscriptionId) return res.status(400).json({
            message: 'SubscriptionId is required',
            success: false,
            status: 400
        });

        const invoice = await Invoice.findOne({
            subscriptionId,
            type: "subscription"
        }).populate('physioId', 'fullName clinic.address').populate({
            path: 'subscriptionId',
            populate: {
                path: 'planId'
            }
        }).sort({ createdAt: -1 });

        if (!invoice) {
            return res.status(404).json({
                message: 'Invoice not found',
                success: false,
                status: 404
            });
        }

        const gst = invoice.subscriptionId?.planId?.price * 0.18;
        const data = {
            physioId: invoice.physioId?._id || null,
            invoiceNumber: invoice.invoiceNumber || null,
            subscriptionId: invoice.subscriptionId?._id || null,
            transactionId: invoice.transactionId?._id || null,
            amount: invoice.amount || null,
            paymentMode: invoice.paymentMode || null,
            type: invoice.type || null,
            planName: invoice.subscriptionId?.planId?.name || null,
            planAmount: invoice.subscriptionId?.planId?.price || null,
            physioName: invoice.physioId?.fullName || null,
            physioAddress: invoice.physioId?.clinic?.address || null,
            gst: gst || null,
            wallet: invoice.physioId?.wallet || null,
            createdAt: invoice.createdAt || null
        }

        return res.status(200).json({
            message: 'Invoice fetched',
            success: true,
            status: 200,
            data
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Something went wrong, please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}


exports.getPatientInvoice = async (req, res) => {
    try {
        const { patientId } = req.query;

        if (!patientId) return res.status(400).json({
            message: 'PatientId is required',
            success: false,
            status: 400
        });

        const invoices = await Invoice.find({ patientId });

        return res.status(200).json({
            message: 'Invoices fetched',
            success: true,
            status: 200,
            data: invoices
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Something went wrong, please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}

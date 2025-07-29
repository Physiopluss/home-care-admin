const appointment = require('../../models/appointment');
const invoice = require('../../models/invoice');
const Invoice = require('../../models/invoice');

exports.getInvoice = async (req, res) => {
    try {
        const { appointmentId, appointmentStatus =0 } = req.query;

        if (!appointmentId) {
            return res.status(400).json({
                message: 'appointmentId  is required',
                status: 400,
            });
        }
        console.log(req.query);
        

        const invoices = await invoice.findOne(
            {
                appointmentId: appointmentId,
                type: appointmentStatus === 0 || "0" ? "appointment" : "treatment"

            })
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
        const { physioId } = req.query;

        const invoice = await Invoice.findOne({
            physioId,
            type: "subscription"
        }).populate('physioId', 'fullName clinic.address').populate('transactionId').populate({
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

        const gst = invoice.transactionId?.gst;
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
            wallet: invoice.transactionId?.wallet || null,
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
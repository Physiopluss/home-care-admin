const mongoose = require("mongoose");

const invoiceSchema = mongoose.Schema(
    {
        invoiceNumber: {
            type: String,
            unique: true,
        },
        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transaction",
            // required: true,
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment",
        },
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
        },
        physioId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Physio",
        },
        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subscription",
        },
        type: {
            type: String,
            enum: ["appointment", "treatment", "subscription", "withdraw","other"],
            default: null
        },
        amount: {
            type: Number,
            required: true,
        },

        totalTreatmentAmount: {
            type: Number,
        },
        appointmentAmount: {
            type: Number,
            default: null
        },
        couponName: {
            type: String,
            default: null
        },
        couponType: {
            type: String,
            default: null
        },
        couponDiscount: {
            type: Number,
            default: null
        },
        paymentMode: {
            type: String,
            enum: [
                "wallet",
                "online",
                "cash",
                "cash/voucher",
                "online/voucher",
                "coin",
                "online/coin",
            ],
            default: "online",
        },
        patientName: {
            type: String,
        },
        patientAddress: {
            type: String,
        },
        physioName: {
            type: String,
        },
        physioCity: {
            type: String,
        },
        physioState: {
            type: String,
        },
        physioAddress: {
            type: String,
            default: null
        },
        serviceType: {
            type: Number, // 0-home  1--clinic
            enum: [0, 1, 2]
        },
        treatmentServiceType: {
            type: Number, // 0-home  1--clinic
            enum: [0, 1, 2]
        },
        appointmentStatus: {
            type: Number, // 0-- Appointment  1-- Treatment Scheduled 2-- Rehab  // 3--Cancelled
            default: 0
        },
        treatment: {
            type: Object,
            required: false
        }
    },
    { timestamps: true }
);

invoiceSchema.statics.generateInvoiceNumber = async () => {
    const timestamp = Date.now();
    const randomPart = Math.floor(10000 + Math.random() * 90000);
    return `INV-${timestamp}-${randomPart}`;
};

invoiceSchema.pre("save", async function (next) {
    if (!this.invoiceNumber) {
        this.invoiceNumber = await this.constructor.generateInvoiceNumber();
    }
    next();
});

module.exports = mongoose.model("Invoice", invoiceSchema);

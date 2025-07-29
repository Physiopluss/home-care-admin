const Wallet = require('../../models/wallet')
const Transaction = require('../../models/transaction')
const Request = require('../../models/withdrawlRequest')
const Physio = require('../../models/physio')
const Patient = require('../../models/patient')
exports.walletDetails = async (req, res) => {
    const physioId = req.params.physioId
    const thePhysio = await Physio.findById(physioId)
    if (!thePhysio) {
        res.status(400).json({ status: false, message: "no physio exists with this id" })
    } else {
        const theWallet = await Wallet.findOne({ physioId: physioId })
        res.status(200).json({ status: true, message: "data Returned", data: theWallet })
    }
}

exports.walletTransactions = async (req, res) => {
    const walletId = req.params.walletId
    const theWallet = await Wallet.findById(walletId)
    if (!theWallet) {
        res.status(400).json({ status: false, message: "no wallet with this id" })
    } else {
        const theTransactions = await Transaction.find({ walletId: walletId }).lean()
        const promis = await theTransactions.map(async i => {
            console.log(i.patientId)
            const thePatient = await Patient.findById(i.patientId).lean()
            if (thePatient) {
                i.patientDetails = thePatient
                return i
            }


        })
        await Promise.all(promis)
        res.status(200).json({ status: true, message: "data Returned", data: theTransactions })
    }
}

exports.singleTransaction = async (req, res) => {
    const transactionId = req.params.transactionId
    const theTransaction = await Transaction.findById(transactionId)
    if (!theTransaction) {
        res.status(400).json({ status: false, message: "no transation with this id" })
    } else {
        res.status(200).json({ status: true, message: "data Returned", data: theTransaction })
    }
}

exports.submitWithdrawlRequest = async (req, res) => {
    const physioId = req.params.physioId
    const amount = req.body.amount
    const walletId = req.body.walletId
    const theWallet = await Wallet.findById(walletId)
    if (theWallet.balance < amount) {
        res.status(400).json({ status: false, message: "you don't have enough balance" })
    } else {
        const newRequest = await new Request({
            physioId: physioId,
            walletId: walletId,
            amount: amount,
            status: 0,
            createdAt: new Date()
        })
        await newRequest.save()
        const newTramsaction = await new Transaction({
            walletId: walletId,
            patientId: "",
            paymentMode: 0,
            amount: amount,
            type: 1,
            from: 0,
            transactionType: 2,
            createdAt: new Date()
        })
        await newTramsaction.save()
        const updateWallet = await Wallet.findByIdAndUpdate(walletId, {
            balance: theWallet.balance - amount
        }, { new: true })
        res.status(201).json({ status: true, message: "request submitted Successfully", data: newRequest })
    }
}

exports.getAllWithdrawlRequest = async (req, res) => {
    const walletId = req.params.walletId
    const theWallet = await Wallet.findById(walletId)
    if (!theWallet) {
        res.status(400).json({ status: false, message: "no wallet with this id" })
    } else {
        const theRequests = await Request.find({ walletId: walletId })
        res.status(200).json({ status: true, message: "data Returned", data: theRequests })
    }
}

exports.getAllWithdrawlRequestAdmin = async (req, res) => {

    const theRequests = await Request.find().lean()
    const prmois = await theRequests.map(async i => {
        const thePhysio = await Physio.findById(i.physioId)
        if (thePhysio) {
            i.physioName = thePhysio.fullName
            i.phone = thePhysio.phone
        }
        return i
    })
    await Promise.all(prmois)
    res.status(200).json({ status: true, message: "data Returned", data: theRequests })

}

exports.updateWithdrawlRequest = async (req, res) => {
    const requestId = req.params.requestId
    const status = req.query.status
    const theRequest = await Request.findById(requestId)
    console.log(status)
    if (!theRequest) {
        res.status(400).json({ status: false, message: "no request with this id" })
    } else {
        const updated = await Request.findByIdAndUpdate(requestId, {
            status: Number(status)
        }, { new: true })
        res.status(200).json({ status: true, message: "Status updated", data: updated })
    }
}

exports.getSingleWithdrawlRequest = async (req, res) => {
    const requestId = req.params.requestId
    const theRequest = await Request.findById(requestId)
    if (!theRequest) {
        res.status(400).json({ status: false, message: "no request with this id" })
    } else {
        res.status(200).json({ status: true, message: "data Returned", data: theRequest })
    }
}
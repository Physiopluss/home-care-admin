const Transaction = require('../../models/transaction')
const Patient = require('../../models/patient')
const Appointment = require('../../models/appointment')
const invoice = require('../../models/invoice')


// Get Patient Transaction
exports.getPatientTransactions = async (req, res) => {
  try {

    const { patientId, appointmentId } = req.query;

    if (!patientId) return res.status(400).json({
      message: 'PatientId is required',
      success: false,
      status: 400
    });

    if (!appointmentId) return res.status(400).json({
      message: 'Appointment Id is required',
      success: false,
      status: 400
    });

    const patient = await Patient.findById({ _id: patientId });
    if (!patient) return res.status(400).json({
      message: 'Patient not found',
      success: false,
      status: 400
    });

    const appointment = await Appointment.findById({ _id: appointmentId }).populate('patientId physioId');
    if (!appointment) return res.status(400).json({
      message: 'Appointment not found',
      success: false,
      status: 400
    });

    const transactions = await Transaction.find({
      patientId: patientId,
      appointmentId: appointmentId
    }).populate('patientId physioId')
    return res.status(200).json({
      message: 'Transactions fetched',
      status: 200,
      success: true,
      data: transactions
    });


  } catch (error) {
    console.log(error)
    return res.status(500).json({
      message: 'Something went wrong',
      status: false,
      status: 500,
      error
    })
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const { appointmentId, appointmentStatus = 0 } = req.query;
    console.log(req.query);


    if (!appointmentId) {
      return res.status(400).json({
        message: 'appointmentId  is required',
        status: 400,
      });
    }

    const appointment = await Appointment.findById(appointmentId)

    if (appointment) {
      const invoices = await invoice.findOne(
        {
          appointmentId: appointmentId,
          type: appointmentStatus === 0 || '0' ? "appointment" : "treatment"

        })
      return res.status(200).json({
        message: 'Invoices fetched',
        success: true,
        status: 200,
        data: invoices
      });

    }

    return res.status(400).json({
      message: 'appointment not found',
      success: false,
      status: 400,
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
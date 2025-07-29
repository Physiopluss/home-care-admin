const auth = require('./routes/physio/auth');
const apiRouter = require('./routes/physio/apiRoutrt');
const appointment = require('./routes/physio/appointment');
const transaction = require('./routes/physio/transaction');
const invoice = require('./routes/physio/invoice');

const PhysioRouter = (app) => {
    app.use('/api/physio', auth);
    app.use('/api/physio', apiRouter);
    app.use('/api/physio/appointment', appointment);
    app.use('/api/transaction', transaction);
    app.use('/api/invoice', invoice);
};

module.exports = PhysioRouter;

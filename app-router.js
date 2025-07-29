const patient = require('./routes/app/patient');
const physio = require('./routes/app/physio');
const appointment = require('./routes/app/appointment');
const specialization = require('./routes/app/Specialization');
const apiRouter = require('./routes/app/apiRouter');
const transaction = require('./routes/app/transaction');


const AppRouter = (app) => {
    app.use('/api/patient', patient);
    app.use('/api/physio', physio);
    app.use('/api/appointment', appointment);
    app.use('/api/specialization', specialization);
    app.use('/api', apiRouter);
    app.use('/api/transaction', transaction);
};

module.exports = AppRouter;
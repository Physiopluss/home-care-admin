const appointment = require('./routes/admin/appointment');
const coupon = require('./routes/admin/coupon');
const specialization = require('./routes/admin/specialization');
const physio = require('./routes/admin/physio');
const auth = require('./routes/admin/auth');
const patient = require('./routes/admin/patient');
const degree = require('./routes/admin/degree');
const subspecialization = require('./routes/admin/subspecialization');
const transaction = require('./routes/admin/transaction');
const help_Support = require('./routes/admin/help_Support');
const physioProfileEdit = require('./routes/admin/physioProfileEdit');
const invoice = require('./routes/admin/invoice');
const summary = require('./routes/admin/summary');
const notification = require('./routes/admin/notification');
const plan = require('./routes/admin/plan')

const AppRouter = (app) => {
    app.use('/api/admin/summary', summary);
    app.use('/api/admin/appointment', appointment);
    app.use('/api/admin/coupon', coupon);
    app.use('/api/admin/specialization', specialization);
    app.use('/api/admin/physio', physio);
    app.use('/api/admin', auth);
    app.use('/api/admin/patient', patient);
    app.use('/api/admin/degree', degree)
    app.use('/api/admin/subspecialization', subspecialization);
    app.use('/api/admin/transaction', transaction);
    app.use('/api/admin/plan',plan);
    app.use('/api/admin/help_Support', help_Support);;
    app.use('/api/admin/physioProfileEdit', physioProfileEdit);
    app.use('/api/admin/invoice', invoice);
    app.use('/api/admin/notification', notification);
};

module.exports = AppRouter;

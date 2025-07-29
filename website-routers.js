const patient = require('./routes/website/patient');
const physio = require('./routes/website/physio');
const appointment = require('./routes/website/appointment');
const apiRouters = require('./routes/website/apiRouts');

const WebsiteRouter = (app) => {
    app.use('/api/web/patient', patient);
    app.use('/api/web/physio', physio);
   // app.use('/api/web/appointment', appointment);
    app.use('/api/web', apiRouters);
};

module.exports = WebsiteRouter;
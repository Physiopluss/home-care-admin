const global = require('./routes/global');

const CommonRouter = (app) => {
    app.use('/api/common', global);
}

module.exports = CommonRouter;
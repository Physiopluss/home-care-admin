const express = require('express')
const http = require('http')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
const helmet = require('helmet');
require('dotenv').config()
// Scheduled jobs
require('./utility/redisClient').watchPhysioCollection();
require('./utility/redisClient').watchPhysioConnectCollection();
require('./utility/redisClient').watchPhysioEditRequestCollection();

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
	origin: process.env.CLIENT_ORIGIN || '*',
	methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
}));

const server = http.createServer(app);

// Routes Setup
const AppRouter = require('./app-router');
const AdminRouter = require('./admin-routers');
const PhysioRouter = require('./physio-routers');
const CommonRouter = require('./common-router');
const WebsiteRouter = require('./website-routers')

AppRouter(app);
AdminRouter(app);
PhysioRouter(app);
WebsiteRouter(app);
CommonRouter(app);

// Connect DB and start server
const startServer = async () => {
	try {
		await mongoose.connect(process.env.MONGODB_URL, {

			autoIndex: true
		});
		console.log('✅ Connected to MongoDB');

		const port = process.env.PORT || 5000;
		server.listen(port, () => {
			console.log(`🚀 Server running on http://localhost:${port}`);
		});
	} catch (err) {
		console.error('❌ MongoDB connection failed:', err.message);
		process.exit(1);
	}
};

startServer();




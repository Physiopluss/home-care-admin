/**
 * This module initializes and exports a Redis client for caching purposes.
 * It connects to a Redis server using the URL specified in the environment variable `REDIS_URL`,
 * or defaults to `redis://localhost:6379` if not provided.
 * 
 * The module also provides a fallback mechanism using an in-memory mock storage
 * in case the Redis connection fails. The mock storage mimics basic Redis operations
 * such as `get`, `set`, `del`, and `keys`.
 * 
 * Features:
 * - Automatically handles Redis connection events (e.g., error, reconnecting, etc.).
 * - Provides a default cache expiration time of 2 minutes.
 * - Exports the Redis client and cache expiration time for use in other parts of the application.
 * 
 * Usage:
 * const { redisClient, CACHE_EXPIRATION } = require('../../utility/redisClient');
 * 
 * Note: Ensure that the Redis server is running and accessible if using the actual Redis client.
 */

const redis = require('redis');
const Physio = require('../models/physio');
const PhysioProfileEdit = require('../models/physioProfileEdit')

const CACHE_EXPIRATION = {
    TWO_MINUTES: 60 * 2,
    TEN_MINUTES: 60 * 10,
    THIRTY_MINUTES: 60 * 30,
    ONE_HOUR: 60 * 60,
    ONE_DAY: 60 * 60 * 24
};

let redisClient;

// Create a Redis redisClient with connection to Redis server
(async () => {
    try {
        // Create Redis redisClient
        redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        // Setup event handlers
        redisClient.on('error', (err) => {
            console.error('❌ Redis Error:', err);
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis connected');
        });

        redisClient.on('reconnecting', () => {
            console.log('🔁 Redis reconnecting...');
        });

        redisClient.on('end', () => {
            console.log('❌ Redis connection closed');
        });

        await redisClient.connect();
    } catch (err) {
        console.error('❌ Failed to create Redis client:', err);

        // Return a mock client that stores data in memory as fallback
        console.log('Using in-memory fallback for Redis');

        const mockStorage = {};

        return {
            get: async (key) => mockStorage[key] || null,
            set: async (key, value, options) => {
                mockStorage[key] = value;
                // Handle expiration if EX option provided
                if (options && options.EX) {
                    setTimeout(() => {
                        delete mockStorage[key];
                    }, options.EX * 1000);
                }
                return 'OK';
            },
            del: async (key) => {
                if (mockStorage[key]) {
                    delete mockStorage[key];
                    return 1;
                }
                return 0;
            },
            keys: async (pattern) => {
                const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
                return Object.keys(mockStorage).filter(key => regex.test(key));
            },
        };
    }
})();


const deleteRedisKeys = async (pattern) => {
    const keys = await redisClient.keys(pattern);

    if (keys.length === 0) {
        console.log(`No keys found for pattern: ${pattern}`);
        return;
    }

    redisClient.del(keys, function (err, response) {
        if (err) throw err;
        console.log(response);
    });
}


const watchPhysioCollection = async () => {
    const changeStream = Physio.watch();

    changeStream.on('change', async (change) => {
        const docId = change?.documentKey?._id?.toString();
        if (!docId) return;

        const pattern = `admin:AllPhysio:*`;
        if (['insert', 'replace', 'delete'].includes(change.operationType)) {
            await deleteRedisKeys(pattern);
        }

        if (change.operationType === 'update') {
            const updatedFields = Object.keys(change.updateDescription?.updatedFields || {});
            const watchFields = ['fullName', 'profileImage', 'phone', 'workExperience', 'serviceType', 'accountStatus', 'subscriptionId', 'subscriptionCount', 'isDeleted', 'isPhysioConnectTransferred', 'accountStatus'];

            if (updatedFields.some(field => watchFields.includes(field))) {
                await deleteRedisKeys(pattern);
            }
        }
    });
}


const watchPhysioConnectCollection = async () => {
    const changeStream = Physio.watch();

    changeStream.on('change', async (change) => {
        const docId = change?.documentKey?._id?.toString();
        if (!docId) return;

        const pattern = `admin:AllPhysioConnect:*`;
        if (['insert', 'replace', 'delete'].includes(change.operationType)) {
            await deleteRedisKeys(pattern);
        }

        if (change.operationType === 'update') {
            const updatedFields = Object.keys(change.updateDescription?.updatedFields || {});
            const watchFields = ['fullName', 'profileImage', 'phone', 'workExperience', 'serviceType', 'isDeleted', 'isPhysioConnect', 'isPhysioConnectPaid', 'isPhysioConnectPaidDate', 'isPhysioConnectPayment', 'isPhysioConnectProfileCompleted', 'isPhysioConnectTransferred', 'accountStatus'];

            if (updatedFields.some(field => watchFields.includes(field))) {
                await deleteRedisKeys(pattern);
            }
        }
    });
}


const watchPhysioEditRequestCollection = async () => {
    const changeStream = PhysioProfileEdit.watch();

    changeStream.on('change', async (change) => {
        const docId = change?.documentKey?._id?.toString();
        if (!docId) return;

        const pattern = `admin:getPhysioProfileEdit:*`;
        if (['insert', 'delete'].includes(change.operationType)) {
            await deleteRedisKeys(pattern);
        }
    });
}

module.exports = { CACHE_EXPIRATION, redisClient, watchPhysioCollection, watchPhysioConnectCollection, watchPhysioEditRequestCollection, deleteRedisKeys };

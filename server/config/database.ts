import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as redis from 'redis';
import * as util from 'util';
import * as cachegoose from 'cachegoose';

dotenv.config();

(mongoose as any).Promise = global.Promise;

const redisConfig = {
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_KEY,
  port: process.env.REDIS_PORT
}

cachegoose(mongoose, redisConfig);

const redisClient = redis.createClient({
  ...redisConfig,
  retry_strategy: function (options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined;
    }
    // reconnect after
    return Math.min(options.attempt * 100, 3000);
}
});

export const redisGetAsync = util.promisify(redisClient.get).bind(redisClient);
export const redisSetAsync = util.promisify(redisClient.set).bind(redisClient);
export const redisDelAsync = util.promisify(redisClient.del).bind(redisClient);
export const redisDel = redisClient.del;
export const redisFlushAll = util.promisify(redisClient.flushall).bind(redisClient);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('mongoose connected'))
  .catch(error => console.log(error.message));

// mongoose.connect('mongodb://localhost/dh')
//   .then(() => console.log('mongoose local connected'))
//   .catch(error => console.log(error.message));

export { mongoose };

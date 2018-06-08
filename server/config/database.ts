import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as redis from 'redis';
import * as util from 'util';

dotenv.config();

(mongoose as any).Promise = global.Promise;


const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_KEY,
  port: process.env.REDIS_PORT
});

export const redisGetAsync = util.promisify(redisClient.get).bind(redisClient);
export const redisSetAsync = util.promisify(redisClient.set).bind(redisClient);
export const redisDelAsync = util.promisify(redisClient.del).bind(redisClient);
export const redisDel = redisClient.del;
export const redisFlushAll = util.promisify(redisClient.flushall).bind(redisClient);

// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('mongoose connected'))
//   .catch(error => console.log(error.message));

mongoose.connect('mongodb://localhost/dh')
  .then(() => console.log('mongoose local connected'))
  .catch(error => console.log(error.message));

export { mongoose };

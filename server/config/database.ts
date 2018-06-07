import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

(mongoose as any).Promise = global.Promise;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('mongoose connected'))
  .catch(error => console.log(error.message));

export { mongoose };

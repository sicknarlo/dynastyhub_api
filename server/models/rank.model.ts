import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import { mongoose } from '../config/database';

export interface IRank extends Document {
  _playerId: mongoose.Types.ObjectId;
  source: string;
  format: string;
  avg: number;
  best?: number;
  worst?: number;
  stdev?: number;
}

export interface IRankModel extends Model<IRank> {
  getRanksFromMfl(): Promise<{ nAdded: number }>
}

const schema: Schema = new Schema({
  _playerId: mongoose.Types.ObjectId,
  source: String,
  format: String,
  avg: Number,
  best: Number,
  worst: Number,
  stdev: Number,
})

export const Player = mongoose.model<IRank>('Rank', schema) as IRankModel;

import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import * as FuzzySet from 'fuzzyset.js';
import * as CSV from 'csv-string';
import { Player, normalizeName } from './player.model';
import { mongoose } from '../config/database';
import { normalize } from 'path';

export interface IADP extends Document {
  _playerId: mongoose.Schema.Types.ObjectId;
  source: string;
  format: string;
  type: string;
  avg: number;
  best?: number;
  worst?: number;
  stdev?: number;
  date: Date;
}

export interface IADPModel extends Model<IADP> {
  updateADPFromFFC()
}

const schema: Schema = new Schema({
  _playerId: mongoose.Schema.Types.ObjectId,
  source: String,
  format: String,
  type: String,
  avg: Number,
  best: Number,
  worst: Number,
  stdev: Number,
  date: Date,
});

const stringToPick = (string) => {
  const split = string.split('.');
  const round = Number(split[0]);
  const pickInRound = Number(split[1]);
  return ((round - 1) * 12) + pickInRound
}

schema.statics.updateADPFromFFC = async () => {
  let nAdded = 0;
  const players = await Player.find({ position: { $ne: 'PICK' }});
  const fuzzySet = FuzzySet();
  const playerMap = players.reduce((acc, el) => {
    if (el.name !== undefined) {
      acc[el.name] = el;
      fuzzySet.add(el.name);
    }
    return acc;
  }, {});
  const csvResponse = await axios.get('https://fantasyfootballcalculator.com/adp/csv/dynasty.csv?teams=12');
  // with String
  const arr = CSV.parse(csvResponse.data);

  const playerData = arr.slice(8);
  for (var i=0; i<playerData.length; i++) {
    const player = playerData[i];
    const adpString = player[0];
    const overallString = player[1];
    const name = player[2];
    const stdevString = player[5];
    const bestString = player[6];
    const worstString = player[7];
    const date = new Date();
    if (name && overallString && stdevString && bestString && worstString) {
      let playerMatch = playerMap[name];
      if (!playerMatch) playerMatch = playerMap[normalizeName(name)];
      if (!playerMatch) {
        const fuzzyMatch = name ? fuzzySet.get(name) : [];
        if (fuzzyMatch.length) playerMatch = playerMap[fuzzyMatch[1]];
      }

      if (playerMatch) {
        const _playerId = playerMatch._id;
        const source = 'ffc';
        const format = 'ppr';
        const type = 'startup';
        const avg = Number(overallString);
        const best = Number(bestString);
        const worst = Number(worstString);
        const stdev = Number(stdevString);
        const adp = new ADP({
          _playerId,
          source,
          format,
          type,
          avg,
          best,
          worst,
          stdev,
          date
        });
        nAdded++;
        adp.save();
      }
    }
  }
  return nAdded;
}

export const ADP = mongoose.model<IADP>('ADP', schema) as IADPModel;

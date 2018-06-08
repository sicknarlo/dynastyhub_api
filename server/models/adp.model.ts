import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import { mongoose } from '../config/database';

export interface IADP extends Document {
  _playerId: mongoose.Schema.Types.ObjectId;
  source: string;
  format: string;
  type: string;
  avg: number;
  best?: number;
  worst?: number;
  stdev?: number;
}

export interface IADPModel extends Model<IADP> {
  initialADPLoad(): Promise<{ nAdded: number }>
}

export const getLeagueList = async () => {
  const leagueResponse = await axios.get('https://www72.myfantasyleague.com/2018/export?TYPE=leagueSearch&SEARCH=dlf dynasty mock&JSON=1');
  const leagueList = leagueResponse.data.leagues.league;
  const draftTypes = {};
  // for (let league of leagueList) {
  //   const draftResponse = await axios.get(`http://www53.myfantasyleague.com/2018/export?TYPE=draftResults&L=${league.id}&APIKEY=&JSON=1`);
  //   const draftType = draftResponse.data
  // }
  console.log(leagueList.length);
  return leagueList;
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
})

export const ADP = mongoose.model<IADP>('ADP', schema) as IADPModel;

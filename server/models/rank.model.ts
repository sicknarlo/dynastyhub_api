import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import * as FuzzySet from 'fuzzyset.js';
import { Player } from './player.model';
import { mongoose } from '../config/database';

export interface IRank extends Document {
  _playerId: mongoose.Schema.Types.ObjectId;
  source: string;
  format: string;
  avg: number;
  best?: number;
  worst?: number;
  stdev?: number;
  date: Date;
}

export interface IRankModel extends Model<IRank> {
  getRanksFromMfl(): Promise<{ nAdded: number }>
}

const schema: Schema = new Schema({
  _playerId: mongoose.Schema.Types.ObjectId,
  source: String,
  format: String,
  avg: Number,
  best: Number,
  worst: Number,
  stdev: Number,
  date: Date,
})

schema.statics.getRanksFromMfl = async () => {
  const FP_URI = 'http://partners.fantasypros.com/api/v1/consensus-rankings.php?experts=show&sport=NFL&year=2018&week=0&position=ALL&type=STK&scoring=PPR';
  let response = { nadded: 0 };
  const fpResponse = await axios.get(FP_URI);
  if (fpResponse.data) {
    const dbPlayers = await Player.find();
    const fuzzySet = FuzzySet();
    const playerMap = dbPlayers.reduce((acc, el) => {
      acc[el.cbsId] = el;
      acc[el.name] = el;
      el.name && fuzzySet.add(el.name);
      return acc;
    }, {});
    fpResponse.data.players.forEach((fpPlayer) => {
      // Try to match based on cbsId
      let playerMatch = playerMap[fpPlayer.cbs_player_id];
      if (!playerMatch) {
        // If no match, try to fuzzymatch by name
        const fuzzyMatch = fuzzySet.get(fpPlayer.player_name);
        if (fuzzyMatch.length) {
          playerMatch = playerMap[fuzzyMatch[0][1]];
        }
      }
      if (playerMatch) {
        if (!playerMatch.cbsId || !playerMatch.yahooId || !playerMatch.fpId) {
          playerMatch.cbsId = fpPlayer.cbs_player_id;
          playerMatch.yahooId = fpPlayer.player_yahoo_id;
          playerMatch.fpId = String(fpPlayer.player_id);
          playerMatch.save();
        }
        const newRank = new Rank();
        newRank._playerId = playerMatch._id;
        newRank.source = 'fp',
        newRank.format = 'ppr',
        newRank.avg = Number(fpPlayer.rank_ave);
        newRank.best = Number(fpPlayer.rank_min);
        newRank.worst = Number(fpPlayer.rank_max);
        newRank.stdev = Number(fpPlayer.rank_std);
        newRank.date = new Date();
        response.nadded ++;
        newRank.save();
      }
    })
  }
  return response;
}

export const Rank = mongoose.model<IRank>('Rank', schema) as IRankModel;

import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import adpToSuperflex from '../utils/adpToSuperflex';
import { Player } from './player.model';
import { mongoose, redisGetAsync, redisSetAsync } from '../config/database';

export interface IPick extends Document {
  _playerId: mongoose.Schema.Types.ObjectId;
  source: string;
  leagueId: string;
  format: string;
  type: string;
  pick: number;
  date: Date;
  uniqueId: string;
}

export interface IPickModel extends Model<IPick> {
  updateDLFPicks(): Promise<number>
  seedPickDB(): void
}

const schema: Schema = new Schema({
  _playerId: mongoose.Schema.Types.ObjectId,
  source: String,
  leagueId: String,
  format: String,
  type: String,
  pick: Number,
  date: Date,
  uniqueId: {
    type: String,
    unique: true,
  },
});

schema.statics.seedPickDB = async () => {
  const years = [2012, 2013, 2014, 2015, 2016, 2017, 2018];
  const players = await Player.find();
  const playerMap = players.reduce((acc, el) => {
    acc[el.mflId] = el;
    return acc;
  }, {});

  for (var z=0; z<years.length;z++) {
    const year = years[z];

    // Get all DLF mocks
    const dlfLeagueResponse = await axios.get(`https://www72.myfantasyleague.com/${year}/export?TYPE=leagueSearch&SEARCH=dynasty mock&JSON=1`);
    const dlfLeaguesToParse = dlfLeagueResponse.data.leagues.league;
    console.log(year, dlfLeaguesToParse.length);
    if (!dlfLeaguesToParse.length) continue;
    for (var i=0; i< dlfLeaguesToParse.length; i++) {
      const league = dlfLeaguesToParse[i];
      const leagueId = league.id;
      console.log(year, leagueId);
      console.time(leagueId);
      const draftResultsResponse = await axios.get(`https://www62.myfantasyleague.com/${year}/export?TYPE=draftResults&L=${leagueId}&APIKEY=&JSON=1`);
      const picks = draftResultsResponse.data.draftResults.draftUnit.draftPick;
      const bulkPicks = []
      if (!picks) continue;
      for (var y=0; y<picks.length; y++) {
        const pick = picks[y];
        if (pick.timestamp && pick.timestamp !== '') {
          const uniqueId = `${year}${leagueId}${pick.timestamp}${pick.franchise}${pick.player}`;
          const newPick = new Pick();
          newPick.source = 'mfl';
          newPick.leagueId = leagueId;
          newPick.format = 'ppr';
          newPick.type = 'startup';
          newPick.pick = (12 * (Number(pick.round) - 1)) + Number(pick.pick);
          newPick.date = new Date(Number(pick.timestamp) * 1000);
          newPick.uniqueId = uniqueId;
          let playerMatch = playerMap[pick.player];
          if (!playerMatch) {
            const mflPlayer = await axios.get(`https://www72.myfantasyleague.com/${year}/export?TYPE=players&DETAILS=1&SINCE=&PLAYERS=${pick.player}&JSON=1`);
            if (mflPlayer.data.players.player) {
              playerMatch = Player.createPlayerFromMFLPlayer(mflPlayer.data.players.player);
              playerMatch = await playerMatch.save();
              playerMap[pick.player] = playerMatch;
            }
          }
          if (playerMatch) {
            newPick._playerId = playerMatch._id;
            bulkPicks.push(newPick);
          }
        }
      }
      bulkPicks.length && await Pick.collection.insert(bulkPicks);
      console.timeEnd(leagueId)
    }
  }
}

schema.statics.updateDLFPicks = async () => {
  const PICK_LIMIT = 240;
  let picksAdded = 0;

  // Get all DLF mocks
  const dlfLeagueResponse = await axios.get('https://www72.myfantasyleague.com/2018/export?TYPE=leagueSearch&SEARCH=dynasty mock&JSON=1');
  const dlfLeaguesToParse = dlfLeagueResponse.data.leagues.league;

  for (var i=0; i< dlfLeaguesToParse.length; i++) {
    const league = dlfLeaguesToParse[i];
    const leagueId = league.id;
    const draftResultsResponse = await axios.get(`https://www62.myfantasyleague.com/2018/export?TYPE=draftResults&L=${leagueId}&APIKEY=&JSON=1`);
    const picks = draftResultsResponse.data.draftResults.draftUnit.draftPick;
    for (var y=0; y<picks.length; y++) {
      const pick = picks[y];
      if (pick.timestamp && pick.timestamp !== '') {
        const uniqueId = `2018${leagueId}${pick.timestamp}${pick.franchise}${pick.player}`;
        const existingPick = await Pick.findOne({ uniqueId });
        if (!existingPick) {
          const newPick = new Pick();
          newPick.source = 'mfl';
          newPick.leagueId = leagueId;
          newPick.format = 'ppr';
          newPick.type = 'startup';
          newPick.pick = (12 * (Number(pick.round) - 1)) + Number(pick.pick);
          newPick.date = new Date(Number(pick.timestamp) * 1000);
          newPick.uniqueId = uniqueId;
          let playerMatch = await Player.findOne({ mflId: pick.player });
          if (!playerMatch) {
            const mflPlayer = await axios.get(`https://www72.myfantasyleague.com/2018/export?TYPE=players&DETAILS=1&SINCE=&PLAYERS=${pick.player}&JSON=1`);
            if (mflPlayer.data.players.player) {
              playerMatch = Player.createPlayerFromMFLPlayer(mflPlayer.data.players.player);
              playerMatch = await playerMatch.save();
            }
          }
          newPick._playerId = playerMatch._id;
          picksAdded++;
          await newPick.save();
        }
      }
    }
  }
  return picksAdded;
}

schema.index({ _playerId: 1, date: -1, format: 1, type: 1 });
schema.index({ unqiueId: 1 });

export const Pick = mongoose.model<IPick>('Pick', schema) as IPickModel;

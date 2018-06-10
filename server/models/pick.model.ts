import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import average from '../utils/average';
import value from '../utils/value';
import expectedValue from '../utils/expectedValue';
import valueToRank from '../utils/valueToRank';
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
  uniqueId: String,
});

schema.statics.seedPickDB = async () => {
  const years = [2012, 2013, 2014, 2015, 2016, 2017, 2018];
  const players = await Player.find();
  const playerMap = players.reduce((acc, el) => {
    acc[el.mflId] = el;
    acc[`${el.name}-${el.position}`] = el;
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
      const rookies = [];
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
            if (playerMatch.draftYear && Number(playerMatch.draftYear) === year) {
              rookies.push({ pick: newPick.pick, timestamp: pick.timestamp });
            }
          }
        }
      }
      if (rookies.length > 0) {

        while (rookies.length < 48) {
          rookies.push({ timestamp: rookies[rookies.length - 1].timestamp, pick: rookies[rookies.length - 1].pick + 2 })
        };
        const rookiePicks = [].concat(
          // rookie picks
          await valuesIntoRookiePicks({ year, values: rookies, leagueId, playerMap }),
          // rookie picks converted to values, adjusted, then back to picks
          await valuesIntoRookiePicks({
            year: year + 1,
            values: rookies.map(x => ({ pick: valueToRank(value(x.pick) * 0.85), timestamp: x.timestamp })),
            leagueId,
            playerMap
          }),
          await valuesIntoRookiePicks({
            year: year + 2,
            values: rookies.map(x => ({ pick: valueToRank(value(x.pick) * 0.75), timestamp: x.timestamp })),
            leagueId,
            playerMap
          }),
          await valuesIntoRookiePicks({
            year: year + 3,
            values: rookies.map(x => ({ pick: valueToRank(value(x.pick) * 0.7), timestamp: x.timestamp })),
            leagueId,
            playerMap,
          }),
        )
        bulkPicks.length && await Pick.collection.insert(bulkPicks.concat(rookiePicks));
      } else {
        bulkPicks.length && await Pick.collection.insert(bulkPicks);
      }
      console.timeEnd(leagueId)
    }
  }
}

const valuesIntoRookiePicks = async ({ year, values, leagueId, playerMap }) => {
  const picks: Array<IPick> = [];
  // Base picks (Year Pick N)
  for (var i=0; i<values.length; i++) {
    const value = values[i];
    const basePickName = `${year} Pick ${i + 1}`;
    let playerMatch = playerMap[`${basePickName}-PICK`];
    if (!playerMatch) playerMatch =  await Player.findOne({ name: basePickName });
    if (!playerMatch) {
      playerMatch = await new Player({
        name: basePickName,
        draftYear: Number(year),
        position: 'PICK',
        status: 'PICK',
      }).save();
      playerMap[`${basePickName}-PICK`] = playerMatch;
    }
    picks.push(new Pick({
      source: 'mfl',
      leagueId: leagueId,
      format: 'ppr',
      type: 'startup',
      pick: value.pick,
      date: new Date(Number(value.timestamp) * 1000),
      uniqueId: `${value.pick}${value.timestamp}${basePickName.replace(' ', '').toLowerCase().replace(' ', '')}`,
      _playerId: playerMatch._id,
    }));
  }
  const ROUNDS = ['1st', '2nd', '3rd', '4th'];
  const STAGES = ['Early', 'Mid', 'Late'];

  for (var i=0; i<4; i++) {
    const round = ROUNDS[i];
    const mainPickName = `${year} ${round}`;
    let playerMatch = playerMap[`${mainPickName}-PICK`];
    if (!playerMatch) playerMatch = await Player.findOne({ name: mainPickName });
    if (!playerMatch) {
      playerMatch = await new Player({
        name: mainPickName,
        draftYear: Number(year),
        position: 'PICK',
        status: 'PICK',
      }).save();
      playerMap[`${mainPickName}-PICK`] = playerMatch;
    }
    const mainStartingPoint = 12 * i;
    const mainValueslice = values.slice(mainStartingPoint, mainStartingPoint + 12);
    // 2017 1st/2nd/3rd/4th
    picks.push(new Pick({
      source: 'mfl',
      leagueId: leagueId,
      format: 'ppr',
      type: 'startup',
      pick: valueToRank(expectedValue(mainValueslice.map(x => value(x.pick)))),
      date: new Date(Number(mainValueslice[0].timestamp) * 1000),
      uniqueId: `${leagueId}${mainValueslice[0].timestamp}${mainPickName.replace(' ', '').toLowerCase()}`,
      _playerId: playerMatch._id,
    }));

    for (var y=0; y<STAGES.length; y++) {
      const stage = STAGES[y];
      const stagePickName = `${year} ${stage} ${round}`;
      let playerMatch = playerMap[`${stagePickName}-PICK`];
      if (!playerMatch) playerMatch =  await Player.findOne({ name: stagePickName });
      if (!playerMatch) {
        playerMatch = await new Player({
          name: stagePickName,
          draftYear: Number(year),
          position: 'PICK',
          status: 'PICK',
        }).save();
        playerMap[`${stagePickName}-PICK`] = playerMatch;
      }
      const stageStartingPoint = mainStartingPoint + (4 * y);
      const stageValuesSlice = values.slice(stageStartingPoint, stageStartingPoint + 4);
      // 2017 Early/Mid/Late 1st/2nd/3rd/4th
      picks.push(new Pick({
        source: 'mfl',
        leagueId: leagueId,
        format: 'ppr',
        type: 'startup',
        pick: valueToRank(expectedValue(stageValuesSlice.map(x => value(x.pick)))),
        date: new Date(Number(stageValuesSlice[0].timestamp) * 1000),
        uniqueId: `${leagueId}${stageValuesSlice[0].timestamp}${stagePickName.replace(' ', '').toLowerCase()}`,
        _playerId: playerMatch._id,
      }));
    }
  }
  return picks;
}

schema.statics.updateDLFPicks = async () => {
  let picksAdded = 0;
  let completedLeagues = await redisGetAsync('parsedLeagues');
  if (completedLeagues) completedLeagues = JSON.parse(completedLeagues);
  if (!completedLeagues) completedLeagues = {};

  const players = await Player.find();
  const playerMap = players.reduce((acc, el) => {
    acc[el.mflId] = el;
    return acc;
  }, {});

  // Get all DLF mocks
  const dlfLeagueResponse = await axios.get('https://www72.myfantasyleague.com/2018/export?TYPE=leagueSearch&SEARCH=dynasty mock&JSON=1');
  const dlfLeaguesToParse = dlfLeagueResponse.data.leagues.league.reduce((acc, el) => {
    if (!completedLeagues[el.id]) acc.push(el);
    return acc;
  }, []);
  console.log(dlfLeaguesToParse.length);

  for (var i=0; i< dlfLeaguesToParse.length; i++) {
    const league = dlfLeaguesToParse[i];
    const leagueId = league.id;
    const rookies = [];
    console.log(i, dlfLeaguesToParse.length)
    console.time(leagueId);
    const draftResultsResponse = await axios.get(`https://www62.myfantasyleague.com/2018/export?TYPE=draftResults&L=${leagueId}&APIKEY=&JSON=1`);
    const picks = draftResultsResponse.data.draftResults.draftUnit.draftPick;
    const existingPicks = await Pick.find({ leagueId });
    const existingPickMap = existingPicks.reduce((acc, el) => {
      acc[el.uniqueId] = true;
      return acc;
    }, {});
    const bulkPicks = []
    if (!picks) continue;
    if (picks[picks.length - 1].timestamp !== '') completedLeagues[leagueId] = true;
    for (var y=0; y<picks.length; y++) {
      const pick = picks[y];
      if (pick.timestamp && pick.timestamp !== '') {
        const uniqueId = `2018${leagueId}${pick.timestamp}${pick.franchise}${pick.player}`;
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
          const mflPlayer = await axios.get(`https://www72.myfantasyleague.com/2018/export?TYPE=players&DETAILS=1&SINCE=&PLAYERS=${pick.player}&JSON=1`);
          if (mflPlayer.data.players.player) {
            playerMatch = Player.createPlayerFromMFLPlayer(mflPlayer.data.players.player);
            playerMatch = await playerMatch.save();
            playerMap[pick.player] = playerMatch;
          }
        }
        if (playerMatch) {
          newPick._playerId = playerMatch._id;
          bulkPicks.push(newPick);
          if (playerMatch.draftYear && Number(playerMatch.draftYear) === 2018) {
            rookies.push({ pick: newPick.pick, timestamp: pick.timestamp });
          }
        }
      }
    }
    if (rookies.length > 0) {

      while (rookies.length < 48) {
        rookies.push({ timestamp: rookies[rookies.length - 1].timestamp, pick: rookies[rookies.length - 1].pick + 2 })
      };
      const rookiePicks = [].concat(
        // rookie picks
        await valuesIntoRookiePicks({ year: 2018, values: rookies, leagueId, playerMap }),
        // rookie picks converted to values, adjusted, then back to picks
        await valuesIntoRookiePicks({
          year: 2018 + 1,
          values: rookies.map(x => ({ pick: valueToRank(value(x.pick) * 0.85), timestamp: x.timestamp })),
          leagueId,
          playerMap
        }),
        await valuesIntoRookiePicks({
          year: 2018 + 2,
          values: rookies.map(x => ({ pick: valueToRank(value(x.pick) * 0.75), timestamp: x.timestamp })),
          leagueId,
          playerMap
        }),
        await valuesIntoRookiePicks({
          year: 2018 + 3,
          values: rookies.map(x => ({ pick: valueToRank(value(x.pick) * 0.7), timestamp: x.timestamp })),
          leagueId,
          playerMap,
        }),
      )
      const finalPicks = bulkPicks.concat(rookiePicks).filter(x => !existingPickMap[x.uniqueId]);
      finalPicks.length && await Pick.collection.insert(finalPicks);
      picksAdded += finalPicks.length;
      console.timeEnd(leagueId);
    } else {
      const finalPicks = bulkPicks.filter(x => !existingPickMap[x.uniqueId]);
      finalPicks.length && await Pick.collection.insert(finalPicks);
      picksAdded += finalPicks.length;
      console.timeEnd(leagueId);
    }
  }
  await redisSetAsync('parsedLeagues', JSON.stringify(completedLeagues));
  console.log('complete, picks added: ', picksAdded)
  return picksAdded;
}

schema.index({ _playerId: 1, date: -1, format: 1, type: 1 });
schema.index({ unqiueId: 1 });

export const Pick = mongoose.model<IPick>('Pick', schema) as IPickModel;

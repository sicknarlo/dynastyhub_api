import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import { Player } from './player.model';
import { mongoose, redisGetAsync, redisSetAsync } from '../config/database';

function ordinalSuffixOf(i) {
  var j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + "st";
  }
  if (j == 2 && k != 12) {
    return i + "nd";
  }
  if (j == 3 && k != 13) {
    return i + "rd";
  }
  return i + "th";
}
const stringToTrade = ({ teamStringArray, year, franchiseCount, playerMap }) => {
  if (!teamStringArray) return { ids: [], strings: [] };
  const teamIds = [];
  const teamStrings = [];
  for (var i=0; i< teamStringArray.length; i++) {
    const playerString = teamStringArray[i];
    if (playerString === '') continue;
    if (playerString.includes('FP')) {
      const pickArray = playerString.split('_');
      const name = `${pickArray[2]} ${ordinalSuffixOf(Number(pickArray[3]))}`;
      const playerMatch = playerMap[`${name}-PICK`];
      if (playerMatch) teamIds.push(playerMatch._id);
      teamStrings.push(name);
    } else if (playerString.includes('DP')) {
      const pickArray = playerString.split('_');
      const round = Number(pickArray[1]);
      const pick = Number(pickArray[2]);
      const pickNumber = (round * franchiseCount) + pick;
      const name = `${year} Pick ${pickNumber}`;
      const playerMatch = playerMap[`${name}-PICK`];
      if (playerMatch) teamIds.push(playerMatch._id);
      teamStrings.push(name);
    } else {
      let playerMatch = playerMap[playerString];
      if (playerMatch) {
        if (playerMatch) {
          teamIds.push(playerMatch._id);
          teamStrings.push(playerMatch.name);
        }
      }
    }
  }
  return { ids: teamIds, strings: teamStrings }
}

export interface IRealTrade extends Document {
  source: string;
  team1Strings: Array<string>;
  team2Strings: Array<string>;
  team1: Array<mongoose.Schema.Types.ObjectId>;
  team2: Array<mongoose.Schema.Types.ObjectId>;
  date: Date;
  uniqueId: string;
  format: string;
}

export interface IRealTradeModel extends Model<IRealTrade> {
  getTradesFromMFL(): Promise<{ nAdded: number }>
}

const schema: Schema = new Schema({
  source: String,
  team1Strings: [String],
  team2Strings: [String],
  team1: [mongoose.Schema.Types.ObjectId],
  team2: [mongoose.Schema.Types.ObjectId],
  date: Date,
  uniqueId: String,
  format: String,
});

const processTrades = async ({ leaguesToParse, year, playerMap, trades }) => {
  let picksAdded = 0;
  // let trades = await redisGetAsync('parsedTrades');
  // let trades = {}

  // if (trades) trades = await JSON.parse(trades);

  // trades = {};

  // if (!trades) trades = {};
  for (var i=0; i< leaguesToParse.length; i++) {
    const league = leaguesToParse[i];
    const leagueId = league.id;
    console.log(year, i+1, leaguesToParse.length, leagueId)
    try {
      // Get league settings
      const leagueSettingsReponse = await axios.get(`http://www53.myfantasyleague.com/${year}/export?TYPE=league&L=${leagueId}&APIKEY=&JSON=1`);
      const leagueSettings = leagueSettingsReponse.data.league;
      const franchiseCount = leagueSettings.conferences ? Number(leagueSettings.franchises.count) / Number(leagueSettings.conferences.count) : Number(leagueSettings.franchises.count);
      const isSuper = leagueSettings.starters &&
        leagueSettings.starters.position &&
        leagueSettings.starters.position.find(x => x.name === 'QB') &&
        leagueSettings.starters.position.find(x => x.name === 'QB').limit !== '1';

      // Check if this is a league we want to parse, we only want startup
      const tradeResponse = await axios.get(`http://www53.myfantasyleague.com/${year}/export?TYPE=transactions&L=${leagueId}&APIKEY=&W=&TRANS_TYPE=TRADE&FRANCHISE=&DAYS=&COUNT=&JSON=1`);
      const tradeData = tradeResponse.data.transactions.transaction;
      if (!tradeData) continue;
      for (var k=0; k<tradeData.length; k++) {
        const mflTrade = tradeData[k];
        const uniqueId = mflTrade.franchise2_gave_up + mflTrade.timestamp + mflTrade.franchise1_gave_up + mflTrade.expires;
        if (trades[uniqueId] === true) continue;
        const team1Array = mflTrade.franchise1_gave_up && mflTrade.franchise1_gave_up.split(',');
        const team2Array = mflTrade.franchise2_gave_up && mflTrade.franchise2_gave_up.split(',');
        const date = mflTrade.timestamp && new Date(Number(mflTrade.timestamp) * 1000);
        const team1 = stringToTrade({ teamStringArray: team1Array, year, franchiseCount, playerMap });
        const team2 = stringToTrade({ teamStringArray: team2Array, year, franchiseCount, playerMap });
        const trade = new RealTrade({
          source: 'mfl',
          team1Strings: team1.strings,
          team2Strings: team2.strings,
          team1: team1.ids,
          team2: team2.ids,
          date,
          uniqueId,
          format: isSuper ? 'super' : 'ppr',
        });

        await trade.save();
        trades[uniqueId] = true;
        // await redisSetAsync('parsedTrades', JSON.stringify(trades));
        picksAdded++;
      }
    } catch(e) {
      console.log(e)
    }
  }
  return picksAdded;
}

schema.statics.getTradesFromMFL = async () => {
  const years = [2018];
  const players = await Player.find();
  const playerMap = players.reduce((acc, el) => {
    acc[el.mflId] = el;
    acc[`${el.name}-${el.position}`] = el;
    return acc;
  }, {});
  // await redisSetAsync('parsedLeaguesObj', await JSON.stringify({}));
  // await redisSetAsync('rookieAverages', await JSON.stringify([]));
   let trades = await redisGetAsync('parsedTrades');
  // let trades = {}

  if (trades) trades = await JSON.parse(trades);

  // trades = {};

  if (!trades) trades = {};

  for (var z=0; z<years.length;z++) {
    const year = years[z];

    // Get all leagues with name 'dynasty league'
    const dynastyLeaguesResponse = await axios.get(`https://www72.myfantasyleague.com/${year}/export?TYPE=leagueSearch&SEARCH=dynasty league&JSON=1`);
    console.log(dynastyLeaguesResponse)

    const dynastyLeagues = dynastyLeaguesResponse.data.leagues.league;

    console.log('processing', dynastyLeagues.length, 'dynasty leagues from', year)


    const dynastyTradesAdded = await processTrades({ leaguesToParse: dynastyLeagues, year, playerMap, trades });
    console.log('trades added', dynastyTradesAdded);
  }
}

export const RealTrade = mongoose.model<IRealTrade>('RealTrade', schema) as IRealTradeModel;

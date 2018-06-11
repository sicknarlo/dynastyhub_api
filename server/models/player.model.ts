import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import { mongoose } from '../config/database';

const normalizeName = (name: string): string => name.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
    .replace('II', '')
    .replace('III', '')
    .replace('IV', '')
    .replace('Jr', '')
    .replace('Sr', '')
    .trim()

export interface IPlayer extends Document {
  draftYear: number;
  draftRound: number;
  nflId: string;
  rotoworldId: string;
  statsId: string;
  position: string;
  statsGlobalId: string;
  espnId: string;
  kfflId: string;
  weight: number;
  mflId: string;
  birthdate: Date;
  draftTeam: string;
  name: string;
  draftPick: number;
  college: string;
  height: number;
  jersey: string;
  twitterUsername: string;
  sportsdataId: string;
  team: string;
  cbsId: string;
  updatedAt: Date;
  status: string;
  yahooId: string;
  fpId: string;
}

export interface IPlayerModel extends Model<IPlayer> {
  updatePlayersFromMFL(): Promise<{ nAdded: number, nUpdated: number }>
  createPlayerFromMFLPlayer({}): IPlayer
}

const schema: Schema = new Schema({
  draftYear: Number,
  draftRound: Number,
  nflId: String,
  rotoworldId: String,
  statsId: String,
  position: String,
  statsGlobalId: String,
  espnId: String,
  kfflId: String,
  weight: Number,
  mflId: String,
  birthdate: Date,
  draftTeam: String,
  name: String,
  draftPick: Number,
  college: String,
  height: Number,
  jersey: String,
  twitterUsername: String,
  sportsdataId: String,
  team: String,
  cbsId: String,
  updatedAt: Date,
  status: String,
  yahooId: String,
  fpId: String,
})

schema.statics.createPlayerFromMFLPlayer = (mflPlayer) => {
  const player = new Player();
  player.draftYear = mflPlayer.draft_year && Number(mflPlayer.draft_year);
  player.draftRound = mflPlayer.draft_round && Number(mflPlayer.draft_round);
  player.nflId = mflPlayer.nfl_id;
  player.rotoworldId = mflPlayer.rotoworld_id;
  player.statsId = mflPlayer.stats_id;
  player.position = mflPlayer.position;
  player.statsGlobalId = mflPlayer.stats_global_id;
  player.espnId = mflPlayer.espn_id;
  player.kfflId = mflPlayer.kffl_id;
  player.weight = mflPlayer.weight && Number(mflPlayer.weight);
  player.mflId = mflPlayer.id;
  player.birthdate = mflPlayer.birthdate && new Date(Number(mflPlayer.birthdate) * 1000);
  player.draftTeam = mflPlayer.draft_team;
  player.name = mflPlayer.name && `${normalizeName(mflPlayer.name.split(', ')[1])} ${normalizeName(mflPlayer.name.split(', ')[0])}`;
  player.draftPick = mflPlayer.draft_pick && Number(mflPlayer.draft_pick);
  player.college = mflPlayer.college;
  player.height = mflPlayer.height && Number(mflPlayer.height);
  player.jersey = mflPlayer.jersey;
  player.twitterUsername = mflPlayer.twitter_username;
  player.sportsdataId = mflPlayer.sportsdata_id;
  player.team = mflPlayer.team;
  player.cbsId = mflPlayer.cbs_id;
  player.updatedAt = new Date();
  player.status = mflPlayer.status === 'R' ? 'rookie' : 'active';
  return player;
}

schema.statics.updatePlayersFromMFL = async (): Promise<{ nAdded: number, nUpdated: number }> => {
  const MFL_URI = 'https://www75.myfantasyleague.com/2018/export?TYPE=players&DETAILS=1&SINCE=&PLAYERS=&JSON=1';
  const response = {
    nAdded: 0,
    nUpdated: 0,
  }
  // Get players from MFL
  const mflAxiosResponse = await axios.get(MFL_URI);
  const mflPlayers: Array<any> = mflAxiosResponse.data.players.player;

  // Get db players
  const players = await Player.find();

  mflPlayers.forEach((mflPlayer) => {
    const playerIndex = players.findIndex(x => x.mflId === mflPlayer.id);
    let player = null;
    if (playerIndex > -1) {
      player = players[playerIndex];
      players.splice(playerIndex, 1);
      response.nUpdated++;
    } else {
      player = new Player();
      response.nAdded++;
    }
    player.draftYear = mflPlayer.draft_year && Number(mflPlayer.draft_year);
    player.draftRound = mflPlayer.draft_round && Number(mflPlayer.draft_round);
    player.nflId = mflPlayer.nfl_id;
    player.rotoworldId = mflPlayer.rotoworld_id;
    player.statsId = mflPlayer.stats_id;
    player.position = mflPlayer.position;
    player.statsGlobalId = mflPlayer.stats_global_id;
    player.espnId = mflPlayer.espn_id;
    player.kfflId = mflPlayer.kffl_id;
    player.weight = mflPlayer.weight && Number(mflPlayer.weight);
    player.mflId = mflPlayer.id;
    player.birthdate = mflPlayer.birthdate && new Date(Number(mflPlayer.birthdate) * 1000);
    player.draftTeam = mflPlayer.draft_team;
    player.name = `${normalizeName(mflPlayer.name.split(', ')[1])} ${normalizeName(mflPlayer.name.split(', ')[0])}`;
    player.draftPick = mflPlayer.draft_pick && Number(mflPlayer.draft_pick);
    player.college = mflPlayer.college;
    player.height = mflPlayer.height && Number(mflPlayer.height);
    player.jersey = mflPlayer.jersey;
    player.twitterUsername = mflPlayer.twitter_username;
    player.sportsdataId = mflPlayer.sportsdata_id;
    player.team = mflPlayer.team;
    player.cbsId = mflPlayer.cbs_id;
    player.updatedAt = new Date();
    player.status = mflPlayer.status === 'R' ? 'rookie' : 'active';
    player.save();
  });
  players.forEach((player) => {
    player.status = 'inactive';
    player.save();
  });
  return response;
}

export const Player = mongoose.model<IPlayer>('Player', schema) as IPlayerModel;

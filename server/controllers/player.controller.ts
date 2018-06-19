import * as moment from 'moment';
import { Player, IPlayer } from '../models/player.model';
import { Pick } from '../models/pick.model';
import { Rank } from '../models/rank.model';
import { News } from '../models/news.model';
import { RealTrade } from '../models/real-trade.model';
import { includedPositions } from '../constants';
import { average, adpToSuperflex, median, standardDeviation, runningADP } from '../utils';
import { redisGetAsync, redisSetAsync } from '../config/database';

export class PlayerController {
  async getAllPlayers({ fields }): Promise<Array<IPlayer>> {
    const queryFields = fields ? fields.reduce((acc, el) => {
      acc[el] = 1;
      return acc;
    }, {}) : null;
    const players = await Player.find({ status: { $ne: 'inactive' }, position: { $in: includedPositions }}, queryFields);
    return players;
  }
  async getFullPlayer(_playerId) {
    const cachedPlayer = await redisGetAsync(`player-${_playerId}`);
    if (cachedPlayer) return JSON.parse(cachedPlayer);
    const basePlayer = await Player.findOne({ _id: _playerId }).lean();
    const picks = await Pick.find({ _playerId, date: { $gte: moment().subtract(8, 'months')} }).lean();
    const ranks = await Rank.find({ _playerId, date: { $gte: moment().subtract(8, 'months')} }).lean();
    const news = await News.find({ players: _playerId }).lean();
    const trades = await RealTrade.find({ $or: [ { team1: _playerId }, { team2: _playerId }], date: { $gte: moment().subtract(90, 'days') } });
    const player = {
      ...basePlayer,
      picks: picks.filter(x => moment().diff(moment(x.date), 'days') > -1).sort((a, b) => new Date(a.date) > new Date(b.date) ? -1 : 1),
      ranks: ranks.sort((a, b) => new Date(a.date) > new Date(b.date) ? -1 : 1),
      news: news.sort((a, b) => new Date(a.date) > new Date(b.date) ? -1 : 1),
      trades,
    }
    redisSetAsync(`player-${_playerId}`, JSON.stringify(player), 'EX', 8600);
    return player;
  }
  async getMainPlayerList(): Promise<Array<any>> {
    const cachedResponse = await redisGetAsync('mainPlayerList');
    if (cachedResponse) return JSON.parse(cachedResponse);
    console.time('players')
    const players = await (Player.find({ status: { $ne: 'inactive' }, position: { $in: includedPositions }}).lean() as any);
    console.timeEnd('players')
    const playerIds = [];
    const playerMap = players.reduce((acc, el) => {
      playerIds.push(el._id);
      acc[el._id] = el;
      return acc;
    }, {});
    const minDateObj = new Date();
    minDateObj.setMonth(minDateObj.getMonth() - 3);
    console.time('picks')
    const picks = await (Pick.aggregate(

      // Pipeline
      [
        // Stage 1
        {
          $match: {
            $and: [
              { date: { $lte: new Date() }},
              { date: { $gte: minDateObj }}
            ],
            _playerId: { $in: playerIds }
          }
        },

        // Stage 2
        {
          $group: {
            _id: "$_playerId",
            picks: { $push: "$$ROOT" },
          }
        },
      ]
    ) as any);
    console.timeEnd('picks')
    const picksMap = picks.reduce((acc, el) => {
      acc[el._id] = el.picks;
      return acc;
    }, {});
    console.time('ranks')
    const ranks = await Rank.aggregate(

      // Pipeline
      [
        // Stage 1
        {
          $match: {
              $and: [
                { date: { $lte: moment().toDate() }},
                { date: { $gte: moment().subtract(14, 'days').toDate() }}
              ],
              _playerId: { $in: playerIds }
          }
        },

        // Stage 2
        {
          $group: {
            _id: "$_playerId",
            ranks: { $push: "$$ROOT" },
          }
        },

      ]

      // Created with Studio 3T, the IDE for MongoDB - https://studio3t.com/

    );
    console.timeEnd('ranks')
    const rankMap = ranks.reduce((acc, el) => {
      acc[el._id] = el.ranks;
      return acc;
    }, {});
    console.time('parse')
    const response = players.filter(x => picksMap[x._id] && picksMap[x._id].length).map((x) => {
      const picks = picksMap[x._id] || [];
      const playerWithFixins = {
        _id: x._id,
        name: x.name,
        status: x.status,
        birthdate: x.birthdate,
        team: x.team,
        position: x.position,
        picks: picks,
        rank: x.position === 'PICK' ? null : {
          avg: null,
          min: null,
          max: null,
          stdev: null
        },
      }
      const rankMatch = rankMap[x._id];
      if (rankMatch) {
        playerWithFixins.rank = {
          ...rankMatch[rankMatch.length - 1],
        }
      }
      return playerWithFixins
    });

    redisSetAsync('mainPlayerList', JSON.stringify(response), 'EX', 8600);
    console.timeEnd('parse')
    return response;
  }
  async getPlayerById(_id): Promise<IPlayer> {
    return await Player.findOne({ _id }).lean();
  }

  async getAdpForPlayer({ player, format }) {
    const dateObj = new Date();
    const minDateObj = new Date();
    minDateObj.setMonth(minDateObj.getMonth() - 1);
    let adpPlayer = player;
    if (!player) throw Error('player not found');
    const picks = await Pick.find({
      _playerId: player._id,
      $and: [
        { date: { $lte: dateObj } },
        { date: { $gte: minDateObj } },
      ]
    }, { pick: 1 }).sort({ date: -1 });
    const pickValues = format === 'super'
      ? picks.map(x => adpToSuperflex({ pos: player.position, adp: x.pick }))
      : picks.map(x => x.pick);
    while (pickValues.length < 5) {
      pickValues.push(241);
    }
    return {
      avg: average(pickValues),
      low: Math.min.apply(null, pickValues),
      high: Math.max.apply(null, pickValues),
      format,
      stdev: standardDeviation(pickValues),
      date: dateObj,
      picks: picks.length,
      median: median(pickValues)
    }
  }

  async getRankForPlayer({ player, format }) {
    const dateObj = new Date();
    const minDateObj = new Date();
    minDateObj.setMonth(minDateObj.getMonth() - 1);
    const rank = await Rank.findOne({
      _playerId: player._id,
      $and: [
        { date: { $lte: dateObj } },
        { date: { $gte: minDateObj } },
      ]
    }).sort({ date: -1 });
    if (!rank) return {
      avg: 500,
      low: 500,
      high: 500,
      stdev: 0,
      date: new Date(),
    }
    return {
      avg: format === 'super' ? adpToSuperflex({ adp: rank.avg, pos: player.position }) : rank.avg,
      low: format === 'super' ? adpToSuperflex({ adp: rank.best, pos: player.position }) : rank.best,
      high: format === 'super' ? adpToSuperflex({ adp: rank.worst, pos: player.position }) : rank.worst,
      format,
      stdev: rank.stdev,
      date: rank.date,
    }
  }

  async seedPicks(): Promise<Array<any>> {
    let n = 0;
    const playersToBeCreated = [];
    const YEARS = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021];
    const ROUNDS = ['1st', '2nd', '3rd', '4th'];
    const LEVEL = ['Early', 'Mid', 'Late'];
    const PICKS = [];
    for (var i=0; i<48; i++) {
      PICKS.push(i + 1);
    }
    for (var i=0; i<YEARS.length; i++) {
      const year = YEARS[i];
      for (var y=0; y<PICKS.length; y++) {
        const pick = PICKS[y];
        const player = new Player({
          name: `${year} Pick ${pick}`,
          draftYear: year,
          position: 'PICK',
          status: year > 2017 ? 'PICK' : 'inactive',
        });
        playersToBeCreated.push(player);
      }
      for (var y=0; y<ROUNDS.length; y++) {
        const round = ROUNDS[y];
        const player = new Player({
          name: `${year} ${round}`,
          draftYear: year,
          position: 'PICK',
          status: year > 2017 ? 'PICK' : 'inactive',
        });
        playersToBeCreated.push(player)
        for (var z=0; z<LEVEL.length;z++) {
          const level = LEVEL[z];
          const player = new Player({
            name: `${year} ${level} ${round}`,
            draftYear: year,
            position: 'PICK',
            status: year > 2017 ? 'PICK' : 'inactive',
          });
          playersToBeCreated.push(player);
        }
      }
    }
    playersToBeCreated && await Player.collection.insert(playersToBeCreated);
    return playersToBeCreated;
  }
}

export default new PlayerController();

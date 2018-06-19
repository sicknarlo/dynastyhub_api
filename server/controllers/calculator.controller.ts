import * as moment from 'moment';
import { Player, IPlayer } from '../models/player.model';
import { Pick } from '../models/pick.model';
import { Rank } from '../models/rank.model';
import { News } from '../models/news.model';
import { value, runningADP } from '../utils';
import { redisGetAsync, redisSetAsync } from '../config/database';
import { RealTrade } from '../models/real-trade.model';

export class CalculatorController {
  async getPlayersForCalculator({ team1, team2 }): Promise<{ fullTeam1: Array<any>, fullTeam2: Array<any> }> {
    const minDateObj = new Date();
    minDateObj.setMonth(minDateObj.getMonth() - 3);
    const newsDate = new Date();
    newsDate.setMonth(newsDate.getMonth() - 2);
    const data = await Promise.all([
      await Player.find({
        _id: { $in: team1.concat(team2) }
      }).lean(),
      await Pick.find({
        _playerId: { $in: team1.concat(team2) },
        date: { $gte: minDateObj },
      }).lean(),
      await Rank.find({
        date: { $gte: moment().subtract(14, 'days').toDate() },
        _playerId: { $in: team1.concat(team2) }
      }).lean(),
      await News.find({
        players: { $in: team1.concat(team2) },
        date: { $gte: newsDate },
      }).lean(),
    ])
    const players = data[0];
    const picks = data[1];
    const ranks = data[2];
    const news = data[3];
    const picksMap = picks.reduce((acc, el) => {
      if (!acc[el._playerId]) acc[el._playerId] = [];
      acc[el._playerId].push(el);
      return acc;
    }, {});
    const ranksMap = ranks.reduce((acc, el) => {
      if (!acc[el._playerId]) acc[el._playerId] = [];
      acc[el._playerId].push(el);
      return acc;
    }, {});
    const newsMap = news.reduce((acc, el) => {
      el.players && el.players.forEach(player => {
        if (!acc[player]) acc[player] = [];
        acc[player].push(el);
      });
      return acc
    }, {});

    const fullPlayers = players.reduce((acc, el) => {
      const picks = picksMap[el._id];
      const ranks = ranksMap[el._id];
      const news = newsMap[el._id];
      acc[el._id] = {
        ...el,
        adps: runningADP(picks),
        picks,
        ranks: ranks ? ranks.sort((a, b) => new Date(a.date) > new Date(b.date) ? -1 : 1) : [],
        news: news ? news.sort((a, b) => new Date(a.date) > new Date(b.date) ? -1 : 1) : [],
      }
      return acc;
    }, {});

    const fullTeam1 = team1.map(x => fullPlayers[x]);
    const fullTeam2 = team2.map(x => fullPlayers[x]);

    return {
      fullTeam1,
      fullTeam2,
    }
  }
}

export default new CalculatorController();

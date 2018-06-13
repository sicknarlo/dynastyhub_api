import { Player, IPlayer } from '../models/player.model';
import { Pick } from '../models/pick.model';
import { Rank } from '../models/rank.model';
import { value } from '../utils';
import { redisGetAsync, redisSetAsync } from '../config/database';

export class CalculatorController {
  async getPlayersForCalculator({ team1, team2 }): Promise<{ fullTeam1: Array<any>, fullTeam2: Array<any> }> {
    const minDateObj = new Date();
    minDateObj.setMonth(minDateObj.getMonth() - 6);
    const data = await Promise.all([
      await Player.find({
        _id: { $in: team1.concat(team2) }
      }).lean(),
      await Pick.find({
        _playerId: { $in: team1.concat(team2) },
        date: { $gte: minDateObj },
      }).lean(),
      await Rank.aggregate([
        {
          $match: {
            $and: [
              { date: { $gte: minDateObj }}
            ],
            _playerId: { $in: team1.concat(team2) }
          }
        },
        {
          $group: {
            _id: "$_playerId",
            ranks: { $push: "$$ROOT" },
          }
        },
      ])
    ])
    const players = data[0];
    const picks = data[1];
    const ranks = data[2];
    const picksMap = picks.reduce((acc, el) => {
      if (!acc[el._playerId]) acc[el._playerId] = [];
      acc[el._playerId].push(el);
      return acc;
    }, {});
    const ranksMap = ranks.reduce((acc, el) => {
      acc[el._id] = el.ranks;
      return acc;
    }, {});
    const fullPlayers = players.reduce((acc, el) => {
      const picks = picksMap[el._id];
      const ranks = ranksMap[el._id];
      acc[el._id] = {
        ...el,
        picks: picks ? picks.sort((a, b) => new Date(a.date) > new Date(b.date) ? -1 : 1) : [],
        ranks: ranks ? ranks.sort((a, b) => new Date(a.date) > new Date(b.date) ? -1 : 1) : [],
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

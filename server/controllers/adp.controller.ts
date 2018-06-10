import * as FuzzySet from 'fuzzyset.js';
import average from '../utils/average';
import standardDeviation from '../utils/standardDeviation';
import median from '../utils/median';
import adpToSuperflex from '../utils/adpToSuperflex';
import { Player } from '../models/player.model';
import { Pick } from '../models/pick.model';

export interface ADP {
  player: string;
  avg: number;
  low: number;
  high: number;
  type: string;
  format: string;
  stdev: number;
  date: Date;
  picks: number;
  median: number;
}


export class ADPController {
  async getADPForPlayer({ _playerId, date, format, type }): Promise<ADP> {
    const dateObj = new Date(date);
    const minDateObj = new Date(date);
    minDateObj.setMonth(minDateObj.getMonth() - 1);
    const player = await Player.findOne({ _id: _playerId }, { name: 1, position: 1 });
    if (!player) throw Error('player not found');
    const picks = await Pick.find({
      _playerId,
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
    const adp: ADP = {
      player: player.name,
      avg: average(pickValues),
      low: Math.min.apply(null, pickValues),
      high: Math.max.apply(null, pickValues),
      type,
      format,
      stdev: standardDeviation(pickValues),
      date: dateObj,
      picks: picks.length,
      median: median(pickValues)
    }
    return adp;
  }
  async getADPForPlayerByName({ name, date, format, type }): Promise<ADP> {
    // let fuzzySet = await nodeCache.get('playerFuzzy');
    let fuzzySet = null;
    const players = await Player.find({}, { name: 1 });
    fuzzySet = FuzzySet(players.map(x => x.name || ''));
    const dateObj = date ? new Date(date) : new Date();
    const minDateObj = date ? new Date(date) : new Date();
    minDateObj.setMonth(minDateObj.getMonth() - 2);
    const nameMatch = fuzzySet.get(name.replace('_', ' '));
    let dbName = null;
    if (nameMatch.length > 0) {
      dbName = nameMatch[0];
      const player = await Player.findOne({ name: dbName }, { name: 1, position: 1 });
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
      const adp: ADP = {
        player: player.name,
        avg: average(pickValues),
        low: Math.min.apply(null, pickValues),
        high: Math.max.apply(null, pickValues),
        type,
        format,
        stdev: standardDeviation(pickValues),
        date: dateObj,
        picks: picks.length,
        median: median(pickValues)
      }
      return adp;
    } else {
      throw Error('Player not found')
    }
  }
}

export default new ADPController();

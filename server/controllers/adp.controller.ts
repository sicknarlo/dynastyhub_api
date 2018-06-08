import average from '../utils/average';
import standardDeviation from '../utils/standardDeviation';
import { Player } from '../models/player.model';
import { Pick } from '../models/pick.model';

export interface ADP {
  avg: number;
  low: number;
  high: number;
  type: string;
  format: string;
  stdev: number;
  date: Date;
  picks: number;
}

export class ADPController {
  async getADPForPlayer({ _playerId, date, format, type }): Promise<ADP> {
    const dateObj = new Date(date);
    const minDateObj = new Date(date);
    minDateObj.setMonth(minDateObj.getMonth() - 3);
    const picks = await Pick.find({
      _playerId,
      format,
      type,
      $and: [
        { date: { $lte: dateObj } },
        { date: { $gte: minDateObj } },
      ]
    }, { pick: 1 }).sort({ date: -1 }).limit(5);
    const pickValues = picks.map(x => x.pick);
    while (pickValues.length < 5) {
      pickValues.push(241);
    }
    const adp: ADP = {
      avg: average(pickValues),
      low: Math.min.apply(null, pickValues),
      high: Math.max.apply(null, pickValues),
      type,
      format,
      stdev: standardDeviation(pickValues),
      date: dateObj,
      picks: picks.length,
    }
    return adp;
  }
}

export default new ADPController();

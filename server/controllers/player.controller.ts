import { Player, IPlayer } from '../models/player.model';

export class PlayerController {
  async getAllPlayers(): Promise<Array<IPlayer>> {
    return await Player.find();
  }
  async getPlayerById(_id): Promise<IPlayer> {
    return await Player.findOne({ _id });
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

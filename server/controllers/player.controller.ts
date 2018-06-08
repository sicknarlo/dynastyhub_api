import { Player, IPlayer } from '../models/player.model';

export class PlayerController {
  async getAllPlayers(): Promise<Array<IPlayer>> {
    return await Player.find();
  }
  async getPlayerById(_id): Promise<IPlayer> {
    return await Player.findOne({ _id });
  }
}

export default new PlayerController();

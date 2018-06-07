import { Player, IPlayer } from '../models/player.model';

export class PlayerController {
  async getAllPlayers(): Promise<Array<IPlayer>> {
    return await Player.find();
  }
}

export default new PlayerController();

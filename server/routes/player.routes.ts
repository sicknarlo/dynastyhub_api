import { Router, Request, Response, NextFunction } from 'express';
import { request } from 'http';
import { Player } from '../models/player.model';
import { Pick } from '../models/pick.model';
import { Rank } from '../models/rank.model';
import PlayerController from '../controllers/player.controller';
import asyncMiddleWare from '../utils/asyncMiddleware';

const playerRouter: Router = Router();

playerRouter.get('/player/ping', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json('pong');
}));

playerRouter.get('/player', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await PlayerController.getAllPlayers());
}));

playerRouter.get('/player/:_id', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  // Get player
  const player = await PlayerController.getPlayerById(request.params._id);
  if (request.query.full && request.query.format) {
    const adp = await PlayerController.getAdpForPlayer({ player, format: request.query.format });
    const rank = await PlayerController.getRankForPlayer({ player, format: request.query.format });
    const opportunity = Number((adp.avg - rank.avg).toFixed(2));
    return response.json(Object.assign({
      adp,
      rank,
      opportunity,
    }, player));
  }
  return response.json(player);
}));

playerRouter.get('/updatePlayersFromMfl', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await Player.updatePlayersFromMFL());
}));

playerRouter.get('/updateDLFPicks', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await Pick.updateDLFPicks());
}));

playerRouter.get('/seedPickDB', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await Pick.seedPickDB());
}));

playerRouter.get('/seedPicks', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await PlayerController.seedPicks());
}));

playerRouter.get('/getRanksFromMFL', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await Rank.getRanksFromMfl());
}));

export default playerRouter;

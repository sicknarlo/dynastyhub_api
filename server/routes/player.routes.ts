import { Router, Request, Response, NextFunction } from 'express';
import { request } from 'http';
import { Player } from '../models/player.model';
import PlayerController from '../controllers/player.controller';
import asyncMiddleWare from '../utils/asyncMiddleware';

const playerRouter: Router = Router();

playerRouter.get('/player/ping', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json('pong');
}));

playerRouter.get('/player', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await PlayerController.getAllPlayers());
}));

playerRouter.get('/updatePlayersFromMfl', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await Player.updatePlayersFromMFL());
}));

export default playerRouter;

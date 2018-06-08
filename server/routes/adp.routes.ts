import { Router, Request, Response, NextFunction } from 'express';
import { request } from 'http';
import ADPController from '../controllers/adp.controller';
import { ADP, getLeagueList } from '../models/adp.model';
import asyncMiddleWare from '../utils/asyncMiddleware';

const adpRouter: Router = Router();

adpRouter.get('/adp/ping', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json('pong');
}));

adpRouter.get('/adp/leagueList', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await getLeagueList());
}));

adpRouter.get('/adp/byPlayer/:_playerId', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  if (!request.query.type || !request.query.format || !request.query.date) throw Error('Missing data to fetch ADP');
  return response.json(await ADPController.getADPForPlayer({
    _playerId: request.params._playerId,
    type: request.query.type,
    format: request.query.format,
    date: request.query.date
  }));
}));

export default adpRouter;

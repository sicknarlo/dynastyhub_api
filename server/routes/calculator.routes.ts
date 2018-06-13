import { Router, Request, Response, NextFunction } from 'express';
import { request } from 'http';
import { Player } from '../models/player.model';
import { Pick } from '../models/pick.model';
import { Rank } from '../models/rank.model';
import CalculatorController from '../controllers/calculator.controller';
import asyncMiddleWare from '../utils/asyncMiddleware';

const CalculatorRouter: Router = Router();

CalculatorRouter.get('/calculator/ping', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json('pong');
}));

CalculatorRouter.get('/calculator', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(
    await CalculatorController.getPlayersForCalculator({
      team1: request.query.team1.split(','),
      team2: request.query.team2.split(',')
    })
  );
}));

export default CalculatorRouter;

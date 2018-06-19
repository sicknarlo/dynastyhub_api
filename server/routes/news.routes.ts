import { Router, Request, Response, NextFunction } from 'express';
import { request } from 'http';
import { News } from '../models/news.model';
import asyncMiddleWare from '../utils/asyncMiddleware';

const adpRouter: Router = Router();

adpRouter.get('/news/ping', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json('pong');
}));

adpRouter.get('/news/latest', asyncMiddleWare(async(request: Request, response: Response, next: NextFunction) => {
  return response.json(await News.find({}).sort({ date: -1 }).limit(10));
}));

export default adpRouter;

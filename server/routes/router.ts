import { Request, Response, Router } from 'express';
import playerRouter from './player.routes';
import adpRouter from './adp.routes';
import calculatorRouter from './calculator.routes';
import newsRouter from './news.routes';

const VERSION: string = 'v1';

const ROUTES: Array<Router> = [playerRouter, adpRouter, calculatorRouter, newsRouter];

const AppRouter: Router = Router();

// Health check
AppRouter.get('/api/health-check', (req: Request, res: Response) => {
  res.status(200).send({
    message: 'OK'
  });
});

// Version check
AppRouter.get('/api/version', (req: Request, res: Response) => {
  res.status(200).send({
    message: VERSION
  });
});

ROUTES.forEach(router => AppRouter.use(`/api/${VERSION}`, router));

export default AppRouter;

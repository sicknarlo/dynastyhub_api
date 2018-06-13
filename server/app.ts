import * as express from 'express';
import { json, urlencoded } from 'body-parser';
import * as http from 'http';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as cors from 'cors';
import { Rank } from './models/rank.model'
import { Pick } from './models/pick.model';
import { Player } from './models/player.model';
import AppRouter from './routes/router';
import { News } from './models/news.model';

dotenv.config();
const app = express();

app.use(json());
app.use(cors());
app.use(urlencoded({
  extended: true
}));

app.get('/', (request: express.Request, response: express.Response) => {

  response.json({
    name: 'Express application'
  })
});

app.get('/ping', (request: express.Request, response: express.Response) => {

    response.json({
      message: 'pong'
    })
  });

app.use((err: Error & { status: number }, request: express.Request, response: express.Response, next: express.NextFunction): void => {

  response.status(err.status || 500);
  response.json({
    error: 'Server error'
  })
});

app.use(AppRouter);

const CronJob = require('cron').CronJob;
new CronJob({
  cronTime: '* * 3 * * 3',
  onTick: () => {
    () => Player.updatePlayersFromMFL();
    // () => Pick.updateDLFPicks();
    () => Rank.getRanksFromMfl();
    Pick.aggregate([
      { '$group': {
          '_id': '$uniqueId',
          'dups': { '$push': '$_id' },
          'count': { '$sum': 1 }
      }},
      { '$match': { 'count': { '$gt': 1 } }}
    ]).then(x => {
      x.forEach(y => {
        const array = y;
        y.dups.shift();
        Pick.remove({ _id: { $in: y.dups }}).then(x => console.log(x));
      })
    });
  },
  start: true,
  timeZone: 'America/New_York',
})

new CronJob({
  cronTime: '* * 12 * * *',
  onTick: () => {
    News.getRotoworldNews().then(x => console.log('added news items:', x));
    News.getDlfNews().then(x => console.log('added news items:', x));
  },
  start: true,
  timeZone: 'America/New_York',
})

const server: http.Server = app.listen(process.env.PORT || 3000);

export { server };

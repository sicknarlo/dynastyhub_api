import * as express from 'express';
import { json, urlencoded } from 'body-parser';
import * as http from 'http';
import * as path from 'path';
import * as dotenv from 'dotenv';
import AppRouter from './routes/router';

dotenv.config();
const app = express();

app.use(json());
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

const server: http.Server = app.listen(process.env.PORT || 3000);

export { server };

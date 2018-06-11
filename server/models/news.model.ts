import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import * as FuzzySet from 'fuzzyset.js';
import { parseStringAsync } from '../utils';
import { Player } from './player.model';
import { mongoose } from '../config/database';

export interface INews extends Document {
  players: Array<mongoose.Schema.Types.ObjectId>;
  site: string;
  link: string;
  title: string;
  body?: string;
  date: Date;
  uid: string;
}

export interface INewsModel extends Model<INews> {
  getRotoworldNews(): Promise<number>
  getDlfNews(): Promise<number>
}

const schema: Schema = new Schema({
  players: [mongoose.Schema.Types.ObjectId],
  site: String,
  link: String,
  title: String,
  body: String,
  date: Date,
  uid: String,
});

const ROTO_URI = 'http://www.rotoworld.com/rss/feed.aspx?sport=nfl&ftype=news&count=12&format=rss';

schema.statics.getRotoworldNews = async () => {
  let nAdded = 0;
  const newsResponse = await axios.get(ROTO_URI);
  const rssJson = await parseStringAsync(newsResponse.data);
  Promise.all(rssJson.rss.channel[0].item.map(async newsItem => {
    const existingNewsItem = await News.findOne({ site: 'rotoworld', uid: newsItem.guid[0]._ });
    if (!existingNewsItem) {
      const playerId = newsItem.link[0].split('/')[5];
      const playerMatch = await Player.findOne({ rotoworldId: playerId });
      if (playerMatch) {
        const news = new News();
        news.players = [playerMatch._id];
        news.site = 'rotoworld';
        news.link = newsItem.link[0];
        news.title = newsItem.title[0];
        news.body = newsItem.description[0];
        news.date = new Date();
        news.uid = newsItem.guid[0]._;
        news.save();
        nAdded++;
      }
    }
  }))
  return nAdded;
}

const DLF_URI = 'http://dynastyleaguefootball.com/feed/';
schema.statics.getDlfNews = async () => {
  let nAdded = 0;
  const newsResponse = await axios.get(DLF_URI);
  const rssJson = await parseStringAsync(newsResponse.data);
  const players = await Player.find({}, { name: 1 });
  const fuzzySet = FuzzySet();
  const playerMap = players.reduce((acc, el) => {
    acc[el.name] = el._id;
    el.name && fuzzySet.add(el.name);
    return acc;
  }, {});
  Promise.all(rssJson.rss.channel[0].item.map(async newsItem => {
    const existingNewsItem = await News.findOne({ site: 'dlf', uid: newsItem.guid[0]._ });
    if (!existingNewsItem) {
      const playerId = newsItem.link[0].split('/')[5];
      const playerArray = [];
      newsItem.category.forEach((name) => {
        let playerMatch = playerMap[name];
        if (!playerMatch) {
          const fuzzyMatch = fuzzySet.get(name);
          if (fuzzyMatch && fuzzyMatch.length) {
            playerMatch = playerMap[fuzzyMatch[0][1]];
          }
        }
        if (playerMatch) playerArray.push(playerMatch);
      })
      if (playerArray.length > 0) {
        const news = new News();
        news.players = playerArray;
        news.site = 'dlf';
        news.link = newsItem.link[0];
        news.title = newsItem.title[0];
        news.body = newsItem.description[0].replace(/<\/?[^>]+(>|$)/g, "");
        news.date = new Date();
        news.uid = newsItem.guid[0]._;
        news.save();
        nAdded++;
      }
    }
  }))
  return nAdded;
}


export const News = mongoose.model<INews>('News', schema) as INewsModel;

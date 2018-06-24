import { Document, Model, Schema } from 'mongoose';
import axios from 'axios';
import * as FuzzySet from 'fuzzyset.js';
import { includedPositions } from '../constants';
import { parseStringAsync } from '../utils';
import { Player, normalizeName } from './player.model';
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
  getNFLNews(): Promise<number>
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
      const playerMatch = await Player.findOne({ rotoworldId: playerId, status: { $ne: 'inactive' }, position: { $in: includedPositions } });
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

const NFL_URI = 'http://api.fantasy.nfl.com/v1/players/news?format=json';
schema.statics.getNFLNews = async (): Promise<number> => {
  let added = 0;
  const newsResponse = await axios.get(NFL_URI);
  const newsItems = newsResponse.data.news;
  const players = await Player.find({ status: { $ne: 'inactive' }, position: { $in: includedPositions }}, { name: 1, gsisPlayerId: 1});
  const fuzzySet = FuzzySet();
  const playerMap = players.reduce((acc, el) => {
    acc[el.name] = el._id;
    acc[el.gsisPlayerId] = el._id;
    el.name && fuzzySet.add(el.name);
    return acc;
  }, {});
  await Promise.all(newsItems.map(async(newsItem) => {
    const dup = await News.findOne({ uid: `nlf-${newsItem.id}`});
    if (!dup) {
      let playerMatch = playerMap[newsItem.gsisPlayerId];
      if (!playerMatch) playerMatch = playerMap[normalizeName(`${newsItem.firstName} ${newsItem.lastName}`)];
      if (!playerMatch) {
        const fuzzyMatch = fuzzySet.get(`${newsItem.firstName} ${newsItem.lastName}`);
        if (fuzzyMatch && fuzzyMatch.length) {
          playerMatch = playerMap[fuzzyMatch[0][1]];
        }
      }
      if (playerMatch) {
        const news = new News();
        news.players = [playerMatch._id];
        news.site = newsItem.source;
        news.link = 'www.' + newsItem.source + '.com';
        news.title = newsItem.body;
        news.body = newsItem.analysis.replace(/<\/?[^>]+(>|$)/g, "");
        news.date = new Date();
        news.uid = `nlf-${newsItem.id}`;
        news.save();
        added++;
        if (!playerMatch.gsisPlayerId) {
          playerMatch.gsisPlayerId = newsItem.gsisPlayerId;
          playerMatch.save();
        }
      }
    }
  }))
  return added;
}

const DLF_URI = 'http://dynastyleaguefootball.com/feed/';
schema.statics.getDlfNews = async () => {
  let nAdded = 0;
  const newsResponse = await axios.get(DLF_URI);
  const rssJson = await parseStringAsync(newsResponse.data);
  const players = await Player.find({ status: { $ne: 'inactive' }, position: { $in: includedPositions } }, { name: 1 });
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

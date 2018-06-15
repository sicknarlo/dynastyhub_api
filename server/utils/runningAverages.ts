import * as moment from 'moment';
import median from './median';

export default (picks) => {
  if (!picks.length) return [];
  const sortedArray = picks.sort((a, b) => new Date(a.date) > new Date(b.date) ? -1 : 1);
  let date = moment(sortedArray[0].date);
  date.subtract(30, 'days');
  const buckets = [[]];
  sortedArray.forEach((pick) => {
    if (moment(pick.date) > date) {
      buckets[0].push(pick);
    } else {
      while (moment(pick.date) < date) date.subtract(30, 'days');
      buckets.unshift([]);
      buckets[0].push(pick)
    }
  });
  return buckets.filter(x => x.length).map(array => {
    return {
      pick: median(array.map(x => x.pick)),
      date: new Date(array[0].date),
    }
  });
}

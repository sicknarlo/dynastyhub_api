import average from './average';

export default (values) => {
  const avg = average(values);

  const squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });

  const avgSquareDiff = average(squareDiffs);

  const stdDev = Math.sqrt(avgSquareDiff);
  return Number(stdDev.toFixed(2));
}

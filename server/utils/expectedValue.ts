export default (arrayOfValues): number =>
  Number((arrayOfValues.reduce((acc, value) => acc + value, 0) / arrayOfValues.length).toFixed(2));

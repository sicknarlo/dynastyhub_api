export default (data) => {
  const sum = data.reduce(function(sum, value){
    return sum + value;
  }, 0);

  return Number((sum / data.length).toFixed(2));
}

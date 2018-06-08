export default (data) => {
  const sum = data.reduce(function(sum, value){
    return sum + value;
  }, 0);

  return sum / data.length;
}

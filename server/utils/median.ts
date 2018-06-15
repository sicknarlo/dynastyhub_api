export default numArray => {
  const sortedArray = numArray.slice().sort((a, b) => a - b);
  return sortedArray.length % 2 === 0
    ? (sortedArray[sortedArray.length / 2 - 1] + sortedArray[sortedArray.length / 2]) / 2
    : sortedArray[(sortedArray.length - 1) / 2];
}

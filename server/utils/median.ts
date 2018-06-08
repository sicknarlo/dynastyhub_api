export default numArray => {
  const sortedArray = numArray.slice().sort();
  return sortedArray.length % 2 === 0
    ? (sortedArray[sortedArray.length / 2 - 1] + sortedArray[sortedArray.length / 2]) / 2
    : sortedArray[(sortedArray.length - 1) / 2];
}

const superScore = {
  QB: ecr => parseFloat((0.0162 * Math.pow(ecr, 1.66) - 0.69).toFixed(2)),
  RB: ecr => parseFloat((1.6912 * Math.pow(ecr, 0.9441) - 0.69).toFixed(2)),
  WR: ecr => parseFloat((1.6912 * Math.pow(ecr, 0.9441) - 0.69).toFixed(2)),
  TE: ecr => parseFloat((1.6912 * Math.pow(ecr, 0.9441) - 0.69).toFixed(2)),
};

export default ({ pos, adp }) => pos === 'QB'
  ? Number((0.0162 * Math.pow(adp, 1.66) - 0.69).toFixed(2))
  : Number((1.6912 * Math.pow(adp, 0.9441) - 0.69).toFixed(2))

import * as chai from "chai";
import median from '../../utils/median';

const expect = chai.expect;

describe("The Median util", () => {

  it("should get the median from an array of values with odd length", async () => {
    const values = [1,2,3,4,5];
    const medianValue = median(values);

    expect(medianValue).to.be.equal(3);
  });

  it("should get the median from an array of values with even length", async () => {
    const values = [1,2,3,4,5,6];
    const medianValue = median(values);

    expect(medianValue).to.be.equal(3.5);
  });

  it("should get the median from an array of unsorted values", async () => {
    const values = [5, 2, 4, 1, 3];
    const medianValue = median(values);

    expect(medianValue).to.be.equal(3);
  });

});

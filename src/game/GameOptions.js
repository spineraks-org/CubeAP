export default class GameOptions {
  /**
 * @param {number} size Dimensions of the cube
 * @param {number} numberStickersToGoalOnSolve
 * @param {number} totalStickers
 * @param {Object.<string, string>|null} sidePermutation Object that maps each side of the cube to a different side to permute the colors.
 */
  constructor(size, sidePermutation, numberStickersToGoalOnSolve, totalStickers) {
    this.size = size;
    this.sidePermutation = sidePermutation;
    this.numberStickersToGoalOnSolve = numberStickersToGoalOnSolve;
    this.totalStickers = totalStickers;
  }
}
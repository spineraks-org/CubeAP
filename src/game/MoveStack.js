/**
 * The stack containing all the moves that have occured.
 */
export default class MoveStack {
    constructor() {
        /**
         * List of moves that have been made
         * @type {Move[]}
         */
        this.moves = [];
    }

    /**
     * Add a move to the list of moves
     * @param {Move} move
     */
    push(move) {
        this.moves.push(move);
    }

    /**
     * Remove the last move and return it.
     * @returns {Move}
     */
    pop() {
        const lastMove = this.moves.pop();
        if (!lastMove) {
            return null;
        }
        return lastMove;
    }
}

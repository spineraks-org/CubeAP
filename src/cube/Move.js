/**
 * Represent a move on the cube
 */
export default class Move {
    /**
     * @param {number[]} layer - Index of all the cubes in the layer in rotation
     * @param {THREE.Vector3} axis - Axis of rotation
     * @param {number} angle - Angle of rotation.
     */
    constructor(layer, axis, angle) {
        this.layer = layer;
        this.axis = axis;
        this.angle = angle;
    }

    /**
     * Returns the move that inverses this move
     * @returns Move
     */
    inverse() {
        return new Move(this.layer.slice(), this.axis.clone(), -this.angle);
    }
}

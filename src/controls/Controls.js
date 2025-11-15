import Tween from '../graphics/animation/Tween.js';
import Easing from '../graphics/Easing.js';
import Draggable from './Draggable.js';
import Move from '../cube/Move.js';

const ControlState = {
    STILL: 0,
    PREPARING: 1,
    ROTATING: 2,
    ANIMATING: 3,
};

export default class Controls {
    /**
     * @param {Game} game
     */
    constructor(game) {
        this.game = game;

        this.flipConfig = 0;

        this.flipEasings = [Easing.Power.Out(3), Easing.Sine.Out(), Easing.Back.Out(1.5)];
        this.flipSpeeds = [125, 200, 300];

        this.raycaster = new THREE.Raycaster();

        const helperMaterial = new THREE.MeshBasicMaterial({
            depthWrite: false,
            transparent: true,
            opacity: 0,
            color: 0x0033ff,
        });

        this.group = new THREE.Object3D();
        this.group.name = 'controls';
        this.game.cube.object.add(this.group);

        this.helper = new THREE.Mesh(new THREE.PlaneBufferGeometry(200, 200), helperMaterial.clone());

        this.helper.rotation.set(0, Math.PI / 4, 0);
        this.game.world.scene.add(this.helper);

        this.edges = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), helperMaterial.clone());

        this.game.world.scene.add(this.edges);

        this.onSolved = () => {};
        this.onMove = () => {};

        this.momentum = [];

        this.scramble = null;
        this.state = ControlState.STILL;
        this.enabled = false;

        this.initDraggable();

        this.addAdditionalKeyListener();
        this.addDeathLinkListener();
    }

    //AP
    undo_action() {
        if (this.state !== ControlState.STILL || !this.enabled || this.scramble !== null) return;
        const lastMove = this.game.moveStack.pop();
        if (!lastMove) {
            return;
        }
        this.state = ControlState.ANIMATING;
        const moveToApply = lastMove.inverse();
        this.flipAxis = moveToApply.axis;
        this.selectLayer(moveToApply.layer);
        this.rotateLayer(moveToApply.angle, false, () => {
            // Do NOT add the move to the move stack - we're undoing it!
            this.game.storage.saveGame();
            this.state = ControlState.STILL;
            this.checkIsSolved();
        });
    }

    moveSide(eventKey) {
        this.state = ControlState.ANIMATING;
        const moveDescriptor = eventKey + (eventKey === eventKey.toUpperCase() ? "'" : '');
        const move = this.game.scrambler.convertMove(moveDescriptor);

        // Get the layer to rotate
        // Always get the layer corresponding to the global axis, not the local cube orientation
        // Find the world position of the layer by transforming the intended position by the cube's rotation
        // Use the inverse quaternion to transform the move position to global coordinates
        const inverseQuaternion = this.game.cube.object.quaternion.clone().inverse();
        const globalPosition = move.position.clone().applyQuaternion(inverseQuaternion);
        // Clamp values to [-1, 1]
        globalPosition.x = Math.max(-1, Math.min(1, globalPosition.x));
        globalPosition.y = Math.max(-1, Math.min(1, globalPosition.y));
        globalPosition.z = Math.max(-1, Math.min(1, globalPosition.z));
        // console.log(inverseQuaternion, globalPosition)

        const layer = this.getLayer(globalPosition);

        // Set the axis to rotate
        this.flipAxis = new THREE.Vector3();

        this.flipAxis[move.axis] = 1;
        this.flipAxis = this.flipAxis.applyQuaternion(inverseQuaternion);
        // Select the layer
        this.selectLayer(layer);
        // Rotate the layer
        this.rotateLayer(move.angle, false, (rotatedLayer) => {
            this.game.moveStack.push(new Move(rotatedLayer.slice(), this.flipAxis.clone(), move.angle));
            this.game.storage.saveGame();
            this.state = ControlState.STILL;
            this.checkIsSolved();
        });
    }

    doDeathLink(source, cause) {
        const amount_of_moves = document.getElementById('deathlink-scramble').value;

        if (document.getElementById('show-deathlinks').checked) {
            const note = this.game.dom.texts.note;
            // make display note for 10 seconds
            if (cause) {
                note.innerText = cause + '';
            } else {
                note.innerText = source + ' died';
            }
            note.style.opacity = '1';
            setTimeout(
                () => {
                    note.style.opacity = '0';
                    note.innerText = 'Double tap to start';
                },
                3000 + amount_of_moves * 500,
            );
        }

        for (let i = 0; i < amount_of_moves; i++) {
            setTimeout(() => {
                if (this.state !== ControlState.STILL || !this.enabled || this.scramble !== null) return;
                const faces = 'UDLRFB';
                const move = faces[Math.floor(Math.random() * faces.length)];
                this.moveSide(move);
            }, i * 500);
        }
    }

    addDeathLinkListener() {
        window.doDeathLink = this.doDeathLink.bind(this);
    }

    addAdditionalKeyListener() {
        document.addEventListener('keydown', (event) => {
            if (this.state !== ControlState.STILL || !this.enabled || this.scramble !== null) return;

            let eventKey = event.key;

            // // Use this to rotate the layer when Q is pressed
            // if (['P'].includes(eventKey)) {
            //   this.doDeathLink("Spineraks", "made too many games");
            // }

            // Use this to rotate the layer when Q is pressed
            if (['L', 'R', 'U', 'D', 'F', 'B'].includes(eventKey.toUpperCase())) {
                this.moveSide(eventKey);
            }

            if (event.key === 'Backspace') {
                this.undo_action();
            }

            // Arrow keys: rotate the cube as a whole
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                this.state = ControlState.ANIMATING;
                let axis, angle;
                switch (event.key) {
                    case 'ArrowLeft':
                        axis = 'y';
                        angle = -Math.PI / 2;
                        break;
                    case 'ArrowRight':
                        axis = 'y';
                        angle = Math.PI / 2;
                        break;
                    case 'ArrowUp':
                        axis = 'x';
                        angle = -Math.PI / 2;
                        if (event.shiftKey) {
                            axis = 'z';
                            angle *= -1;
                        }
                        break;
                    case 'ArrowDown':
                        axis = 'x';
                        angle = Math.PI / 2;
                        if (event.shiftKey) {
                            axis = 'z';
                            angle *= -1;
                        }
                        break;
                }
                this.flipAxis = new THREE.Vector3();
                this.flipAxis[axis] = 1;
                this.rotateCube(angle, () => {
                    this.state = ControlState.STILL;
                });
            }
        });
    }

    enable() {
        this.draggable.enable();
        this.enabled = true;
    }

    disable() {
        this.draggable.disable();
        this.enabled = false;
    }

    initDraggable() {
        this.draggable = new Draggable(this.game.dom.game);

        this.draggable.onDragStart = (position) => {
            if (this.scramble !== null) return;
            if (this.state === ControlState.PREPARING || this.state === ControlState.ROTATING) return;

            this.gettingDrag = this.state === ControlState.ANIMATING;

            const edgeIntersect = this.getIntersect(position.current, this.edges, false);

            if (edgeIntersect !== false) {
                this.dragIntersect = this.getIntersect(position.current, this.game.cube.cubes, true);
            }

            if (edgeIntersect !== false && this.dragIntersect !== false) {
                this.dragNormal = edgeIntersect.face.normal.round();
                this.flipType = 'layer';

                this.attach(this.helper, this.edges);

                this.helper.rotation.set(0, 0, 0);
                this.helper.position.set(0, 0, 0);
                this.helper.lookAt(this.dragNormal);
                this.helper.translateZ(0.5);
                this.helper.updateMatrixWorld();

                this.detach(this.helper, this.edges);
            } else {
                this.dragNormal = new THREE.Vector3(0, 0, 1);
                this.flipType = 'cube';

                this.helper.position.set(0, 0, 0);
                this.helper.rotation.set(0, Math.PI / 4, 0);
                this.helper.updateMatrixWorld();
            }

            let planeIntersect = this.getIntersect(position.current, this.helper, false);
            if (planeIntersect === false) return;

            this.dragCurrent = this.helper.worldToLocal(planeIntersect.point);
            this.dragTotal = new THREE.Vector3();
            this.state = this.state === ControlState.STILL ? ControlState.PREPARING : this.state;
        };

        this.draggable.onDragMove = (position) => {
            if (this.scramble !== null) return;
            if (
                this.state === ControlState.STILL ||
                (this.state === ControlState.ANIMATING && this.gettingDrag === false)
            )
                return;

            const planeIntersect = this.getIntersect(position.current, this.helper, false);
            if (planeIntersect === false) return;

            const point = this.helper.worldToLocal(planeIntersect.point.clone());

            this.dragDelta = point.clone().sub(this.dragCurrent).setZ(0);
            this.dragTotal.add(this.dragDelta);
            this.dragCurrent = point;
            this.addMomentumPoint(this.dragDelta);

            if (this.state === ControlState.PREPARING && this.dragTotal.length() > 0.05) {
                this.dragDirection = this.getMainAxis(this.dragTotal);

                if (this.flipType === 'layer') {
                    const direction = new THREE.Vector3();
                    direction[this.dragDirection] = 1;

                    const worldDirection = this.helper.localToWorld(direction).sub(this.helper.position);
                    const objectDirection = this.edges.worldToLocal(worldDirection).round();

                    this.flipAxis = objectDirection.cross(this.dragNormal).negate();

                    this.selectLayer(this.getLayer(false));
                } else {
                    const axis =
                        this.dragDirection != 'x'
                            ? this.dragDirection == 'y' && position.current.x > this.game.world.width / 2
                                ? 'z'
                                : 'x'
                            : 'y';

                    this.flipAxis = new THREE.Vector3();
                    this.flipAxis[axis] = 1 * (axis == 'x' ? -1 : 1);
                }

                this.flipAngle = 0;
                this.state = ControlState.ROTATING;
            } else if (this.state === ControlState.ROTATING) {
                const rotation = this.dragDelta[this.dragDirection];

                if (this.flipType === 'layer') {
                    this.group.rotateOnAxis(this.flipAxis, rotation);
                    this.flipAngle += rotation;
                } else {
                    this.edges.rotateOnWorldAxis(this.flipAxis, rotation);
                    this.game.cube.object.rotation.copy(this.edges.rotation);
                    this.flipAngle += rotation;
                }
            }
        };

        this.draggable.onDragEnd = (position) => {
            if (this.scramble !== null) return;
            if (this.state !== ControlState.ROTATING) {
                this.gettingDrag = false;
                this.state = ControlState.STILL;
                return;
            }

            this.state = ControlState.ANIMATING;

            const momentum = this.getMomentum()[this.dragDirection];
            const flip = Math.abs(momentum) > 0.05 && Math.abs(this.flipAngle) < Math.PI / 2;

            const angle = flip
                ? this.roundAngle(this.flipAngle + Math.sign(this.flipAngle) * (Math.PI / 4))
                : this.roundAngle(this.flipAngle);

            const delta = angle - this.flipAngle;

            if (this.flipType === 'layer') {
                this.rotateLayer(delta, false, (rotatedLayer) => {
                    // If the angle is too small, it means no rotation was applied. We ignore it.
                    // 360 degrees rotation would still be possible, even if they don't do anything.
                    // This is probably preferable in terms of UX.
                    if (Math.abs(angle) > 1.5) {
                        this.game.moveStack.push(new Move(rotatedLayer.slice(), this.flipAxis.clone(), angle));
                    }
                    this.game.storage.saveGame();

                    this.state = this.gettingDrag ? ControlState.PREPARING : ControlState.STILL;
                    this.gettingDrag = false;

                    this.checkIsSolved();
                });
            } else {
                this.rotateCube(delta, () => {
                    this.state = this.gettingDrag ? ControlState.PREPARING : ControlState.STILL;
                    this.gettingDrag = false;
                });
            }
        };
    }

    /**
     * @param {number} rotation - Target angle of rotation.
     * This is used for the animation: this allows a layer to be in a partially turned position when its dragged with the mouse.
     * @param {boolean} scramble - True if the cube is being scrambled.
     * @param {onRotateCompleteCallback} callback - Callback to call once the animation is complete.
     */
    rotateLayer(rotation, scramble, callback) {
        const config = scramble ? 0 : this.flipConfig;

        const easing = this.flipEasings[config];
        const duration = this.flipSpeeds[config];
        const bounce = config == 2 ? this.bounceCube() : () => {};

        this.rotationTween = new Tween({
            easing: easing,
            duration: duration,
            onUpdate: (tween) => {
                let deltaAngle = tween.delta * rotation;
                this.group.rotateOnAxis(this.flipAxis, deltaAngle);
                bounce(tween.value, deltaAngle, rotation);
            },
            /**
             * @callback onRotateCompleteCallback
             * @param {number[]} layer
             * @returns {void}
             */
            onComplete: () => {
                if (!scramble) this.onMove();

                if (this.flipLayer) {
                    const layer = this.flipLayer.slice(0);

                    if (layer) {
                        this.game.cube.object.rotation.setFromVector3(
                            this.snapRotation(this.game.cube.object.rotation.toVector3()),
                        );
                        this.group.rotation.setFromVector3(this.snapRotation(this.group.rotation.toVector3()));
                        this.deselectLayer(this.flipLayer);

                        callback(layer);
                    }
                }
            },
        });
    }

    bounceCube() {
        let fixDelta = true;

        return (progress, delta, rotation) => {
            if (progress >= 1) {
                if (fixDelta) {
                    delta = (progress - 1) * rotation;
                    fixDelta = false;
                }

                this.game.cube.object.rotateOnAxis(this.flipAxis, delta);
            }
        };
    }

    rotateCube(rotation, callback) {
        const config = this.flipConfig;
        const easing = [Easing.Power.Out(4), Easing.Sine.Out(), Easing.Back.Out(2)][config];
        const duration = [100, 150, 350][config];

        this.rotationTween = new Tween({
            easing: easing,
            duration: duration,
            onUpdate: (tween) => {
                this.edges.rotateOnWorldAxis(this.flipAxis, tween.delta * rotation);
                this.game.cube.object.rotation.copy(this.edges.rotation);
            },
            onComplete: () => {
                this.edges.rotation.setFromVector3(this.snapRotation(this.edges.rotation.toVector3()));
                this.game.cube.object.rotation.copy(this.edges.rotation);
                callback();
            },
        });
    }

    selectLayer(layer) {
        this.group.rotation.set(0, 0, 0);
        this.movePieces(layer, this.game.cube.object, this.group);
        this.flipLayer = layer;
    }

    deselectLayer(layer) {
        this.movePieces(layer, this.group, this.game.cube.object);
        this.flipLayer = null;
    }

    movePieces(layer, from, to) {
        from.updateMatrixWorld();
        to.updateMatrixWorld();

        layer.forEach((index) => {
            const piece = this.game.cube.pieces[index];

            piece.applyMatrix(from.matrixWorld);
            from.remove(piece);
            piece.applyMatrix(new THREE.Matrix4().getInverse(to.matrixWorld));
            to.add(piece);
        });
    }

    getLayer(position) {
        const scalar = { 2: 6, 3: 3, 4: 4, 5: 3 }[this.game.cube.size];
        const layer = [];

        let axis;

        if (position === false) {
            const piece = this.dragIntersect.object.parent;

            axis = this.getMainAxis(this.flipAxis);
            position = piece.position.clone().multiplyScalar(scalar).round();
        } else {
            axis = this.getMainAxis(position);
        }

        this.game.cube.pieces.forEach((piece) => {
            const piecePosition = piece.position.clone().multiplyScalar(scalar).round();

            if (piecePosition[axis] == position[axis]) layer.push(piece.name);
        });

        return layer;
    }

    scrambleCube() {
        if (this.scramble == null) {
            this.scramble = this.game.scrambler;
            this.scramble.callback = typeof callback !== 'function' ? () => {} : callback;
        }

        const converted = this.scramble.converted;
        const move = converted[0];
        const layer = this.getLayer(move.position);

        this.flipAxis = new THREE.Vector3();
        this.flipAxis[move.axis] = 1;

        this.selectLayer(layer);
        this.rotateLayer(move.angle, true, () => {
            converted.shift();

            if (converted.length > 0) {
                this.scrambleCube();
            } else {
                this.scramble = null;
                window.doneScramble = true;
                this.game.storage.saveGame();
            }
        });
    }

    getIntersect(position, object, multiple) {
        this.raycaster.setFromCamera(this.draggable.convertPosition(position.clone()), this.game.world.camera);

        const intersect = multiple ? this.raycaster.intersectObjects(object) : this.raycaster.intersectObject(object);

        return intersect.length > 0 ? intersect[0] : false;
    }

    getMainAxis(vector) {
        return Object.keys(vector).reduce((a, b) => (Math.abs(vector[a]) > Math.abs(vector[b]) ? a : b));
    }

    detach(child, parent) {
        child.applyMatrix(parent.matrixWorld);
        parent.remove(child);
        this.game.world.scene.add(child);
    }

    attach(child, parent) {
        child.applyMatrix(new THREE.Matrix4().getInverse(parent.matrixWorld));
        this.game.world.scene.remove(child);
        parent.add(child);
    }

    addMomentumPoint(delta) {
        const time = Date.now();

        this.momentum = this.momentum.filter((moment) => time - moment.time < 500);

        if (delta !== false) this.momentum.push({ delta, time });
    }

    getMomentum() {
        const points = this.momentum.length;
        const momentum = new THREE.Vector2();

        this.addMomentumPoint(false);

        this.momentum.forEach((point, index) => {
            momentum.add(point.delta.multiplyScalar(index / points));
        });

        return momentum;
    }

    roundAngle(angle) {
        const round = Math.PI / 2;
        return Math.sign(angle) * Math.round(Math.abs(angle) / round) * round;
    }

    snapRotation(angle) {
        return angle.set(this.roundAngle(angle.x), this.roundAngle(angle.y), this.roundAngle(angle.z));
    }

    //AP
    checkIsSolved() {
        const sides = {
            'x-': [],
            'x+': [],
            'y-': [],
            'y+': [],
            'z-': [],
            'z+': [],
        };

        this.game.cube.edges.forEach((edge) => {
            const position = edge.parent.localToWorld(edge.position.clone()).sub(this.game.cube.object.position);

            const mainAxis = this.getMainAxis(position);
            const mainSign = position.multiplyScalar(2).round()[mainAxis] < 1 ? '-' : '+';

            sides[mainAxis + mainSign].push(edge);
        });

        // Calculate the number of correctly colored stickers per side
        let maxPossible = 0;
        const sideKeys = Object.keys(sides);

        let bestPerColor = { B: 0, D: 0, F: 0, L: 0, R: 0, U: 0 };
        for (let i = 0; i < sideKeys.length; i++) {
            const side = sideKeys[i];
            if (sides[side].length === 0) continue;
            // Count occurrences of each color
            const colorCounts = { B: 0, D: 0, F: 0, L: 0, R: 0, U: 0 };
            for (let j = 0; j < sides[side].length; j++) {
                const sticker = sides[side][j];
                if (sticker.name.charAt(1) === 'O') {
                    const color = sticker.name.charAt(0);
                    colorCounts[color] += 1;
                    maxPossible += 1;
                }
            }
            for (const color in colorCounts) {
                // Find the second highest color count
                const sortedCounts = Object.values(colorCounts).sort((a, b) => b - a);
                const secondHighest = sortedCounts[1] || 0;
                let count = colorCounts[color];
                if (secondHighest > 0) {
                    count = 0;
                }

                if (colorCounts[color] > bestPerColor[color]) {
                    bestPerColor[color] = count;
                }
            }
        }
        // const correctPerColor = `White:${bestPerColor['U']} Yellow:${bestPerColor['D']} Red:${bestPerColor['F']} Orange:${bestPerColor['B']} Blue:${bestPerColor['R']} Green:${bestPerColor['L']}`;

        const correctCount = Object.values(bestPerColor).reduce((a, b) => a + b, 0);
        const maxMaxPossible = 6 * (this.game.cube.size * this.game.cube.size);

        this.game.dom.texts.correctness.textContent = `${correctCount}/${maxPossible} correct`;
        // this.game.dom.texts.correctness2.textContent = correctPerColor;
        window.submitScore(bestPerColor);

        // If all stickers are correct but not all possible stickers are present, fix one sticker

        if (correctCount === maxPossible && maxPossible < maxMaxPossible) {
            // console.log("BK :/")
            // window.unlockRandomSticker();
        }

        if (correctCount === maxMaxPossible) this.onSolved();
    }
}

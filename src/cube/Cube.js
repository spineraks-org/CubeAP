import RoundedBoxGeometry from '../graphics/geometry/RoundedBoxGeometry.js';
import RoundedPlaneGeometry from '../graphics/geometry/RoundedPlaneGeometry.js';

export default class Cube {
    constructor(game) {
        this.game = game;
        this.size = 3;

        this.geometry = {
            pieceCornerRadius: 0.12,
            edgeCornerRoundness: 0.15,
            edgeScale: 0.82,
            edgeDepth: 0.01,
        };

        this.holder = new THREE.Object3D();
        this.object = new THREE.Object3D();
        this.animator = new THREE.Object3D();

        this.holder.add(this.animator);
        this.animator.add(this.object);

        this.game.world.scene.add(this.holder);
    }

    init() {
        this.cubes = [];
        this.object.children = [];
        this.object.add(this.game.controls.group);

        if (this.size === 2) this.scale = 1.25;
        else if (this.size === 3) this.scale = 1;
        else if (this.size > 3) this.scale = 3 / this.size;

        this.object.scale.set(this.scale, this.scale, this.scale);

        const controlsScale = this.size === 2 ? 0.825 : 1;
        this.game.controls.edges.scale.set(controlsScale, controlsScale, controlsScale);

        this.generatePositions();
        this.generateModel();

        this.pieces.forEach((piece) => {
            this.cubes.push(piece.userData.cube);
            this.object.add(piece);
        });

        this.holder.traverse((node) => {
            if (node.frustumCulled) node.frustumCulled = false;
        });

        this.updateColors(this.game.themes.getColors(), this.game.sidePermutation);

        this.sizeGenerated = this.size;
    }

    resize(force = false) {
        if (this.size !== this.sizeGenerated || force) {
            // this.size = this.game.preferences.ranges.size.value;

            this.reset();
            this.init();

            this.game.saved = false;
            this.game.timer.reset();
            this.game.storage.clearGame();
        }
    }

    reset() {
        this.game.controls.edges.rotation.set(0, 0, 0);

        this.holder.rotation.set(0, 0, 0);
        this.object.rotation.set(0, 0, 0);
        this.animator.rotation.set(0, 0, 0);
    }

    generatePositions() {
        const m = this.size - 1;
        const first = this.size % 2 !== 0 ? 0 - Math.floor(this.size / 2) : 0.5 - this.size / 2;

        let x, y, z;

        this.positions = [];

        for (x = 0; x < this.size; x++) {
            for (y = 0; y < this.size; y++) {
                for (z = 0; z < this.size; z++) {
                    let position = new THREE.Vector3(first + x, first + y, first + z);
                    let edges = [];

                    if (x == 0) edges.push(0);
                    if (x == m) edges.push(1);
                    if (y == 0) edges.push(2);
                    if (y == m) edges.push(3);
                    if (z == 0) edges.push(4);
                    if (z == m) edges.push(5);

                    position.edges = edges;
                    this.positions.push(position);
                }
            }
        }
    }

    generateModel() {
        this.pieces = [];
        this.edges = [];

        const pieceSize = 1 / 3;

        const mainMaterial = new THREE.MeshLambertMaterial();

        const pieceMesh = new THREE.Mesh(
            new RoundedBoxGeometry(pieceSize, this.geometry.pieceCornerRadius, 3),
            mainMaterial.clone(),
        );

        const edgeGeometry = RoundedPlaneGeometry(
            pieceSize,
            this.geometry.edgeCornerRoundness,
            this.geometry.edgeDepth,
        );

        this.positions.forEach((position, index) => {
            const piece = new THREE.Object3D();
            const pieceCube = pieceMesh.clone();
            const pieceEdges = [];

            piece.position.copy(position.clone().divideScalar(3));
            piece.add(pieceCube);
            piece.name = index;
            piece.edgesName = '';

            position.edges.forEach((position) => {
                const edge = new THREE.Mesh(edgeGeometry, mainMaterial.clone());
                const name = ['L', 'R', 'D', 'U', 'B', 'F'][position];
                const distance = pieceSize / 2;

                edge.position.set(
                    distance * [-1, 1, 0, 0, 0, 0][position],
                    distance * [0, 0, -1, 1, 0, 0][position],
                    distance * [0, 0, 0, 0, -1, 1][position],
                );

                edge.rotation.set(
                    (Math.PI / 2) * [0, 0, 1, -1, 0, 0][position],
                    (Math.PI / 2) * [-1, 1, 0, 0, 2, 0][position],
                    0,
                );

                edge.scale.set(this.geometry.edgeScale, this.geometry.edgeScale, this.geometry.edgeScale);

                edge.name = name;

                piece.add(edge);
                pieceEdges.push(name);
                this.edges.push(edge);
            });

            piece.userData.edges = pieceEdges;
            piece.userData.cube = pieceCube;

            piece.userData.start = {
                position: piece.position.clone(),
                rotation: piece.rotation.clone(),
            };

            this.pieces.push(piece);
        });
    }

    /**
     *
     * @param {Object.<string, number>} colors Colors to use for each side
     * @param {Object.<string, string>} sidePermutation Object that maps each side of the cube to a different side to permute the colors
     */
    updateColors(colors, sidePermutation) {
        if (typeof this.pieces !== 'object' && typeof this.edges !== 'object') return;

        //AP
        let sideCount = {};
        if (!this.lockedColors) {
            for (let i = 0; i < this.edges.length; i++) {
                sideCount[this.edges[i].name.charAt(0)] = (sideCount[this.edges[i].name.charAt(0)] || 0) + 1;
                this.edges[i].name = this.edges[i].name + 'X' + 'X' + '-' + sideCount[this.edges[i].name.charAt(0)];
            }
            this.lockedColors = true;
        }

        this.pieces.forEach((piece) => {
            piece.userData.cube.material.color.setHex(colors.P);
            piece.userData.cube.material.transparent = true;
            piece.userData.cube.material.opacity = 0.05;
        });

        this.edges.forEach((edge) => {
            if (edge.name.charAt(1) === 'O') {
                const colorCode = sidePermutation[edge.name.charAt(0)] || edge.name.charAt(0);
                edge.material.color.setHex(colors[colorCode]);
                edge.material.transparent = true;
                edge.material.opacity = 1;
            } else {
                edge.material.color.setHex(0x888888); // gray
                edge.material.transparent = true;
                edge.material.opacity = 1;
            }

            // Remove previous border if exists
            if (edge.userData && edge.userData.border) {
                edge.remove(edge.userData.border);
                edge.userData.border.geometry.dispose();
                edge.userData.border.material.dispose();
                edge.userData.border = null;
            }

            // up next, if charAt(2) is not X, add a border and make it color edge.name.charAt(2)
            if (edge.name.charAt(2) !== 'X') {
                // Add a border to the edge with color colors[edge.name.charAt(2)]
                // We'll use MeshBasicMaterial for the border and overlay a slightly larger plane

                // Add colored border mesh (outline)
                const outlineMaterial = new THREE.MeshBasicMaterial({
                    color: colors[edge.name.charAt(2)],
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: 1,
                });
                const outlineMesh = new THREE.Mesh(edge.geometry.clone(), outlineMaterial);
                outlineMesh.scale.multiplyScalar(1.1); // Increased for thicker border
                outlineMesh.position.set(0, 0, 0); // Centered on edge
                outlineMesh.rotation.set(0, 0, 0); // No extra rotation
                outlineMesh.renderOrder = 1; // Ensure border renders above

                edge.add(outlineMesh);
                edge.userData.border = outlineMesh;
            }
        });
    }

    loadFromData(data) {
        this.size = data.size;

        this.reset();
        this.init();

        this.pieces.forEach((piece) => {
            const index = data.names.indexOf(piece.name);

            const position = data.positions[index];
            const rotation = data.rotations[index];

            piece.position.set(position.x, position.y, position.z);
            piece.rotation.set(rotation.x, rotation.y, rotation.z);
        });
    }
}

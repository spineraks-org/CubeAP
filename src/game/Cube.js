import RoundedBoxGeometry from "../geometry/RoundedBoxGeometry.js";
import RoundedPlaneGeometry from "../geometry/RoundedPlaneGeometry.js";

import GAME_STATE from "./GameState.js";

export default class Cube {

  constructor( game ) {

    /**
     * @type Game
     */
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

    this.holder.add( this.animator );
    this.animator.add( this.object );

    this.game.world.scene.add( this.holder );
  }

  init() {

    this.cubes = [];
    this.object.children = [];
    this.object.add( this.game.controls.group );

    if ( this.size === 2 ) this.scale = 1.25;
    else if ( this.size === 3 ) this.scale = 1;
    else if ( this.size > 3 ) this.scale = 3 / this.size;

    this.object.scale.set( this.scale, this.scale, this.scale );

    const controlsScale = this.size === 2 ? 0.825 : 1;
    this.game.controls.edges.scale.set( controlsScale, controlsScale, controlsScale );
    
    this.generatePositions();
    this.generateModel();

    this.pieces.forEach( piece => {

      this.cubes.push( piece.userData.cube );
      this.object.add( piece );

    } );

    this.holder.traverse( node => {

      if ( node.frustumCulled ) node.frustumCulled = false;

    } );

    this.updateColors( this.game.themes.getColors(), this.game.sidePermutation );

    this.sizeGenerated = this.size;

  }

  resize( force = false ) {

    if ( this.size !== this.sizeGenerated || force ) {

      // this.size = this.game.preferences.ranges.size.value;

      this.reset();
      this.init();

      this.game.saved = false;
      this.game.timer.reset();
      this.game.storage.clearGame();

    }

  }

  reset() {

    this.game.controls.edges.rotation.set( 0, 0, 0 );

    this.holder.rotation.set( 0, 0, 0 );
    this.object.rotation.set( 0, 0, 0 );
    this.animator.rotation.set( 0, 0, 0 );

  }

  generatePositions() {

    const m = this.size - 1;
    const first = this.size % 2 !== 0
      ? 0 - Math.floor(this.size / 2)
      : 0.5 - this.size / 2;

    let x, y, z;

    this.positions = [];

    for ( x = 0; x < this.size; x ++ ) {
      for ( y = 0; y < this.size; y ++ ) {
        for ( z = 0; z < this.size; z ++ ) {

          let position = new THREE.Vector3(first + x, first + y, first + z);
          let edges = [];

          if ( x == 0 ) edges.push(0);
          if ( x == m ) edges.push(1);
          if ( y == 0 ) edges.push(2);
          if ( y == m ) edges.push(3);
          if ( z == 0 ) edges.push(4);
          if ( z == m ) edges.push(5);

          let pieceType = '';
          let isMiddle;

          switch (edges.length) {
            case 1:
              pieceType = 'center';
              isMiddle = position.toArray().filter(x => x === 0).length === 2;
              break;
            case 2:
              pieceType = 'edge';
              isMiddle = position.toArray().filter(x => x === 0).length === 1;
              break;
            case 3:
              pieceType = 'corner';
              isMiddle = false;
              break;
          }

          this.positions.push( {position, edges, pieceType, isMiddle} );

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
      new RoundedBoxGeometry( pieceSize, this.geometry.pieceCornerRadius, 3 ),
      mainMaterial.clone()
    );

    const edgeGeometry = RoundedPlaneGeometry(
      pieceSize,
      this.geometry.edgeCornerRoundness,
      this.geometry.edgeDepth
    );

    let baseNameCount = {}
    let colorCount = {'L':0, 'R':0, 'D':0, 'U':0, 'B':0, 'F':0}

    this.positions.forEach( ( {position, edges, pieceType, isMiddle}, index ) => {
      const piece = new THREE.Object3D();
      const pieceCube = pieceMesh.clone();
      const pieceEdges = [];

      piece.position.copy( position.clone().divideScalar( 3 ) );
      piece.add( pieceCube );
      piece.name = index;
      piece.edgesName = '';

      const basePieceName = pieceType + (isMiddle ? '-middle' : '');

      edges.forEach( side => {

        const edge = new THREE.Mesh( edgeGeometry, mainMaterial.clone() );
        const color = [ 'L', 'R', 'D', 'U', 'B', 'F' ][ side ];
        const baseName = color + '-' + basePieceName;
        const edgeIndex = baseNameCount[baseName] ?? 0;
        const name = baseName + '-' + edgeIndex;
        baseNameCount[baseName] = edgeIndex + 1;
        const data = {
          locked: true,
          mark: null,
          color: color,
          colorIndex: colorCount[color]++,
          pieceType: pieceType,
          isMiddlePiece: isMiddle
        };
        const distance = pieceSize / 2;

        edge.position.set(
          distance * [ - 1, 1, 0, 0, 0, 0 ][ side ],
          distance * [ 0, 0, - 1, 1, 0, 0 ][ side ],
          distance * [ 0, 0, 0, 0, - 1, 1 ][ side ]
        );

        edge.rotation.set(
          Math.PI / 2 * [ 0, 0, 1, - 1, 0, 0 ][ side ],
          Math.PI / 2 * [ - 1, 1, 0, 0, 2, 0 ][ side ],
          0
        );

        edge.scale.set(
          this.geometry.edgeScale,
          this.geometry.edgeScale,
          this.geometry.edgeScale
        );
        edge.name = name;
        edge.userData = data;
        piece.add( edge );
        pieceEdges.push( name );
        this.edges.push( edge );
      } );
      piece.userData.edges = pieceEdges;
      piece.userData.cube = pieceCube;

      piece.userData.start = {
        position: piece.position.clone(),
        rotation: piece.rotation.clone(),
      };

      this.pieces.push( piece );

    } );
  }

  /**
   *
   * @param {Object.<string, number>} colors Colors to use for each side
   * @param {Object.<string, string>} sidePermutation Object that maps each side of the cube to a different side to permute the colors
   */
  updateColors( colors, sidePermutation ) {

    if ( typeof this.pieces !== 'object' && typeof this.edges !== 'object' ) return;

    this.pieces.forEach(piece => {
      piece.userData.cube.material.color.setHex(colors.P);
      piece.userData.cube.material.transparent = true;
      piece.userData.cube.material.opacity = 0.05;
    });
    
    this.edges.forEach( edge => {
      if ((!this.game.isLayoutRandomized || this.game.state === GAME_STATE.Playing || this.game.state === GAME_STATE.Complete || this.game.saved) && !edge.userData.locked) {
        const colorCode = sidePermutation[edge.userData.color];
        edge.material.color.setHex(colors[colorCode]);
        edge.material.transparent = true;
        edge.material.opacity = 1;
      } else {
        edge.material.color.setHex(0x888888); // gray
        edge.material.transparent = true;
        edge.material.opacity = 1;
      }
      if (edge.userData.mark !== null) {
        if (!edge.userData.border) {
          const outlineMaterial = new THREE.MeshBasicMaterial({
            side: THREE.BackSide,
            transparent: true,
            opacity: 1,
          });
          const outlineMesh = new THREE.Mesh(edge.geometry.clone(), outlineMaterial);
          outlineMesh.scale.multiplyScalar(1.10); // Increased for thicker border
          outlineMesh.position.set(0, 0, 0); // Centered on edge
          outlineMesh.rotation.set(0, 0, 0); // No extra rotation
          outlineMesh.renderOrder = 1; // Ensure border renders above
          edge.add(outlineMesh);
          edge.userData.border = outlineMesh;
        }
        edge.userData.border.material.color.setHex(colors[edge.userData.mark]);
      }
      else
      {
        if (edge.userData.border) {
          edge.remove(edge.userData.border);
          edge.userData.border.geometry.dispose();
          edge.userData.border.material.dispose();
          edge.userData.border = null;
        }
      }
    });

  }

  loadFromData( data ) {

    this.size = data.size;

    this.reset();
    this.init();

    this.pieces.forEach( piece => {

      const index = data.names.indexOf( piece.name );

      const position = data.positions[index];
      const rotation = data.rotations[index];

      piece.position.set( position.x, position.y, position.z );
      piece.rotation.set( rotation.x, rotation.y, rotation.z );
      piece.children.forEach(edge => {
        edge.userData.mark = data.marks[edge.name] ?? null;
      })
    } );

  }

}
import Draggable from "../animation/Draggable.js";
import Easing from "../animation/Easing.js";
import Tween from "../animation/Tween.js";

import Move from "./Move.js";
import RotateMove from "./RotateMove.js";
import GAME_STATE from "./GameState.js";

const AnimationState = {
    STILL: 0,
    PREPARING: 1,
    ROTATING: 2,
    ANIMATING: 3
}

export default class Controls {

  /**
   * @param {Game} game
   */
  constructor( game ) {

    this.game = game;

    this.flipConfig = 0;
    this.controlStyle = 0;

    this.flipEasings = [ Easing.Power.Out( 3 ), Easing.Sine.Out(), Easing.Back.Out( 1.5 ) ];
    this.flipSpeeds = [ 125, 200, 300 ];

    this.raycaster = new THREE.Raycaster();

    const helperMaterial = new THREE.MeshBasicMaterial( { depthWrite: false, transparent: true, opacity: 0, color: 0x0033ff } );

    this.group = new THREE.Object3D();
    this.group.name = 'controls';
    this.game.cube.object.add( this.group );

    this.helper = new THREE.Mesh(
      new THREE.PlaneBufferGeometry( 200, 200 ),
      helperMaterial.clone()
    );

    this.helper.rotation.set( 0, Math.PI / 4, 0 );
    this.game.world.scene.add( this.helper );

    this.edges = new THREE.Mesh(
      new THREE.BoxBufferGeometry( 1, 1, 1 ),
      helperMaterial.clone(),
    );

    this.game.world.scene.add( this.edges );

    this.onSolved = () => {};
    this.onMove = () => {};

    this.momentum = [];

    this.scramble = null;
    this.state = AnimationState.STILL;
    this.enabled = false;
    this.deathlinkMoves = 0;
    this.deathlinksInProgress = 0;
    this.dragResolve = () => {};

    this.initDraggable();

    this.addAdditionalKeyListener();
    this.addDeathLinkListener();

    this.moveInProgress = Promise.resolve()
  }

  //AP
  queueAction(action) {
    this.moveInProgress = this.moveInProgress
      .catch(() => {})
      .then(() => new Promise(action));

    return this.moveInProgress;
  }

  undo_action(){
    if (!this.enabled || this.scramble !== null || this.deathlinksInProgress > 0 || this.state == ANIMATING) return;
    this.queueAction((resolve) => {
      const lastMove = this.game.moveStack.pop();
      if (!lastMove) {
        resolve();
        return;
      }
      this.state = AnimationState.ANIMATING;
      if(lastMove instanceof RotateMove){
        const moveToApply = lastMove.inverse();
        this.flipAxis = moveToApply.axis;
        this.rotateCube(moveToApply.angle, () => {
          this.state = STILL;
          this.game.storage.saveGame();
          resolve();
        });
      }
      if(lastMove instanceof Move){
        const moveToApply = lastMove.inverse();
        this.flipAxis = moveToApply.axis;
        this.selectLayer(moveToApply.layer);
        this.rotateLayer(moveToApply.angle, false, false, () => {
          // Do NOT add the move to the move stack - we're undoing it!
          this.game.storage.saveGame();
          this.state = STILL;
          this.checkIsSolved();
          resolve();
        });
      }
    });
  }

  moveSide(moveDescriptor, isKeyboardEvent){
    this.queueAction((resolve) => {
      this.state = AnimationState.ANIMATING;
      const move = this.game.scrambler.convertMove(moveDescriptor);

      // Get the layer to rotate
      // Always get the layer corresponding to the global axis, not the local cube orientation
      // Find the world position of the layer by transforming the intended position by the cube's rotation
      // Use the inverse quaternion to transform the move position to global coordinates
      const inverseQuaternion = this.game.cube.object.quaternion.clone().inverse();
      const globalPosition = move.position.clone().applyQuaternion(inverseQuaternion);

      const layer = this.getLayer(globalPosition);

      if( this.flipLayer != null) {
        this.state = STILL;
        console.log("Already flipping, cannot rotate the cube", this.flipLayer);
        resolve();
        return;
      }else{
        console.log("OK")
      }

      // Set the axis to rotate
      this.flipAxis = new THREE.Vector3();

      this.flipAxis[move.axis] = 1;
      this.flipAxis = this.flipAxis.applyQuaternion(inverseQuaternion);
      // Select the layer
      this.selectLayer(layer);
      // Rotate the layer
      this.rotateLayer(move.angle, false, isKeyboardEvent, rotatedLayer => {
        this.game.moveStack.push(new Move(rotatedLayer.slice(), this.flipAxis.clone(), move.angle));
        this.game.storage.saveGame();
        this.state = AnimationState.STILL;
        this.checkIsSolved();
        resolve();
      });
    });
  }

  moveRotation(moveDescriptor){
    this.queueAction((resolve) => {
      const face = moveDescriptor.charAt( 0 );
      const modifier = moveDescriptor.charAt( 1 );
      
      this.state = AnimationState.ANIMATING;
      let axis = face;
      let angle = -Math.PI / 2 * ( ( modifier == "'" ) ? - 1 : 1 );

      if( this.flipLayer != null) {
        this.state = STILL;
        console.log("Already flipping, cannot rotate the cube", this.flipLayer, "tried to rotate around", axis);
        resolve();
        return;
      }

      this.flipAxis = new THREE.Vector3();
      this.flipAxis[axis] = 1;
      this.rotateCube(angle, () => {
        this.game.moveStack.push(new RotateMove(this.flipAxis.clone(), angle));
        this.state = AnimationState.STILL;
        this.game.storage.saveGame();
        resolve();
      });
    });
  }

  async doDeathLink(source, cause) {
    window.dispatchEvent(new MouseEvent("mouseup"));
    const amount_of_moves = parseInt(document.getElementById('deathlink-scramble').value);

    if(document.getElementById('show-deathlinks').checked){
      const note = this.game.dom.texts.note;
      // make display note for 10 seconds
      if(cause){
        note.innerText = cause +'';
      }else{
        note.innerText = source + ' died';
      }
      note.style.opacity = '1';
      setTimeout(() => {
        note.style.opacity = '0';
        note.innerText = 'Double tap to start<br> and show colors';
      }, 3000 + amount_of_moves * 500);
    }
    if (amount_of_moves === 0) {
      return;
    }

    const hasDeathlinkInProgress = this.deathlinkMoves > 0;
    this.deathlinkMoves += amount_of_moves;
    const applyDeathlinkMove = async () => {
      while(!this.enabled || this.scramble !== null){
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const faces = 'UDLRFB';
      const move = faces[ Math.floor( Math.random() * faces.length ) ];
      this.moveSide(move, false);
      this.deathlinkMoves--;
    };

    if (!hasDeathlinkInProgress) {
      this.deathlinksInProgress++;
      while (this.deathlinkMoves > 0) {
        await applyDeathlinkMove();
      }
      this.queueAction((resolve) => {
        this.deathlinksInProgress--;
        this.game.moveStack.clear();
        resolve();
      });
    }
  }
  
  addDeathLinkListener() {
    window.doDeathLink = this.doDeathLink.bind(this);
  }

  addAdditionalKeyListener() {
    document.addEventListener('keydown', event => {
      let eventKey = event.key;

      // Use this to deathlink the layer when P is pressed
      /*if (eventKey === '-') {
        this.doDeathLink("Spineraks", "made too many games");
      }*/
      if (!this.enabled || this.scramble !== null || this.deathlinksInProgress > 0) return;


      if (event.key === 'Backspace') {
        window.dispatchEvent(new MouseEvent("mouseup"));
        this.undo_action();
      }

      let moveDescriptor = '';
      let moveKey = eventKey.toUpperCase();
      // Standard controls
      if (this.controlStyle == 0) {
        if (['L', 'R', 'U', 'D', 'F', 'B'].includes(moveKey)) {
          moveDescriptor = moveKey + (eventKey === eventKey.toUpperCase() ? "'" : "");
        }
      } else if (this.controlStyle == 1) {
        const keymap = { 
          J: "U", F: "U'", S: "D", L: "D'", I: "R", K: "R'", D: "L", E: "L'", H: "F", G: "F'", W: "B", O: "B'",
          T: "x", Y: "x", B: "x'", N: "x'", ";": "y", ":": "y", A: "y'", P: "z", Q: "z'",
        };
        if (moveKey in keymap){
          moveDescriptor = keymap[moveKey];
        }
      }

      // Arrow keys: rotate the cube as a whole
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        switch (event.key) {
          case 'ArrowLeft':
            moveDescriptor = "y";
            break;
          case 'ArrowRight':
            moveDescriptor = "y'";
            break;
          case 'ArrowUp':
            if (event.shiftKey) {
              moveDescriptor = "z'";
            } else {
              moveDescriptor = "x";
            }
            break;
          case 'ArrowDown':
            if (event.shiftKey) {
              moveDescriptor = "z";
            } else {
              moveDescriptor = "x'";
            }
            break;
        }
      }

      // Apply move
      if (moveDescriptor !== '') {
        window.dispatchEvent(new MouseEvent("mouseup"));
        const face = moveDescriptor.charAt( 0 );
        if (['L', 'R', 'U', 'D', 'F', 'B'].includes(face)) {
          this.moveSide(moveDescriptor, true);
        }
        if(['x', 'y', 'z'].includes(face)) {
          this.moveRotation(moveDescriptor);
        }
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

    this.draggable = new Draggable( this.game.dom.game );

    this.draggable.onDragStart = position => {

      if ( this.scramble !== null ) return;
      if ( this.state === AnimationState.PREPARING || this.state === AnimationState.ROTATING || this.deathlinksInProgress > 0  || this.state === ANIMATING) return;

      this.gettingDrag = this.state === AnimationState.ANIMATING;

      const edgeIntersect = this.getIntersect( position.current, this.edges, false );

      if ( edgeIntersect !== false ) {

        this.dragIntersect = this.getIntersect( position.current, this.game.cube.cubes, true );

      }

      if ( edgeIntersect !== false && this.dragIntersect !== false ) {

        this.dragNormal = edgeIntersect.face.normal.round();
        this.flipType = 'layer';

        this.attach( this.helper, this.edges );

        this.helper.rotation.set( 0, 0, 0 );
        this.helper.position.set( 0, 0, 0 );
        this.helper.lookAt( this.dragNormal );
        this.helper.translateZ( 0.5 );
        this.helper.updateMatrixWorld();

        this.detach( this.helper, this.edges );

      } else {

        this.dragNormal = new THREE.Vector3( 0, 0, 1 );
        this.flipType = 'cube';

        this.helper.position.set( 0, 0, 0 );
        this.helper.rotation.set( 0, Math.PI / 4, 0 );
        this.helper.updateMatrixWorld();

      }

      let planeIntersect = this.getIntersect( position.current, this.helper, false );
      if ( planeIntersect === false ) return;

      this.dragCurrent = this.helper.worldToLocal( planeIntersect.point );
      this.dragTotal = new THREE.Vector3();
      this.state = ( this.state === AnimationState.STILL ) ? AnimationState.PREPARING : this.state;

    };

    this.draggable.onDragMove = position => {

      if ( this.scramble !== null ) return;
      if ( this.state === AnimationState.STILL || ( this.state === AnimationState.ANIMATING && this.gettingDrag === false ) || this.deathlinksInProgress > 0 ) return;

      const planeIntersect = this.getIntersect( position.current, this.helper, false );
      if ( planeIntersect === false ) return;

      const point = this.helper.worldToLocal( planeIntersect.point.clone() );

      this.dragDelta = point.clone().sub( this.dragCurrent ).setZ( 0 );
      this.dragTotal.add( this.dragDelta );
      this.dragCurrent = point;
      this.addMomentumPoint( this.dragDelta );

      if ( this.state === AnimationState.PREPARING && this.dragTotal.length() > 0.05 ) {
        
        this.queueAction((resolve) => {
          this.dragResolve = resolve;
        });

        this.dragDirection = this.getMainAxis( this.dragTotal );

        if ( this.flipType === 'layer' ) {

          const direction = new THREE.Vector3();
          direction[ this.dragDirection ] = 1;

          const worldDirection = this.helper.localToWorld( direction ).sub( this.helper.position );
          const objectDirection = this.edges.worldToLocal( worldDirection ).round();

          this.flipAxis = objectDirection.cross( this.dragNormal ).negate();

          this.selectLayer( this.getLayer( false ) );

        } else {

          const axis = ( this.dragDirection != 'x' )
            ? ( ( this.dragDirection == 'y' && position.current.x > this.game.world.width / 2 ) ? 'z' : 'x' )
            : 'y';

          this.flipAxis = new THREE.Vector3();
          this.flipAxis[ axis ] = 1 * ( ( axis == 'x' ) ? - 1 : 1 );

        }

        this.flipAngle = 0;
        this.state = AnimationState.ROTATING;

      } else if ( this.state === AnimationState.ROTATING ) {

        const rotation = this.dragDelta[ this.dragDirection ];

        if ( this.flipType === 'layer' ) { 

          this.group.rotateOnAxis( this.flipAxis, rotation );
          this.flipAngle += rotation;

        } else {

          this.edges.rotateOnWorldAxis( this.flipAxis, rotation );
          this.game.cube.object.rotation.copy( this.edges.rotation );
          this.flipAngle += rotation;

        }

      }

    };

    this.draggable.onDragEnd = position => {

      if ( this.scramble !== null || this.deathlinksInProgress > 0 ) return;
      if ( this.state !== AnimationState.ROTATING ) {

        this.gettingDrag = false;
        this.state = AnimationState.STILL;
        if (this.dragResolve) {
          this.dragResolve();
        }
        return;

      }

      this.state = AnimationState.ANIMATING;

      const momentum = this.getMomentum()[ this.dragDirection ];
      const flip = ( Math.abs( momentum ) > 0.05 && Math.abs( this.flipAngle ) < Math.PI / 2 );

      const angle = flip
        ? this.roundAngle( this.flipAngle + Math.sign( this.flipAngle ) * ( Math.PI / 4 ) )
        : this.roundAngle( this.flipAngle );

      const delta = angle - this.flipAngle;

      if ( this.flipType === 'layer' ) {

        this.rotateLayer( delta, false, false, rotatedLayer => {
          // If the angle is too small, it means no rotation was applied. We ignore it.
          // 360 degrees rotation would AnimationState.STILL be possible, even if they don't do anything.
          // This is probably preferable in terms of UX.
          if (Math.abs(angle) > 1.5) {
            this.game.moveStack.push(new Move(rotatedLayer.slice(), this.flipAxis.clone(), angle));
          }
          this.game.storage.saveGame();
          
          this.state = this.gettingDrag ? AnimationState.PREPARING : AnimationState.STILL;
          this.gettingDrag = false;

          this.checkIsSolved();
          if (this.dragResolve) {
            this.dragResolve();
          }

        } );

      } else {

        this.rotateCube( delta, () => {

          this.state = this.gettingDrag ? AnimationState.PREPARING : AnimationState.STILL;
          this.gettingDrag = false;
          this.game.storage.saveGame();
          if (this.dragResolve) {
            this.dragResolve();
          }
        } );

      }

    };

  }

  /**
   * @param {number} rotation - Target angle of rotation.
   * This is used for the animation: this allows a layer to be in a partially turned position when its dragged with the mouse.
   * @param {boolean} scramble - True if the cube is being scrambled.
   * @param {boolean} isKeyboardEvent - True if the rotation was triggered by a keyboard input
   * @param {onRotateCompleteCallback} callback - Callback to call once the animation is complete.
   */
  rotateLayer(rotation, scramble, isKeyboardEvent, callback) {

    const layerSnapshot = this.flipLayer ? this.flipLayer.slice() : null;

    const config = scramble ? 0 : this.flipConfig;
    const easing = this.flipEasings[config];
    const duration = isKeyboardEvent ? this.flipSpeeds[config] / 3 : this.flipSpeeds[config];
    const bounce = (config == 2) ? this.bounceCube() : (() => {});

    this.rotationTween = new Tween({

      easing,
      duration,

      onUpdate: tween => {
        const deltaAngle = tween.delta * rotation;
        this.group.rotateOnAxis(this.flipAxis, deltaAngle);
        bounce(tween.value, deltaAngle, rotation);
      },

      onComplete: () => {

        if (!scramble) this.onMove();

        if (layerSnapshot) {

          this.game.cube.object.rotation.setFromVector3(
            this.snapRotation(this.game.cube.object.rotation.toVector3())
          );

          this.group.rotation.setFromVector3(
            this.snapRotation(this.group.rotation.toVector3())
          );

          this.deselectLayer(layerSnapshot);
        }

        callback(layerSnapshot);

      }
    });
  }

  bounceCube() {

    let fixDelta = true;

    return ( progress, delta, rotation ) => {

        if ( progress >= 1 ) {

          if ( fixDelta ) {

            delta = ( progress - 1 ) * rotation;
            fixDelta = false;

          }

          this.game.cube.object.rotateOnAxis( this.flipAxis, delta );

        }

    }

  }

  rotateCube( rotation, callback ) {

    const config = this.flipConfig;
    const easing = [ Easing.Power.Out( 4 ), Easing.Sine.Out(), Easing.Back.Out( 2 ) ][ config ];
    const duration = [ 100, 150, 350 ][ config ];

    this.rotationTween = new Tween( {
      easing: easing,
      duration: duration,
      onUpdate: tween => {

        this.edges.rotateOnWorldAxis( this.flipAxis, tween.delta * rotation );
        this.game.cube.object.rotation.copy( this.edges.rotation );

      },
      onComplete: () => {

        this.edges.rotation.setFromVector3( this.snapRotation( this.edges.rotation.toVector3() ) );
        this.game.cube.object.rotation.copy( this.edges.rotation );
        callback();

      },
    } );

  }

  selectLayer( layer ) {

    this.group.rotation.set( 0, 0, 0 );
    this.movePieces( layer, this.game.cube.object, this.group );
    this.flipLayer = layer;

  }

  deselectLayer( layer ) {

    this.movePieces( layer, this.group, this.game.cube.object );
    this.flipLayer = null;

  }

  movePieces( layer, from, to ) {

    from.updateMatrixWorld();
    to.updateMatrixWorld();

    layer.forEach( index => {

      const piece = this.game.cube.pieces[ index ];

      piece.applyMatrix( from.matrixWorld );
      from.remove( piece );
      piece.applyMatrix( new THREE.Matrix4().getInverse( to.matrixWorld ) );
      to.add( piece );

    } );

  }

  getLayer( position ) {

    const scalar = { 2: 6, 3: 3, 4: 4, 5: 3 }[ this.game.cube.size ];
    const layer = [];

    let axis;

    if ( position === false ) {

      const piece = this.dragIntersect.object.parent;

      axis = this.getMainAxis( this.flipAxis );
      position = piece.position.clone() .multiplyScalar( scalar ) .round();

    } else {

      axis = this.getMainAxis( position );

    }

    this.game.cube.pieces.forEach( piece => {

      const piecePosition = piece.position.clone().multiplyScalar( scalar ).round();

      if ( piecePosition[ axis ] == position[ axis ] ) layer.push( piece.name );

    } );

    return layer;

  }

  scrambleCube() {

    if ( this.scramble == null ) {

      this.scramble = this.game.scrambler;
      this.scramble.callback = ( typeof callback !== 'function' ) ? () => {} : callback;

    }

    const converted = this.scramble.converted;
    const move = converted[ 0 ];
    const layer = this.getLayer( move.position );

    this.flipAxis = new THREE.Vector3();
    this.flipAxis[ move.axis ] = 1;

    this.selectLayer( layer );
    this.rotateLayer( move.angle, true, false, () => {

      converted.shift();

      if ( converted.length > 0 ) {

        this.scrambleCube();

      } else {

        this.scramble = null;
        this.game.cube.updateColors(this.game.themes.getColors(), this.game.sidePermutation);
        this.game.storage.saveGame();
      }

    } );

  }

  getIntersect( position, object, multiple ) {

    this.raycaster.setFromCamera(
      this.draggable.convertPosition( position.clone() ),
      this.game.world.camera
    );

    const intersect = ( multiple )
      ? this.raycaster.intersectObjects( object )
      : this.raycaster.intersectObject( object );

    return ( intersect.length > 0 ) ? intersect[ 0 ] : false;

  }

  getMainAxis( vector ) {

    return Object.keys( vector ).reduce(
      ( a, b ) => Math.abs( vector[ a ] ) > Math.abs( vector[ b ] ) ? a : b
    );

  }

  detach( child, parent ) {

    child.applyMatrix( parent.matrixWorld );
    parent.remove( child );
    this.game.world.scene.add( child );

  }

  attach( child, parent ) {

    child.applyMatrix( new THREE.Matrix4().getInverse( parent.matrixWorld ) );
    this.game.world.scene.remove( child );
    parent.add( child );

  }

  addMomentumPoint( delta ) {

    const time = Date.now();

    this.momentum = this.momentum.filter( moment => time - moment.time < 500 );

    if ( delta !== false ) this.momentum.push( { delta, time } );

  }

  getMomentum() {

    const points = this.momentum.length;
    const momentum = new THREE.Vector2();

    this.addMomentumPoint( false );

    this.momentum.forEach( ( point, index ) => {

      momentum.add( point.delta.multiplyScalar( index / points ) );

    } );

    return momentum;

  }

  roundAngle( angle ) {

    const round = Math.PI / 2;
    return Math.sign( angle ) * Math.round( Math.abs( angle) / round ) * round;

  }

  snapRotation( angle ) {

    return angle.set(
      this.roundAngle( angle.x ),
      this.roundAngle( angle.y ),
      this.roundAngle( angle.z )
    );

  }

  //AP
  checkIsSolved() {
    if (this.game.state !== GAME_STATE.Playing && this.game.state !== GAME_STATE.Complete){
      return;
    }
    const sides = { 'x-': [], 'x+': [], 'y-': [], 'y+': [], 'z-': [], 'z+': [] };

    this.game.cube.edges.forEach( edge => {

      const position = edge.parent
        .localToWorld( edge.position.clone() )
        .sub( this.game.cube.object.position );

      const mainAxis = this.getMainAxis( position );
      const mainSign = position.multiplyScalar( 2 ).round()[ mainAxis ] < 1 ? '-' : '+';
      sides[ mainAxis + mainSign ].push(edge.userData);

    } );

    let maxPossible = 0;
    let isSolved = true;
    let maxColorsPerSide = {}
    let maxSidesPerColor = {}

    for (const side in sides) 
    {
      if (sides[side].length === 0) {
        continue;
      }
      const firstColor = sides[side][0].color;
      let isAllSameColor = true;
      let colorCounts = {};
      for (const sticker of sides[side]) {
        if (sticker.color !== firstColor) {
          isAllSameColor = false;
        }
        if (!sticker.locked) {
          maxPossible++;
          colorCounts[sticker.color] = (colorCounts[sticker.color] ?? 0) + 1;
        }
      }
      if (!isAllSameColor) {
        isSolved = false;
      }
      
      let maxCount = 0;
      let maxColors = [];

      for (const color in colorCounts) {
        const count = colorCounts[color];
        if (count > maxCount) {
          maxColors = [color];
          maxCount = count;
        }
        else if (count === maxCount) {
          maxColors.push(color);
        }

        if (!(color in maxSidesPerColor)) {
          maxSidesPerColor[color] = {
            score: 0,
            sides: []
          }
        }

        if (count > maxSidesPerColor[color].score) {
          maxSidesPerColor[color] = {
            score: count,
            sides: [side]
          }
        }
        else if (count === maxSidesPerColor[color].score) {
          maxSidesPerColor[color].sides.push(side)
        }
      }
      maxColorsPerSide[side] = {
        score: maxCount,
        colors: maxColors
      }
    }

    let score = 0;
    for (const color in maxSidesPerColor) {
      const maxSides = maxSidesPerColor[color];
      if (maxSides.sides.length !== 1) {
        continue;
      }

      const side = maxSides.sides[0];
      const maxColors = maxColorsPerSide[side];
      if (maxColors.colors.length === 1 && maxColors.colors[0] === color) {
        score += maxSides.score;
      }
    }
    window.highScore = Math.max(window.highScore, score);
    this.game.dom.texts.correctness.innerHTML = `${score}/${maxPossible} correct`;
    this.game.dom.texts.correctness2.innerHTML = `High score: ${window.highScore}`;
    if (isSolved && this.game.numberStickersToGoalOnSolve <= score && this.game.state === GAME_STATE.Playing) {
      this.onSolved();
    }

    window.submitScore(window.highScore);

    if (window.highScore === this.game.totalStickers) {
      this.game.storage.clearGame();
    }
  }

}
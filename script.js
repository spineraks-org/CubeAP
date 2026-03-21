import { loadGraphics } from "./src/graphics/GraphicLoader.js";
import Game from "./src/game/Game.js";
import GAME_STATE from "./src/game/GameState.js";

window.addEventListener( 'touchmove', () => {} );
document.addEventListener( 'touchmove',  event => { event.preventDefault(); }, { passive: false } );

loadGraphics();


window.version = '0.99.2';

function unlockSticker(sticker){
  if(!sticker) return;
  console.log("Unlocking sticker: ", sticker);

  const sides = { 'x-': [], 'x+': [], 'y-': [], 'y+': [], 'z-': [], 'z+': [] };

  window.game.cube.edges.forEach( edge => {

    const position = edge.parent
      .localToWorld( edge.position.clone() )
      .sub( window.game.cube.object.position );

    const mainAxis = window.game.controls.getMainAxis( position );
    const mainSign = position.multiplyScalar( 2 ).round()[ mainAxis ] < 1 ? '-' : '+';
    sides[ mainAxis + mainSign ].push(edge);

  } ); 
  const stickerName = sticker[0];
  const sideIndex = sticker[1] - 1;

  const sideKeys = Object.keys(sides);
  let changed = false;
  for (let i = 0; i < sideKeys.length; i++) {
    const side = sideKeys[i];
    if (sides[side].length === 0) continue;
    for (let j = 0; j < sides[side].length; j++) {
      const sticker = sides[side][j];
      if (sticker.userData.color === stickerName && sticker.userData.colorIndex === sideIndex) {
        sticker.userData.locked = false;
        changed = true;
        break;
      }
    }
    if (changed) break;
  }
  if(!changed) {
    console.warn('Could not find sticker to change', sticker);
    return;
  }
  this.game.cube.updateColors(this.game.themes.getColors(), this.game.sidePermutation);
  this.game.controls.checkIsSolved();
}

function submitScore(counts){
  if (this.game.state === GAME_STATE.Playing || this.game.state === GAME_STATE.Complete) {
    window.findAndDetermineChecks(counts);
  }
}

/**
 * Start a game
 *
 * @param {GameOptions} gameOptions options
 * @param {number|undefined} seed Randomizer seed
 * @param {string|undefined} apId Identifier for the AP
 */
function startGame(gameOptions, seed, apId) {
  console.log(gameOptions)
  console.log("Starting game!");
  window.highScore = 0;
  window.lastCorrectSent = 0;
  window.deathlinksInProgress = false;
  window.game = new Game(gameOptions, seed, apId);

  // Disable the standard right-click context menu on the whole document
  document.addEventListener('contextmenu', function(event) {
    event.preventDefault();
  });

  // Add an event listener for right-click (contextmenu) on the cube area
  window.game.dom.game.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    if (window.game.state !== GAME_STATE.Playing) {
      return;
    }
    // Get mouse position
    const clickEvent = event.touches
      ? (event.touches[0] || event.changedTouches[0])
      : event;
    const clickPosition = new THREE.Vector2(clickEvent.pageX, clickEvent.pageY);

    // Try to intersect with edges first (stickers)
    let edgeIntersect = window.game.controls.getIntersect(clickPosition, window.game.cube.edges, true);
    if (edgeIntersect !== false) {
      // change the third letter of the name to F
      const sides = [null, 'F', 'R', 'B', 'L', 'U', 'D'];
      const currentIndex = sides.indexOf(edgeIntersect.object.userData.mark);
      const nextIndex = (currentIndex + 1) % sides.length;
      edgeIntersect.object.userData.mark = sides[nextIndex];
      window.game.cube.updateColors(window.game.themes.getColors(), window.game.sidePermutation);
      window.game.storage.saveGame();
      return;
    }

    // If nothing found
    console.log('No square found at this position.');
  });

}
window.startGame = startGame;
window.unlockSticker = unlockSticker;
window.submitScore = submitScore;

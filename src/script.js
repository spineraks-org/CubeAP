import IconsLoader from './graphics/IconsLoader.js';
import Game from './game/Game.js';

window.addEventListener('touchmove', () => {});
document.addEventListener(
    'touchmove',
    (event) => {
        event.preventDefault();
    },
    { passive: false },
);

IconsLoader.loadIcon();

const RangeHTML = [
    '<div class="range">',
    '<div class="range__label"></div>',
    '<div class="range__track">',
    '<div class="range__track-line"></div>',
    '<div class="range__handle"><div></div></div>',
    '</div>',
    '<div class="range__list"></div>',
    '</div>',
].join('\n');

document.querySelectorAll('range').forEach((el) => {
    const temp = document.createElement('div');
    temp.innerHTML = RangeHTML;

    const range = temp.querySelector('.range');
    const rangeLabel = range.querySelector('.range__label');
    const rangeList = range.querySelector('.range__list');

    range.setAttribute('name', el.getAttribute('name'));
    rangeLabel.innerHTML = el.getAttribute('title');

    if (el.hasAttribute('color')) {
        range.classList.add('range--type-color');
        range.classList.add('range--color-' + el.getAttribute('name'));
    }

    if (el.hasAttribute('list')) {
        el.getAttribute('list')
            .split(',')
            .forEach((listItemText) => {
                const listItem = document.createElement('div');
                listItem.innerHTML = listItemText;
                rangeList.appendChild(listItem);
            });
    }

    el.parentNode.replaceChild(range, el);
});

window.version = '0.99.2';

function unlockSticker(sticker) {
    if (!sticker) return;
    console.log('Unlocking sticker: ', sticker);

    const sides = { 'x-': [], 'x+': [], 'y-': [], 'y+': [], 'z-': [], 'z+': [] };

    window.game.cube.edges.forEach((edge) => {
        const position = edge.parent.localToWorld(edge.position.clone()).sub(window.game.cube.object.position);

        const mainAxis = window.game.controls.getMainAxis(position);
        const mainSign = position.multiplyScalar(2).round()[mainAxis] < 1 ? '-' : '+';

        sides[mainAxis + mainSign].push(edge);
    });

    const wantedSide = sticker[0];
    const wantedNumber = sticker[1] + '';

    const sideKeys = Object.keys(sides);
    let changed = false;
    for (let i = 0; i < sideKeys.length; i++) {
        const side = sideKeys[i];
        if (sides[side].length === 0) continue;
        for (let j = 0; j < sides[side].length; j++) {
            const sticker = sides[side][j];
            if (sticker.name.charAt(0) === wantedSide && sticker.name.slice(4) === wantedNumber) {
                // Change this sticker to the most common color on this side
                sticker.name = sticker.name.charAt(0) + 'O' + 'X' + sticker.name.slice(3);
                changed = true;
                break;
            }
        }
        if (changed) break;
    }
    if (!changed) {
        console.warn('Could not find sticker to change', sticker);
        return;
    }
    this.game.cube.updateColors(this.game.themes.getColors(), this.game.sidePermutation);
    this.game.controls.checkIsSolved();
}

function submitScore(counts) {
    if (window.doneScramble) {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        console.log('Submitting score: ', counts, total);
        window.findAndDetermineChecks(total);
    }
}

window.unlockSticker = unlockSticker;
window.submitScore = submitScore;

/**
 * Start a game
 *
 * @param {number} size Dimensions of the cube
 * @param {Object.<string, string>} sidePermutation Object that maps each side of the cube to a different side to permute the colors.
 */
function startGame(size, sidePermutation) {
    console.log('Starting game!');
    window.doneScramble = false;
    window.game = new Game(size, sidePermutation);

    // Disable the standard right-click context menu on the whole document
    document.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    });

    // Add an event listener for right-click (contextmenu) on the cube area
    window.game.dom.game.addEventListener('contextmenu', function (event) {
        event.preventDefault();
        // Get mouse position
        const clickEvent = event.touches ? event.touches[0] || event.changedTouches[0] : event;
        const clickPosition = new THREE.Vector2(clickEvent.pageX, clickEvent.pageY);

        // Try to intersect with edges first (stickers)
        let edgeIntersect = window.game.controls.getIntersect(clickPosition, window.game.cube.edges, true);
        if (edgeIntersect !== false) {
            // change the third letter of the name to F
            const sides = ['X', 'F', 'R', 'B', 'L', 'U', 'D'];
            const currentIndex = sides.indexOf(edgeIntersect.object.name.charAt(2));
            const nextIndex = (currentIndex + 1) % sides.length;
            edgeIntersect.object.name =
                edgeIntersect.object.name.slice(0, 2) + sides[nextIndex] + edgeIntersect.object.name.slice(3);
            // call this.game.cube.updateColors(this.game.themes.getColors());
            window.game.cube.updateColors(window.game.themes.getColors(), window.game.sidePermutation);
            return;
        }

        // // If not a sticker, try to intersect with cube pieces
        // let pieceIntersect = window.game.controls.getIntersect(clickPosition, window.game.cube.cubes, true);
        // if (pieceIntersect !== false) {
        //   console.log('Piece name:', pieceIntersect.object.name);
        //   return;
        // }

        // If nothing found
        console.log('No square found at this position.');
    });
}
window.startGame = startGame;

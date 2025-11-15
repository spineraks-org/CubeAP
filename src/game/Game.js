import Preferences from '../options/Preferences.js';
import Scores from '../options/Scores.js';
import ThemeEditor from '../options/ThemeEditor.js';
import Themes from '../options/Themes.js';
import Timer from '../graphics/animation/Timer.js';
import World from '../graphics/animation/World.js';
import Confetti from '../graphics/Confetti.js';
import Transition from '../graphics/Transition.js';
import Controls from '../controls/Controls.js';
import Cube from '../cube/Cube.js';
import Scrambler from '../cube/Scrambler.js';
import MoveStack from './MoveStack.js';
import Storage from './Storage.js';

const CUBE_STATES = {
    3: {
        checkerboard: {
            names: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
            positions: [
                { x: 1 / 3, y: -1 / 3, z: 1 / 3 },
                { x: -1 / 3, y: 1 / 3, z: 0 },
                { x: 1 / 3, y: -1 / 3, z: -1 / 3 },
                { x: -1 / 3, y: 0, z: -1 / 3 },
                { x: 1 / 3, y: 0, z: 0 },
                { x: -1 / 3, y: 0, z: 1 / 3 },
                { x: 1 / 3, y: 1 / 3, z: 1 / 3 },
                { x: -1 / 3, y: -1 / 3, z: 0 },
                { x: 1 / 3, y: 1 / 3, z: -1 / 3 },
                { x: 0, y: 1 / 3, z: -1 / 3 },
                { x: 0, y: -1 / 3, z: 0 },
                { x: 0, y: 1 / 3, z: 1 / 3 },
                { x: 0, y: 0, z: 1 / 3 },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: -1 / 3 },
                { x: 0, y: -1 / 3, z: -1 / 3 },
                { x: 0, y: 1 / 3, z: 0 },
                { x: 0, y: -1 / 3, z: 1 / 3 },
                { x: -1 / 3, y: -1 / 3, z: 1 / 3 },
                { x: 1 / 3, y: 1 / 3, z: 0 },
                { x: -1 / 3, y: -1 / 3, z: -1 / 3 },
                { x: 1 / 3, y: 0, z: -1 / 3 },
                { x: -1 / 3, y: 0, z: 0 },
                { x: 1 / 3, y: 0, z: 1 / 3 },
                { x: -1 / 3, y: 1 / 3, z: 1 / 3 },
                { x: 1 / 3, y: -1 / 3, z: 0 },
                { x: -1 / 3, y: 1 / 3, z: -1 / 3 },
            ],
            rotations: [
                { x: -Math.PI, y: 0, z: Math.PI },
                { x: Math.PI, y: 0, z: 0 },
                { x: -Math.PI, y: 0, z: Math.PI },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: Math.PI },
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI, y: 0, z: Math.PI },
                { x: Math.PI, y: 0, z: 0 },
                { x: -Math.PI, y: 0, z: Math.PI },
                { x: 0, y: 0, z: Math.PI },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: Math.PI },
                { x: -Math.PI, y: 0, z: 0 },
                { x: Math.PI, y: 0, z: Math.PI },
                { x: Math.PI, y: 0, z: 0 },
                { x: 0, y: 0, z: Math.PI },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: Math.PI },
                { x: Math.PI, y: 0, z: Math.PI },
                { x: -Math.PI, y: 0, z: 0 },
                { x: Math.PI, y: 0, z: Math.PI },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: Math.PI },
                { x: 0, y: 0, z: 0 },
                { x: Math.PI, y: 0, z: Math.PI },
                { x: -Math.PI, y: 0, z: 0 },
                { x: Math.PI, y: 0, z: Math.PI },
            ],
            size: 3,
        },
    },
};

const GAME_STATE = {
    Menu: 0,
    Playing: 1,
    Complete: 2,
    Stats: 3,
    Prefs: 4,
    Theme: 5,
};

const BUTTONS_FOR_STATE = {
    Menu: ['stats', 'prefs'],
    Playing: ['back'],
    Complete: [],
    Stats: [],
    Prefs: ['back', 'theme'],
    Theme: ['back', 'reset'],
    None: [],
};

const DISPLAY_STATE = {
    Show: true,
    Hide: false,
};

export default class Game {
    /**
     * @param {number} size Dimensions of the cube
     * @param {Object.<string, string>} sidePermutation Object that maps each side of the cube to a different side to permute the colors.
     */
    constructor(size, sidePermutation) {
        this.dom = {
            ui: document.querySelector('.ui'),
            game: document.querySelector('.ui__game'),
            back: document.querySelector('.ui__background'),
            prefs: document.querySelector('.ui__prefs'),
            theme: document.querySelector('.ui__theme'),
            stats: document.querySelector('.ui__stats'),
            texts: {
                title: document.querySelector('.text--title'),
                note: document.querySelector('.text--note'),
                timer: document.querySelector('.text--timer'),
                correctness: document.querySelector('.text--correctness'),
                correctness2: document.querySelector('.text--correctness2'),
                complete: document.querySelector('.text--complete'),
                best: document.querySelector('.text--best-time'),
                theme: document.querySelector('.text--theme'),
            },
            buttons: {
                prefs: document.querySelector('.btn--prefs'),
                back: document.querySelector('.btn--back'),
                stats: document.querySelector('.btn--stats'),
                reset: document.querySelector('.btn--reset'),
                theme: document.querySelector('.btn--theme'),
            },
        };

        this.world = new World(this);
        this.cube = new Cube(this);
        this.controls = new Controls(this);
        this.moveStack = new MoveStack();
        this.scrambler = new Scrambler(this);
        this.transition = new Transition(this);
        this.timer = new Timer(this);
        this.preferences = new Preferences(this);
        this.scores = new Scores(this);
        this.storage = new Storage(this);
        this.confetti = new Confetti(this);
        this.themes = new Themes(this);
        this.themeEditor = new ThemeEditor(this);
        /**
         * @type {Object.<string, string>}
         */
        this.sidePermutation = sidePermutation;

        this.initActions();

        this.state = GAME_STATE.Menu;
        this.newGame = false;
        this.saved = false;

        this.storage.init(size);
        this.preferences.init();
        this.cube.init();
        this.transition.init();

        this.storage.loadGame();
        this.scores.calcStats();

        setTimeout(() => {
            this.transition.float();
            this.transition.cube(DISPLAY_STATE.Show);

            setTimeout(() => this.transition.title(DISPLAY_STATE.Show), 700);
            setTimeout(() => this.transition.buttons(BUTTONS_FOR_STATE.Menu, BUTTONS_FOR_STATE.None), 1000);
        }, 500);
    }

    initActions() {
        let tappedTwice = false;

        this.dom.game.addEventListener(
            'click',
            (event) => {
                if (this.transition.activeTransitions > 0) return;
                if (this.state === GAME_STATE.Playing) return;

                if (this.state === GAME_STATE.Menu) {
                    if (!tappedTwice) {
                        tappedTwice = true;
                        setTimeout(() => (tappedTwice = false), 300);
                        return false;
                    }

                    this.game(DISPLAY_STATE.Show);
                } else if (this.state === GAME_STATE.Complete) {
                    this.complete(DISPLAY_STATE.Hide);
                } else if (this.state === GAME_STATE.Stats) {
                    this.stats(DISPLAY_STATE.Hide);
                }
            },
            false,
        );

        this.controls.onMove = () => {
            if (this.newGame) {
                this.timer.start(true);
                this.newGame = false;
            }
        };

        this.dom.buttons.back.onclick = (event) => {
            // if ( this.transition.activeTransitions > 0 ) return;

            // if ( this.state === STATE.Playing ) {

            //   this.game( DISPLAY_STATE.Hide );

            // } else

            if (this.state === GAME_STATE.Prefs) {
                this.prefs(DISPLAY_STATE.Hide);
            } else {
                this.controls.undo_action();
            }

            //else if ( this.state === STATE.Theme ) {

            //   this.theme( DISPLAY_STATE.Hide );

            // }
        };

        this.dom.buttons.reset.onclick = (event) => {
            if (this.state === GAME_STATE.Theme) {
                this.themeEditor.resetTheme();
            }
        };

        this.dom.buttons.prefs.onclick = (event) => this.prefs(DISPLAY_STATE.Show);

        // this.dom.buttons.theme.onclick = event => this.theme( DISPLAY_STATE.Show );

        this.dom.buttons.stats.onclick = (event) => this.stats(DISPLAY_STATE.Show);

        this.controls.onSolved = () => {
            this.complete(DISPLAY_STATE.Show);
            window.sendGoal();
        };
    }

    game(show) {
        if (show) {
            if (!this.saved) {
                this.scrambler.scramble();
                this.controls.scrambleCube();
                this.newGame = true;
            }

            const duration = this.saved ? 0 : this.scrambler.converted.length * (this.controls.flipSpeeds[0] + 10);

            this.state = GAME_STATE.Playing;
            this.saved = true;

            this.transition.buttons(BUTTONS_FOR_STATE.None, BUTTONS_FOR_STATE.Menu);

            this.transition.zoom(GAME_STATE.Playing, duration);
            this.transition.title(DISPLAY_STATE.Hide);

            setTimeout(() => {
                this.transition.timer(DISPLAY_STATE.Show);
                this.transition.buttons(BUTTONS_FOR_STATE.Playing, BUTTONS_FOR_STATE.None);
            }, this.transition.durations.zoom - 1000);

            setTimeout(() => {
                this.controls.enable();
                if (!this.newGame) this.timer.start(true);
                this.controls.checkIsSolved();
            }, this.transition.durations.zoom);
        } else {
            this.state = GAME_STATE.Menu;

            this.transition.buttons(BUTTONS_FOR_STATE.Menu, BUTTONS_FOR_STATE.Playing);

            this.transition.zoom(GAME_STATE.Menu, 0);

            this.controls.disable();
            if (!this.newGame) this.timer.stop();
            this.transition.timer(DISPLAY_STATE.Hide);

            setTimeout(() => this.transition.title(DISPLAY_STATE.Show), this.transition.durations.zoom - 1000);

            this.playing = false;
            this.controls.disable();
        }
    }

    prefs(show) {
        if (show) {
            if (this.transition.activeTransitions > 0) return;

            this.state = GAME_STATE.Prefs;

            this.transition.buttons(BUTTONS_FOR_STATE.Prefs, BUTTONS_FOR_STATE.Menu);

            this.transition.title(DISPLAY_STATE.Hide);
            this.transition.cube(DISPLAY_STATE.Hide);

            setTimeout(() => this.transition.preferences(DISPLAY_STATE.Show), 1000);
        } else {
            this.cube.resize();

            this.state = GAME_STATE.Menu;

            this.transition.buttons(BUTTONS_FOR_STATE.Menu, BUTTONS_FOR_STATE.Prefs);

            this.transition.preferences(DISPLAY_STATE.Hide);

            setTimeout(() => this.transition.cube(DISPLAY_STATE.Show), 500);
            setTimeout(() => this.transition.title(DISPLAY_STATE.Show), 1200);
        }
    }

    theme(show) {
        this.themeEditor.colorPicker(show);

        if (show) {
            if (this.transition.activeTransitions > 0) return;

            this.cube.loadFromData(CUBE_STATES['3']['checkerboard']);

            this.themeEditor.setHSL(null, false);

            this.state = GAME_STATE.Theme;

            this.transition.buttons(BUTTONS_FOR_STATE.Theme, BUTTONS_FOR_STATE.Prefs);

            this.transition.preferences(DISPLAY_STATE.Hide);

            setTimeout(() => this.transition.cube(DISPLAY_STATE.Show, true), 500);
            setTimeout(() => this.transition.theming(DISPLAY_STATE.Show), 1000);
        } else {
            this.state = GAME_STATE.Prefs;

            this.transition.buttons(BUTTONS_FOR_STATE.Prefs, BUTTONS_FOR_STATE.Theme);

            this.transition.cube(DISPLAY_STATE.Hide, true);
            this.transition.theming(DISPLAY_STATE.Hide);

            setTimeout(() => this.transition.preferences(DISPLAY_STATE.Show), 1000);
            setTimeout(() => {
                const gameCubeData = JSON.parse(localStorage.getItem('theCube_savedState'));

                if (!gameCubeData) {
                    this.cube.resize(true);
                    return;
                }

                this.cube.loadFromData(gameCubeData);
            }, 1500);
        }
    }

    stats(show) {
        if (show) {
            if (this.transition.activeTransitions > 0) return;

            this.state = GAME_STATE.Stats;

            this.transition.buttons(BUTTONS_FOR_STATE.Stats, BUTTONS_FOR_STATE.Menu);

            this.transition.title(DISPLAY_STATE.Hide);
            this.transition.cube(DISPLAY_STATE.Hide);

            setTimeout(() => this.transition.stats(DISPLAY_STATE.Show), 1000);
        } else {
            this.state = GAME_STATE.Menu;

            this.transition.buttons(BUTTONS_FOR_STATE.Menu, BUTTONS_FOR_STATE.None);

            this.transition.stats(DISPLAY_STATE.Hide);

            setTimeout(() => this.transition.cube(DISPLAY_STATE.Show), 500);
            setTimeout(() => this.transition.title(DISPLAY_STATE.Show), 1200);
        }
    }

    complete(show) {
        if (show) {
            this.transition.buttons(BUTTONS_FOR_STATE.Complete, BUTTONS_FOR_STATE.Playing);

            this.state = GAME_STATE.Complete;
            this.saved = false;

            this.controls.disable();
            this.timer.stop();
            this.storage.clearGame();

            this.bestTime = this.scores.addScore(this.timer.deltaTime);

            this.transition.zoom(GAME_STATE.Menu, 0);
            this.transition.elevate(DISPLAY_STATE.Show);

            setTimeout(() => {
                this.transition.complete(DISPLAY_STATE.Show, this.bestTime);
                this.confetti.start();
            }, 1000);
        } else {
            this.state = GAME_STATE.Stats;
            this.saved = false;

            this.transition.timer(DISPLAY_STATE.Hide);
            this.transition.complete(DISPLAY_STATE.Hide, this.bestTime);
            this.transition.cube(DISPLAY_STATE.Hide);
            this.timer.reset();

            setTimeout(() => {
                this.cube.reset();
                this.confetti.stop();

                this.transition.stats(DISPLAY_STATE.Show);
                this.transition.elevate(0);
            }, 1000);

            return false;
        }
    }
}

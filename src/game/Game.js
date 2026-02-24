import Controls from "./Controls.js";
import Cube from "./Cube.js";
import MoveStack from "./MoveStack.js";
import Scrambler from "./Scrambler.js";
import Storage from "./Storage.js";
import Transition from "./Transition.js";

import GAME_STATE from "./GameState.js";
import PREDEFINED_CUBE_STATE from "./PredefinedCubeStates.js";

import Confetti from "../animation/Confetti.js";
import Timer from "../animation/Timer.js";
import World from "../animation/World.js";

import ThemeEditor from "../graphics/ThemeEditor.js";
import Themes from "../graphics/Themes.js";

import Preferences from "../graphics/menus/Preferences.js";
import Scores from "../graphics/menus/Scores.js";

const DISPLAY = {
  Show: true,
  Hide: false
}

const BUTTONS = {
  Menu: [ 'stats', 'prefs' ],
  Playing: [ 'back' ],
  Complete: [],
  Stats: [],
  Prefs: [ 'back', 'theme' ],
  Theme: [ 'back', 'reset' ],
  None: [],
};

export default class Game {

/**
 * @param {GameOptions} gameOptions Options for the game
 * @param {string|null} apId ID for the AP session
 */
  constructor(gameOptions, seed = null, apId = null) {

    this.dom = {
      ui: document.querySelector( '.ui' ),
      game: document.querySelector( '.ui__game' ),
      back: document.querySelector( '.ui__background' ),
      prefs: document.querySelector( '.ui__prefs' ),
      theme: document.querySelector( '.ui__theme' ),
      stats: document.querySelector( '.ui__stats' ),
      texts: {
        title: document.querySelector( '.text--title' ),
        note: document.querySelector( '.text--note' ),
        timer: document.querySelector( '.text--timer' ),
        correctness: document.querySelector( '.text--correctness' ),
        correctness2: document.querySelector( '.text--correctness2' ),
        complete: document.querySelector( '.text--complete' ),
        best: document.querySelector( '.text--best-time' ),
        theme: document.querySelector( '.text--theme' ),
      },
      buttons: {
        prefs: document.querySelector( '.btn--prefs' ),
        back: document.querySelector( '.btn--back' ),
        stats: document.querySelector( '.btn--stats' ),
        reset: document.querySelector( '.btn--reset' ),
        theme: document.querySelector( '.btn--theme' ),
      },
    };

    this.world = new World( this );
    this.cube = new Cube( this );
    this.controls = new Controls( this );
    this.moveStack = new MoveStack();
    this.scrambler = new Scrambler( this );
    this.transition = new Transition( this );
    this.timer = new Timer( this );
    this.preferences = new Preferences( this );
    this.scores = new Scores( this );
    this.storage = new Storage( this );
    this.confetti = new Confetti( this );
    this.themes = new Themes( this );
    this.themeEditor = new ThemeEditor( this );
    /**
     * @type {Object.<string, string>}
     */
    this.sidePermutation = gameOptions.sidePermutation ?? {
      'U': 'U',
      'D': 'D',
      'L': 'L',
      'R': 'R',
      'F': 'F',
      'B': 'B'
    };
    this.isLayoutRandomized = gameOptions.sidePermutation !== null;
    this.numberStickersToGoalOnSolve = gameOptions.numberStickersToGoalOnSolve;
    this.totalStickers = gameOptions.totalStickers;

    this.initActions();

    this.state = GAME_STATE.Menu;
    this.newGame = false;
    this.saved = false;

    this.storage.init(gameOptions.size);
    this.apId = apId;
    this.seed = seed;
    this.preferences.init();
    this.cube.init();
    this.transition.init();

    this.storage.loadGame();
    this.scores.calcStats();

    setTimeout( () => {

      this.transition.float();
      this.transition.cube( DISPLAY.Show );

      setTimeout( () => this.transition.title( DISPLAY.Show ), 700 );
      setTimeout( () => this.transition.buttons( BUTTONS.Menu, BUTTONS.None ), 1000 );

    }, 500 );

  }

  initActions() {

    let tappedTwice = false;

    this.dom.game.addEventListener( 'click', event => {

      if ( this.transition.activeTransitions > 0 ) return;
      if ( this.state === GAME_STATE.Playing ) return;

      if ( this.state === GAME_STATE.Menu ) {

        if ( ! tappedTwice ) {

          tappedTwice = true;
          setTimeout( () => tappedTwice = false, 300 );
          return false;

        }

        this.game( DISPLAY.Show );

      } else if ( this.state === GAME_STATE.Complete ) {

        this.complete( DISPLAY.Hide );

      } else if ( this.state === GAME_STATE.Stats ) {

        this.stats( DISPLAY.Hide );

      } 

    }, false );

    this.controls.onMove = () => {

      if ( this.newGame ) {
        
        this.timer.start( true );
        this.newGame = false;

      }

    };

    this.dom.buttons.back.onclick = event => {

      



      // if ( this.transition.activeTransitions > 0 ) return;

      // if ( this.state === GAME_STATE.Playing ) {

      //   this.game( Display.HIDE );

      // } else 
      
      if ( this.state === GAME_STATE.Prefs ) {

        this.prefs( DISPLAY.Hide );

      } else{
        this.controls.undo_action();
      }
       
       //else if ( this.state === GAME_STATE.Theme ) {

      //   this.theme( Display.HIDE );

      // }

    };

    this.dom.buttons.reset.onclick = event => {

      if ( this.state === GAME_STATE.Theme ) {

        this.themeEditor.resetTheme();

      }
      
    };

    this.dom.buttons.prefs.onclick = event => this.prefs( DISPLAY.Show );

    // this.dom.buttons.theme.onclick = event => this.theme( Display.SHOW );

    this.dom.buttons.stats.onclick = event => this.stats( DISPLAY.Show );

    this.controls.onSolved = () => {
      this.complete( DISPLAY.Show );
      window.sendGoal();
    };

  }

  game( show ) {

    if ( show ) {

      if ( ! this.saved ) {

        this.scrambler.scramble();
        this.controls.scrambleCube();
        this.newGame = true;

      }
      const duration = this.saved ? 0 :
        this.scrambler.converted.length * ( this.controls.flipSpeeds[0] + 10 );

      this.state = GAME_STATE.Playing;
      this.saved = true;

      this.transition.buttons( BUTTONS.None, BUTTONS.Menu );

      this.transition.zoom( GAME_STATE.Playing, duration );
      this.transition.title( DISPLAY.Hide );

      setTimeout( () => {

        this.transition.timer( DISPLAY.Show );
        this.transition.buttons( BUTTONS.Playing, BUTTONS.None );
      }, this.transition.durations.zoom - 1000 );

      setTimeout( () => {
        if ( ! this.newGame ) this.timer.start( true );
        this.controls.checkIsSolved();
        this.transition.correctness(DISPLAY.Show, () => this.controls.enable());
      }, this.transition.durations.zoom );

    } else {

      this.state = GAME_STATE.Menu;

      this.transition.buttons( BUTTONS.Menu, BUTTONS.Playing );

      this.transition.zoom( GAME_STATE.Menu, 0 );

      this.controls.disable();
      if ( ! this.newGame ) this.timer.stop();
      this.transition.timer( DISPLAY.Hide );
      this.transition.correctness(DISPLAY.Hide);

      setTimeout( () => this.transition.title( DISPLAY.Show ), this.transition.durations.zoom - 1000 );

      this.playing = false;
      this.controls.disable();

    }

  }

  prefs( show ) {

    if ( show ) {

      if ( this.transition.activeTransitions > 0 ) return;

      this.state = GAME_STATE.Prefs;

      this.transition.buttons( BUTTONS.Prefs, BUTTONS.Menu );

      this.transition.title( DISPLAY.Hide );
      this.transition.cube( DISPLAY.Hide );

      setTimeout( () => this.transition.preferences( DISPLAY.Show ), 1000 );

    } else {

      this.cube.resize();

      this.state = GAME_STATE.Menu;

      this.transition.buttons( BUTTONS.Menu, BUTTONS.Prefs );

      this.transition.preferences( DISPLAY.Hide );

      setTimeout( () => this.transition.cube( DISPLAY.Show ), 500 );
      setTimeout( () => this.transition.title( DISPLAY.Show ), 1200 );

    }

  }

  theme( show ) {

    this.themeEditor.colorPicker( show );
    
    if ( show ) {

      if ( this.transition.activeTransitions > 0 ) return;

      this.cube.loadFromData( PREDEFINED_CUBE_STATE[ '3' ][ 'checkerboard' ] );

      this.themeEditor.setHSL( null, false );

      this.state = GAME_STATE.Theme;

      this.transition.buttons( BUTTONS.Theme, BUTTONS.Prefs );

      this.transition.preferences( DISPLAY.Hide );

      setTimeout( () => this.transition.cube( DISPLAY.Show, true ), 500 );
      setTimeout( () => this.transition.theming( DISPLAY.Show ), 1000 );

    } else {

      this.state = GAME_STATE.Prefs;

      this.transition.buttons( BUTTONS.Prefs, BUTTONS.Theme );

      this.transition.cube( DISPLAY.Hide, true );
      this.transition.theming( DISPLAY.Hide );

      setTimeout( () => this.transition.preferences( DISPLAY.Show ), 1000 );
      setTimeout( () => {

        const gameCubeData = JSON.parse( localStorage.getItem( 'theCube_savedState' ) );

        if ( !gameCubeData ) {

          this.cube.resize( true );
          return;

        }

        this.cube.loadFromData( gameCubeData );

      }, 1500 );

    }

  }

  stats( show ) {

    if ( show ) {

      if ( this.transition.activeTransitions > 0 ) return;

      this.state = GAME_STATE.Stats;

      this.transition.buttons( BUTTONS.Stats, BUTTONS.Menu );

      this.transition.title( DISPLAY.Hide );
      this.transition.cube( DISPLAY.Hide );

      setTimeout( () => this.transition.stats( DISPLAY.Show ), 1000 );

    } else {

      this.state = GAME_STATE.Menu;

      this.transition.buttons( BUTTONS.Menu, BUTTONS.None );

      this.transition.stats( DISPLAY.Hide );
      document.getElementById("login-container").style.display = "flex";
      document.getElementById("ui").style.display = "none";
      document.getElementsByClassName("ui__game").item(0).innerHTML = '';
      document.getElementsByClassName("text--correctness").item(0).innerHTML = '';
      document.getElementsByClassName("text--correctness2").item(0).innerHTML = '';
    }

  }

  complete( show ) {

    if ( show ) {

      this.transition.buttons( BUTTONS.Complete, BUTTONS.Playing );

      this.state = GAME_STATE.Complete;
      this.saved = false;

      this.controls.disable();
      this.timer.stop();
      this.storage.clearGame();

      this.bestTime = this.scores.addScore( this.timer.deltaTime );

      this.transition.zoom( GAME_STATE.Menu, 0 );
      this.transition.elevate( DISPLAY.Show );

      setTimeout( () => {

        this.transition.complete( DISPLAY.Show, this.bestTime );
        this.confetti.start();

      }, 1000 );

    } else {

      this.state = GAME_STATE.Stats;
      this.saved = false;

      this.transition.timer( DISPLAY.Hide );
      this.transition.complete( DISPLAY.Hide, this.bestTime );
      this.transition.cube( DISPLAY.Hide );
      this.timer.reset();

      setTimeout( () => {

        this.cube.reset();
        this.confetti.stop();

        this.transition.stats( DISPLAY.Show );
        this.transition.elevate( 0 );

      }, 1000 );

      return false;

    }

  }

}
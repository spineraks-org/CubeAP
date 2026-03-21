import GAME_STATE from "./GameState.js";

export default class Storage {

  constructor( game ) {

    this.game = game;

    document.addEventListener('keydown', (event) => {
      if (this.game.state === GAME_STATE.Stats) {
        if (event.key === 'Delete') {
          this.game.storage.clearScores();
        }
      }
    });

  }

  init(size) {

    this.loadPreferences(size);
    this.loadScores();

  }

  loadGame() {
    this.game.saved = false;
    const rawSave = localStorage.getItem(this.game.apId);
    if (rawSave === null) {
      return;
    }

    const save = JSON.parse(rawSave);

    switch (save.save_version) {
      case 1:
        this.#loadGameV1(save);
        break;
    }
  }

  #loadGameV1(save) {
    const gameCubeData = save.saved_state;
    const gameTime = save.time;

    if (save.seed !== this.game.seed
        || save.apworld_version !== window.version
        || !gameCubeData
        || gameTime === null
        || gameCubeData.size !== this.game.cube.sizeGenerated
    ) {
      return;
    }

    this.game.cube.loadFromData( gameCubeData );
    this.game.controls.edges.rotation.setFromVector3(save.cube_rotation);
    this.game.cube.object.rotation.copy( this.game.controls.edges.rotation );

    window.highScore = save.high_score;

    this.game.timer.deltaTime = gameTime;

    this.game.saved = true;
  }

  saveGame() {
    if (!this.game.apId) {
      return;
    }

    const gameCubeData = {
      names: [],
      positions: [],
      rotations: []
    };
    const gameTime = this.game.timer.deltaTime;

    gameCubeData.size = this.game.cube.sizeGenerated;

    this.game.cube.pieces.forEach( piece => {
      gameCubeData.names.push( piece.name );
      gameCubeData.positions.push( piece.position );
      gameCubeData.rotations.push( piece.rotation.toVector3() );

    } );

    gameCubeData.marks = Object.fromEntries(
      this.game.cube.edges
        .filter(edge => edge.userData.mark !== null)
        .map(edge => [edge.name, edge.userData.mark])
    );
    
    const save = {
      saved_state: gameCubeData,
      time: gameTime,
      seed: this.game.seed,
      apworld_version: window.version,
      cube_rotation: this.game.controls.edges.rotation.toVector3(),
      save_version: 1,
      high_score: window.highScore,
      saved_at: Date.now()
    }
    localStorage.setItem(this.game.apId, JSON.stringify(save));
  }

  clearGame() {
    localStorage.removeItem( this.game.apId );
  }

  loadScores() {

    try {

      const scoresData = JSON.parse( localStorage.getItem( 'theCube_scores' ) );

      if ( ! scoresData ) throw new Error();

      this.game.scores.data = scoresData;

    } catch( e ) {}

  }

  saveScores() {

    const scoresData = this.game.scores.data;

    localStorage.setItem( 'theCube_scores', JSON.stringify( scoresData ) );

  }

  clearScores() {

    localStorage.removeItem( 'theCube_scores' );

  }

  migrateScores() {

    try {

      const scoresData = JSON.parse( localStorage.getItem( 'theCube_scoresData' ) );
      const scoresBest = parseInt( localStorage.getItem( 'theCube_scoresBest' ) );
      const scoresWorst = parseInt( localStorage.getItem( 'theCube_scoresWorst' ) );
      const scoresSolves = parseInt( localStorage.getItem( 'theCube_scoresSolves' ) );

      if ( ! scoresData || ! scoresBest || ! scoresSolves || ! scoresWorst ) return false;

      this.game.scores.data[ 3 ].scores = scoresData;
      this.game.scores.data[ 3 ].best = scoresBest;
      this.game.scores.data[ 3 ].solves = scoresSolves;
      this.game.scores.data[ 3 ].worst = scoresWorst;

      localStorage.removeItem( 'theCube_scoresData' );
      localStorage.removeItem( 'theCube_scoresBest' );
      localStorage.removeItem( 'theCube_scoresWorst' );
      localStorage.removeItem( 'theCube_scoresSolves' );

    } catch( e ) {}

  }

  loadPreferences(size) {

    this.game.cube.size = size;

    try {

      const preferences = JSON.parse( localStorage.getItem( 'theCube_preferences' ) );

      if ( ! preferences ) throw new Error();

      // this.game.cube.size = parseInt( preferences.cubeSize );
      this.game.controls.flipConfig = parseInt( preferences.flipConfig );
      this.game.scrambler.dificulty = parseInt( preferences.dificulty );

      this.game.world.fov = parseFloat( preferences.fov );
      this.game.world.resize();

      this.game.themes.colors = preferences.colors;
      this.game.themes.setTheme( preferences.theme );

      this.game.controls.controlStyle = parseInt( preferences.controlStyle ) || 0;

      return true;

    } catch (e) {

      this.game.controls.flipConfig = 0;
      this.game.scrambler.dificulty = 1;

      this.game.world.fov = 10;
      this.game.world.resize();

      this.game.themes.setTheme( 'cube' );

      this.game.controls.controlStyle = 0;

      this.savePreferences();

      return false;

    }

  }

  savePreferences() {

    const preferences = {
      cubeSize: this.game.cube.size,
      flipConfig: this.game.controls.flipConfig,
      dificulty: this.game.scrambler.dificulty,
      fov: this.game.world.fov,
      theme: this.game.themes.theme,
      colors: this.game.themes.colors,
      controlStyle: this.game.controls.controlStyle,
    };

    localStorage.setItem( 'theCube_preferences', JSON.stringify( preferences ) );

  }

  clearPreferences() {

    localStorage.removeItem( 'theCube_preferences' );

  }

}
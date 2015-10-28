var Pool = {
    showDebug: true,
    RED: 0,
    YELLOW: 1,
    WHITE: 2,
    BLACK: 3,
};

var socket = io();

Pool.Preloader = function () {};

Pool.Preloader.prototype = {

    init: function () {

        this.input.maxPointers = 1;

        this.scale.pageAlignHorizontally = true;

        this.game.renderer.renderSession.roundPixels = true;

        this.physics.startSystem(Phaser.Physics.P2JS);

    },

    preload: function () {

        this.load.path = 'assets/';

        this.load.bitmapFont('fat-and-tiny');

        this.load.images([ 'logo', 'table', 'cushions', 'cue', 'fill', 'line']);

        this.load.spritesheet('balls', 'balls.png', 26, 26);

        this.load.physics('table');

    },

    create: function () {

        this.state.start('Pool.MainMenu');

    }

};

Pool.MainMenu = function () {};

Pool.MainMenu.prototype = {

    create: function () {

        this.stage.backgroundColor = 0xF8FAF8;

        var logo = this.add.image(this.world.centerX, 140, 'logo');
        logo.anchor.x = 0.5;

        var start = this.add.bitmapText(this.world.centerX, 460, 'fat-and-tiny', 'CLICK TO PLAY', 64);
        start.anchor.x = 0.5;
        start.smoothed = false;
        start.tint = 0xff0000;

        this.input.onDown.addOnce(this.start, this);

    },

    start: function () {

        this.state.start('Pool.Game');

    }

};

Pool.Game = function (game) {

    this.score = 0;
    this.scoreText = null;

    this.speed = 0;
    this.allowShotSpeed = 20.0;

    this.balls = null;
    this.shadows = null;

    this.cue = null;
    this.fill = null;
    this.fillRect = null;
    this.aimLine = null;
    this.line = null; // The sprite line that shows where you are aiming
    this.shootLine = null; // The geometry line that shows aiming, only shows in debug
    this.lineRect = null; // Rectangle to crop line

    this.cueball = null;

    this.resetting = false;
    this.placeball = null;
    this.placeballShadow = null;
    this.placeRect = null;

    this.pauseKey = null;
    this.debugKey = null;

    // this.socket = io() //io.connect("http://localhost", {port: 5000, transports: ["websocket"]});
    //this.socket.listen(http);

};

Pool.Game.prototype = {

    init: function () {

        this.score = 0;
        this.speed = 0;
        this.resetting = false;

    },

    create: function () {

        this.stage.backgroundColor = 0x001b07;

        //  The table
        this.table = this.add.sprite(400, 300, 'table');

        this.physics.p2.enable(this.table, Pool.showDebug);

        this.table.body.static = true;
        this.table.body.clearShapes();
        this.table.body.loadPolygon('table', 'pool-table-physics-shape');

        this.tableMaterial = this.physics.p2.createMaterial('tableMaterial', this.table.body);

        //  The pockets
        this.pockets = this.add.sprite();

        this.physics.p2.enable(this.pockets, Pool.showDebug);

        this.pockets.body.static = true;

        this.pockets.body.clearShapes();

        this.pockets.body.addCircle(128, 64, 80);
        this.pockets.body.addCircle(32, 400, 80);
        this.pockets.body.addCircle(128, 736, 80);

        this.pockets.body.addCircle(128, 64, 528);
        this.pockets.body.addCircle(32, 400, 528);
        this.pockets.body.addCircle(128, 736, 528);

        //  Ball shadows
        this.shadows = this.add.group();

        //  The cushions sit above the shadow layer
        this.add.sprite(0, 0, 'cushions');

        //  The balls

        this.balls = this.add.physicsGroup(Phaser.Physics.P2JS);
        this.balls.enableBodyDebug = Pool.showDebug;

        this.ballMaterial = this.physics.p2.createMaterial('ballMaterial');

        //  Row 1 (5 balls)

        var y = 241;

        this.makeBall(640, y, Pool.RED);
        this.makeBall(640, y + 32, Pool.YELLOW);
        this.makeBall(640, y + 64, Pool.YELLOW);
        this.makeBall(640, y + 96, Pool.RED);
        this.makeBall(640, y + 128, Pool.YELLOW);

        //  Row 2 (4 balls)

        y = 257;

        this.makeBall(608, y, Pool.YELLOW);
        this.makeBall(608, y + 32, Pool.RED);
        this.makeBall(608, y + 64, Pool.YELLOW);
        this.makeBall(608, y + 96, Pool.RED);

        //  Row 3 (3 balls including black)

        y = 273;
        // x = 264
        this.makeBall(576, y, Pool.RED);
        this.makeBall(576, y + 32, Pool.BLACK);
        this.makeBall(576, y + 64, Pool.YELLOW);

        //  Row 4 (2 balls)

        y = 289;

        this.makeBall(544, y, Pool.YELLOW);
        this.makeBall(544, y + 32, Pool.RED);

        //  Row 5 (single red ball)

        this.makeBall(512, 305, Pool.RED);

        //  The cue ball
        //x = 576, x = 264
        this.cueball = this.makeBall(232, 305, Pool.WHITE);

        //  Our placing cue ball and its shadow
        this.placeball = this.add.sprite(0, 0, 'balls', Pool.WHITE);
        this.placeball.anchor.set(0.5);
        this.placeball.visible = false;

        this.placeballShadow = this.shadows.create(0, 0, 'balls', 4);
        this.placeballShadow.anchor.set(0.5);
        this.placeballShadow.visible = false;

        this.placeRect = new Phaser.Rectangle(112, 128, 576, 352);

        //  P2 Impact Events

        this.physics.p2.setImpactEvents(true);

        var ballVsTableMaterial = this.physics.p2.createContactMaterial(
            this.ballMaterial, this.tableMaterial);

        ballVsTableMaterial.restitution = 0.6;

        var ballVsBallMaterial = this.physics.p2.createContactMaterial(
            this.ballMaterial, this.ballMaterial);

        ballVsBallMaterial.restitution = 0.9;

        //  The cue
        this.cue = this.add.sprite(0, 0, 'cue');
        this.cue.anchor.y = 0.5;

        this.fill = this.add.sprite(0, 0, 'fill');
        this.fill.anchor.y = 0.5;
        this.fillRect = new Phaser.Rectangle(0, 0, 332, 6);

        this.fill.crop(this.fillRect);

        // Geometry lines, help point cue and shoot line
        this.aimLine = new Phaser.Line(this.cueball.x, this.cueball.y, this.cueball.x, this.cueball.y);
        this.shootLine = new Phaser.Line(this.cueball.x, this.cueball.y, this.cueball.x, this.cueball.y);

        // Shoot line sprite
        this.line = this.add.sprite(0, 0, 'line');
        this.line.anchor.y = 0.5;

        //this.physics.p2.enable(this.line, true);
        //this.line.body.setCircle(10);
        //this.line.body.data.shapes[0].sensor = true;
        //this.line.x = 400;
        //this.line.y = 300;
        
        this.lineRect = new Phaser.Rectangle(0, 0, 300, 6);

        this.physics.p2.enable(this.lineRect, true);
        this.lineRect.sensor = true;
        //this.lineRect.body.onBeginContact.add(this.balls, this.lineRect);
        //this.lineRect.body.data.shapes[0].sensor = true;

        //this.lineRect.sensor = true;
        this.line.crop(this.lineRect);

        //  Score
        this.scoreText = this.add.bitmapText(16, 0, 'fat-and-tiny', 'SCORE: 0', 32);
        this.scoreText.text = "SCORE: " + this.score;
        this.scoreText.smoothed = false;

        //  Press P to pause and resume the game
        this.pauseKey = this.input.keyboard.addKey(Phaser.Keyboard.P);
        this.pauseKey.onDown.add(this.togglePause, this);

        //  Press D to toggle the debug display
        this.debugKey = this.input.keyboard.addKey(Phaser.Keyboard.D);
        this.debugKey.onDown.add(this.toggleDebug, this);

        this.input.addMoveCallback(this.updateCue, this);
        this.input.onDown.add(this.takeShot, this);

        socket.on('newscore', this.startio.bind(this));
    },

    startio: function (score) {
        console.log(score);
        //this.score = score + 30;
        this.scoreText.text = "SCORE: " + score;
    },

    togglePause: function () {

        this.game.paused = (this.game.paused) ? false : true;

    },

    toggleDebug: function () {

        Pool.showDebug = (Pool.showDebug) ? false : true;

        this.state.restart();

    },

    makeBall: function (x, y, color) {

        var ball = this.balls.create(x, y, 'balls', color);

        ball.body.setCircle(13);
        ball.body.fixedRotation = true;
        ball.body.setMaterial(this.ballMaterial);
        ball.body.damping = 0.70;
        ball.body.angularDamping = 0.75;
        ball.body.createBodyCallback(this.pockets, this.hitPocket, this);

        //  Link the two sprites together
        var shadow = this.shadows.create(x + 4, y + 4, 'balls', 4);
        shadow.anchor.set(0.5);

        ball.shadow = shadow;

        return ball;

    },

    takeShot: function () {

        if (this.speed > this.allowShotSpeed)
        {
            return;
        }

        var speed = (this.aimLine.length / 3);

        if (speed > 112)
        {
            speed = 112;
        }

        this.updateCue();

        var px = (Math.cos(this.aimLine.angle) * speed);
        var py = (Math.sin(this.aimLine.angle) * speed);

        this.cueball.body.applyImpulse([ px, py ], this.cueball.x, this.cueball.y);

        // Hides cue and aim lines when shot happens
        this.line.visible = false;
        this.cue.visible = false;
        this.fill.visible = false;
    },

    hitPocket: function (ball, pocket) {

        //  Cue ball reset
        if (ball.sprite === this.cueball)
        {
            this.resetCueBall();
        }
        else
        {
            ball.sprite.shadow.destroy();
            ball.sprite.destroy();

            this.score += 30;
            //this.scoreText.text = "SCORE: " + this.score;
            socket.emit('newscore', this.score);
            
            
            if (this.balls.total === 1)
            {
                this.time.events.add(3000, this.gameOver, this);
            }

        }

    },

    resetCueBall: function () {

        this.cueball.body.setZeroVelocity();

        //  Move it to a 'safe' area
        this.cueball.body.x = 16;
        this.cueball.body.y = 16;

        this.resetting = true;

        //  We disable the physics body and stick the ball to the pointer
        this.cueball.visible = false;
        this.cueball.shadow.visible = false;

        this.placeball.x = this.input.activePointer.x;
        this.placeball.y = this.input.activePointer.y;
        this.placeball.visible = true;

        this.placeballShadow.x = this.placeball.x + 10;
        this.placeballShadow.y = this.placeball.y + 10;
        this.placeballShadow.visible = true;

        this.input.onDown.remove(this.takeShot, this);
        this.input.onDown.add(this.placeCueBall, this);

    },

    placeCueBall: function () {

        //  Check it's not colliding with other balls

        var a = new Phaser.Circle(this.placeball.x, this.placeball.y, 26);
        var b = new Phaser.Circle(0, 0, 26);

        for (var i = 0; i < this.balls.length; i++)
        {
            var ball = this.balls.children[i];

            if (ball.frame !== 2 && ball.exists)
            {
                b.x = ball.x;
                b.y = ball.y;

                if (Phaser.Circle.intersects(a, b))
                {
                    //  No point going any further
                    return;
                }
            }
        }

        this.cueball.reset(this.placeball.x, this.placeball.y);
        this.cueball.body.reset(this.placeball.x, this.placeball.y);
        this.cueball.visible = true;
        this.cueball.shadow.visible = true;

        this.placeball.visible = false;
        this.placeballShadow.visible = false;

        this.resetting = false;

        this.input.onDown.remove(this.placeCueBall, this);
        this.input.onDown.add(this.takeShot, this);

    },

    updateCue: function () {

        this.aimLine.start.set(this.cueball.x, this.cueball.y);
        this.aimLine.end.set(this.input.activePointer.x, this.input.activePointer.y);

        this.shootLine.fromAngle(this.cueball.x, this.cueball.y, this.aimLine.angle + 3.14, 1000);

        // Places the line on the same angle as the shootLine
        this.line.position.copyFrom(this.shootLine.start);
        this.line.rotation = this.shootLine.angle;

        this.cue.position.copyFrom(this.aimLine.start);
        this.cue.rotation = this.aimLine.angle;

        this.fill.position.copyFrom(this.aimLine.start);
        this.fill.rotation = this.aimLine.angle;

        this.fillRect.width = this.aimLine.length;
        this.fill.updateCrop();

        this.scoreText.text = "SCORE: " + this.score;

    },

    update: function () {

        if (this.resetting)
        {
            this.placeball.x = this.math.clamp(this.input.x, this.placeRect.left, this.placeRect.right);
            this.placeball.y = this.math.clamp(this.input.y, this.placeRect.top, this.placeRect.bottom);
            this.placeballShadow.x = this.placeball.x + 10;
            this.placeballShadow.y = this.placeball.y + 10;
        }
        else
        {
            this.updateSpeed();
            this.updateCue();
        }

    },

    updateSpeed: function () {

        this.speed = Math.sqrt(this.cueball.body.velocity.x * this.cueball.body.velocity.x + this.cueball.body.velocity.y * this.cueball.body.velocity.y);

        if (this.speed < this.allowShotSpeed)
        {
            if (!this.cue.visible)
            {
                // Shows cues and lines once speed is slow enough
                this.line.visible = true;
                this.cue.visible = true;
                this.fill.visible = true;
            }
        }
        else if (this.speed < 3.0)
        {
            this.cueball.body.setZeroVelocity();
        }

    },

    preRender: function () {

        this.balls.forEach(this.positionShadow, this);

    },

    positionShadow: function (ball) {

        ball.shadow.x = ball.x + 4;
        ball.shadow.y = ball.y + 4;

    },

    gameOver: function () {

        this.state.start('Pool.MainMenu');

    },

    render: function () {

        if (Pool.showDebug)
        {
            if (this.speed < 6)
            {
                this.game.debug.geom(this.aimLine);
                this.game.debug.geom(this.shootLine);
            }

            this.game.debug.text("speed: " + this.speed, 540, 24);
            this.game.debug.text("power: " + (this.aimLine.length / 3), 540, 48);
            this.game.debug.text("aAngle: " + (this.aimLine.angle), 540, 72);
            this.game.debug.text("sAngle: " + (this.shootLine.angle), 540, 96);
        }

    }

};

var game = new Phaser.Game(800, 600, Phaser.CANVAS, 'game', null, false, true);

game.state.add('Pool.Preloader', Pool.Preloader);
game.state.add('Pool.MainMenu', Pool.MainMenu);
game.state.add('Pool.Game', Pool.Game);

game.state.start('Pool.Preloader');


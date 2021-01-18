import Phaser from 'phaser';
import io from 'socket.io-client';

const getNamePosition = player => [Math.floor(player.x - player.width / 2), Math.floor(player.y - player.width / 2) - 10];

class GameScene extends Phaser.Scene {
    constructor(url = '', speed = 150) {
        super('GameScene');
        this.socket = io(url);
        this.speed = speed;
        this.playerMap = {};
    }

    preload() {
        this.load.image('tiles', './assets/tilesets/tuxmon-sample-32px-extruded.png');
        this.load.tilemapTiledJSON('map', './assets/tilemaps/tuxemon-town.json');
        this.load.atlas('atlas', './assets/atlas/atlas.png', './assets/atlas/atlas.json');
    }

    create() {
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('tuxmon-sample-32px-extruded', 'tiles');
        map.createLayer('Below Player', tileset, 0, 0);
        const worldLayer = map.createLayer('World', tileset, 0, 0);
        const aboveLayer = map.createLayer('Above Player', tileset, 0, 0);
        worldLayer.setCollisionByProperty({ collides: true });
        aboveLayer.setDepth(10);
        this.worldLayer = worldLayer;
        this.map = map;

        this.cursors = this.input.keyboard.createCursorKeys();
        this.leftKeyPressed = false;
        this.rightKeyPressed = false;
        this.upKeyPressed = false;
        this.downKeyPressed = false;

        this.socket.on('current', msg => {
            const currentPlayers = JSON.parse(msg);
            for (let i = 0, len = currentPlayers.length; i < len; i++) {
                const item = currentPlayers[i];
                const id = item.id;
                if (id && !this.playerMap[id]) {
                    const type = id === this.socket.id ? 'HOST' : 'JOIN';
                    this._createPlayer(id, item.name, item.x, item.y, type);
                }
            }
        });

        this.socket.on('move', msg => {
            const action = JSON.parse(msg);
            const player = this.playerMap[action.id];
            if (player) {
                player.input = action.input;
                player.setPosition(action.x, action.y);
            }
        });

        this.socket.on('leave', id => {
            if (this.playerMap[id]) {
                this._removePlayer(id);
            }
        });
    }

    update(time, delta) {
        this._movePlayers();

        const hostPlayerId = this.socket.id;
        const hostPlayer = this.playerMap[hostPlayerId];
        if (hostPlayer) {
            let left = this.leftKeyPressed;
            let right = this.rightKeyPressed;
            let up = this.upKeyPressed;
            let down = this.downKeyPressed;

            if (this.cursors.left.isDown) {
                this.leftKeyPressed = true;
            } else if (this.cursors.right.isDown) {
                this.rightKeyPressed = true;
            } else {
                this.leftKeyPressed = false;
                this.rightKeyPressed = false;
            }

            if (this.cursors.up.isDown) {
                this.upKeyPressed = true;
            } else if (this.cursors.down.isDown) {
                this.downKeyPressed = true;
            } else {
                this.upKeyPressed = false;
                this.downKeyPressed = false;
            }

            if (left !== this.leftKeyPressed ||
                right !== this.rightKeyPressed ||
                up !== this.upKeyPressed ||
                down !== this.downKeyPressed) {

                this.socket.emit('move', JSON.stringify({
                    id: hostPlayerId,
                    x: hostPlayer.x,
                    y: hostPlayer.y,
                    input: {
                        left: this.leftKeyPressed,
                        right: this.rightKeyPressed,
                        up: this.upKeyPressed,
                        down: this.downKeyPressed
                    }
                }));
            }
        }
    }

    getHostPlayerPosition() {
        const player = this.playerMap[this.socket.id];
        return {
            x: player.x,
            y: player.y
        }
    }

    _createPlayer(id, name, x, y, type = '') {
        const player = this.physics.add
            .sprite(x, y, 'atlas', 'misa-front')
            .setSize(30, 40)
            .setOffset(0, 24);

        this.physics.add.collider(player, this.worldLayer);

        this._createName(player, name);
        this._createAnims(player);

        if (type === 'HOST') {
            const camera = this.cameras.main;
            camera.startFollow(player);
            camera.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        }

        player.input = {
            left: false,
            right: false,
            up: false,
            down: false
        }

        this.playerMap[id] = player;
    }

    _removePlayer(id) {
        this.playerMap[id].name.destroy();
        this.playerMap[id].destroy();
        delete this.playerMap[id];
    }

    _createName(player, name) {
        const [_x, _y] = getNamePosition(player);
        player.name = this.add
            .text(_x, _y, name, { font: '12px', fill: 'blue' })
            .setScrollFactor(1)
            .setDepth(30);
    }

    _createAnims(player) {
        const anims = player.anims;
        anims.create({
            key: 'misa-left-walk',
            frames: anims.generateFrameNames('atlas', { prefix: 'misa-left-walk.', start: 0, end: 3, zeroPad: 3 }),
            frameRate: 10,
            repeat: -1
        });
        anims.create({
            key: 'misa-right-walk',
            frames: anims.generateFrameNames('atlas', { prefix: 'misa-right-walk.', start: 0, end: 3, zeroPad: 3 }),
            frameRate: 10,
            repeat: -1
        });
        anims.create({
            key: 'misa-front-walk',
            frames: anims.generateFrameNames('atlas', { prefix: 'misa-front-walk.', start: 0, end: 3, zeroPad: 3 }),
            frameRate: 10,
            repeat: -1
        });
        anims.create({
            key: 'misa-back-walk',
            frames: anims.generateFrameNames('atlas', { prefix: 'misa-back-walk.', start: 0, end: 3, zeroPad: 3 }),
            frameRate: 10,
            repeat: -1
        });
    }

    _movePlayers() {
        const speed = this.speed;
        const playerMap = this.playerMap;

        Object.keys(playerMap).forEach(key => {
            const player = playerMap[key];
            const input = player.input;

            // Stop any previous movement from the last frame
            player.body.setVelocity(0);

            const [_x, _y] = getNamePosition(player);
            player.name.setPosition(_x, _y);

            // Horizontal movement
            if (input.left) {
                player.body.setVelocityX(-speed);
            } else if (input.right) {
                player.body.setVelocityX(speed);
            }

            // Vertical movement
            if (input.up) {
                player.body.setVelocityY(-speed);
            } else if (input.down) {
                player.body.setVelocityY(speed);
            }

            // Normalize and scale the velocity so that player can't move faster along a diagonal
            player.body.velocity.normalize().scale(speed);

            if (input.left) {
                player.anims.play('misa-left-walk', true);
            } else if (input.right) {
                player.anims.play('misa-right-walk', true);
            } else if (input.up) {
                player.anims.play('misa-back-walk', true);
            } else if (input.down) {
                player.anims.play('misa-front-walk', true);
            } else {
                player.anims.stop();
            }
        });
    }
}

export default GameScene;

import Phaser from 'phaser';
import io from 'socket.io-client';
import { Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

const getNamePosition = player => [Math.floor(player.x - player.width / 2), Math.floor(player.y - player.width / 2) - 15];

class GameScene extends Phaser.Scene {
    constructor(url, customEvent, speed = 150) {
        super('GameScene');
        this.socket = io(url);
        this.customEvent = customEvent;
        this.speed = speed;
        this.playerMap = {};
    }

    preload() {
        this.load.image('tiles', './assets/tiles-tileset.png');
        this.load.tilemapTiledJSON('map', './assets/town.json');
        this.load.spritesheet('player_spritesheet', './assets/player_spritesheet.png', { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('tiles-tileset', 'tiles');
        map.createLayer('land', tileset, 0, 0);
        const worldLayer = map.createLayer('wall', tileset, 0, 0);
        worldLayer.setCollisionByProperty({ collides: true });
        this.map = map;
        this.worldLayer = worldLayer;

        this.cursors = this.input.keyboard.createCursorKeys();

        const source = Observable.create(observer => {
            this.customEvent.on('cursor', data => {
                observer.next(data);
            });
        });

        source
            .pipe(
                distinctUntilChanged((a, b) => JSON.stringify(a.input) === JSON.stringify(b.input))
            )
            .subscribe(data => {
                console.log(data.input);
                this.socket.emit('move', JSON.stringify(data));
            });

        this.socket.on('current', msg => {
            const currentPlayers = JSON.parse(msg);
            const playerList = [];
            for (let i = 0, len = currentPlayers.length; i < len; i++) {
                const item = currentPlayers[i];
                const id = item.id;
                if (id) {
                    if (!this.playerMap[id]) {
                        const type = id === this.socket.id ? 'HOST' : 'JOIN';
                        this._createPlayer(id, item.name, item.x, item.y, type);
                    }

                    playerList.push({ id, name: item.name });
                }
            }

            this.customEvent.emit('playerList', playerList);
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
            const playerMap = this.playerMap;
            if (playerMap[id]) {
                this._removePlayer(id);
            }

            const playerList = [];
            Object.keys(playerMap).forEach(key => {
                if (key !== id) {
                    playerList.push({ id: key, name: playerMap[key].name._text });
                }
            });
            this.customEvent.emit('playerList', playerList);
        });
    }

    update(time, delta) {
        this._movePlayers();

        const hostPlayerId = this.socket.id;
        const hostPlayer = this.playerMap[hostPlayerId];
        if (hostPlayer) {
            const cursors = this.cursors;
            this.customEvent.emit('cursor', {
                id: hostPlayerId,
                x: hostPlayer.x,
                y: hostPlayer.y,
                input: {
                    left: cursors.left.isDown,
                    right: cursors.right.isDown,
                    up: cursors.up.isDown,
                    down: cursors.down.isDown
                }
            });
        }
    }

    getHostPlayerPosition() {
        const player = this.playerMap[this.socket.id];
        return {
            x: player.x,
            y: player.y
        }
    }

    setCustomEvent(customEvent) {
        this.customEvent = customEvent;
    }

    _createPlayer(id, name, x, y, type = '') {
        const player = this.physics.add
            .sprite(x, y, 'player_spritesheet', 'front')
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
            key: 'left-walk',
            frames: anims.generateFrameNames('player_spritesheet', { start: 8, end: 11 }),
            frameRate: 8,
            repeat: -1
        });
        anims.create({
            key: 'right-walk',
            frames: anims.generateFrameNames('player_spritesheet', { start: 12, end: 15 }),
            frameRate: 8,
            repeat: -1
        });
        anims.create({
            key: 'front-walk',
            frames: anims.generateFrameNames('player_spritesheet', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });
        anims.create({
            key: 'back-walk',
            frames: anims.generateFrameNames('player_spritesheet', { start: 4, end: 7 }),
            frameRate: 8,
            repeat: -1
        });
        anims.create({
            key: 'front',
            frames: [{ key: 'player_spritesheet', frame: 0 }],
            frameRate: 20
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
                player.anims.play('left-walk', true);
            } else if (input.right) {
                player.anims.play('right-walk', true);
            } else if (input.up) {
                player.anims.play('back-walk', true);
            } else if (input.down) {
                player.anims.play('front-walk', true);
            } else {
                player.anims.stop();
            }
        });
    }
}

export default GameScene;

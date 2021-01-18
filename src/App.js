import { useState, useEffect, useCallback } from 'react';
import Phaser from 'phaser';
import GameScene from './scene';
import './App.css';

let gameScene;

function initScene() {
    if (gameScene) {
        return;
    }
    gameScene = new GameScene('http://localhost:3000');
    new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game-container',
        width: 800,
        height: 600,
        pixelArt: true,
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 }
            }
        },
        scene: gameScene
    });
}

function App() {
    const [playerName, setPlayerName] = useState('');
    const [hasEntered, setHasEntered] = useState(false);

    useEffect(() => {
        const info = localStorage.getItem('info');
        if (info) {
            const data = JSON.parse(info);
            setPlayerName(data.name);
        }

        initScene();

        const beforeunload = ev => {
            ev.preventDefault();
            const position = gameScene.getHostPlayerPosition();
            const info = localStorage.getItem('info');
            const data = JSON.parse(info);
            localStorage.setItem('info', JSON.stringify({
                ...data,
                position
            }));
        };
        window.addEventListener('beforeunload', beforeunload);
        return () => {
            window.removeEventListener('beforeunload', beforeunload);
            gameScene.socket.disconnect();
        }
    }, []);

    const handleChangeName = useCallback(e => {
        setPlayerName(e.target.value);
    }, []);

    const handleClickJoin = useCallback(e => {
        if (playerName) {
            const info = localStorage.getItem('info');
            let position = { x: 700, y: 350 };
            if (info) {
                const data = JSON.parse(info);
                position = data.position;
            }

            const { socket } = gameScene;
            socket.emit(
                'join',
                JSON.stringify({
                    name: playerName,
                    x: position.x,
                    y: position.y
                })
            );
            socket.on('join', msg => {
                setHasEntered(true);
                localStorage.setItem(
                    'info',
                    JSON.stringify({
                        name: playerName,
                        position: position
                    })
                );
            });
        }
    }, [playerName]);

    return (
        <div className='App'>
            <div id='game-container'></div>
            {!hasEntered && (
                <div className='mask'>
                    <div className='form-box'>
                        <p>What is your name?</p>
                        <input value={playerName} onChange={handleChangeName} />
                        <div className='button' onClick={handleClickJoin}>Join!</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;

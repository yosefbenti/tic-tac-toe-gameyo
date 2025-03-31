const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const randomString = require('random-string');
const path = require('path');
const cors = require('cors'); // Import CORS module

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000; // Use environment variable for port

// Store game data in memory
const games = {};

// Middleware
app.use(cors()); // Enable CORS
app.use(express.static('public')); // Serve static files from the public folder
app.use(express.json()); // Parse JSON bodies

// Route for home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Create a new game
app.post('/create', (req, res) => {
    const gameId = randomString({ length: 6, numeric: true, letters: true, special: false });
    games[gameId] = {
        board: [['', '', ''], ['', '', ''], ['', '', '']],
        players: [],
        current_player: 'X',
        winner: null,
        status: 'waiting'
    };
    res.json({ game_id: gameId });
});

// Join an existing game
app.get('/join/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    if (!games[gameId]) {
        return res.status(404).send('Game not found');
    }
    res.sendFile(path.join(__dirname, 'public', 'game.html')); // Ensure game.html is in public
});

// Socket.IO events
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join', (data) => {
        const gameId = data.game_id;
        const username = data.username;

        if (!games[gameId]) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        const game = games[gameId];

        if (game.players.length >= 2) {
            socket.emit('error', { message: 'Game is full' });
            return;
        }

        // Assign player symbol (X or O)
        const symbol = game.players.length === 0 ? 'X' : 'O';
        game.players.push({ id: socket.id, symbol, username });

        socket.join(gameId);
        socket.emit('player_assigned', { symbol, username, current_player: game.current_player });
        io.to(gameId).emit('game_update', game);

        if (game.players.length === 2) {
            game.status = 'playing';
            io.to(gameId).emit('game_start', { message: 'Game started!' });
        }
    });

    socket.on('move', (data) => {
        const gameId = data.game_id;
        const { row, col } = data;
    
        const game = games[gameId];
        const player = game.players.find(p => p.id === socket.id);
    
        if (!player || player.symbol !== game.current_player) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }
    
        if (game.board[row][col] !== '') {
            socket.emit('error', { message: 'Cell already taken' });
            return;
        }
    
        // Make the move
        game.board[row][col] = player.symbol;
    
        // Check for winner
        const winner = checkWinner(game.board);
        if (winner) {
            game.winner = winner;
            game.status = 'finished';
            io.to(gameId).emit('game_over', { winner });
        } else if (isBoardFull(game.board)) {
            game.status = 'finished';
            io.to(gameId).emit('game_over', { winner: 'draw' });
        } else {
            // Switch turns
            game.current_player = player.symbol === 'X' ? 'O' : 'X';
        }
    
        // Always send the full game object with players included
        const updatedGame = {
            ...game,
            players: game.players,
        };
    
        io.to(gameId).emit('game_update', updatedGame);
    });

    socket.on('restart', (data) => {
        const gameId = data.game_id;
        if (games[gameId]) {
            const game = games[gameId];
            game.board = [['', '', ''], ['', '', ''], ['', '', '']];
            game.current_player = 'X';
            game.winner = null;
            game.status = 'playing';
            io.to(gameId).emit('game_restarted', game);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        for (const gameId in games) {
            const game = games[gameId];
            game.players = game.players.filter(player => player.id !== socket.id);
            if (game.players.length === 0) {
                delete games[gameId];
            } else {
                io.to(gameId).emit('game_update', game);
            }
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Helper functions
function checkWinner(board) {
    for (const row of board) {
        if (row[0] && row[0] === row[1] && row[0] === row[2]) {
            return row[0];
        }
    }
    for (let col = 0; col < 3; col++) {
        if (board[0][col] && board[0][col] === board[1][col] && board[0][col] === board[2][col]) {
            return board[0][col];
        }
    }
    if (board[0][0] && board[0][0] === board[1][1] && board[0][0] === board[2][2]) {
        return board[0][0];
    }
    if (board[0][2] && board[0][2] === board[1][1] && board[0][2] === board[2][0]) {
        return board[0][2];
    }
    return null;
}

function isBoardFull(board) {
    return board.flat().every(cell => cell !== '');
}
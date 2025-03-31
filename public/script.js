const socket = io();
const cells = document.querySelectorAll('.cell');
const statusDiv = document.getElementById('status');
const resetButton = document.getElementById('reset');
const createGameButton = document.getElementById('createGameButton');
const copyLinkButton = document.getElementById('copyLinkButton');
const joinGameButton = document.getElementById('joinGameButton');
const playerNameInput = document.getElementById('playerName');
const roomNameInput = document.getElementById('roomName');
const board = document.getElementById('board');

let room;

createGameButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (playerName) {
        socket.emit('createGame', { playerName });
    }
});

joinGameButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    room = roomNameInput.value.trim();
    if (playerName && room) {
        socket.emit('joinGame', { room, playerName });
    }
});

// Handle board interaction
cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = cell.dataset.index;
        socket.emit('makeMove', { room, index });
    });
});

// Reset game
resetButton.addEventListener('click', () => {
    socket.emit('resetGame', { room });
});

// Listen for events from the server
socket.on('gameCreated', (room) => {
    roomNameInput.value = room; // Show the room name to the creator
    statusDiv.textContent = `Game created! Share this link: ${window.location.href}${room}`;
    copyLinkButton.style.display = 'block'; // Show copy link button
});

copyLinkButton.addEventListener('click', () => {
    // Copy the link to the clipboard
    const link = `${window.location.href}${roomNameInput.value}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('Game link copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
});

socket.on('playerJoined', (roomData) => {
    statusDiv.textContent = `${Object.values(roomData.players).map(player => player.name).join(', ')} have joined.`;
});

socket.on('startGame', (roomData) => {
    statusDiv.textContent = `Game has started! Current turn: ${roomData.players[roomData.currentPlayer].name}`;
    board.style.display = 'grid';
    resetButton.style.display = 'block';
});

socket.on('gameState', (gameData) => {
    gameData.board.forEach((cellValue, index) => {
        cells[index].textContent = cellValue || '';
    });
    statusDiv.textContent = `Current turn: ${gameData.currentPlayer}`;
});

socket.on('gameOver', ({ winner }) => {
    if (winner) {
        statusDiv.textContent = `${winner} wins!`;
    } else {
        statusDiv.textContent = 'It\'s a draw!';
    }
    board.style.display = 'none'; // Disable the board
});

resetButton.addEventListener('click', () => {
    socket.emit('resetGame', { room });
});
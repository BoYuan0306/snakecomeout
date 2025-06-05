document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score');
    const highScoreDisplay = document.getElementById('highScore');
    const finalScoreDisplay = document.getElementById('finalScore');

    const startScreen = document.getElementById('startScreen');
    const pauseScreen = document.getElementById('pauseScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');

    const startButton = document.getElementById('startButton');
    const resumeButton = document.getElementById('resumeButton');
    const restartButton = document.getElementById('restartButton');
    const submitScoreButton = document.getElementById('submitScoreButton');
    const pauseToggleButton = document.getElementById('pauseToggleButton');

    const difficultySelect = document.getElementById('difficulty');
    const playerNameInput = document.getElementById('playerName');
    const leaderboardList = document.getElementById('leaderboardList');

    const mobileControls = document.getElementById('mobileControls');
    const btnUp = document.getElementById('btnUp');
    const btnLeft = document.getElementById('btnLeft');
    const btnDown = document.getElementById('btnDown');
    const btnRight = document.getElementById('btnRight');

    // --- Game Constants & Variables ---
    const GRID_SIZE_BASE = 20; // Base size for each grid cell/snake segment
    let gridSize; // Actual grid size, responsive
    let tileCountX, tileCountY;
    const CANVAS_MAX_WIDTH = 500; // Max width for the canvas

    let snake, food, score, highScore, gameLoopInterval, currentDirection, nextDirection;
    let gamePaused = false;
    let gameOver = false;
    let gameSpeed; // Milliseconds per game tick

    // Power-up states and types
    let powerUp = null; // { x, y, type, timer, effectApplied }
    const POWER_UP_DURATION = 5000; // 5 seconds for temporary power-ups
    const POWER_UP_SPAWN_CHANCE = 0.15; // 15% chance to spawn a power-up instead of normal food after N foods

    const FOOD_TYPES = {
        NORMAL: { color: getCssVariableValue('--food-color') || '#ffeb3b', score: 10, effect: null },
        SPEED_BOOST: { color: '#2196f3', score: 20, effect: 'speed_boost', temporary: true, symbol: '⚡'},
        SLOW_MO: { color: '#7e57c2', score: 5, effect: 'slow_mo', temporary: true, symbol: '🐢'},
        SHIELD: { color: '#4caf50', score: 15, effect: 'shield', temporary: false, symbol: '🛡️'}, // Shield is one-time use
        SCORE_BONUS: { color: '#ff9800', score: 50, effect: 'score_bonus', temporary: false, symbol: '💰'},
        SHRINK: { color: '#e91e63', score: 0, effect: 'shrink', temporary: false, symbol: '🤏'}
    };
    let currentFoodTypeDetails = FOOD_TYPES.NORMAL;
    let hasShield = false;
    let foodsEatenSinceLastPowerUpCheck = 0;

    // --- Utility to get CSS variable values ---
    function getCssVariableValue(varName) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    // --- Initialization ---
    function setupCanvas() {
        const containerWidth = canvas.parentElement.offsetWidth;
        const canvasSize = Math.min(containerWidth, CANVAS_MAX_WIDTH);
        canvas.width = canvasSize;
        canvas.height = canvasSize; // Keep it square

        gridSize = Math.floor(canvas.width / (GRID_SIZE_BASE * 1.25)); // Adjust tile count for aesthetics
        if (gridSize < 10) gridSize = 10; // Minimum grid size
        // Ensure gridsize leads to integer number of tiles
        canvas.width = Math.floor(canvas.width / gridSize) * gridSize;
        canvas.height = canvas.width;


        tileCountX = canvas.width / gridSize;
        tileCountY = canvas.height / gridSize;

        // Update food colors from CSS after canvas setup (if needed or they change)
        FOOD_TYPES.NORMAL.color = getCssVariableValue('--food-color') || '#ffeb3b';
        FOOD_TYPES.SHIELD.color = getCssVariableValue('--shield-food') || '#4caf50';
        // ... update other colors if they are defined in CSS and might change
    }


    function initGameVariables() {
        snake = [
            { x: Math.floor(tileCountX / 2) + 1, y: Math.floor(tileCountY / 2) },
            { x: Math.floor(tileCountX / 2), y: Math.floor(tileCountY / 2) },
            { x: Math.floor(tileCountX / 2) - 1, y: Math.floor(tileCountY / 2) }
        ];
        score = 0;
        currentDirection = 'RIGHT';
        nextDirection = 'RIGHT';
        gamePaused = false;
        gameOver = false;
        hasShield = false;
        powerUp = null;
        foodsEatenSinceLastPowerUpCheck = 0;
        currentFoodTypeDetails = FOOD_TYPES.NORMAL; // Reset to normal food
        updateScoreDisplay();
        setDifficultyAndSpeed();
        spawnFood(); // Initial food
        playerNameInput.value = localStorage.getItem('snakePlayerName') || '';
    }

    function setDifficultyAndSpeed() {
        const difficulty = difficultySelect.value;
        switch (difficulty) {
            case 'easy': gameSpeed = 150; break;
            case 'medium': gameSpeed = 100; break;
            case 'hard': gameSpeed = 70; break;
            case 'insane': gameSpeed = 50; break;
            default: gameSpeed = 100;
        }
        // If a power-up speed effect is active, it will override this base speed
        applySpeedEffect();
    }

    function loadHighScore() {
        highScore = parseInt(localStorage.getItem('snakeHighScoreDeluxe')) || 0;
        highScoreDisplay.textContent = highScore;
    }

    function saveHighScore() {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScoreDeluxe', highScore);
            highScoreDisplay.textContent = highScore;
        }
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', startGame);
    resumeButton.addEventListener('click', togglePauseGame); // Will resume
    restartButton.addEventListener('click', startGame);
    pauseToggleButton.addEventListener('click', togglePauseGame);

    difficultySelect.addEventListener('change', () => {
        if (!gameLoopInterval && !gameOver) { // Only if game not running
             setDifficultyAndSpeed();
        }
    });

    window.addEventListener('keydown', handleKeyPress);
    submitScoreButton.addEventListener('click', handleSubmitScore);

    // Mobile controls
    btnUp.addEventListener('click', () => requestDirectionChange('UP'));
    btnLeft.addEventListener('click', () => requestDirectionChange('LEFT'));
    btnDown.addEventListener('click', () => requestDirectionChange('DOWN'));
    btnRight.addEventListener('click', () => requestDirectionChange('RIGHT'));

    function requestDirectionChange(newDir) {
        if (gamePaused || gameOver) return;
        // Logic to prevent 180-degree turns
        if (newDir === 'UP' && currentDirection !== 'DOWN') nextDirection = 'UP';
        else if (newDir === 'DOWN' && currentDirection !== 'UP') nextDirection = 'DOWN';
        else if (newDir === 'LEFT' && currentDirection !== 'RIGHT') nextDirection = 'LEFT';
        else if (newDir === 'RIGHT' && currentDirection !== 'LEFT') nextDirection = 'RIGHT';
    }

    // Responsive canvas resizing
    window.addEventListener('resize', () => {
        if (!gameLoopInterval) { // Only resize if game is not actively running to avoid disruption
            setupCanvas();
            if (!gameOver && !gamePaused && snake) { // If game was in a state (e.g. start screen but snake defined)
                 drawGame(); // Redraw elements on new canvas size
            } else if (gameOverScreen.classList.contains('active')) {
                // If game over screen is active, just redraw background
                drawBackground();
            } else {
                showStartScreen(); // Or redraw initial start screen content
            }
        }
    });


    // --- Game Flow ---
    function startGame() {
        hideAllOverlays();
        pauseToggleButton.disabled = false;
        pauseToggleButton.textContent = '暫停 (P)';
        difficultySelect.disabled = true;
        initGameVariables(); // This calls setDifficultyAndSpeed and spawnFood

        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(gameLoop, gameSpeed); // Use initial gameSpeed
        drawGame();
    }

    function togglePauseGame() {
        if (gameOver) return;
        gamePaused = !gamePaused;
        if (gamePaused) {
            clearInterval(gameLoopInterval);
            pauseScreen.classList.add('active');
            pauseToggleButton.textContent = '繼續 (P)';
        } else {
            pauseScreen.classList.remove('active');
            pauseToggleButton.textContent = '暫停 (P)';
            // Re-apply current speed (might have been affected by power-ups)
            applySpeedEffect(); // This will re-create interval with correct speed
        }
    }

    function gameLoop() {
        if (gamePaused || gameOver) return;

        updateSnakePosition();
        if (gameOver) return; // Check collision might set gameOver

        checkFoodEaten();
        checkPowerUpEaten();
        updatePowerUpTimers(); // Handle expiration of temporary power-ups
        drawGame();
    }

    function handlePlayerDeath() {
        if (hasShield) {
            hasShield = false;
            // Visual/Audio cue for shield breaking
            console.log("Shield broken!");
            // Potentially add a small invulnerability period or bounce back
            // For now, just consume shield and continue. Need to adjust snake position if stuck.
            // Example: if snake hit wall, move it back one step.
            // This part needs careful implementation to avoid getting stuck again immediately.
            // Let's simplify: shield prevents game over, snake continues. If it was a wall hit,
            // the snake might be at the edge. The next move might still be problematic.
            // A better shield effect might be temporary invincibility or "ghost" through one obstacle.

            // Let's make the snake "pass through" the wall/self for the hit the shield absorbs
            const head = snake[0];
            if (currentDirection === 'LEFT' && head.x < 0) head.x = tileCountX -1;
            else if (currentDirection === 'RIGHT' && head.x >= tileCountX) head.x = 0;
            else if (currentDirection === 'UP' && head.y < 0) head.y = tileCountY -1;
            else if (currentDirection === 'DOWN' && head.y >= tileCountY) head.y = 0;
            // For self-collision with shield, the game just continues.
            return false; // Game does not end
        }
        return true; // Game ends
    }


    function triggerGameOver() {
        gameOver = true;
        clearInterval(gameLoopInterval);
        gameLoopInterval = null; // Clear interval ID
        saveHighScore();
        finalScoreDisplay.textContent = score;
        gameOverScreen.classList.add('active');
        pauseToggleButton.disabled = true;
        difficultySelect.disabled = false;
        // Sound: Game Over
    }

    function hideAllOverlays() {
        startScreen.classList.remove('active');
        pauseScreen.classList.remove('active');
        gameOverScreen.classList.remove('active');
    }

    function showStartScreen() {
        hideAllOverlays();
        startScreen.classList.add('active');
        pauseToggleButton.disabled = true;
        difficultySelect.disabled = false;
        drawBackground(); // Draw a static background or placeholder
        // Display initial message on canvas if desired
        ctx.fillStyle = getCssVariableValue('--text-color') || 'white';
        ctx.font = `${gridSize*0.8}px ${getCssVariableValue('--font-primary')}`;
        ctx.textAlign = 'center';
        if (canvas.width > 300) { // Avoid text on very small canvas if it's too cluttered
            ctx.fillText('準備好了嗎？', canvas.width / 2, canvas.height / 2 - gridSize);
            ctx.font = `${gridSize*0.6}px ${getCssVariableValue('--font-primary')}`;
            ctx.fillText('選擇難度並開始！', canvas.width / 2, canvas.height / 2 + gridSize);
        }
    }

    // --- Drawing ---
    function drawBackground() {
        ctx.fillStyle = getCssVariableValue('--canvas-bg') || '#0f0f1c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Optional: Draw grid lines for better visual separation
        ctx.strokeStyle = getCssVariableValue('--grid-line-color') || 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    function drawGame() {
        drawBackground();

        // Draw Food
        ctx.fillStyle = currentFoodTypeDetails.color;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);
        ctx.strokeRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);
        // Draw food symbol if any
        if(currentFoodTypeDetails.symbol) {
            ctx.fillStyle = '#000'; // Contrasting color for symbol
            ctx.font = `${gridSize * 0.6}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentFoodTypeDetails.symbol, food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2 + 1);
        }


        // Draw Power-up (if exists and different from normal food)
        if (powerUp) {
            const puDetails = FOOD_TYPES[powerUp.type];
            ctx.fillStyle = puDetails.color;
            ctx.strokeStyle = 'gold'; // Highlight power-ups
            ctx.lineWidth = 2;
            // Pulsating effect for power-up
            const pulseFactor = Math.abs(Math.sin(Date.now() / 200)) * 0.1 + 0.9; // 0.9 to 1.0
            const puSize = gridSize * pulseFactor;
            const puOffset = (gridSize - puSize) / 2;

            ctx.fillRect(powerUp.x * gridSize + puOffset, powerUp.y * gridSize + puOffset, puSize, puSize);
            ctx.strokeRect(powerUp.x * gridSize + puOffset, powerUp.y * gridSize + puOffset, puSize, puSize);

            if(puDetails.symbol) {
                ctx.fillStyle = '#fff';
                ctx.font = `${gridSize * 0.6 * pulseFactor}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(puDetails.symbol, powerUp.x * gridSize + gridSize / 2, powerUp.y * gridSize + gridSize / 2 +1);
            }
        }

        // Draw Snake
        snake.forEach((segment, index) => {
            if (index === 0) { // Head
                ctx.fillStyle = getCssVariableValue('--snake-head-color') || '#00e676';
                if (hasShield) ctx.fillStyle = FOOD_TYPES.SHIELD.color; // Shield visual on head
            } else { // Body
                ctx.fillStyle = getCssVariableValue('--snake-body-color') || '#00bfa5';
            }
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
            ctx.strokeStyle = getCssVariableValue('--canvas-bg') || '#0f0f1c'; // Border color same as background for segment separation
            ctx.strokeRect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
        });

        // Draw Shield border if active (around canvas)
        if (hasShield && !snake.find(seg => seg.x === snake[0].x && seg.y === snake[0].y && snake.indexOf(seg) !== 0) ) { // only draw if not also head color
            ctx.strokeStyle = FOOD_TYPES.SHIELD.color;
            ctx.lineWidth = gridSize * 0.2; // Thicker border
            ctx.strokeRect(0,0,canvas.width, canvas.height);
        }
    }

    // --- Snake Logic ---
    function updateSnakePosition() {
        currentDirection = nextDirection;
        const head = { x: snake[0].x, y: snake[0].y }; // Clone the head

        switch (currentDirection) {
            case 'UP': head.y -= 1; break;
            case 'DOWN': head.y += 1; break;
            case 'LEFT': head.x -= 1; break;
            case 'RIGHT': head.x += 1; break;
        }
        snake.unshift(head); // Add new head

        // Check Collisions (Wall or Self)
        if (
            head.x < 0 || head.x >= tileCountX ||
            head.y < 0 || head.y >= tileCountY ||
            checkSelfCollision(head)
        ) {
            if (!handlePlayerDeath()) { // If shield saved player
                // Potentially adjust head position if it went off-screen due to shield
                if (head.x < 0) head.x = tileCountX - 1;
                else if (head.x >= tileCountX) head.x = 0;
                if (head.y < 0) head.y = tileCountY - 1;
                else if (head.y >= tileCountY) head.y = 0;
                snake.pop(); // Still remove tail as if no food eaten
                return;
            }
            triggerGameOver();
            return;
        }
        // If snake hasn't eaten food or power-up, remove tail (handled in checkFoodEaten/checkPowerUpEaten)
    }

    function checkSelfCollision(head) {
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                return true;
            }
        }
        return false;
    }

    function handleKeyPress(event) {
        if (gameOverScreen.classList.contains('active') && event.key === "Enter") {
            if (document.activeElement === playerNameInput) {
                submitScoreButton.click();
            } else {
                restartButton.click();
            }
            return;
        }
        if (startScreen.classList.contains('active') && event.key === "Enter") {
            startButton.click();
            return;
        }

        if (event.key === 'p' || event.key === 'P') {
            if (!startScreen.classList.contains('active') && !gameOverScreen.classList.contains('active')) {
                 togglePauseGame();
            }
            return;
        }

        if (gamePaused || gameOver) return;

        const key = event.key;
        if ((key === 'ArrowUp' || key.toLowerCase() === 'w') && currentDirection !== 'DOWN') nextDirection = 'UP';
        else if ((key === 'ArrowDown' || key.toLowerCase() === 's') && currentDirection !== 'UP') nextDirection = 'DOWN';
        else if ((key === 'ArrowLeft' || key.toLowerCase() === 'a') && currentDirection !== 'RIGHT') nextDirection = 'LEFT';
        else if ((key === 'ArrowRight' || key.toLowerCase() === 'd') && currentDirection !== 'LEFT') nextDirection = 'RIGHT';
    }

    // --- Food & Power-up Logic ---
    function spawnFood() {
        let newPosition;
        do {
            newPosition = {
                x: Math.floor(Math.random() * tileCountX),
                y: Math.floor(Math.random() * tileCountY)
            };
        } while (isOccupied(newPosition));

        food = newPosition;
        // After a certain number of normal foods, consider spawning a power-up
        foodsEatenSinceLastPowerUpCheck++;
        if (powerUp === null && foodsEatenSinceLastPowerUpCheck > 3 && Math.random() < POWER_UP_SPAWN_CHANCE) {
            spawnPowerUp();
            foodsEatenSinceLastPowerUpCheck = 0; // Reset counter
        } else {
             // Regular food, ensure currentFoodTypeDetails is normal unless a power-up exists
            if (!powerUp) { // Only set to normal if NO powerup is currently active/spawned.
                currentFoodTypeDetails = FOOD_TYPES.NORMAL;
            }
        }
    }

    function spawnPowerUp() {
        let puPosition;
        let attempts = 0;
        do {
            puPosition = {
                x: Math.floor(Math.random() * tileCountX),
                y: Math.floor(Math.random() * tileCountY)
            };
            attempts++;
        } while (isOccupied(puPosition) && attempts < 50); // Try not to overlap

        if (attempts < 50) { // Successfully found a spot
            const puTypes = Object.keys(FOOD_TYPES).filter(type => type !== 'NORMAL');
            const randomTypeKey = puTypes[Math.floor(Math.random() * puTypes.length)];
            powerUp = { ...puPosition, type: randomTypeKey, timer: null, effectApplied: false };
            currentFoodTypeDetails = FOOD_TYPES[randomTypeKey]; // For drawing the main food as this power-up
            food = puPosition; // The power-up replaces the normal food visually and functionally
        } else {
            // Failed to spawn power-up, just spawn normal food
            powerUp = null;
            currentFoodTypeDetails = FOOD_TYPES.NORMAL;
            spawnFood(); // This will ensure food is spawned.
        }
    }


    function isOccupied(position) {
        // Check snake body
        if (snake.some(segment => segment.x === position.x && segment.y === position.y)) return true;
        // Check current food (if spawning power-up and food exists)
        if (food && food.x === position.x && food.y === position.y && currentFoodTypeDetails !== FOOD_TYPES.NORMAL) return true;
        // Check current power-up (if spawning food and power-up exists)
        if (powerUp && powerUp.x === position.x && powerUp.y === position.y) return true;
        return false;
    }

    function checkFoodEaten() { // This function now primarily handles normal food
        const head = snake[0];
        if (food && head.x === food.x && head.y === food.y) {
            // If the 'food' eaten was actually a power-up item
            if(powerUp && powerUp.x === food.x && powerUp.y === food.y){
                applyPowerUpEffect(powerUp.type);
                score += FOOD_TYPES[powerUp.type].score; // Add score for power-up itself
                powerUp = null; // Power-up is consumed
                currentFoodTypeDetails = FOOD_TYPES.NORMAL; // Next food will be normal unless another powerup spawns
            } else { // It was normal food
                score += FOOD_TYPES.NORMAL.score;
                // Normal food does not remove tail implicitly, snake grows
            }

            updateScoreDisplay();
            // Sound: Eat

            // Snake grows by not popping tail. The tail is popped if nothing is eaten.
            spawnFood(); // Spawn new food (or power-up check)
        } else {
            snake.pop(); // Remove tail if no food/power-up eaten this tick
        }
    }

    function checkPowerUpEaten() {
        // This logic is now mostly integrated into checkFoodEaten as power-ups replace food
        // However, if we had separate power-up items visually, this would be its own check.
        // For now, it's redundant if power-ups are treated as special food types.
    }


    function applyPowerUpEffect(typeKey) {
        const effectDetails = FOOD_TYPES[typeKey];
        if (!effectDetails) return;

        // Reset previous temporary effects first
        if (effectDetails.temporary) {
            clearTemporaryEffects(typeKey); // Clear others except current type if it's being reapplied
        }

        switch (effectDetails.effect) {
            case 'speed_boost':
                if(powerUp && powerUp.effectApplied && powerUp.type === typeKey) clearTimeout(powerUp.timer); // Clear existing timer for this specific powerup
                gameSpeed = Math.max(30, (difficultySelect.value === 'easy' ? 150 : difficultySelect.value === 'medium' ? 100 : difficultySelect.value === 'hard' ? 70 : 50) * 0.6);
                if(powerUp) powerUp.effectApplied = true;
                powerUp.timer = setTimeout(() => {
                    resetSpeedEffect('speed_boost');
                }, POWER_UP_DURATION);
                break;
            case 'slow_mo':
                 if(powerUp && powerUp.effectApplied && powerUp.type === typeKey) clearTimeout(powerUp.timer);
                gameSpeed = (difficultySelect.value === 'easy' ? 150 : difficultySelect.value === 'medium' ? 100 : difficultySelect.value === 'hard' ? 70 : 50) * 1.5;
                if(powerUp) powerUp.effectApplied = true;
                powerUp.timer = setTimeout(() => {
                    resetSpeedEffect('slow_mo');
                }, POWER_UP_DURATION);
                break;
            case 'shield':
                hasShield = true;
                // No timer, it's a one-time use. Visual update in drawGame.
                break;
            case 'score_bonus':
                // Score already added when "food" (power-up) was eaten.
                break;
            case 'shrink':
                const amountToShrink = 2;
                for(let i=0; i < amountToShrink; i++){
                    if(snake.length > 3) snake.pop(); // Keep a minimum length
                }
                break;
        }
        applySpeedEffect(); // Restart game loop with new speed if changed
    }

    function clearTemporaryEffects(excludeType = null) {
        // If a speed boost or slow-mo was active, reset its timer and effect
        if (powerUp && powerUp.effectApplied && powerUp.type !== excludeType) {
            if (powerUp.type === 'SPEED_BOOST' || powerUp.type === 'SLOW_MO') {
                clearTimeout(powerUp.timer);
                resetSpeedEffect(powerUp.type, false); // Reset speed without restarting loop yet
            }
        }
    }


    function applySpeedEffect() { // Central function to (re)start game loop with current gameSpeed
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        if (!gamePaused && !gameOver) {
            gameLoopInterval = setInterval(gameLoop, gameSpeed);
        }
    }

    function resetSpeedEffect(effectType, reapplyBaseSpeed = true) {
        // Find if this powerup is still the 'active' one visually
        let wasActivePowerUp = false;
        if(powerUp && powerUp.type === effectType && powerUp.effectApplied){
            powerUp.effectApplied = false; // Mark as no longer actively applying its timed effect
            // Don't nullify powerUp here, it's nullified when "eaten"
            wasActivePowerUp = true;
        }

        if (reapplyBaseSpeed) {
            setDifficultyAndSpeed(); // This sets gameSpeed to base and calls applySpeedEffect
        }
        // Check if another speed powerup is active and should take precedence
        // This part is tricky if multiple speed powerups could be picked up.
        // For simplicity, assume only one timed speed effect at a time.
    }


    function updatePowerUpTimers() {
        // This is now handled by setTimeout in applyPowerUpEffect for temporary ones.
        // This function could be used for visual countdowns on screen if desired.
    }

    function updateScoreDisplay() {
        scoreDisplay.textContent = score;
    }

    // --- Leaderboard Logic (Local Storage) ---
    const MAX_LEADERBOARD_ENTRIES = 10;

    function loadLeaderboard() {
        const leaderboard = JSON.parse(localStorage.getItem('snakeLeaderboardDeluxe')) || [];
        leaderboardList.innerHTML = '';

        leaderboard.sort((a, b) => b.score - a.score);

        leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES).forEach((entry, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank">${index + 1}.</span>
                <span class="name">${entry.name}</span>
                <span class="score">${entry.score}</span>
            `;
            leaderboardList.appendChild(li);
        });
         if (leaderboard.length === 0) {
            leaderboardList.innerHTML = '<li>還沒有記錄，快來挑戰第一個高分吧！</li>';
        }
    }

    function handleSubmitScore() {
        let playerName = playerNameInput.value.trim().toUpperCase();
        if (!playerName) playerName = "匿名";
        if (playerName.length > 3 && playerName !== "匿名") playerName = playerName.substring(0, 3);

        localStorage.setItem('snakePlayerName', playerName); // Save for next time

        const leaderboard = JSON.parse(localStorage.getItem('snakeLeaderboardDeluxe')) || [];
        leaderboard.push({ name: playerName, score: score });
        leaderboard.sort((a, b) => b.score - a.score);
        const updatedLeaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);

        localStorage.setItem('snakeLeaderboardDeluxe', JSON.stringify(updatedLeaderboard));
        loadLeaderboard();
        gameOverScreen.classList.remove('active');
        showStartScreen(); // Go back to start screen state
    }

    // --- Initial Setup Calls ---
    setupCanvas(); // Initial canvas setup based on window size
    loadHighScore();
    loadLeaderboard();
    showStartScreen(); // Display the start screen initially

    // Check for touch support to show mobile controls
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        mobileControls.style.display = 'flex';
    }
});
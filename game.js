// ============================================================
// ANSON PARAKKUU — Complete Flappy Bird Game Engine v3
// FIXED: Sprite cropping, custom hitboxes, proper scaling
// ============================================================
(function () {
    'use strict';

    // ========================
    // DYNAMIC VIRTUAL COORDINATE SYSTEM
    // ========================
    const VIRTUAL_W = 360;
    let VIRTUAL_H = 640;
    const BASE_H = 640; // Physics base to keep game feel identical on all devices

    // ========================
    // SPRITE SOURCE RECTS (crop out transparent padding)
    // Both sprites are 1536x1024 with content in center.
    // These define the NON-transparent content region as fractions.
    // ========================
    const SPRITE_CROP = {
        // Character sprites: content roughly center 40% width, center 50% height
        // Measured visually: bird body sits ~30-70% X, ~20-75% Y
        character: { sx: 0.28, sy: 0.18, sw: 0.44, sh: 0.60 },
        // Cylinder: content roughly center 35% width, top 5% to bottom 98%
        // Two stacked cylinders, narrow compared to full image
        cylinder:  { sx: 0.30, sy: 0.02, sw: 0.40, sh: 0.96 },
    };

    // ========================
    // GAME CONFIG (% of virtual screen)
    // ========================
    const CONFIG = {
        // Physics (tuned for Flappy Bird feel)
        GRAVITY: 0.30,
        JUMP_VELOCITY: -6.0,
        MAX_FALL_SPEED: 7.5,
        ROTATION_FACTOR: 3,            // rotation = velocity * this
        FLAP_ROTATION: -20,

        // Player: fixed size based on BASE_H so physics feel identical
        PLAYER_H: BASE_H * 0.10,    // 64
        PLAYER_ASPECT: 1.15,           // slightly wider than tall (bird shape)
        get PLAYER_W() { return this.PLAYER_H * this.PLAYER_ASPECT; },  // ~73.6
        PLAYER_X: VIRTUAL_W * 0.30,    // 30% from left = 108
        PLAYER_HITBOX_R: 0.28,         // hitbox circle radius = 28% of player width

        // Towers
        TOWER_W: VIRTUAL_W * 0.20,     // 72
        TOWER_CYLINDER_H: BASE_H * 0.18, // 115.2
        TOWER_HITBOX_W_RATIO: 0.50,    
        TOWER_GAP_INSET: 30,           
        TOWER_OVERLAP: 26,

        // Gap size remains constant
        GAP_BASE: BASE_H * 0.25,    // 160
        GAP_VARIANCE: BASE_H * 0.02, // 12.8
        
        // Spawn zones and ground use dynamic VIRTUAL_H so they adapt to tall screens
        get GAP_MIN_CENTER() { return VIRTUAL_H * 0.15 + BASE_H * 0.10; },
        get GAP_MAX_CENTER() { return this.GROUND_Y - (BASE_H * 0.20); },

        // Ground
        get GROUND_H() { return VIRTUAL_H * 0.12; },
        get GROUND_Y() { return VIRTUAL_H - this.GROUND_H; },

        // Towers movement
        TOWER_SPEED_BASE: 2.6,
        TOWER_SPEED_INCREMENT: 0.02,
        TOWER_SPEED_MAX: 4.5,
        TOWER_SPAWN_INTERVAL: 85,     // frames between spawns

        // Background
        BG_SCROLL_SPEED: 0.5,
        BG_DARKEN: 0.10,               // subtle darken for contrast

        // Sprite timing
        FLAP_SPRITE_DURATION: 150,
        SCORE_SPRITE_DURATION: 250,

        // Particles
        MAX_PARTICLES: 25,
    };

    // ========================
    // GAME STATE
    // ========================
    const STATES = { MENU: 0, GET_READY: 1, PLAYING: 2, GAME_OVER: 3, FROZEN: -1 };

    let state = STATES.MENU;
    let score = 0;
    let highScore = parseInt(localStorage.getItem('ansonParakkuu_highScore')) || 0;
    let isNewBest = false;

    // Day/Night cycle
    let nightAlpha = 0;
    let targetNightAlpha = 0;
    let stars = [];

    function initStars() {
        stars = [];
        for (let i = 0; i < 40; i++) {
            stars.push({
                x: Math.random() * VIRTUAL_W,
                y: Math.random() * VIRTUAL_H * 0.65,
                size: 1 + Math.random() * 2,
                opacity: 0.2 + Math.random() * 0.8
            });
        }
    }

    function drawStars() {
        if (nightAlpha < 0.01) return;
        ctx.save();
        ctx.fillStyle = '#FFF';
        const time = Date.now() * 0.003;
        stars.forEach((s, i) => {
            const sx = (s.x - bgScrollX * 0.15) % VIRTUAL_W;
            const drawX = sx < 0 ? sx + VIRTUAL_W : sx;
            const twinkle = 0.7 + 0.3 * Math.sin(time + i);
            ctx.globalAlpha = s.opacity * nightAlpha * twinkle;
            ctx.fillRect(drawX, s.y, s.size, s.size);
        });
        ctx.restore();
    }

    // ========================
    // CANVAS & SCALING
    // ========================
    const container = document.getElementById('game-container');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    let screenW, screenH, scale;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resizeGame() {
        const wW = window.innerWidth;
        const wH = window.innerHeight;

        let aspect = wW / wH;
        // Clamp aspect ratio so desktop doesn't get too squished. Max width is 9:16
        if (aspect > 9/16) {
            aspect = 9/16;
        }

        screenW = wW;
        if (wW / wH > 9/16) {
            // Desktop: constrain width to maintain max aspect, creating black bars on sides
            screenW = Math.floor(wH * (9/16));
        }
        screenH = Math.floor(screenW / aspect);

        container.style.width = screenW + 'px';
        container.style.height = screenH + 'px';

        // Update virtual height dynamically to match aspect ratio perfectly
        VIRTUAL_H = Math.floor(VIRTUAL_W / aspect);

        canvas.width = screenW * dpr;
        canvas.height = screenH * dpr;
        canvas.style.width = screenW + 'px';
        canvas.style.height = screenH + 'px';

        scale = screenW / VIRTUAL_W;
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    }

    window.addEventListener('resize', resizeGame);
    resizeGame();

    // ========================
    // ASSET LOADING
    // ========================
    const assets = {};
    const assetList = [
        { key: 'smile',    src: 'Assets/anson smile.png' },
        { key: 'mouth',    src: 'Assets/anson mouth.png' },
        { key: 'happy',    src: 'Assets/anson happy.png' },
        { key: 'hit',      src: 'Assets/anson hit.png' },
        { key: 'lip',      src: 'Assets/anson lip.png' },
        { key: 'title',    src: 'Assets/anson title.png' },
        { key: 'cylinder', src: 'Assets/bharathgas top.png' },
        { key: 'bg',       src: 'Assets/game_bg.png' },
    ];

    let assetsLoaded = 0;

    function loadAssets(callback) {
        assetList.forEach(item => {
            const img = new Image();
            img.onload = () => {
                assets[item.key] = img;
                assetsLoaded++;
                if (assetsLoaded === assetList.length) callback();
            };
            img.onerror = () => {
                console.error('Failed to load:', item.src);
                assetsLoaded++;
                if (assetsLoaded === assetList.length) callback();
            };
            img.src = item.src;
        });
    }

    // ========================
    // CROPPED SPRITE DRAWING
    // ========================
    // Draws only the content region of an image (removes transparent padding)

    function drawCroppedSprite(img, crop, dx, dy, dw, dh) {
        const sx = img.naturalWidth * crop.sx;
        const sy = img.naturalHeight * crop.sy;
        const sw = img.naturalWidth * crop.sw;
        const sh = img.naturalHeight * crop.sh;
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    // ========================
    // BACKGROUND
    // ========================
    let bgScrollX = 0;

    function drawBackground() {
        const bgImg = assets.bg;
        if (!bgImg) {
            // Fallback gradient
            const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H);
            grad.addColorStop(0, '#5ec8f2');
            grad.addColorStop(0.45, '#87CEEB');
            grad.addColorStop(0.75, '#b8e6b8');
            grad.addColorStop(1, '#8B7355');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
            return;
        }

        // Tile horizontally, fill virtual height
        const imgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
        const drawH = VIRTUAL_H;
        const drawW = drawH * imgAspect;

        const scroll = ((bgScrollX % drawW) + drawW) % drawW;
        const startX = -scroll;

        for (let x = startX; x < VIRTUAL_W; x += drawW) {
            ctx.drawImage(bgImg, x, 0, drawW, drawH);
        }
        if (startX > 0) {
            ctx.drawImage(bgImg, startX - drawW, 0, drawW, drawH);
        }

        // Slight darken overlay for better gameplay contrast
        ctx.fillStyle = 'rgba(0, 0, 0, ' + CONFIG.BG_DARKEN + ')';
        ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    }

    function updateBackground() {
        if (state === STATES.PLAYING) {
            bgScrollX += CONFIG.BG_SCROLL_SPEED;
        } else if (state === STATES.MENU || state === STATES.GET_READY) {
            bgScrollX += CONFIG.BG_SCROLL_SPEED * 0.3;
        }
    }

    // ========================
    // GROUND
    // ========================
    function drawGround() {
        const gy = CONFIG.GROUND_Y;
        const gh = CONFIG.GROUND_H;

        // Main dirt
        const dirtGrad = ctx.createLinearGradient(0, gy + 10, 0, gy + gh + 100);
        dirtGrad.addColorStop(0, '#6B4423');
        dirtGrad.addColorStop(1, '#4a2f15');
        ctx.fillStyle = dirtGrad;
        ctx.fillRect(0, gy + 10, VIRTUAL_W, gh + 100);

        // Grass strip
        const grassGrad = ctx.createLinearGradient(0, gy, 0, gy + 14);
        grassGrad.addColorStop(0, '#5DAE4B');
        grassGrad.addColorStop(0.5, '#4A9A3A');
        grassGrad.addColorStop(1, '#3E8E2E');
        ctx.fillStyle = grassGrad;
        ctx.fillRect(0, gy, VIRTUAL_W, 14);

        // Grass highlight
        ctx.strokeStyle = 'rgba(120, 220, 80, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy + 1);
        ctx.lineTo(VIRTUAL_W, gy + 1);
        ctx.stroke();

        // Soil texture dots
        ctx.fillStyle = 'rgba(90, 55, 20, 0.35)';
        for (let i = 0; i < 12; i++) {
            const dx = (i * 31 + bgScrollX * 0.4) % VIRTUAL_W;
            ctx.fillRect(dx, gy + 20 + (i % 3) * 10, 3, 2);
        }
    }

    // ========================
    // PLAYER
    // ========================
    const player = {
        x: CONFIG.PLAYER_X,
        y: 0,
        vy: 0,
        rotation: 0,
        sprite: 'smile',
        spriteTimer: 0,
        pendingSprite: null,
        scaleX: 1,
        scaleY: 1,
        idleTime: 0,
        panicOffsetX: 0,
        panicOffsetY: 0,
        lastWord: null,
        lastWordAlpha: 0,
        lastWordY: 0
    };

    const PW = CONFIG.PLAYER_W;
    const PH = CONFIG.PLAYER_H;
    const PX = CONFIG.PLAYER_X;

    let lastFlapTime = 0;
    let recentFlapCount = 0;

    function resetPlayer() {
        player.x = CONFIG.PLAYER_X;
        player.y = VIRTUAL_H * 0.38;
        player.vy = 0;
        player.rotation = 0;
        player.sprite = 'smile';
        player.spriteTimer = 0;
        player.pendingSprite = null;
        player.scaleX = 1;
        player.scaleY = 1;
        player.idleTime = 0;
        player.panicOffsetX = 0;
        player.panicOffsetY = 0;
        player.lastWord = null;
        player.lastWordAlpha = 0;
        player.lastWordY = 0;
        lastFlapTime = performance.now();
        recentFlapCount = 0;
    }

    function flap() {
        const now = performance.now();
        if (now - lastFlapTime < 400) recentFlapCount++;
        else recentFlapCount = 1;
        lastFlapTime = now;

        player.vy = CONFIG.JUMP_VELOCITY;
        player.rotation = CONFIG.FLAP_ROTATION;
        player.scaleX = 0.88;
        player.scaleY = 1.12;
        setTemporarySprite('mouth', CONFIG.FLAP_SPRITE_DURATION);
        
        for (let i = 0; i < 3; i++) {
            spawnParticle(player.x - PW/3, player.y + PH/4, 'jump');
        }
    }

    function setTemporarySprite(sprite, duration) {
        player.sprite = sprite;
        player.spriteTimer = duration;
        player.pendingSprite = 'smile';
    }

    function updatePlayer(dt) {
        if (state === STATES.GAME_OVER || state === STATES.FROZEN) {
            // Death yeet animation
            player.rotation += 20;
            player.x += 2;
            player.vy += CONFIG.GRAVITY * 1.2;
            if (player.vy > CONFIG.MAX_FALL_SPEED * 1.5) player.vy = CONFIG.MAX_FALL_SPEED * 1.5;
            player.y += player.vy;
            
            // Floating text animation
            if (player.lastWordAlpha > 0) {
                player.lastWordAlpha -= 0.02;
                player.lastWordY -= 1;
            }
            return;
        }

        player.vy += CONFIG.GRAVITY;
        if (player.vy > CONFIG.MAX_FALL_SPEED) player.vy = CONFIG.MAX_FALL_SPEED;
        player.y += player.vy;

        // Expressive sprites (velocity-based)
        if (player.spriteTimer <= 0) {
            if (player.vy < -2) player.sprite = 'happy';
            else if (player.vy > 2) player.sprite = 'mouth';
            else player.sprite = 'smile';
        }

        // Proximity panic effect removed

        // Rotation: direct velocity-based (responsive like Flappy Bird)
        // Clamp between flap angle and max fall angle
        const rawRot = player.vy * CONFIG.ROTATION_FACTOR;
        player.rotation = Math.max(-25, Math.min(90, rawRot));

        // Squash/stretch recovery
        player.scaleX += (1 - player.scaleX) * 0.14;
        player.scaleY += (1 - player.scaleY) * 0.14;

        // Sprite timer
        if (player.spriteTimer > 0) {
            player.spriteTimer -= dt;
            if (player.spriteTimer <= 0 && player.pendingSprite) {
                player.sprite = player.pendingSprite;
                player.pendingSprite = null;
            }
        }

        // Ground collision
        if (player.y + PH / 2 >= CONFIG.GROUND_Y) {
            player.y = CONFIG.GROUND_Y - PH / 2;
            triggerGameOver();
        }

        // Ceiling
        if (player.y - PH / 2 < 0) {
            player.y = PH / 2;
            player.vy = 0;
        }
    }

    function drawPlayer() {
        const spriteImg = assets[player.sprite] || assets.smile;
        if (!spriteImg) return;

        ctx.save();
        ctx.translate(player.x + player.panicOffsetX, player.y + player.panicOffsetY);
        ctx.rotate(player.rotation * Math.PI / 180);
        ctx.scale(player.scaleX, player.scaleY);

        // Drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 5;

        // Draw CROPPED sprite (removes transparent padding)
        drawCroppedSprite(
            spriteImg,
            SPRITE_CROP.character,
            -PW / 2, -PH / 2,
            PW, PH
        );

        ctx.restore();

        // Draw "Last Word" floating text
        if (player.lastWord && player.lastWordAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = player.lastWordAlpha;
            ctx.font = "bold clamp(14px, 3vmin, 18px) Outfit, sans-serif";
            ctx.textAlign = "center";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(0,0,0,0.8)";
            ctx.strokeText(player.lastWord, player.x, player.y + player.lastWordY);
            ctx.fillStyle = "#fff";
            ctx.fillText(player.lastWord, player.x, player.y + player.lastWordY);
            ctx.restore();
        }
    }

    // ========================
    let towers = [];
    let towerSpawnTimer = 0;
    let towerSpeed = CONFIG.TOWER_SPEED_BASE;

    let offscreenTowerCanvas = null;

    function createPreRenderedCylinder() {
        const cylImg = assets.cylinder;
        if (!cylImg) return null;

        const tw = CONFIG.TOWER_W;
        const ch = CONFIG.TOWER_CYLINDER_H;
        const overlap = CONFIG.TOWER_OVERLAP;
        const step = ch - overlap;
        const crop = SPRITE_CROP.cylinder;

        const maxH = Math.ceil(VIRTUAL_H / step) * step + ch;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = tw;
        offCanvas.height = maxH;
        const offCtx = offCanvas.getContext('2d');

        offCtx.globalAlpha = 0.95;

        const count = Math.ceil(maxH / step) + 1;
        for (let i = count - 1; i >= 0; i--) {
            const cy = i * step;
            const sx = cylImg.naturalWidth * crop.sx;
            const sy = cylImg.naturalHeight * crop.sy;
            const sw = cylImg.naturalWidth * crop.sw;
            const sh = cylImg.naturalHeight * crop.sh;
            offCtx.drawImage(cylImg, sx, sy, sw, sh, 0, cy, tw, ch);
        }

        return offCanvas;
    }

    function resetTowers() {
        towers = [];
        towerSpawnTimer = 0;
        towerSpeed = CONFIG.TOWER_SPEED_BASE;
    }

    function spawnTower() {
        // Gap with slight variance
        const gapSize = CONFIG.GAP_BASE + (Math.random() * 2 - 1) * CONFIG.GAP_VARIANCE;
        const halfGap = gapSize / 2;

        // Random gap center within safe bounds
        const gapCenterY = CONFIG.GAP_MIN_CENTER + Math.random() * (CONFIG.GAP_MAX_CENTER - CONFIG.GAP_MIN_CENTER);

        const topEnd = gapCenterY - halfGap;
        const bottomStart = gapCenterY + halfGap;

        towers.push({
            x: VIRTUAL_W + CONFIG.TOWER_W,
            topEnd: topEnd,
            bottomStart: bottomStart,
            scored: false,
            visualRot: 0,
            visualOffsetY: Math.random() * 6 - 3
        });
    }

    function updateTowers() {
        towerSpeed = Math.min(
            CONFIG.TOWER_SPEED_BASE + score * CONFIG.TOWER_SPEED_INCREMENT,
            CONFIG.TOWER_SPEED_MAX
        );

        towerSpawnTimer++;
        if (towerSpawnTimer >= CONFIG.TOWER_SPAWN_INTERVAL) {
            towerSpawnTimer = 0;
            spawnTower();
        }

        for (let i = towers.length - 1; i >= 0; i--) {
            towers[i].x -= towerSpeed;
            const t = towers[i];

            // Score and Near Miss trigger
            if (!t.scored && t.x + CONFIG.TOWER_W / 2 < player.x) {
                t.scored = true;
                addScore();
                
                // Near Miss check (tight vertical clearance)
                const gapInset = CONFIG.TOWER_GAP_INSET;
                const clearanceTop = player.y - (t.topEnd - gapInset);
                const clearanceBot = (t.bottomStart + gapInset) - player.y;
                if (clearanceTop < 25 || clearanceBot < 25) {
                    for (let k = 0; k < 4; k++) spawnParticle(player.x - 20, player.y, 'streak');
                }
            }

            // Cleanup
            if (t.x + CONFIG.TOWER_W < -10) {
                towers.splice(i, 1);
            }
        }
    }

    function drawTowers() {
        if (!offscreenTowerCanvas) return;

        const tw = CONFIG.TOWER_W;
        const maxH = offscreenTowerCanvas.height;

        towers.forEach(tower => {
            ctx.save();
            ctx.translate(0, tower.visualOffsetY);
            
            const left = tower.x - tw / 2;

            // === BOTTOM TOWER ===
            const botRegionH = CONFIG.GROUND_Y - tower.bottomStart;
            if (botRegionH > 0) {
                const drawH = Math.min(botRegionH, maxH);
                ctx.drawImage(offscreenTowerCanvas, 
                    0, 0, tw, drawH, 
                    left, tower.bottomStart, tw, drawH);
            }

            // === TOP TOWER ===
            if (tower.topEnd > 0) {
                const drawH = Math.min(tower.topEnd, maxH);
                
                ctx.save();
                ctx.translate(left + tw / 2, tower.topEnd / 2);
                ctx.scale(1, -1);
                ctx.drawImage(offscreenTowerCanvas, 
                    0, 0, tw, drawH, 
                    -tw / 2, -tower.topEnd / 2, tw, drawH);
                ctx.restore();
            }
            
            ctx.restore();
        });
    }

    // ========================
    // COLLISION DETECTION (CUSTOM TIGHT HITBOXES)
    // ========================
    // Collision uses INSET boundaries:
    //   - Width: 70% of visual tower width (only red cylinder body)
    //   - Gap edge: pulled INWARD by GAP_INSET pixels (skips ring/handle/stand)
    // Player uses a small circle hitbox (38% of width)
    // Result: player only dies when visibly touching the red body

    function checkCollisions() {
        const playerR = PW * CONFIG.PLAYER_HITBOX_R;

        // Ground collision
        if (player.y + playerR >= CONFIG.GROUND_Y) return 'ground';

        // Tower hitbox dimensions
        const hitboxW = CONFIG.TOWER_W * CONFIG.TOWER_HITBOX_W_RATIO;
        const hitboxXOffset = (CONFIG.TOWER_W - hitboxW) / 2;
        const gapInset = CONFIG.TOWER_GAP_INSET;

        for (let i = 0; i < towers.length; i++) {
            const t = towers[i];
            const tLeft = t.x - CONFIG.TOWER_W / 2 + hitboxXOffset;
            const tRight = tLeft + hitboxW;

            // Closest X on tower hitbox rect to player center
            const closestX = Math.max(tLeft, Math.min(PX, tRight));

            // TOP TOWER hitbox: from Y=0 down to (topEnd - gapInset)
            // The inset removes the ring/handle area near the gap opening
            const topHitEnd = t.topEnd - gapInset;
            if (topHitEnd > 0) {
                const closestY = Math.max(0, Math.min(player.y, topHitEnd));
                const dx = PX - closestX;
                const dy = player.y - closestY;
                if (dx * dx + dy * dy < playerR * playerR) return 'cylinder';
            }

            // BOTTOM TOWER hitbox: from (bottomStart + gapInset) down to GROUND_Y
            // The inset removes the tapered top/ring area near the gap opening
            const botHitStart = t.bottomStart + gapInset;
            if (botHitStart < CONFIG.GROUND_Y) {
                const closestY = Math.max(botHitStart, Math.min(player.y, CONFIG.GROUND_Y));
                const dx = PX - closestX;
                const dy = player.y - closestY;
                if (dx * dx + dy * dy < playerR * playerR) return 'cylinder';
            }
        }

        return null;
    }

    // ========================
    // SCORE
    // ========================
    const scoreDisplay = document.getElementById('score-display');

    function addScore() {
        score++;
        scoreDisplay.textContent = score;
        scoreDisplay.classList.remove('pop');
        void scoreDisplay.offsetWidth;
        scoreDisplay.classList.add('pop');

        // Night mode every 25 points
        if (score > 0 && Math.floor(score / 25) % 2 === 1) {
            targetNightAlpha = 1.0;
        } else {
            targetNightAlpha = 0;
        }

        setTemporarySprite('happy', CONFIG.SCORE_SPRITE_DURATION);
        triggerVibration('score');

        for (let i = 0; i < 4; i++) {
            spawnParticle(PX + 15, player.y, 'score');
        }
    }

    function resetScore() {
        score = 0;
        scoreDisplay.textContent = '0';
        targetNightAlpha = 0;
        nightAlpha = 0;
    }

    // ========================
    // PARTICLES
    // ========================
    let particles = [];

    function spawnParticle(x, y, type) {
        if (particles.length >= CONFIG.MAX_PARTICLES) return;

        let colors;
        if (type === 'score') colors = ['#FFD700', '#FFA500', '#FF6347', '#fff'];
        else if (type === 'jump') colors = ['#ffffff', '#eeeeee', '#dddddd'];
        else if (type === 'streak') colors = ['#ffffff', '#e0ffff'];
        else colors = ['#ff4757', '#ff6b81', '#ffa502', '#fff'];

        particles.push({
            x, y,
            vx: type === 'streak' ? -8 - Math.random() * 5 : (Math.random() - 0.5) * 5,
            vy: type === 'streak' ? (Math.random() - 0.5) * 2 : (Math.random() - 0.8) * 4.5,
            life: 1,
            decay: type === 'streak' ? 0.1 : (0.025 + Math.random() * 0.02),
            size: type === 'streak' ? 4 + Math.random() * 4 : 2.5 + Math.random() * 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 8,
        });
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.life -= p.decay;
            p.rotation += p.rotSpeed;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            
            const cos = Math.cos(p.rotation * Math.PI / 180);
            const sin = Math.sin(p.rotation * Math.PI / 180);
            const hw = p.size / 2;
            
            ctx.beginPath();
            ctx.moveTo(p.x - hw * cos + hw * sin, p.y - hw * sin - hw * cos);
            ctx.lineTo(p.x + hw * cos + hw * sin, p.y + hw * sin - hw * cos);
            ctx.lineTo(p.x + hw * cos - hw * sin, p.y + hw * sin + hw * cos);
            ctx.lineTo(p.x - hw * cos - hw * sin, p.y - hw * sin + hw * cos);
            ctx.closePath();
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }

    // ========================
    // CLOUDS
    // ========================
    let clouds = [];

    function initClouds() {
        initStars();
        clouds = [];
        for (let i = 0; i < 4; i++) {
            clouds.push({
                x: Math.random() * VIRTUAL_W * 1.3,
                y: 20 + Math.random() * VIRTUAL_H * 0.15,
                w: 35 + Math.random() * 45,
                h: 14 + Math.random() * 12,
                speed: 0.12 + Math.random() * 0.18,
                opacity: 0.10 + Math.random() * 0.12,
            });
        }
    }

    function updateClouds() {
        clouds.forEach(c => {
            c.x -= c.speed;
            if (c.x + c.w < 0) {
                c.x = VIRTUAL_W + Math.random() * 50;
                c.y = 20 + Math.random() * VIRTUAL_H * 0.15;
            }
        });
    }

    function drawClouds() {
        clouds.forEach(c => {
            ctx.save();
            ctx.globalAlpha = c.opacity;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x - c.w * 0.2, c.y + 3, c.w * 0.28, c.h * 0.32, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x + c.w * 0.17, c.y + 2, c.w * 0.23, c.h * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    // ========================
    // STATE MANAGEMENT
    // ========================
    const startScreen = document.getElementById('start-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const getReadyOverlay = document.getElementById('get-ready-overlay');
    const flashOverlay = document.getElementById('flash-overlay');
    const menuHighscore = document.getElementById('menu-highscore');
    const finalScore = document.getElementById('final-score');
    const finalHighscore = document.getElementById('final-highscore');
    const btnPlay = document.getElementById('btn-play');
    const btnRetry = document.getElementById('btn-retry');
    const btnHome = document.getElementById('btn-home');

    function setState(newState) {
        state = newState;

        switch (state) {
            case STATES.MENU:
                startScreen.classList.remove('hidden');
                gameoverScreen.classList.add('hidden');
                getReadyOverlay.classList.remove('visible');
                scoreDisplay.classList.remove('visible');
                menuHighscore.textContent = highScore;
                resetPlayer();
                resetTowers();
                resetScore();
                particles = [];
                initClouds();
                break;

            case STATES.GET_READY:
                startScreen.classList.add('hidden');
                gameoverScreen.classList.add('hidden');
                getReadyOverlay.classList.add('visible');
                scoreDisplay.classList.add('visible');
                resetPlayer();
                resetTowers();
                resetScore();
                particles = [];
                break;

            case STATES.PLAYING:
                getReadyOverlay.classList.remove('visible');
                break;

            case STATES.GAME_OVER:
                handleGameOver();
                break;
        }
    }

    const LAST_WORDS = [
        "ayyoo daa", "enta daivame", "ayyo poyi", "ente life", "bro why", "ithu venda", 
        "poyi njan", "ente scene", "ayyo bro", "daivame pls", "ente luck", "ayyo no", 
        "bro stop", "ente fate", "ithu over", "ayyo ayyoo", "ente end", "bro please", 
        "daivame no", "ente crash", "ayyo set", "ente karyam", "bro done", "ithu theernu", 
        "ayyo dead", "ente poyi", "bro finish", "ente loss", "ayyo kazhinju", "daivame help", 
        "ente mistake", "bro gg", "ithu scene", "ayyo flop", "ente gone", "bro sad", 
        "ente pain", "ayyo hit", "daivame save", "ente error", "bro whyyy", "ente bad", 
        "ayyo fail", "ente gonee", "bro rip", "ente down", "ayyo oof", "daivame ayyoo", 
        "ente doom", "bro lost"
    ];

    let lastDeathType = 'general';

    function triggerGameOver(type) {
        if (state !== STATES.PLAYING) return;
        lastDeathType = type || 'general';
        triggerVibration('death');

        player.sprite = 'hit';
        player.spriteTimer = 9999;
        player.pendingSprite = null;
        
        player.lastWord = LAST_WORDS[Math.floor(Math.random() * LAST_WORDS.length)];
        player.lastWordAlpha = 1.0;
        player.lastWordY = -PH;

        flashOverlay.classList.add('flash');
        setTimeout(() => flashOverlay.classList.remove('flash'), 100);

        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 200);

        for (let i = 0; i < 8; i++) {
            spawnParticle(player.x, player.y, 'hit');
        }

        setTimeout(() => setState(STATES.GAME_OVER), 1000); // More time to see the yeet
        state = STATES.FROZEN;
    }

    const ROASTS = {
        ground: [
            { title: "Anson marichuu 💀", subtitle: "Parakkan poyi but gravity paranju nee ivide thanne irikkeda mone 😭" },
            { title: "Flight cancel aayi 🚫", subtitle: "Takeoff nannayi but landing direct ground-il crash aayi kazhinju 🤡" },
            { title: "Anson down aayi 😔", subtitle: "Practice undayirunnu but timing illa bro ithu parakkal alla falling aanu 😭" },
            { title: "Crash landing 💥", subtitle: "Smooth landing plan cheythu but ground-il rocket pole vannu 😭" },
            { title: "Direct ground visit 😭", subtitle: "Sky explore cheyyan poyi but ground-il thanne settle aayi 🤡" }
        ],
        cylinder: [
            { title: "Anson idichu 😭", subtitle: "Cylinder kandappo brain full hang aayi bro ithu entha reaction time 😂" },
            { title: "Kazhivilla bro 😤", subtitle: "Pilot aavanam enn paranju but gas cylinder thanne final boss aayi vannu 💀" },
            { title: "Gas adichu poyi 😭", subtitle: "Cylinder avoid cheyyanam enn paranju but athine thanne hug cheythu 💀" },
            { title: "Flight over 😵", subtitle: "Air-il ninnalum cylinder thanne choose cheyyunnu bro ithu destiny aanu 💀" },
            { title: "Anson panic 😵", subtitle: "Cylinder kandappo panic aayi random tap cheythu crash aayi 😭" },
            { title: "Anson slip aayi 😭", subtitle: "Perfect gap undayirunnu but nee athine miss cheythu bro 💀" },
            { title: "Over confidence 🤡", subtitle: "Easy aanu enn vicharichu but cylinder ninte ego break cheythu 😭" }
        ],
        general: [
            { title: "Pilot training fail 😂", subtitle: "License kittiyilla bro ithu pole parannal DGCA thanne ban cheyyum 🤡" },
            { title: "Anson kazhivilla 😤", subtitle: "Jump cheyyan poyi but late aayi bro reaction time 2G speed il aanu 😭" },
            { title: "Anson confused 🤡", subtitle: "Left pokano right pokano enn aalochichu nilkkumbo crash aayi 😂" },
            { title: "Timing illa 😭", subtitle: "Exact moment-il tap cheyyanam enn paranju but nee delay aayi bro 😤" },
            { title: "Mission fail 🚫", subtitle: "Objective simple aayirunnu bro but execution full flop aayi 🤡" },
            { title: "Skill issue 😤", subtitle: "Game easy aanu bro but control illa athu thanne problem 😂" },
            { title: "Brain lag 🧠", subtitle: "Eyes kandathu brain process cheyyumbo late aayi bro 😂" },
            { title: "Anson retry venam 😤", subtitle: "Ithrem flop aayalum give up cheyyaruthu bro next time correct aavum 😭" }
        ]
    };

    let roastIndices = { ground: 0, cylinder: 0, general: 0 };
    let deathCount = 0;

    function handleGameOver() {
        isNewBest = false;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('ansonParakkuu_highScore', highScore);
            isNewBest = true;
        }

        finalScore.textContent = score;
        finalHighscore.innerHTML = highScore + (isNewBest ? ' <span class="new-best">NEW!</span>' : '');

        // Choose contextual roasts
        let pool = lastDeathType === 'ground' ? ROASTS.ground : ROASTS.cylinder;
        deathCount++;
        // Occasionally mix in general so it doesn't get strictly repetitive
        if (deathCount % 3 === 0) pool = ROASTS.general;

        let typeKey = (pool === ROASTS.ground) ? 'ground' : ((pool === ROASTS.cylinder) ? 'cylinder' : 'general');
        let index = roastIndices[typeKey];
        let roast = pool[index];
        
        // Cycle sequentially
        roastIndices[typeKey] = (index + 1) % pool.length;

        document.getElementById('gameover-title').textContent = roast.title;
        document.getElementById('gameover-roast').textContent = roast.subtitle;

        gameoverScreen.classList.remove('hidden');
        scoreDisplay.classList.remove('visible');
    }

    // ========================
    // GAMEPAD INPUT
    // ========================
    let lastGamepadState = { A: false, RT: false };

    function triggerVibration(type) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp && gp.vibrationActuator) {
                try {
                    if (type === 'score') {
                        gp.vibrationActuator.playEffect('dual-rumble', {
                            startDelay: 0, duration: 250,
                            weakMagnitude: 0.8, strongMagnitude: 0.4
                        });
                    } else if (type === 'death') {
                        gp.vibrationActuator.playEffect('dual-rumble', {
                            startDelay: 0, duration: 500,
                            weakMagnitude: 0.8, strongMagnitude: 1.0
                        });
                    }
                } catch (e) { console.warn("Vibration error", e); }
            }
        }
    }

    function pollGamepads() {
        if (inputLocked) return;
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp) continue;

            // 'A' button (index 0) or 'Menu' (index 9) for UI navigation
            const btnA = gp.buttons[0]?.pressed || gp.buttons[9]?.pressed;
            // RT (Right Trigger) (index 7)
            const rtObj = gp.buttons[7];
            const rtValue = rtObj ? rtObj.value : 0;
            const rtPressed = rtValue > 0.15;

            // UI Navigation & Flapping via A
            if (btnA && !lastGamepadState.A) {
                if (state === STATES.MENU || state === STATES.GAME_OVER) {
                    if (state === STATES.GAME_OVER) {
                        inputLocked = true;
                        setState(STATES.GET_READY);
                        setTimeout(() => { inputLocked = false; }, 300);
                    } else {
                        setState(STATES.GET_READY);
                    }
                } else if (state === STATES.GET_READY) {
                    setState(STATES.PLAYING);
                    flap();
                } else if (state === STATES.PLAYING) {
                    flap();
                }
            }

            // Flapping via RT
            if (rtPressed && !lastGamepadState.RT) {
                if (state === STATES.GET_READY) {
                    setState(STATES.PLAYING);
                    flap();
                } else if (state === STATES.PLAYING) {
                    flap();
                }
            }

            lastGamepadState.A = btnA;
            lastGamepadState.RT = rtPressed;
            break; // Only process the first connected gamepad
        }
    }

    // ========================
    // INPUT
    // ========================
    let inputLocked = false;

    function handleInput(e) {
        if (e) e.preventDefault();
        if (inputLocked) return;

        switch (state) {
            case STATES.GET_READY:
                setState(STATES.PLAYING);
                flap();
                break;
            case STATES.PLAYING:
                flap();
                break;
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            handleInput();
        }
    });

    canvas.addEventListener('touchstart', (e) => handleInput(e), { passive: false });
    canvas.addEventListener('mousedown', (e) => handleInput(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    function addButtonListeners(btn, action) {
        btn.addEventListener('click', (e) => { e.stopPropagation(); btn.blur(); action(); });
        btn.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); btn.blur(); action(); });
    }

    addButtonListeners(btnPlay, () => setState(STATES.GET_READY));
    addButtonListeners(btnRetry, () => {
        inputLocked = true;
        setState(STATES.GET_READY);
        setTimeout(() => { inputLocked = false; }, 300);
    });
    addButtonListeners(btnHome, () => setState(STATES.MENU));

    // ========================
    // IDLE ANIMATION
    // ========================
    function updateIdlePlayer(dt) {
        player.idleTime += dt * 0.003;
        player.y = VIRTUAL_H * 0.38 + Math.sin(player.idleTime * 2) * 12;
        player.rotation = Math.sin(player.idleTime * 1.5) * 5;
    }

    // ========================
    // DEBUG: Draw hitboxes (toggle with 'D' key)
    // ========================
    // Debug hitboxes: OFF (toggle with Shift+D if needed)
    let debugHitboxes = false;

    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyD' && e.shiftKey) {
            debugHitboxes = !debugHitboxes;
        }
    });

    function drawDebugHitboxes() {
        if (!debugHitboxes) return;

        ctx.save();

        // --- Player hitbox: GREEN circle ---
        const playerR = PW * CONFIG.PLAYER_HITBOX_R;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(PX, player.y, playerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // --- Tower hitboxes: RED rectangles (exact collision zones) ---
        const hitboxW = CONFIG.TOWER_W * CONFIG.TOWER_HITBOX_W_RATIO;
        const hitboxXOffset = (CONFIG.TOWER_W - hitboxW) / 2;
        const gapInset = CONFIG.TOWER_GAP_INSET;

        towers.forEach(t => {
            const tLeft = t.x - CONFIG.TOWER_W / 2 + hitboxXOffset;

            // Top tower hitbox (with gap inset)
            const topHitEnd = t.topEnd - gapInset;
            if (topHitEnd > 0) {
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
                ctx.fillRect(tLeft, 0, hitboxW, topHitEnd);
                ctx.globalAlpha = 0.7;
                ctx.strokeStyle = '#ff3333';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(tLeft, 0, hitboxW, topHitEnd);
            }

            // Bottom tower hitbox (with gap inset)
            const botHitStart = t.bottomStart + gapInset;
            if (botHitStart < CONFIG.GROUND_Y) {
                const botH = CONFIG.GROUND_Y - botHitStart;
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
                ctx.fillRect(tLeft, botHitStart, hitboxW, botH);
                ctx.globalAlpha = 0.7;
                ctx.strokeStyle = '#ff3333';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(tLeft, botHitStart, hitboxW, botH);
            }

            // Also draw the VISUAL boundary as thin yellow dashes for comparison
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([4, 4]);
            const visualLeft = t.x - CONFIG.TOWER_W / 2;
            if (t.topEnd > 0) {
                ctx.strokeRect(visualLeft, 0, CONFIG.TOWER_W, t.topEnd);
            }
            ctx.strokeRect(visualLeft, t.bottomStart, CONFIG.TOWER_W, CONFIG.GROUND_Y - t.bottomStart);
            ctx.setLineDash([]);
        });

        ctx.restore();
    }

    // ========================
    // MAIN GAME LOOP
    // ========================
    let lastTime = 0;

    function gameLoop(timestamp) {
        const dt = Math.min(timestamp - lastTime, 33);
        lastTime = timestamp;

        pollGamepads();

        // Clear
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

        // UPDATE
        updateBackground();
        updateClouds();
        updateParticles();

        switch (state) {
            case STATES.MENU:
                updateIdlePlayer(dt);
                break;
            case STATES.GET_READY:
                updateIdlePlayer(dt);
                break;
            case STATES.PLAYING:
                updatePlayer(dt);
                updateTowers();
                const col = checkCollisions();
                if (col) triggerGameOver(col);
                break;
            case STATES.FROZEN:
                break;
            case STATES.GAME_OVER:
                break;
        }

        // DRAW (back to front)
        drawBackground();
        drawStars();
        drawClouds();

        if (state === STATES.PLAYING || state === STATES.FROZEN || state === STATES.GAME_OVER) {
            drawTowers();
        }

        drawGround();
        drawParticles();

        if (state !== STATES.MENU) {
            drawPlayer();
        }

        // --- NIGHT LIGHTING OVERLAY ---
        nightAlpha += (targetNightAlpha - nightAlpha) * 0.015;
        if (nightAlpha > 0.01) {
            // Darken everything heavily (simulates loss of sunlight)
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `rgba(10, 15, 30, ${nightAlpha * 0.8})`;
            ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
            
            // Add a blue moonlight tint over everything
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `rgba(20, 30, 80, ${nightAlpha * 0.35})`;
            ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
        }

        drawDebugHitboxes();

        requestAnimationFrame(gameLoop);
    }

    // ========================
    // INIT
    // ========================
    function init() {
        loadAssets(() => {
            // Dynamically generate a high-res, tightly cropped favicon using 'happy' sprite
            try {
                const favCanvas = document.createElement('canvas');
                favCanvas.width = 256;
                favCanvas.height = 256;
                const fCtx = favCanvas.getContext('2d');
                const img = assets.happy; // Using happy sprite
                
                // Calculate center of the current character crop
                const cw = img.naturalWidth * SPRITE_CROP.character.sw;
                const ch = img.naturalHeight * SPRITE_CROP.character.sh;
                const cx = img.naturalWidth * SPRITE_CROP.character.sx + cw / 2;
                const cy = img.naturalHeight * SPRITE_CROP.character.sy + ch / 2;
                
                // Apply a massive zoom factor (e.g. 2.0x) to scale it up heavily
                const zoom = 2.0; 
                const sw = cw / zoom;
                const sh = ch / zoom;
                const sx = cx - sw / 2;
                const sy = cy - sh / 2;
                
                fCtx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256);
                
                const favLink = document.querySelector('link[rel="icon"]');
                if (favLink) favLink.href = favCanvas.toDataURL('image/png');
            } catch (e) {
                console.error('Failed to generate favicon', e);
            }

            initClouds();
            offscreenTowerCanvas = createPreRenderedCylinder();
            menuHighscore.textContent = highScore;
            setState(STATES.MENU);
            requestAnimationFrame(gameLoop);
        });
    }

    init();
})();

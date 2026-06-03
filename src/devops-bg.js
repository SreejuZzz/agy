class ActivePath {
    constructor(gridX, gridY, color, maxSteps, cols, rows) {
        this.history = [{ x: gridX, y: gridY }];
        this.currentStep = 0;
        this.maxSteps = maxSteps;
        this.progress = 0;
        this.color = color;
        this.speed = 0.02 + Math.random() * 0.03; // Smooth packet velocity
        this.isDone = false;
        
        this.from = { x: gridX, y: gridY };
        this.to = null;
        this.findNextTarget(cols, rows);
    }
    
    findNextTarget(cols, rows) {
        const last = this.history[this.history.length - 1];
        const directions = [
            { x: 0, y: -1 }, // Up
            { x: 0, y: 1 },  // Down
            { x: -1, y: 0 }, // Left
            { x: 1, y: 0 }   // Right
        ];
        
        // Randomize directions
        directions.sort(() => Math.random() - 0.5);
        
        for (const dir of directions) {
            const nextX = last.x + dir.x;
            const nextY = last.y + dir.y;
            
            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows) {
                const inHistory = this.history.some(p => p.x === nextX && p.y === nextY);
                if (!inHistory) {
                    this.to = { x: nextX, y: nextY };
                    this.progress = 0;
                    return;
                }
            }
        }
        
        this.isDone = true;
    }
    
    update(cols, rows, onSegmentComplete) {
        if (this.isDone) return;
        
        this.progress += this.speed;
        if (this.progress >= 1) {
            this.progress = 1;
            
            // Push completed segment
            if (onSegmentComplete) {
                onSegmentComplete(this.from, this.to, this.color);
            }
            
            this.history.push({ x: this.to.x, y: this.to.y });
            this.from = { x: this.to.x, y: this.to.y };
            this.currentStep++;
            
            if (this.currentStep >= this.maxSteps) {
                this.isDone = true;
            } else {
                this.findNextTarget(cols, rows);
            }
        }
    }
}

export class ExperienceScanner {
    constructor(container) {
        if (!container) return;
        this.container = container;
        
        if (getComputedStyle(this.container).position === 'static') {
            this.container.style.position = 'relative';
        }
        
        const contentContainer = this.container.querySelector('.container');
        if (contentContainer) {
            contentContainer.style.position = 'relative';
            contentContainer.style.zIndex = '1';
        }
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'exp-net-bg';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '0';
        this.canvas.style.pointerEvents = 'none';
        
        this.container.insertBefore(this.canvas, this.container.firstChild);
        this.ctx = this.canvas.getContext('2d');
        
        this.gridSize = 65; // Balanced grid size
        this.paths = [];
        this.fadingSegments = [];
        this.colors = ['#00ff88', '#00f0ff', '#8a2be2', '#ff5f57', '#febc2e'];
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Initialize standard paths
        this.initPaths();
        
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }
    
    resize() {
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.cols = Math.ceil(this.width / this.gridSize);
        this.rows = Math.ceil(this.height / this.gridSize);
    }
    
    initPaths() {
        this.paths = [];
        const numPaths = 6;
        for (let i = 0; i < numPaths; i++) {
            this.spawnPath();
        }
    }
    
    spawnPath() {
        if (!this.cols || !this.rows) return;
        const startX = Math.floor(Math.random() * this.cols);
        const startY = Math.floor(Math.random() * this.rows);
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const maxSteps = 4 + Math.floor(Math.random() * 5);
        this.paths.push(new ActivePath(startX, startY, color, maxSteps, this.cols, this.rows));
    }
    
    getPixelPos(gridPos) {
        return {
            x: gridPos.x * this.gridSize + this.gridSize / 2,
            y: gridPos.y * this.gridSize + this.gridSize / 2
        };
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const isLight = document.body.classList.contains('light-mode');
        
        // 1. Draw Background Grid Dots
        this.ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.05)';
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                const pos = this.getPixelPos({ x: c, y: r });
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // 2. Update and Draw Completed Fading Segments
        this.fadingSegments.forEach(seg => {
            seg.alpha -= 0.003; // Slow elegant fade out
        });
        this.fadingSegments = this.fadingSegments.filter(seg => seg.alpha > 0);
        
        this.ctx.lineWidth = 1.5;
        this.ctx.lineCap = 'round';
        
        this.fadingSegments.forEach(seg => {
            const fromPos = this.getPixelPos(seg.from);
            const toPos = this.getPixelPos(seg.to);
            
            this.ctx.strokeStyle = seg.color;
            this.ctx.globalAlpha = seg.alpha * (isLight ? 0.35 : 0.25);
            
            this.ctx.beginPath();
            this.ctx.moveTo(fromPos.x, fromPos.y);
            this.ctx.lineTo(toPos.x, toPos.y);
            this.ctx.stroke();
        });
        
        // 3. Update and Draw Active Paths
        this.ctx.globalAlpha = 1.0; // Reset
        this.paths.forEach((path, index) => {
            path.update(this.cols, this.rows, (from, to, color) => {
                // Callback: when segment finishes, add to fading segments
                this.fadingSegments.push({
                    from: { ...from },
                    to: { ...to },
                    color,
                    alpha: 1.0
                });
            });
            
            // Draw completed steps in the current path's history
            this.ctx.lineWidth = 2.0;
            for (let i = 0; i < path.history.length - 1; i++) {
                const p1 = this.getPixelPos(path.history[i]);
                const p2 = this.getPixelPos(path.history[i + 1]);
                
                this.ctx.strokeStyle = path.color;
                this.ctx.globalAlpha = isLight ? 0.4 : 0.3;
                
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
            }
            
            // Draw the current growing segment
            if (path.to && !path.isDone) {
                const pFrom = this.getPixelPos(path.from);
                const pTo = this.getPixelPos(path.to);
                
                const curX = pFrom.x + (pTo.x - pFrom.x) * path.progress;
                const curY = pFrom.y + (pTo.y - pFrom.y) * path.progress;
                
                this.ctx.strokeStyle = path.color;
                this.ctx.globalAlpha = isLight ? 0.55 : 0.45;
                
                this.ctx.beginPath();
                this.ctx.moveTo(pFrom.x, pFrom.y);
                this.ctx.lineTo(curX, curY);
                this.ctx.stroke();
                
                // Draw a pulsing packet dot at the front of the path
                this.ctx.fillStyle = path.color;
                this.ctx.shadowColor = path.color;
                this.ctx.shadowBlur = isLight ? 4 : 8;
                this.ctx.globalAlpha = 1.0;
                
                this.ctx.beginPath();
                this.ctx.arc(curX, curY, 3, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Reset shadow blur
                this.ctx.shadowBlur = 0;
            }
            
            // Respawn path if finished
            if (path.isDone) {
                this.paths[index] = null;
            }
        });
        
        // Clean nulls & respawn
        this.paths = this.paths.filter(p => p !== null);
        while (this.paths.length < 6) {
            this.spawnPath();
        }
        
        requestAnimationFrame(this.animate);
    }
}

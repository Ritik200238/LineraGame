/**
 * Confetti Animation System
 * Creates celebratory confetti effects for victories
 */

class ConfettiManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
        this.isActive = false;
    }

    init() {
        // Create canvas if it doesn't exist
        if (!document.getElementById('confetti-canvas')) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'confetti-canvas';
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = '9999';
            document.body.appendChild(this.canvas);

            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();

            window.addEventListener('resize', () => this.resizeCanvas());
        } else {
            this.canvas = document.getElementById('confetti-canvas');
            this.ctx = this.canvas.getContext('2d');
        }
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticle(x, y) {
        const colors = [
            '#FFD700', // Gold
            '#FFA500', // Orange
            '#FF69B4', // Pink
            '#00CED1', // Turquoise
            '#9370DB', // Purple
            '#32CD32', // Green
            '#FF6347', // Red
            '#4169E1'  // Blue
        ];

        return {
            x: x || Math.random() * this.canvas.width,
            y: y || -10,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            width: Math.random() * 10 + 5,
            height: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            gravity: 0.3,
            drag: 0.98,
            life: 1,
            decay: Math.random() * 0.01 + 0.005,
            shape: Math.random() > 0.5 ? 'rect' : 'circle'
        };
    }

    burst(x, y, count = 50) {
        this.init();

        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle(x, y));
        }

        if (!this.isActive) {
            this.start();
        }
    }

    rain(duration = 5000, density = 3) {
        this.init();
        this.isActive = true;

        const interval = setInterval(() => {
            if (!this.isActive) {
                clearInterval(interval);
                return;
            }

            for (let i = 0; i < density; i++) {
                this.particles.push(this.createParticle());
            }
        }, 50);

        setTimeout(() => {
            clearInterval(interval);
        }, duration);

        this.start();
    }

    celebration() {
        this.init();

        // Multiple bursts from different positions
        const positions = [
            { x: this.canvas.width * 0.2, y: this.canvas.height * 0.3 },
            { x: this.canvas.width * 0.5, y: this.canvas.height * 0.2 },
            { x: this.canvas.width * 0.8, y: this.canvas.height * 0.3 }
        ];

        positions.forEach((pos, index) => {
            setTimeout(() => {
                this.burst(pos.x, pos.y, 80);
            }, index * 200);
        });

        // Add rain effect after bursts
        setTimeout(() => {
            this.rain(4000, 2);
        }, 600);
    }

    start() {
        if (this.animationId) return;

        this.isActive = true;
        this.animate();
    }

    stop() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.clear();
    }

    clear() {
        this.particles = [];
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    animate() {
        if (!this.isActive) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Update physics
            p.vy += p.gravity;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.life -= p.decay;

            // Remove dead particles
            if (p.life <= 0 || p.y > this.canvas.height + 50) {
                this.particles.splice(i, 1);
                continue;
            }

            // Draw particle
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation * Math.PI / 180);

            this.ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                this.ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }

        // Continue animation if particles remain
        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            this.animationId = null;
            this.isActive = false;
        }
    }

    // Preset effects
    victory() {
        this.celebration();
    }

    levelUp() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.burst(centerX, centerY, 60);
    }

    milestone() {
        this.rain(3000, 2);
    }
}

// Create global instance
window.ConfettiManager = new ConfettiManager();

console.log('[Confetti] Animation system loaded');

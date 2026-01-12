/**
 * Cartoon Defense - Visual Effects System
 * Handles projectiles, impacts, muzzle flashes, and particle effects
 */

// ===== Effects Manager =====
const EffectsManager = {
    canvas: null,
    ctx: null,
    projectiles: [],
    particles: [],
    impacts: [],
    damageNumbers: [],
    animationId: null,
    gridElement: null,
    gridRect: null,

    // ===== Initialization =====
    init() {
        this.canvas = document.getElementById('effects-canvas');
        this.gridElement = document.getElementById('game-grid');

        if (!this.canvas || !this.gridElement) {
            console.warn('Effects canvas or grid not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        window.addEventListener('resize', () => this.resizeCanvas());

        this.startAnimationLoop();
        console.log('✨ Effects system initialized');
    },

    resizeCanvas() {
        if (!this.canvas || !this.gridElement) return;

        const wrapper = this.canvas.parentElement;
        this.canvas.width = wrapper.offsetWidth;
        this.canvas.height = wrapper.offsetHeight;

        this.gridRect = this.gridElement.getBoundingClientRect();
    },

    // ===== Animation Loop =====
    startAnimationLoop() {
        const animate = (timestamp) => {
            this.update(timestamp);
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };
        this.animationId = requestAnimationFrame(animate);
    },

    update(timestamp) {
        // Update projectiles
        this.projectiles = this.projectiles.filter(p => {
            p.progress += p.speed;

            if (p.progress >= 1) {
                // Projectile hit - create impact
                this.createImpact(p.endX, p.endY, p.type);
                return false;
            }
            return true;
        });

        // Update particles
        this.particles = this.particles.filter(p => {
            p.life -= 0.02;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity || 0;
            return p.life > 0;
        });

        // Update impacts
        this.impacts = this.impacts.filter(i => {
            i.life -= 0.05;
            i.scale += 0.1;
            return i.life > 0;
        });

        // Update damage numbers
        this.damageNumbers = this.damageNumbers.filter(d => {
            d.life -= 0.02;
            d.y -= 1;
            return d.life > 0;
        });
    },

    render() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render projectiles
        this.projectiles.forEach(p => this.renderProjectile(p));

        // Render particles
        this.particles.forEach(p => this.renderParticle(p));

        // Render impacts
        this.impacts.forEach(i => this.renderImpact(i));

        // Render damage numbers
        this.damageNumbers.forEach(d => this.renderDamageNumber(d));
    },

    // ===== Projectile System =====
    createProjectile(fromX, fromY, toX, toY, type = 'bullet') {
        const projectile = {
            startX: fromX,
            startY: fromY,
            endX: toX,
            endY: toY,
            progress: 0,
            speed: this.getProjectileSpeed(type),
            type: type,
            color: this.getProjectileColor(type)
        };

        this.projectiles.push(projectile);
        this.createMuzzleFlash(fromX, fromY, type);
    },

    getProjectileSpeed(type) {
        const speeds = {
            bullet: 0.08,
            laser: 0.15,
            magic: 0.06,
            ice: 0.07,
            lightning: 0.2
        };
        return speeds[type] || 0.08;
    },

    getProjectileColor(type) {
        const colors = {
            bullet: '#FFD700',
            laser: '#00BCD4',
            magic: '#9C27B0',
            ice: '#64B5F6',
            lightning: '#FFEB3B'
        };
        return colors[type] || '#FFD700';
    },

    renderProjectile(p) {
        const x = p.startX + (p.endX - p.startX) * p.progress;
        const y = p.startY + (p.endY - p.startY) * p.progress;

        const angle = Math.atan2(p.endY - p.startY, p.endX - p.startX);

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        switch (p.type) {
            case 'laser':
                this.renderLaser(p);
                break;
            case 'magic':
                this.renderMagicOrb(p);
                break;
            case 'ice':
                this.renderIceShard(p);
                break;
            case 'lightning':
                this.renderLightningBolt(p);
                break;
            default:
                this.renderBullet(p);
        }

        this.ctx.restore();
    },

    renderBullet(p) {
        // Glowing bullet
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.4, p.color);
        gradient.addColorStop(1, 'transparent');

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Trail
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-15, 0);
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = 0.5;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
    },

    renderLaser(p) {
        // Main beam
        this.ctx.beginPath();
        this.ctx.moveTo(-20, 0);
        this.ctx.lineTo(10, 0);
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Glow
        this.ctx.beginPath();
        this.ctx.moveTo(-20, 0);
        this.ctx.lineTo(10, 0);
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Outer glow
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.moveTo(-20, 0);
        this.ctx.lineTo(10, 0);
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 6;
        this.ctx.globalAlpha = 0.3;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;
    },

    renderMagicOrb(p) {
        // Rotating magic orb
        const time = Date.now() * 0.01;

        // Outer glow
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
        gradient.addColorStop(0, '#E1BEE7');
        gradient.addColorStop(0.5, p.color);
        gradient.addColorStop(1, 'transparent');

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Inner sparkles
        for (let i = 0; i < 4; i++) {
            const angle = (time + i * Math.PI / 2) % (Math.PI * 2);
            const sx = Math.cos(angle) * 5;
            const sy = Math.sin(angle) * 5;

            this.ctx.beginPath();
            this.ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fill();
        }
    },

    renderIceShard(p) {
        // Diamond shape
        this.ctx.beginPath();
        this.ctx.moveTo(8, 0);
        this.ctx.lineTo(0, -5);
        this.ctx.lineTo(-8, 0);
        this.ctx.lineTo(0, 5);
        this.ctx.closePath();

        const gradient = this.ctx.createLinearGradient(-8, 0, 8, 0);
        gradient.addColorStop(0, '#E3F2FD');
        gradient.addColorStop(0.5, p.color);
        gradient.addColorStop(1, '#E3F2FD');

        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        this.ctx.strokeStyle = '#BBDEFB';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Frost trail
        for (let i = 0; i < 5; i++) {
            const tx = -10 - i * 4;
            const ty = (Math.random() - 0.5) * 6;
            this.ctx.beginPath();
            this.ctx.arc(tx, ty, 2 - i * 0.3, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(227, 242, 253, ${0.5 - i * 0.1})`;
            this.ctx.fill();
        }
    },

    renderLightningBolt(p) {
        // Jagged lightning
        this.ctx.beginPath();
        this.ctx.moveTo(-15, 0);
        this.ctx.lineTo(-8, -4);
        this.ctx.lineTo(-4, 2);
        this.ctx.lineTo(2, -3);
        this.ctx.lineTo(8, 1);
        this.ctx.lineTo(15, 0);

        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();

        // Glow
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 5;
        this.ctx.globalAlpha = 0.6;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;
    },

    // ===== Muzzle Flash =====
    createMuzzleFlash(x, y, type) {
        const color = this.getProjectileColor(type);

        // Add flash particles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                life: 0.5,
                color: color,
                size: 4,
                type: 'flash'
            });
        }
    },

    // ===== Particle Creation (God-level Enhancement) =====
    createParticle(x, y, angle, color = '#FFD700') {
        const speed = 3 + Math.random() * 2;
        this.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color: color,
            size: 4 + Math.random() * 3,
            gravity: 0.15,
            type: 'burst'
        });
    },

    // ===== Impact Effects =====
    createImpact(x, y, type = 'bullet') {
        const color = this.getProjectileColor(type);

        this.impacts.push({
            x: x,
            y: y,
            life: 1,
            scale: 1,
            color: color
        });

        // Spawn impact particles
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8,
                color: color,
                size: 3 + Math.random() * 2,
                gravity: 0.1,
                type: 'spark'
            });
        }
    },

    renderImpact(impact) {
        const gradient = this.ctx.createRadialGradient(
            impact.x, impact.y, 0,
            impact.x, impact.y, 20 * impact.scale
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${impact.life})`);
        gradient.addColorStop(0.3, impact.color + Math.floor(impact.life * 200).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, 'transparent');

        this.ctx.beginPath();
        this.ctx.arc(impact.x, impact.y, 20 * impact.scale, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    },

    // ===== Particle Rendering =====
    renderParticle(p) {
        this.ctx.globalAlpha = p.life;

        if (p.type === 'flash') {
            const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            gradient.addColorStop(0, '#FFFFFF');
            gradient.addColorStop(0.5, p.color);
            gradient.addColorStop(1, 'transparent');

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
        } else {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1;
    },

    // ===== Death Effects =====
    createDeathEffect(x, y, enemyColor = '#9C27B0') {
        // Big explosion particles
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: enemyColor,
                size: 4 + Math.random() * 4,
                gravity: 0.15,
                type: 'death'
            });
        }

        // White core particles
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8,
                color: '#FFFFFF',
                size: 3,
                gravity: 0.05,
                type: 'death'
            });
        }

        // Add central flash
        this.impacts.push({
            x: x,
            y: y,
            life: 1,
            scale: 0.5,
            color: enemyColor
        });
    },

    // ===== Damage Numbers =====
    createDamageNumber(x, y, damage, isCrit = false) {
        this.damageNumbers.push({
            x: x,
            y: y,
            damage: damage,
            life: 1,
            isCrit: isCrit
        });
    },

    renderDamageNumber(d) {
        this.ctx.globalAlpha = d.life;
        this.ctx.font = d.isCrit ? 'bold 18px Fredoka One' : 'bold 14px Fredoka One';
        this.ctx.textAlign = 'center';

        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillText(`-${d.damage}`, d.x + 2, d.y + 2);

        // Main text
        this.ctx.fillStyle = d.isCrit ? '#FF5722' : '#FFEB3B';
        this.ctx.fillText(`-${d.damage}`, d.x, d.y);

        this.ctx.globalAlpha = 1;
    },

    // ===== Gold Pickup Effect =====
    createGoldPickup(x, y, amount) {
        // Gold coin particles
        for (let i = 0; i < 6; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2;
            const speed = 2 + Math.random() * 2;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: '#FFD700',
                size: 5,
                gravity: 0.1,
                type: 'coin'
            });
        }

        // Show gold amount
        this.damageNumbers.push({
            x: x,
            y: y - 10,
            damage: `+${amount}`,
            life: 1.2,
            isCrit: false,
            isGold: true
        });
    },

    // ===== Utility Functions =====
    getCellCenter(cellX, cellY) {
        if (!this.gridElement) return { x: 0, y: 0 };

        const cellSize = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--cell-size')) || 32;
        const gridRect = this.gridElement.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();

        const offsetX = gridRect.left - canvasRect.left;
        const offsetY = gridRect.top - canvasRect.top;

        return {
            x: offsetX + cellX * (cellSize + 1) + cellSize / 2 + 4,
            y: offsetY + cellY * (cellSize + 1) + cellSize / 2 + 4
        };
    },

    // Clean up
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.projectiles = [];
        this.particles = [];
        this.impacts = [];
        this.damageNumbers = [];
    }
};

// ===== Announcement Banner System =====
const AnnouncementSystem = {
    banner: null,
    textElement: null,
    timeout: null,

    init() {
        this.banner = document.getElementById('announcement-banner');
        this.textElement = document.getElementById('announcement-text');
        console.log('📢 Announcement system initialized');
    },

    show(text, duration = 2000) {
        if (!this.banner || !this.textElement) return;

        this.textElement.textContent = text;
        this.banner.classList.add('show');

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
            this.hide();
        }, duration);
    },

    hide() {
        if (this.banner) {
            this.banner.classList.remove('show');
        }
    }
};

// ===== Initialize on DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the grid to be set up
    setTimeout(() => {
        EffectsManager.init();
        AnnouncementSystem.init();
    }, 100);
});

// Export for use in game.js
window.EffectsManager = EffectsManager;
window.AnnouncementSystem = AnnouncementSystem;

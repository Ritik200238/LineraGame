/**
 * Toast Notification System
 * Shows toast notifications for multiplayer events
 */

class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.maxNotifications = 5;
        this.init();
    }

    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            this.container.setAttribute('role', 'alert');
            this.container.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    show(message, type = 'info', duration = 4000, icon = null) {
        // Remove oldest if at max
        if (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications.shift();
            if (oldest && oldest.element) {
                oldest.element.remove();
            }
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        // Auto-select icon based on type if not provided
        if (!icon) {
            icon = this.getIconForType(type);
        }

        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" aria-label="Close notification">✕</button>
        `;

        // Add to container
        this.container.appendChild(notification);

        // Add to tracking
        const notificationObj = { element: notification, type };
        this.notifications.push(notificationObj);

        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hide(notification);
        });

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hide(notification);
            }, duration);
        }

        return notification;
    }

    hide(notification) {
        notification.classList.remove('show');
        notification.classList.add('hide');

        setTimeout(() => {
            notification.remove();
            this.notifications = this.notifications.filter(n => n.element !== notification);
        }, 300);
    }

    getIconForType(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            player: '👤',
            game: '🎮',
            victory: '🏆',
            defeat: '💀'
        };
        return icons[type] || 'ℹ️';
    }

    // Convenience methods for common notification types
    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 4500) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }

    playerJoined(playerName) {
        return this.show(`${playerName} joined the game`, 'player', 4000, '👋');
    }

    playerLeft(playerName) {
        return this.show(`${playerName} left the game`, 'player', 4000, '👋');
    }

    playerReady(playerName) {
        return this.show(`${playerName} is ready`, 'success', 3000, '✅');
    }

    gameStarting(countdown) {
        return this.show(`Game starting in ${countdown}...`, 'game', 1000, '🎮');
    }

    towerPlaced(playerName, towerType) {
        return this.show(`${playerName} placed ${towerType} tower`, 'info', 2000, '🏗️');
    }

    waveStarted(playerName, waveNumber) {
        return this.show(`${playerName} started wave ${waveNumber}`, 'info', 3000, '🌊');
    }

    playerDefeated(playerName) {
        return this.show(`${playerName} was eliminated!`, 'defeat', 5000, '💀');
    }

    gameVictory(winnerName) {
        return this.show(`🎉 ${winnerName} wins!`, 'victory', 0, '🏆'); // No auto-hide
    }

    clearAll() {
        this.notifications.forEach(n => {
            if (n.element) {
                n.element.remove();
            }
        });
        this.notifications = [];
    }
}

// Create global instance
window.NotificationManager = new NotificationManager();

// Add CSS styles dynamically
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
    pointer-events: none;
}

.notification {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(26, 26, 46, 0.98);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    transform: translateX(120%);
    transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    opacity: 0;
    pointer-events: auto;
}

.notification.show {
    transform: translateX(0);
    opacity: 1;
}

.notification.hide {
    transform: translateX(120%);
    opacity: 0;
}

.notification-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
}

.notification-content {
    flex: 1;
    min-width: 0;
}

.notification-message {
    color: #fff;
    font-size: 0.95rem;
    line-height: 1.4;
    word-wrap: break-word;
}

.notification-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.notification-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.notification-success {
    border-left: 4px solid #4CAF50;
}

.notification-error {
    border-left: 4px solid #f44336;
}

.notification-warning {
    border-left: 4px solid #FFC107;
}

.notification-info {
    border-left: 4px solid #2196F3;
}

.notification-player {
    border-left: 4px solid #9C27B0;
}

.notification-game {
    border-left: 4px solid #FF9800;
}

.notification-victory {
    border-left: 4px solid #FFD700;
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(26, 26, 46, 0.98) 100%);
    animation: victoryPulse 2s ease-in-out infinite;
}

.notification-defeat {
    border-left: 4px solid #666;
}

@keyframes victoryPulse {
    0%, 100% {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    50% {
        box-shadow: 0 8px 32px rgba(255, 215, 0, 0.4);
    }
}

@media (max-width: 768px) {
    .notification-container {
        right: 10px;
        left: 10px;
        max-width: none;
    }

    .notification {
        padding: 12px;
    }

    .notification-icon {
        font-size: 1.2rem;
    }

    .notification-message {
        font-size: 0.9rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .notification {
        transition: opacity 0.1s ease;
        animation: none !important;
    }

    .notification.show {
        transform: translateX(0);
    }

    .notification.hide {
        transform: translateX(0);
    }
}
`;
document.head.appendChild(notificationStyles);

console.log('[Notifications] Toast notification system loaded');

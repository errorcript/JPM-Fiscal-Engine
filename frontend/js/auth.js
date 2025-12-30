const SimpleAuth = {
    // Secure Hash (SHA-256)
    pinHash: "d3c18bb33ebb2bc7717786b6e4b438c23d20024dc5c6b6a5387fb971a9cef6cc",
    inactivityTime: 5 * 60 * 1000, // 5 Minutes
    timer: null,

    init: () => {
        return; // PIN NONAKTIF SEMENTARA

        // Cek apakah sudah login di sesi ini
        if (sessionStorage.getItem('neoma_auth')) {
            SimpleAuth.startIdleTimer();
            return;
        }

        // Jika belum, render Lock Screen
        SimpleAuth.renderLockScreen();
    },

    // Helper: Generate SHA-256 Hash
    hash: async (string) => {
        const utf8 = new TextEncoder().encode(string);
        const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    startIdleTimer: () => {
        // Reset timer on activity (Use addEventListener to avoid conflicts)
        window.addEventListener('load', SimpleAuth.resetTimer);
        document.addEventListener('mousemove', SimpleAuth.resetTimer);
        document.addEventListener('keydown', SimpleAuth.resetTimer);
        document.addEventListener('click', SimpleAuth.resetTimer);
        document.addEventListener('scroll', SimpleAuth.resetTimer);

        SimpleAuth.resetTimer();
    },

    resetTimer: () => {
        clearTimeout(SimpleAuth.timer);
        SimpleAuth.timer = setTimeout(SimpleAuth.lockApp, SimpleAuth.inactivityTime);
    },

    lockApp: () => {
        sessionStorage.removeItem('neoma_auth');
        SimpleAuth.renderLockScreen();
    },

    renderLockScreen: () => {
        // Prevent duplicate overlays
        if (document.getElementById('auth-overlay')) return;

        // CSS untuk Lock Screen
        const css = `
            #auth-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: #0f172a;
                z-index: 10000;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                color: white; font-family: 'Inter', sans-serif;
            }
            .pin-display {
                display: flex; gap: 1rem; margin-bottom: 2rem;
            }
            .pin-dot {
                width: 16px; height: 16px;
                border-radius: 50%;
                border: 2px solid #3b82f6;
                transition: all 0.2s;
            }
            .pin-dot.filled { background: #3b82f6; box-shadow: 0 0 10px #3b82f6; }
            .numpad {
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
            }
            .num-btn {
                width: 64px; height: 64px;
                border-radius: 50%;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.05);
                color: white; font-size: 1.5rem;
                cursor: pointer; transition: all 0.2s;
                display: flex; align-items: center; justify-content: center;
            }
            .num-btn:hover { background: rgba(255,255,255,0.1); }
            .num-btn:active { transform: scale(0.95); }
        `;

        // Inject CSS if not exists
        if (!document.getElementById('auth-style')) {
            const style = document.createElement('style');
            style.id = 'auth-style';
            style.innerHTML = css;
            document.head.appendChild(style);
        }

        // HTML Lock Screen
        const overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.innerHTML = `
            <div style="text-align:center; margin-bottom:2rem;">
                <div style="font-size:3rem; margin-bottom:1rem;">🔒</div>
                <h2 style="margin:0;">Neoma Secure</h2>
                <p style="color:#94a3b8; margin:0.5rem 0 0;">Sesi Kedaluwarsa. Masukkan PIN.</p>
            </div>
            
            <div class="pin-display" id="pinDots">
                <div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div>
                <div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div>
            </div>

            <div class="numpad">
                <button class="num-btn" onclick="SimpleAuth.addNum(1)">1</button>
                <button class="num-btn" onclick="SimpleAuth.addNum(2)">2</button>
                <button class="num-btn" onclick="SimpleAuth.addNum(3)">3</button>
                <button class="num-btn" onclick="SimpleAuth.addNum(4)">4</button>
                <button class="num-btn" onclick="SimpleAuth.addNum(5)">5</button>
                <button class="num-btn" onclick="SimpleAuth.addNum(6)">6</button>
                <button class="num-btn" onclick="SimpleAuth.addNum(7)">7</button>
                <button class="num-btn" onclick="SimpleAuth.addNum(8)">8</button>
                <button class="num-btn" onclick="SimpleAuth.addNum(9)">9</button>
                <button class="num-btn" style="opacity:0; cursor:default;"></button>
                <button class="num-btn" onclick="SimpleAuth.addNum(0)">0</button>
                <button class="num-btn" onclick="SimpleAuth.clear()" style="font-size:1rem;">⌫</button>
            </div>
        `;
        document.body.appendChild(overlay);
        SimpleAuth.currentInput = "";

        // Stop timer while locked
        clearTimeout(SimpleAuth.timer);

        // Activate Keyboard Input
        document.addEventListener('keydown', SimpleAuth.handleKeyDown);
    },

    currentInput: "",

    addNum: (num) => {
        if (SimpleAuth.currentInput.length < 6) {
            SimpleAuth.currentInput += num;
            SimpleAuth.updateDots();
            if (SimpleAuth.currentInput.length === 6) {
                setTimeout(SimpleAuth.checkPin, 200);
            }
        }
    },

    clear: () => {
        SimpleAuth.currentInput = SimpleAuth.currentInput.slice(0, -1);
        SimpleAuth.updateDots();
    },

    updateDots: () => {
        const dots = document.querySelectorAll('.pin-dot');
        dots.forEach((dot, idx) => {
            if (idx < SimpleAuth.currentInput.length) dot.classList.add('filled');
            else dot.classList.remove('filled');
        });
    },

    checkPin: async () => {
        // Cek PIN
        const savedPin = localStorage.getItem('neoma_pin');
        let isValid = false;

        if (savedPin) {
            // Legacy: Check if user has custom plain text pin
            isValid = (SimpleAuth.currentInput === savedPin);
        } else {
            // Default: Check Hash
            try {
                const inputHash = await SimpleAuth.hash(SimpleAuth.currentInput);
                isValid = (inputHash === SimpleAuth.pinHash);
            } catch (e) {
                console.error("Crypto Error (Non-Secure Context?):", e);
                // Fallback panic mostly for dev
                alert("Browser tidak mendukung keamanan ini. Gunakan localhost/HTTPS.");
            }
        }

        if (isValid) {
            sessionStorage.setItem('neoma_auth', 'true');
            const overlay = document.getElementById('auth-overlay');
            if (overlay) {
                overlay.style.transition = 'opacity 0.3s';
                overlay.style.opacity = '0';
            }

            // Remove Keyboard Listener
            document.removeEventListener('keydown', SimpleAuth.handleKeyDown);

            setTimeout(() => {
                if (overlay) overlay.remove();
                SimpleAuth.startIdleTimer(); // Start timer again
            }, 300);
        } else {
            alert("PIN Salah! Coba lagi.");
            SimpleAuth.currentInput = "";
            SimpleAuth.updateDots();
        }
    },

    handleKeyDown: (e) => {
        // Only active if locked
        if (!document.getElementById('auth-overlay')) return;

        if (e.key >= '0' && e.key <= '9') {
            SimpleAuth.addNum(e.key);
        } else if (e.key === 'Backspace') {
            SimpleAuth.clear();
        }
    }
};

// Auto Init
document.addEventListener('DOMContentLoaded', SimpleAuth.init);

/**
 * SmartPanel Web — Context Menu
 * 
 * Dynamiczne menu kontekstowe (prawy klik).
 * Buduje listę opcji w zależności od kontekstu selekcji.
 */

export class ContextMenu {
    _el: HTMLElement | null = null;
    _actionCallback: Function | null = null;
    _boundClose: (e: MouseEvent) => void;
    _boundKeydown: (e: KeyboardEvent) => void;

    constructor() {
        this._el = null;
        this._actionCallback = null;
        this._boundClose = this._handleOutsideClick.bind(this);
        this._boundKeydown = this._handleKeydown.bind(this);
    }

    /**
     * Wyświetla menu kontekstowe w podanych współrzędnych.
     * @param {number} x - clientX
     * @param {number} y - clientY
     * @param {Array<{label: string, icon?: string, action: string, separator?: boolean, disabled?: boolean}>} items
     */
    show(x, y, items) {
        this.hide();

        const menu = document.createElement('div');
        menu.className = 'ctx-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        for (const item of items) {
            if (item.separator) {
                const sep = document.createElement('div');
                sep.className = 'ctx-menu-separator';
                menu.appendChild(sep);
                continue;
            }

            const btn = document.createElement('button');
            btn.className = 'ctx-menu-item';
            if (item.disabled) {
                btn.classList.add('disabled');
                btn.disabled = true;
            }

            if (item.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'ctx-menu-icon';
                iconSpan.innerHTML = item.icon;
                btn.appendChild(iconSpan);
            }

            const labelSpan = document.createElement('span');
            labelSpan.className = 'ctx-menu-label';
            labelSpan.textContent = item.label;
            btn.appendChild(labelSpan);

            if (item.shortcut) {
                const shortcutSpan = document.createElement('span');
                shortcutSpan.className = 'ctx-menu-shortcut';
                shortcutSpan.textContent = item.shortcut;
                btn.appendChild(shortcutSpan);
            }

            btn.addEventListener('click', () => {
                if (!item.disabled && this._actionCallback) {
                    this._actionCallback(item.action, item);
                }
                this.hide();
            });

            menu.appendChild(btn);
        }

        document.body.appendChild(menu);
        this._el = menu;

        // Upewnij się, że menu nie wychodzi poza ekran
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = (x - rect.width) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = (y - rect.height) + 'px';
            }
        });

        // Zamknij przy kliknięciu poza menu / ESC
        setTimeout(() => {
            document.addEventListener('mousedown', this._boundClose);
            document.addEventListener('keydown', this._boundKeydown);
        }, 0);
    }

    /**
     * Ukrywa menu kontekstowe.
     */
    hide() {
        if (this._el) {
            this._el.remove();
            this._el = null;
        }
        document.removeEventListener('mousedown', this._boundClose);
        document.removeEventListener('keydown', this._boundKeydown);
    }

    /**
     * Rejestruje callback wywoływany po wybraniu opcji.
     * @param {Function} fn - callback(actionName, itemData)
     */
    onAction(fn) {
        this._actionCallback = fn;
    }

    /** @private */
    _handleOutsideClick(e) {
        if (this._el && !this._el.contains(e.target)) {
            this.hide();
        }
    }

    /** @private */
    _handleKeydown(e) {
        if (e.key === 'Escape') {
            this.hide();
        }
    }
}

/**
 * SmartPanel Web — Context Menu
 *
 * Dynamiczne menu kontekstowe (prawy klik).
 * Wspiera klasyczne wiersze oraz zwarte paski ikon z podpisami (jak toolbar formularza).
 */

export type CtxMenuItem = {
    label?: string;
    /** Krótki podpis pod ikoną (gdy brak — skrót z label). */
    caption?: string;
    icon?: string;
    action?: string;
    separator?: boolean;
    disabled?: boolean;
    shortcut?: string;
    /** Nagłówek sekcji nad paskiem / blokiem. */
    section?: string;
    /** Zwarty pasek ikon obok siebie. */
    toolbar?: CtxMenuItem[];
};

function shortCaption(item: CtxMenuItem): string {
    if (item.caption !== undefined) return item.caption;
    const label = String(item.label || '').trim();
    if (!label) return '';
    // Skróć dłuższe etykiety do czytelnego podpisu pod ikoną
    if (label.length <= 10) return label;
    return label.split(/[\s·—\-–(/]+/)[0].slice(0, 10);
}

export class ContextMenu {
    _el: HTMLElement | null = null;
    _actionCallback: Function | null = null;
    _boundClose: (e: Event) => void;
    _boundKeydown: (e: KeyboardEvent) => void;

    constructor() {
        this._el = null;
        this._actionCallback = null;
        this._boundClose = this._handleOutsideClick.bind(this);
        this._boundKeydown = this._handleKeydown.bind(this);
    }

    show(x: number, y: number, items: CtxMenuItem[], title?: string) {
        this.hide();
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('cad-close-floating-edit'));
        }

        const menu = document.createElement('div');
        menu.className = 'ctx-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Nagłówek z przyciskiem zamknięcia (X)
        const header = document.createElement('div');
        header.className = 'ctx-menu-header';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'ctx-menu-header-title';
        titleSpan.textContent = title || 'Narzędzia';
        header.appendChild(titleSpan);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'ctx-menu-close-btn';
        closeBtn.title = 'Zamknij menu (Esc)';
        closeBtn.setAttribute('aria-label', 'Zamknij');
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });
        header.appendChild(closeBtn);
        menu.appendChild(header);

        for (const item of items) {
            if (item.separator) {
                const sep = document.createElement('div');
                sep.className = 'ctx-menu-separator';
                menu.appendChild(sep);
                continue;
            }

            if (item.section && !item.toolbar && !item.action) {
                menu.appendChild(this._buildSectionTitle(item.section));
                continue;
            }

            if (Array.isArray(item.toolbar) && item.toolbar.length > 0) {
                if (item.section) {
                    const group = document.createElement('div');
                    group.className = 'ctx-menu-group';

                    const vLabel = document.createElement('div');
                    vLabel.className = 'ctx-menu-vlabel';
                    vLabel.textContent = item.section;
                    group.appendChild(vLabel);

                    group.appendChild(this._buildToolbar(item.toolbar));
                    menu.appendChild(group);
                } else {
                    menu.appendChild(this._buildToolbar(item.toolbar));
                }
                continue;
            }

            if (item.section) {
                menu.appendChild(this._buildSectionTitle(item.section));
            }
            menu.appendChild(this._buildRowItem(item));
        }

        document.body.appendChild(menu);
        this._el = menu;

        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = Math.max(8, window.innerWidth - rect.width - 8) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = Math.max(8, window.innerHeight - rect.height - 8) + 'px';
            }
        });

        setTimeout(() => {
            window.addEventListener('pointerdown', this._boundClose, true);
            window.addEventListener('mousedown', this._boundClose, true);
            window.addEventListener('keydown', this._boundKeydown, true);
        }, 10);
    }

    hide() {
        if (this._el) {
            this._el.remove();
            this._el = null;
        }
        window.removeEventListener('pointerdown', this._boundClose, true);
        window.removeEventListener('mousedown', this._boundClose, true);
        window.removeEventListener('keydown', this._boundKeydown, true);
        document.removeEventListener('mousedown', this._boundClose);
        document.removeEventListener('keydown', this._boundKeydown);
    }

    onAction(fn: Function) {
        this._actionCallback = fn;
    }

    private _buildSectionTitle(text: string): HTMLElement {
        const el = document.createElement('div');
        el.className = 'ctx-menu-section';
        el.textContent = text;
        return el;
    }

    private _buildToolbar(tools: CtxMenuItem[]): HTMLElement {
        const row = document.createElement('div');
        row.className = 'ctx-menu-toolbar';
        row.setAttribute('role', 'toolbar');

        for (const tool of tools) {
            if (!tool || tool.separator) continue;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ctx-menu-tool';
            if (tool.disabled) {
                btn.classList.add('disabled');
                btn.disabled = true;
            }
            const fullLabel = tool.label || tool.action || '';
            btn.title = fullLabel;
            btn.setAttribute('aria-label', fullLabel);

            if (tool.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'ctx-menu-tool-icon';
                iconSpan.innerHTML = tool.icon;
                btn.appendChild(iconSpan);
            }

            const cap = shortCaption(tool);
            if (cap) {
                const capSpan = document.createElement('span');
                capSpan.className = 'ctx-menu-tool-caption';
                capSpan.textContent = cap;
                btn.appendChild(capSpan);
            }

            btn.addEventListener('click', () => {
                if (!tool.disabled && tool.action && this._actionCallback) {
                    this._actionCallback(tool.action, tool);
                }
                this.hide();
            });

            row.appendChild(btn);
        }

        return row;
    }

    private _buildRowItem(item: CtxMenuItem): HTMLElement {
        const btn = document.createElement('button');
        btn.type = 'button';
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
        labelSpan.textContent = item.label || '';
        btn.appendChild(labelSpan);

        if (item.shortcut) {
            const shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'ctx-menu-shortcut';
            shortcutSpan.textContent = item.shortcut;
            btn.appendChild(shortcutSpan);
        }

        btn.addEventListener('click', () => {
            if (item.action === '__close__') {
                this.hide();
                return;
            }
            if (!item.disabled && item.action && this._actionCallback) {
                this._actionCallback(item.action, item);
            }
            this.hide();
        });

        return btn;
    }

    /** @private */
    _handleOutsideClick(e: Event) {
        if (this._el && !this._el.contains(e.target as Node)) {
            this.hide();
        }
    }

    /** @private */
    _handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.hide();
        }
    }
}

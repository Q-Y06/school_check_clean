(function () {
    const STORAGE_KEY = 'swpuAiCharacterPosition';
    const PANEL_SIZE_KEY = 'swpuAiCharacterPanelSize';
    const CHAT_SIZE_KEY = 'swpuAiCharacterChatSize';
    const SETTINGS_SIZE_KEY = 'swpuAiCharacterSettingsSize';
    const history = [];
    const text = {
        tip: '\u6211\u662f\u5c0f\u5de1\uff0c\u53ef\u62d6\u52a8',
        title: '\u5c0f\u5de1\u52a9\u624b',
        subtitle: '\u53ef\u62d6\u52a8\uff0c\u4e5f\u53ef\u968f\u65f6\u53eb\u6211',
        aiAnswer: 'AI\u56de\u7b54',
        aiSettings: 'AI\u8bbe\u7f6e',
        pending: '\u5f85\u5de1\u68c0',
        duty: '\u4eca\u65e5\u503c\u73ed',
        records: '\u5de1\u68c0\u8bb0\u5f55',
        shortcut: '\u5feb\u6377\u5165\u53e3',
        askPlaceholder: '\u95ee\u5c0f\u5de1\uff1a\u5982\u4eca\u5929\u8fd8\u6709\u54ea\u4e9b\u672a\u5de1\u68c0\uff1f',
        askButton: '\u63d0\u95ee',
        thinking: '\u5c0f\u5de1\u6b63\u5728\u601d\u8003...',
        apiMissing: '\u95ee\u7b54\u63a5\u53e3\u5df2\u9884\u7559\uff0c\u4f46\u8fd8\u6ca1\u6709\u914d\u7f6e AI API Key\u3002\u540e\u7eed\u586b\u597d key \u540e\u5c31\u53ef\u4ee5\u771f\u6b63\u8c03\u7528 AI \u56de\u7b54\u3002',
        askError: 'AI \u8fde\u63a5\u5f02\u5e38\uff0c\u8bf7\u68c0\u67e5\u540e\u7aef\u670d\u52a1\u3001\u7f51\u7edc\u6216 AI \u914d\u7f6e\u3002'
    };

    class SwpuAiCharacter {
        constructor() {
            this.root = null;
            this.panelMessage = null;
            this.askInput = null;
            this.askButton = null;
            this.chatMessages = null;
            this.tipTimer = null;
            this.activeBubble = null;
            this.drag = {
                active: false,
                moved: false,
                pointerId: null,
                startX: 0,
                startY: 0,
                offsetX: 0,
                offsetY: 0
            };
            this.bubbleDrag = {
                active: false,
                target: null,
                pointerId: null,
                offsetX: 0,
                offsetY: 0
            };
            this.resize = {
                active: false,
                pointerId: null,
                target: null,
                startX: 0,
                startY: 0,
                startWidth: 0,
                startHeight: 0
            };
            this.init();
        }

        init() {
            if (document.querySelector('.ai-character')) return;
            this.createElement();
            document.body.appendChild(this.root);
            this.restorePosition();
            this.restoreBubbleSizes();
            this.bindEvents();
            this.scheduleTipHide();
            setTimeout(() => this.say(this.getWelcomeText()), 180);
        }

        createElement() {
            const root = document.createElement('div');
            root.className = 'ai-character';
            root.innerHTML = `
                <div class="ai-character-tip">${text.tip}</div>
                <div class="ai-character-panel" role="dialog" aria-label="${text.title}">
                    <div class="ai-character-panel-header">
                        <div>
                            <strong>${text.title}</strong>
                            <span>${text.subtitle}</span>
                        </div>
                        <button class="ai-character-close" type="button" aria-label="\u5173\u95ed"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="ai-character-message"></div>
                    <div class="ai-character-followups"></div>
                    <div class="ai-character-actions">
                        <button class="ai-character-action" type="button" data-ai-action="aiChat"><i class="fas fa-comments"></i>${text.aiAnswer}</button>
                        <button class="ai-character-action" type="button" data-ai-action="aiSettings"><i class="fas fa-sliders"></i>${text.aiSettings}</button>
                        <button class="ai-character-action" type="button" data-ai-action="pending"><i class="fas fa-clipboard-list"></i>${text.pending}</button>
                        <button class="ai-character-action" type="button" data-ai-action="duty"><i class="fas fa-calendar-check"></i>${text.duty}</button>
                        <button class="ai-character-action" type="button" data-ai-action="records"><i class="fas fa-clock-rotate-left"></i>${text.records}</button>
                        <button class="ai-character-action" type="button" data-ai-action="jump"><i class="fas fa-location-arrow"></i>${text.shortcut}</button>
                    </div>
                    ${this.renderResizeHandles('panel')}
                </div>
                <div class="ai-character-settings-bubble" role="dialog" aria-label="AI\u8bbe\u7f6e">
                    <div class="ai-character-panel-header">
                        <div>
                            <strong>AI\u8bbe\u7f6e</strong>
                            <span>\u53ef\u9009\u540e\u53f0\u9ed8\u8ba4\u6216\u4e2a\u4eba\u914d\u7f6e</span>
                        </div>
                        <button class="ai-settings-close" type="button" aria-label="\u5173\u95ed"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="ai-chat-settings">
                        <label class="ai-setting-option">
                            <input type="radio" name="swpuAiMode" value="backend">
                            <span>\u4f7f\u7528\u540e\u53f0\u9ed8\u8ba4 API Key \u548c\u6a21\u578b</span>
                        </label>
                        <label class="ai-setting-option">
                            <input type="radio" name="swpuAiMode" value="custom">
                            <span>\u4f7f\u7528\u6211\u81ea\u5df1\u7684 API Key \u548c\u6a21\u578b</span>
                        </label>
                        <input class="ai-setting-input" id="swpuAiCustomKey" type="password" placeholder="AI API Key">
                        <input class="ai-setting-input" id="swpuAiCustomModel" type="text" placeholder="\u4f8b\u5982 deepseek-chat / gpt-4o-mini / qwen-plus">
                        <input class="ai-setting-input" id="swpuAiCustomUrl" type="text" placeholder="\u4f8b\u5982 https://api.deepseek.com/chat/completions">
                        <button class="ai-setting-test" type="button">\u6821\u9a8c AI \u914d\u7f6e</button>
                        <button class="ai-setting-save" type="button">\u4fdd\u5b58 AI \u8bbe\u7f6e</button>
                        <p class="ai-setting-note">\u4e2a\u4eba\u914d\u7f6e\u53ea\u4fdd\u5b58\u5728\u5f53\u524d\u6d4f\u89c8\u5668\u3002</p>
                    </div>
                    ${this.renderResizeHandles('settings')}
                </div>
                <div class="ai-character-chat-bubble" role="dialog" aria-label="AI\u56de\u7b54">
                    <div class="ai-character-panel-header">
                        <div>
                            <strong>AI\u56de\u7b54</strong>
                            <span>\u548c\u5c0f\u5de1\u7ee7\u7eed\u804a\u5de1\u68c0\u95ee\u9898</span>
                        </div>
                        <button class="ai-chat-close" type="button" aria-label="\u5173\u95ed"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="ai-chat-messages"></div>
                    <form class="ai-character-ask">
                        <input class="ai-character-input" type="text" maxlength="300" placeholder="${text.askPlaceholder}">
                        <button class="ai-character-submit" type="submit">${text.askButton}</button>
                    </form>
                    ${this.renderResizeHandles('chat')}
                </div>
                <button class="ai-character-person" type="button" aria-label="${text.title}">
                    <span class="ai-character-shadow"></span>
                    <span class="ai-character-body"><span class="ai-character-badge"><i class="fas fa-bolt"></i></span></span>
                    <span class="ai-character-head">
                        <span class="ai-character-eye left"></span>
                        <span class="ai-character-eye right"></span>
                        <span class="ai-character-mouth"></span>
                    </span>
                </button>
            `;
            this.root = root;
            this.panelMessage = root.querySelector('.ai-character-message');
            this.askInput = root.querySelector('.ai-character-input');
            this.askButton = root.querySelector('.ai-character-submit');
            this.chatMessages = root.querySelector('.ai-chat-messages');
        }

        renderResizeHandles(target) {
            return ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
                .map((edge) => `<span class="ai-bubble-resizer ai-resize-${edge}" data-ai-resize="${target}" data-ai-edge="${edge}"></span>`)
                .join('');
        }

        bindEvents() {
            const person = this.root.querySelector('.ai-character-person');
            person.addEventListener('pointerdown', (event) => this.startDrag(event));
            this.root.querySelectorAll('.ai-character-panel-header').forEach((header) => {
                header.addEventListener('pointerdown', (event) => this.startBubbleDrag(event, this.getBubbleTargetFromElement(header)));
                header.addEventListener('click', (event) => {
                    if (!event.target.closest('button')) {
                        event.stopPropagation();
                    }
                });
            });
            person.addEventListener('click', (event) => {
                event.preventDefault();
                if (this.drag.moved) return;
                this.togglePanel();
            });
            this.bindCloseButton('.ai-character-close', () => this.closePanel());
            this.bindCloseButton('.ai-chat-close', () => this.closeAiChat());
            this.bindCloseButton('.ai-settings-close', () => this.closeAiSettings());
            this.root.querySelectorAll('[data-ai-action]').forEach((button) => {
                button.addEventListener('click', () => this.handleAction(button.dataset.aiAction));
            });
            this.root.querySelector('.ai-character-followups')?.addEventListener('click', (event) => {
                const button = event.target.closest('[data-ai-followup]');
                if (!button) return;
                this.handleFollowup(button.dataset.aiFollowup);
            });
            this.root.querySelector('.ai-character-ask')?.addEventListener('submit', (event) => {
                event.preventDefault();
                this.askAi();
            });
            this.root.querySelector('.ai-setting-test')?.addEventListener('click', () => this.validateAiSettingsFromPanel());
            this.root.querySelector('.ai-setting-save')?.addEventListener('click', () => this.saveAiUserSettings());
            this.root.querySelectorAll('input[name="swpuAiMode"]').forEach((radio) => {
                radio.addEventListener('change', () => this.updateAiSettingInputsState());
            });
            this.root.querySelectorAll('[data-ai-resize]').forEach((handle) => {
                handle.addEventListener('pointerdown', (event) => this.startResize(event, handle.dataset.aiResize, handle.dataset.aiEdge));
            });
            ['panel', 'chat', 'settings'].forEach((target) => {
                const bubble = this.getResizableBubble(target);
                bubble?.addEventListener('pointerdown', () => this.setActiveBubble(target), true);
                bubble?.addEventListener('focusin', () => this.setActiveBubble(target));
            });
            this.updatePermissionView();
            window.addEventListener('resize', () => this.keepInViewport());
            document.addEventListener('dblclick', (event) => {
                if (!this.getOpenBubbleTargets().length) return;
                if (this.root.contains(event.target)) return;
                this.closeAllBubbles();
            });
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') this.closeActiveBubble();
            });
        }

        bindCloseButton(selector, closeAction) {
            const button = this.root.querySelector(selector);
            if (!button) return;
            button.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                closeAction();
            });
        }

        getBubbleTargetFromElement(element) {
            if (element.closest('.ai-character-chat-bubble')) return 'chat';
            if (element.closest('.ai-character-settings-bubble')) return 'settings';
            return 'panel';
        }

        startDrag(event) {
            if (event.button !== undefined && event.button !== 0) return;
            const interactiveTarget = event.target.closest('button, input, textarea, select, a');
            if (interactiveTarget && !interactiveTarget.classList.contains('ai-character-person')) return;
            event.preventDefault();
            this.hideTip();
            const rect = this.root.getBoundingClientRect();
            this.drag = {
                active: true,
                moved: false,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
            };
            this.root.classList.add('is-dragging');
            event.currentTarget?.setPointerCapture?.(event.pointerId);
            window.addEventListener('pointermove', this.onPointerMove);
            window.addEventListener('pointerup', this.onPointerUp);
        }

        startBubbleDrag(event, target) {
            if (event.button !== undefined && event.button !== 0) return;
            if (!target || event.target.closest('button, input, textarea, select, a')) return;
            const bubble = this.getResizableBubble(target);
            if (!bubble) return;
            event.preventDefault();
            event.stopPropagation();
            this.hideTip();
            this.setActiveBubble(target);
            const rect = bubble.getBoundingClientRect();
            this.bubbleDrag = {
                active: true,
                target,
                pointerId: event.pointerId,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
            };
            bubble.classList.add('is-dragging-bubble');
            event.currentTarget?.setPointerCapture?.(event.pointerId);
            window.addEventListener('pointermove', this.onBubbleDragMove);
            window.addEventListener('pointerup', this.onBubbleDragEnd);
        }

        onBubbleDragMove = (event) => {
            if (!this.bubbleDrag.active || event.pointerId !== this.bubbleDrag.pointerId) return;
            this.setBubblePosition(
                this.bubbleDrag.target,
                event.clientX - this.bubbleDrag.offsetX,
                event.clientY - this.bubbleDrag.offsetY
            );
        };

        onBubbleDragEnd = (event) => {
            if (!this.bubbleDrag.active || event.pointerId !== this.bubbleDrag.pointerId) return;
            const bubble = this.getResizableBubble(this.bubbleDrag.target);
            bubble?.classList.remove('is-dragging-bubble');
            this.ensureBubbleVisible(this.bubbleDrag.target);
            this.bubbleDrag = { active: false, target: null, pointerId: null, offsetX: 0, offsetY: 0 };
            window.removeEventListener('pointermove', this.onBubbleDragMove);
            window.removeEventListener('pointerup', this.onBubbleDragEnd);
        };

        onPointerMove = (event) => {
            if (!this.drag.active || event.pointerId !== this.drag.pointerId) return;
            const moveDistance = Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY);
            if (moveDistance > 4) {
                this.drag.moved = true;
            }
            this.setPosition(event.clientX - this.drag.offsetX, event.clientY - this.drag.offsetY);
        };

        onPointerUp = (event) => {
            if (!this.drag.active || event.pointerId !== this.drag.pointerId) return;
            this.drag.active = false;
            this.root.classList.remove('is-dragging');
            this.keepInViewport();
            this.ensureOpenBubblesVisible();
            this.savePosition();
            window.removeEventListener('pointermove', this.onPointerMove);
            window.removeEventListener('pointerup', this.onPointerUp);
            setTimeout(() => {
                this.drag.moved = false;
            }, 0);
        };

        startResize(event, target, edge) {
            event.preventDefault();
            event.stopPropagation();
            const bubble = this.getResizableBubble(target);
            if (!bubble) return;
            const rect = bubble.getBoundingClientRect();
            this.resize = {
                active: true,
                pointerId: event.pointerId,
                target,
                edge,
                startX: event.clientX,
                startY: event.clientY,
                startWidth: rect.width,
                startHeight: rect.height,
                startLeft: rect.left,
                startTop: rect.top
            };
            bubble.classList.add('is-resizing');
            event.currentTarget.setPointerCapture(event.pointerId);
            window.addEventListener('pointermove', this.onResizeMove);
            window.addEventListener('pointerup', this.onResizeEnd);
        }

        onResizeMove = (event) => {
            if (!this.resize.active || event.pointerId !== this.resize.pointerId) return;
            const bubble = this.getResizableBubble(this.resize.target);
            if (!bubble) return;
            const dx = event.clientX - this.resize.startX;
            const dy = event.clientY - this.resize.startY;
            const edge = this.resize.edge || '';
            const maxWidth = this.getMaxBubbleWidth();
            const maxHeight = this.getMaxBubbleHeight();
            let width = this.resize.startWidth;
            let height = this.resize.startHeight;
            let left = this.resize.startLeft;
            let top = this.resize.startTop;

            if (edge.includes('e')) width += dx;
            if (edge.includes('w')) {
                width -= dx;
                left += dx;
            }
            if (edge.includes('s')) height += dy;
            if (edge.includes('n')) {
                height -= dy;
                top += dy;
            }

            width = this.clamp(width, 280, maxWidth);
            height = this.clamp(height, 230, maxHeight);
            bubble.style.width = `${width}px`;
            bubble.style.height = `${height}px`;
            if (edge.includes('w') || edge.includes('n')) {
                this.setBubblePosition(this.resize.target, left, top);
            }
        };

        onResizeEnd = (event) => {
            if (!this.resize.active || event.pointerId !== this.resize.pointerId) return;
            const bubble = this.getResizableBubble(this.resize.target);
            bubble?.classList.remove('is-resizing');
            this.saveBubbleSize(this.resize.target);
            this.ensureBubbleVisible(this.resize.target);
            this.resize.active = false;
            window.removeEventListener('pointermove', this.onResizeMove);
            window.removeEventListener('pointerup', this.onResizeEnd);
        };

        clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        getResizableBubble(target) {
            return target === 'chat'
                ? this.root.querySelector('.ai-character-chat-bubble')
                : target === 'settings'
                    ? this.root.querySelector('.ai-character-settings-bubble')
                : this.root.querySelector('.ai-character-panel');
        }

        saveBubbleSize(target) {
            const bubble = this.getResizableBubble(target);
            if (!bubble) return;
            const rect = bubble.getBoundingClientRect();
            localStorage.setItem(target === 'chat' ? CHAT_SIZE_KEY : target === 'settings' ? SETTINGS_SIZE_KEY : PANEL_SIZE_KEY, JSON.stringify({
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            }));
        }

        restoreBubbleSizes() {
            this.restoreBubbleSize('panel', PANEL_SIZE_KEY);
            this.restoreBubbleSize('chat', CHAT_SIZE_KEY);
            this.restoreBubbleSize('settings', SETTINGS_SIZE_KEY);
        }

        restoreBubbleSize(target, key) {
            try {
                const saved = JSON.parse(localStorage.getItem(key) || 'null');
                const bubble = this.getResizableBubble(target);
                if (!saved || !bubble || !Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return;
                bubble.style.width = `${this.clamp(saved.width, 280, this.getMaxBubbleWidth())}px`;
                bubble.style.height = `${this.clamp(saved.height, 230, this.getMaxBubbleHeight())}px`;
            } catch (error) {
                localStorage.removeItem(key);
            }
        };

        getMaxBubbleWidth() {
            return Math.max(280, window.innerWidth - 24);
        }

        getMaxBubbleHeight() {
            return Math.max(230, window.innerHeight - 24);
        }

        ensureBubbleVisible(target) {
            const bubble = this.getResizableBubble(target);
            if (!bubble) return;
            const margin = 12;
            this.normalizeBubbleSize(target);
            const bubbleRect = bubble.getBoundingClientRect();
            let nextLeft = bubbleRect.left;
            let nextTop = bubbleRect.top;
            if (bubbleRect.left < margin) {
                nextLeft += margin - bubbleRect.left;
            }
            if (bubbleRect.right > window.innerWidth - margin) {
                nextLeft -= bubbleRect.right - (window.innerWidth - margin);
            }
            if (bubbleRect.top < margin) {
                nextTop += margin - bubbleRect.top;
            }
            if (bubbleRect.bottom > window.innerHeight - margin) {
                nextTop -= bubbleRect.bottom - (window.innerHeight - margin);
            }
            if (nextLeft !== bubbleRect.left || nextTop !== bubbleRect.top) {
                this.setBubblePosition(target, nextLeft, nextTop);
            }
            const finalRect = bubble.getBoundingClientRect();
            if (!this.isRectFullyInViewport(finalRect)) {
                this.setBubblePosition(target, finalRect.left, finalRect.top);
            }
        }

        setBubblePosition(target, left, top) {
            const bubble = this.getResizableBubble(target);
            if (!bubble) return;
            const margin = 12;
            const rect = bubble.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width - margin;
            const maxTop = window.innerHeight - rect.height - margin;
            const safeLeft = this.clamp(left, margin, Math.max(margin, maxLeft));
            const safeTop = this.clamp(top, margin, Math.max(margin, maxTop));
            bubble.style.left = `${safeLeft}px`;
            bubble.style.top = `${safeTop}px`;
            bubble.style.right = 'auto';
            bubble.style.bottom = 'auto';
        }

        normalizeBubbleSize(target) {
            const bubble = this.getResizableBubble(target);
            if (!bubble) return;
            const maxWidth = this.getMaxBubbleWidth();
            const maxHeight = this.getMaxBubbleHeight();
            const rect = bubble.getBoundingClientRect();
            let changed = false;
            if (rect.width > maxWidth) {
                bubble.style.width = `${maxWidth}px`;
                changed = true;
            }
            if (rect.height > maxHeight) {
                bubble.style.height = `${maxHeight}px`;
                changed = true;
            }
            if (changed) {
                this.saveBubbleSize(target);
            }
        }

        ensureOpenBubblesVisible() {
            this.getOpenBubbleTargets().forEach((target) => this.ensureBubbleVisible(target));
        }

        arrangeOpenBubbles() {
            this.getOpenBubbleTargets().forEach((target) => {
                this.placeBubble(target);
                this.ensureBubbleVisible(target);
            });
        }

        placeBubble(target) {
            const bubble = this.getResizableBubble(target);
            if (!bubble) return;
            const candidates = this.getBubblePlacementCandidates(target);
            const others = this.getOpenBubbleTargets().filter((item) => item !== target);
            let best = null;
            candidates.forEach((candidate) => {
                this.applyBubblePlacement(bubble, candidate);
                const rect = bubble.getBoundingClientRect();
                const overlapArea = others.reduce((total, item) => {
                    const other = this.getResizableBubble(item);
                    return total + (other ? this.getRectOverlapArea(rect, other.getBoundingClientRect()) : 0);
                }, 0);
                const personOverlap = this.getRectOverlapArea(rect, this.root.querySelector('.ai-character-person')?.getBoundingClientRect());
                const score = this.getBubblePlacementScore(rect, overlapArea, personOverlap);
                if (!best || score < best.score) {
                    best = { candidate, score };
                }
            });
            if (best) {
                this.applyBubblePlacement(bubble, best.candidate);
            }
        }

        getOpenBubbleTargets() {
            const targets = [];
            if (this.root.classList.contains('is-open')) targets.push('panel');
            if (this.root.classList.contains('is-chat-open')) targets.push('chat');
            if (this.root.classList.contains('is-settings-open')) targets.push('settings');
            return targets;
        }

        getBubblePlacementCandidates(target) {
            const bubble = this.getResizableBubble(target);
            const rootRect = this.root.getBoundingClientRect();
            const bubbleRect = bubble?.getBoundingClientRect();
            const width = bubbleRect?.width || 320;
            const height = bubbleRect?.height || 320;
            const gap = 14;
            const stagger = target === 'settings' ? 46 : target === 'chat' ? -46 : 0;
            const centerLeft = rootRect.left + (rootRect.width - width) / 2;
            const centerTop = rootRect.top + (rootRect.height - height) / 2;
            const candidates = [
                { left: rootRect.right + gap, top: rootRect.bottom - height + stagger },
                { left: rootRect.left - width - gap, top: rootRect.bottom - height + stagger },
                { left: centerLeft + stagger, top: rootRect.top - height - gap },
                { left: centerLeft + stagger, top: rootRect.bottom + gap },
                { left: rootRect.right + gap, top: rootRect.top + stagger },
                { left: rootRect.left - width - gap, top: rootRect.top + stagger },
                { left: rootRect.right + gap, top: rootRect.top - height - gap },
                { left: rootRect.left - width - gap, top: rootRect.top - height - gap },
                { left: centerLeft, top: centerTop }
            ];
            if (target === 'panel') {
                return [candidates[1], candidates[3], candidates[5], candidates[0], candidates[6], candidates[7]];
            }
            return candidates;
        }

        applyBubblePlacement(bubble, placement) {
            bubble.style.left = `${Math.round(placement.left)}px`;
            bubble.style.top = `${Math.round(placement.top)}px`;
            bubble.style.right = 'auto';
            bubble.style.bottom = 'auto';
        }

        isRectMostlyInViewport(rect) {
            return this.isRectFullyInViewport(rect);
        }

        isRectFullyInViewport(rect) {
            const margin = 12;
            return rect.left >= margin
                && rect.top >= margin
                && rect.right <= window.innerWidth - margin
                && rect.bottom <= window.innerHeight - margin;
        }

        rectsOverlap(first, second) {
            const gap = 10;
            return first.left < second.right + gap
                && first.right + gap > second.left
                && first.top < second.bottom + gap
                && first.bottom + gap > second.top;
        }

        getBubblePlacementScore(rect, overlapArea, personOverlap) {
            const margin = 12;
            const overflowLeft = Math.max(0, margin - rect.left);
            const overflowTop = Math.max(0, margin - rect.top);
            const overflowRight = Math.max(0, rect.right - (window.innerWidth - margin));
            const overflowBottom = Math.max(0, rect.bottom - (window.innerHeight - margin));
            const overflowPenalty = (overflowLeft + overflowTop + overflowRight + overflowBottom) * 1000;
            return overflowPenalty + overlapArea * 8 + personOverlap * 12;
        }

        getRectOverlapArea(first, second) {
            if (!first || !second) return 0;
            const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
            const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
            return width * height;
        }

        setPosition(left, top) {
            const margin = 8;
            const rect = this.root.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width - margin;
            const maxTop = window.innerHeight - rect.height - margin;
            const safeLeft = Math.min(Math.max(margin, left), Math.max(margin, maxLeft));
            const safeTop = Math.min(Math.max(margin, top), Math.max(margin, maxTop));
            this.root.style.left = `${safeLeft}px`;
            this.root.style.top = `${safeTop}px`;
            this.root.style.right = 'auto';
            this.root.style.bottom = 'auto';
        }

        keepInViewport() {
            const rect = this.root.getBoundingClientRect();
            this.setPosition(rect.left, rect.top);
            this.ensureOpenBubblesVisible();
        }

        savePosition() {
            const rect = this.root.getBoundingClientRect();
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
        }

        restorePosition() {
            try {
                const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
                if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
                    requestAnimationFrame(() => this.setPosition(saved.left, saved.top));
                }
            } catch (error) {
                localStorage.removeItem(STORAGE_KEY);
            }
        }

        togglePanel() {
            this.hideTip();
            this.root.classList.toggle('is-open');
            if (this.root.classList.contains('is-open')) {
                this.setActiveBubble('panel');
                this.say(this.getWelcomeText());
                requestAnimationFrame(() => {
                    this.placeBubble('panel');
                    this.ensureBubbleVisible('panel');
                });
            }
        }

        closePanel() {
            this.root.classList.remove('is-open');
            this.clearActiveBubble('panel');
        }

        closeAllBubbles() {
            this.closePanel();
            this.closeAiChat();
            this.closeAiSettings();
        }

        setActiveBubble(target) {
            if (!this.getOpenBubbleTargets().includes(target)) return;
            this.activeBubble = target;
            ['panel', 'chat', 'settings'].forEach((item) => {
                this.getResizableBubble(item)?.classList.toggle('is-active-bubble', item === target);
            });
        }

        clearActiveBubble(target) {
            if (this.activeBubble !== target) return;
            this.getResizableBubble(target)?.classList.remove('is-active-bubble');
            const openTargets = this.getOpenBubbleTargets();
            const fallback = openTargets[openTargets.length - 1] || null;
            if (fallback) {
                this.setActiveBubble(fallback);
            } else {
                this.activeBubble = null;
            }
        }

        closeActiveBubble() {
            const openTargets = this.getOpenBubbleTargets();
            if (!openTargets.length) return;
            const target = openTargets.includes(this.activeBubble)
                ? this.activeBubble
                : openTargets[openTargets.length - 1];
            if (target === 'chat') {
                this.closeAiChat();
                return;
            }
            if (target === 'settings') {
                this.closeAiSettings();
                return;
            }
            this.closePanel();
        }

        openAiChat() {
            this.hideTip();
            this.root.classList.add('is-open');
            this.root.classList.add('is-chat-open');
            this.setActiveBubble('chat');
            if (!this.chatMessages?.children.length) {
                this.addChatMessage('assistant', '\u4f60\u597d\uff0c\u6211\u662f\u5c0f\u5de1\u3002\u4f60\u53ef\u4ee5\u95ee\u6211\u5de1\u68c0\u3001\u544a\u8b66\u3001\u503c\u73ed\u6216\u7cfb\u7edf\u64cd\u4f5c\u95ee\u9898\u3002');
            }
            requestAnimationFrame(() => {
                this.placeBubble('chat');
                this.ensureBubbleVisible('chat');
            });
            setTimeout(() => this.askInput?.focus(), 80);
        }

        closeAiChat() {
            this.root.classList.remove('is-chat-open');
            this.clearActiveBubble('chat');
        }

        openAiSettings() {
            this.hideTip();
            this.root.classList.add('is-open');
            this.root.classList.add('is-settings-open');
            this.setActiveBubble('settings');
            this.loadAiUserSettings();
            requestAnimationFrame(() => {
                this.placeBubble('settings');
                this.ensureBubbleVisible('settings');
            });
        }

        closeAiSettings() {
            this.root.classList.remove('is-settings-open');
            this.clearActiveBubble('settings');
        }

        say(message) {
            if (this.panelMessage) {
                this.panelMessage.textContent = message;
            }
        }

        setFollowups(items) {
            const container = this.root.querySelector('.ai-character-followups');
            if (!container) return;
            container.innerHTML = items.map((item) => `
                <button class="ai-character-followup" type="button" data-ai-followup="${item.action}">
                    ${item.icon ? `<i class="fas ${item.icon}"></i>` : ''}${item.label}
                </button>
            `).join('');
        }

        clearFollowups() {
            const container = this.root.querySelector('.ai-character-followups');
            if (container) container.innerHTML = '';
        }

        handleFollowup(action) {
            if (action === 'showPendingNames') {
                this.say(this.getPendingNamesText());
                this.clearFollowups();
                return;
            }
            if (action === 'hidePendingNames') {
                this.say('\u597d\u7684\uff0c\u9700\u8981\u65f6\u518d\u70b9\u201c\u5f85\u5de1\u68c0\u201d\u67e5\u770b\u3002');
                this.clearFollowups();
            }
        }

        scheduleTipHide() {
            clearTimeout(this.tipTimer);
            this.root.classList.remove('hide-tip');
            this.tipTimer = setTimeout(() => this.hideTip(), 10000);
        }

        hideTip() {
            clearTimeout(this.tipTimer);
            this.root.classList.add('hide-tip');
        }

        handleAction(action) {
            this.clearFollowups();
            if (action === 'aiChat') {
                this.openAiChat();
                return;
            }
            if (action === 'aiSettings') {
                this.openAiSettings();
                return;
            }
            if (action === 'pending') {
                this.showPendingSummary();
                return;
            }
            if (action === 'duty') {
                this.say(this.getDutyText());
                return;
            }
            if (action === 'records') {
                window.location.href = 'detail.html?view=all';
                return;
            }
            if (action === 'jump') {
                this.jumpToUsefulPage();
            }
        }

        async askAi() {
            const question = (this.askInput?.value || '').trim();
            if (!question) return;
            this.clearFollowups();
            this.addChatMessage('user', question);
            if (this.askInput) this.askInput.value = '';
            const localAnswer = this.getLocalSystemAnswer(question);
            if (localAnswer) {
                this.addChatMessage('assistant', localAnswer);
                history.push({ role: 'user', content: question });
                history.push({ role: 'assistant', content: localAnswer });
                return;
            }
            this.setLoading(true);
            const thinking = this.addChatMessage('assistant', text.thinking);
            try {
                const response = await fetch(this.apiUrl('/api/ai/chat'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question,
                        context: this.buildLocalContext(question),
                        history: history.slice(-6),
                        ...this.getAiRequestOptions()
                    })
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.configured === false) {
                    thinking.textContent = result.answer || text.apiMissing;
                } else {
                    thinking.textContent = result.answer || text.askError;
                    history.push({ role: 'user', content: question });
                    history.push({ role: 'assistant', content: result.answer || '' });
                }
            } catch (error) {
                thinking.textContent = text.askError;
            } finally {
                this.setLoading(false);
                this.scrollChatToBottom();
            }
        }

        addChatMessage(role, content) {
            const message = document.createElement('div');
            message.className = `ai-chat-message ${role}`;
            message.textContent = content;
            this.chatMessages?.appendChild(message);
            this.scrollChatToBottom();
            return message;
        }

        scrollChatToBottom() {
            if (this.chatMessages) {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
        }

        setLoading(isLoading) {
            if (this.askButton) {
                this.askButton.disabled = isLoading;
                this.askButton.textContent = isLoading ? '\u601d\u8003\u4e2d' : text.askButton;
            }
        }

        loadAiUserSettings() {
            const mode = localStorage.getItem('swpuAiMode') || 'backend';
            const checked = this.root.querySelector(`input[name="swpuAiMode"][value="${mode}"]`);
            if (checked) checked.checked = true;
            const keyInput = this.root.querySelector('#swpuAiCustomKey');
            const modelInput = this.root.querySelector('#swpuAiCustomModel');
            const urlInput = this.root.querySelector('#swpuAiCustomUrl');
            if (keyInput) keyInput.value = localStorage.getItem('swpuAiCustomKey') || '';
            if (modelInput) modelInput.value = localStorage.getItem('swpuAiCustomModel') || '';
            if (urlInput) urlInput.value = localStorage.getItem('swpuAiCustomUrl') || '';
            this.updateAiSettingInputsState();
        }

        async saveAiUserSettings() {
            const mode = this.root.querySelector('input[name="swpuAiMode"]:checked')?.value || 'backend';
            const key = this.root.querySelector('#swpuAiCustomKey')?.value.trim() || '';
            const model = this.root.querySelector('#swpuAiCustomModel')?.value.trim() || '';
            const url = this.root.querySelector('#swpuAiCustomUrl')?.value.trim() || '';
            if (mode === 'custom' && (!key || !model || !url)) {
                this.openAiChat();
                this.addChatMessage('assistant', '使用自己的 AI 配置时，请完整填写 API Key、模型和接口地址。');
                return;
            }
            const validation = await this.validateAiConfig(mode === 'custom' ? { apiKey: key, apiUrl: url, model } : {});
            if (!validation.valid) {
                this.openAiChat();
                this.addChatMessage('assistant', validation.message || '\u6821\u9a8c\u672a\u901a\u8fc7\uff0c\u8bf7\u68c0\u67e5 AI \u914d\u7f6e\u3002');
                return;
            }
            localStorage.setItem('swpuAiMode', mode);
            localStorage.setItem('swpuAiCustomKey', key);
            localStorage.setItem('swpuAiCustomModel', model);
            localStorage.setItem('swpuAiCustomUrl', url);
            this.closeAiSettings();
            this.openAiChat();
            this.addChatMessage('assistant', mode === 'custom' ? '\u5df2\u5207\u6362\u4e3a\u4f60\u81ea\u5df1\u7684 AI \u914d\u7f6e\u3002' : '\u5df2\u5207\u6362\u4e3a\u4f7f\u7528\u540e\u53f0\u9ed8\u8ba4 AI \u914d\u7f6e\u3002');
        }
        async validateAiSettingsFromPanel() {
            const mode = this.root.querySelector('input[name="swpuAiMode"]:checked')?.value || 'backend';
            const payload = mode === 'custom' ? {
                apiKey: this.root.querySelector('#swpuAiCustomKey')?.value.trim() || '',
                apiUrl: this.root.querySelector('#swpuAiCustomUrl')?.value.trim() || '',
                model: this.root.querySelector('#swpuAiCustomModel')?.value.trim() || ''
            } : {};
            const validation = await this.validateAiConfig(payload);
            this.openAiChat();
            this.addChatMessage('assistant', validation.message || (validation.valid ? '\u6821\u9a8c\u901a\u8fc7\u3002' : '\u6821\u9a8c\u5931\u8d25\u3002'));
        }

        async validateAiConfig(payload) {
            try {
                const response = await fetch(this.apiUrl('/api/ai/validate'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload || {})
                });
                const result = await response.json().catch(() => ({}));
                return {
                    valid: response.ok && result.valid !== false,
                    message: result.message || ''
                };
            } catch (error) {
                return {
                    valid: false,
                    message: '\u65e0\u6cd5\u8fde\u63a5 AI \u6821\u9a8c\u63a5\u53e3\uff0c\u8bf7\u786e\u8ba4\u540e\u7aef\u670d\u52a1\u6b63\u5728\u8fd0\u884c\u3002'
                };
            }
        }

        getAiRequestOptions() {
            const mode = localStorage.getItem('swpuAiMode') || 'backend';
            if (mode !== 'custom') {
                return { aiMode: 'backend' };
            }
            const apiKey = localStorage.getItem('swpuAiCustomKey') || '';
            const apiUrl = localStorage.getItem('swpuAiCustomUrl') || '';
            const model = localStorage.getItem('swpuAiCustomModel') || '';
            if (!apiKey.trim() || !apiUrl.trim() || !model.trim()) {
                return { aiMode: 'backend' };
            }
            return {
                aiMode: 'custom',
                apiKey,
                apiUrl,
                model
            };
        }

        apiUrl(path) {
            const base = (window.ApiClient && window.ApiClient.API_BASE) || window.API_BASE || '';
            return /^https?:\/\//i.test(path) ? path : `${base}${path}`;
        }

        updateAiSettingInputsState() {
            const mode = this.root.querySelector('input[name="swpuAiMode"]:checked')?.value || 'backend';
            const disabled = mode === 'backend';
            ['#swpuAiCustomKey', '#swpuAiCustomModel', '#swpuAiCustomUrl'].forEach((selector) => {
                const input = this.root.querySelector(selector);
                if (input) input.disabled = disabled;
            });
        }

        buildLocalContext(question = '') {
            if (!window.SWPUData) {
                return {};
            }
            const pending = this.getPendingItems();
            const duty = window.SWPUData.getTodayDutyRecord?.();
            const knowledgeMatches = this.searchKnowledgeForQuestion(question);
            const documentMatches = this.searchDocumentsForQuestion(question);
            const activeAlerts = this.getActiveAlertContext();
            return {
                page: location.pathname,
                pendingRooms: pending.rooms.map((item) => item.name),
                pendingDevices: pending.devices.map((item) => item.name),
                pendingManagementPages: pending.pages.map((item) => item.name),
                todayDuty: duty ? { name: duty.swpuUserName || duty.name, phone: duty.phone } : null,
                activeAlerts,
                matchedKnowledge: knowledgeMatches,
                matchedDocuments: documentMatches,
                instruction: '如果用户询问故障解决方案，优先引用 matchedKnowledge 和 matchedDocuments 中的内容，再补充通用排查方法；没有匹配内容时需要明确说明知识库暂无直接条目。'
            };
        }
        searchKnowledgeForQuestion(question) {
            const entries = window.SWPUData?.getKnowledgeBase?.() || [];
            return window.SWPUData.searchCollection(entries, question, ['title', 'category', 'solution', 'tags'])
                .slice(0, 5)
                .map((item) => ({
                    title: item.title,
                    category: item.category,
                    tags: item.tags || [],
                    solution: item.solution
                }));
        }

        searchDocumentsForQuestion(question) {
            const documents = window.SWPUData?.getDocuments?.() || [];
            const devices = window.SWPUData?.getDevices?.() || [];
            const deviceTerms = devices
                .filter((device) => window.SWPUData.scoreSearchMatch(device, question, ['name', 'model', 'type', 'ncicRoomName']) > 0)
                .map((device) => `${device.name} ${device.model || ''} ${device.type || ''}`)
                .join(' ');
            return window.SWPUData.searchCollection(documents, [question, deviceTerms].filter(Boolean).join(' '), ['title', 'category', 'description'])
                .slice(0, 4)
                .map((item) => ({
                    title: item.title,
                    category: item.category,
                    description: item.description || '',
                    updatedAt: item.updatedAt
                }));
        }

        getActiveAlertContext() {
            const today = window.SWPUData?.getTodayDate?.();
            const isAlert = (item) => item.date === today && (item.status === 'warning' || item.status === 'error');
            const roomAlerts = (window.SWPUData?.getDailyPatrolList?.() || [])
                .filter(isAlert)
                .map((item) => ({ target: item.ncicRoomName, type: '机房', status: item.status, notes: item.notes || '', timestamp: item.timestamp }));
            const deviceAlerts = (window.SWPUData?.getDevicePatrolList?.() || [])
                .filter(isAlert)
                .map((item) => ({ target: item.deviceName, type: `硬件设备 · ${item.ncicRoomName || ''}`, status: item.status, notes: item.notes || '', timestamp: item.timestamp }));
            const managementAlerts = (window.SWPUData?.getManagementPatrolList?.() || [])
                .filter(isAlert)
                .map((item) => ({ target: item.managementName, type: `管理页面 · ${item.system || ''}`, status: item.status, notes: item.notes || '', timestamp: item.timestamp }));
            return [...roomAlerts, ...deviceAlerts, ...managementAlerts]
                .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
                .slice(0, 6);
        }

        getWelcomeText() {
            const user = window.SWPUData?.getCurrentSwpuUser?.();
            const name = user?.name || '\u8001\u5e08';
            return `${name}\uff0c\u6211\u53ef\u4ee5\u62d6\u5230\u4efb\u610f\u4f4d\u7f6e\u3002\u4f60\u4e5f\u53ef\u4ee5\u76f4\u63a5\u95ee\u6211\u5de1\u68c0\u3001\u503c\u73ed\u548c\u544a\u8b66\u95ee\u9898\u3002`;
        }

        getPendingText() {
            if (!window.SWPUData) {
                return '\u5f53\u524d\u9875\u9762\u8fd8\u6ca1\u6709\u52a0\u8f7d\u5de1\u68c0\u6570\u636e\uff0c\u7a0d\u540e\u518d\u8bd5\u3002';
            }
            const pending = this.getPendingItems();
            return `\u5f53\u524d\u5f85\u68c0\u67e5\uff1a\u673a\u623f ${pending.rooms.length} \u4e2a\uff0c\u786c\u4ef6\u8bbe\u5907 ${pending.devices.length} \u4e2a\uff0c\u7ba1\u7406\u9875\u9762 ${pending.pages.length} \u4e2a\u3002`;
        }

        showPendingSummary() {
            const pending = this.getPendingItems();
            const summary = this.getPendingText();
            if (!pending.total) {
                this.say(summary);
                return;
            }
            this.say(`${summary} \u662f\u5426\u67e5\u770b\u5f85\u68c0\u67e5\u9879\u76ee\u540d\u79f0\uff1f`);
            this.setFollowups([
                { action: 'showPendingNames', label: '\u67e5\u770b\u540d\u79f0', icon: 'fa-list' },
                { action: 'hidePendingNames', label: '\u6682\u4e0d\u67e5\u770b', icon: 'fa-xmark' }
            ]);
        }

        getPendingItems() {
            if (!window.SWPUData) {
                return { rooms: [], devices: [], pages: [], total: 0 };
            }
            window.SWPUData.updateNcicRoomStatusFromRecords?.();
            window.SWPUData.updateDeviceStatusFromRecords?.();
            window.SWPUData.updateManagementStatusFromRecords?.();
            const rooms = (window.SWPUData.getNcicRooms?.() || []).filter((item) => item.status === 'unchecked');
            const devices = (window.SWPUData.getDevices?.() || []).filter((item) => item.status === 'unchecked');
            const pages = (window.SWPUData.getManagementPages?.() || []).filter((item) => item.status === 'unchecked');
            return { rooms, devices, pages, total: rooms.length + devices.length + pages.length };
        }

        getLocalSystemAnswer(question) {
            const normalized = String(question || '').replace(/\s+/g, '').toLowerCase();
            if (!normalized) return '';
            if (/(我是谁|我是誰|当前用户|當前用戶|我的身份|我是谁啊)/.test(normalized)) {
                const user = window.SWPUData?.getCurrentSwpuUser?.();
                if (!user) return '当前还没有读取到登录用户信息，请重新登录后再试。';
                const roleText = user.role === 'admin' ? '管理员' : user.role === 'duty' ? '值班工程师' : '巡检工程师';
                return `你是 ${user.name}，身份是${roleText}，联系电话 ${user.phone || '未填写'}。`;
            }
            if (/(今日值班|今天值班|谁值班|誰值班|值班人员|值班人)/.test(normalized)) {
                return this.getDutyText();
            }
            if (/(待巡检|待检查|未巡检|未检查|没巡检|没检查|没有巡检|哪些.*巡检|哪些.*检查|还.*巡检|还.*检查|剩.*巡检|剩.*检查)/.test(normalized)) {
                return this.getPendingDetailText();
            }
            if (/(当前告警|今日告警|有哪些告警|告警项目|异常项目|报警项目)/.test(normalized)) {
                return this.getAlertDetailText();
            }
            return '';
        }

        getPendingDetailText() {
            const pending = this.getPendingItems();
            if (!pending.total) {
                return '今天所有已纳入巡检范围的项目都已完成巡检。';
            }
            const formatRooms = (items) => items.map((item) => `${item.name}${item.location ? `（${item.location}）` : ''}`);
            const formatDevices = (items) => items.map((item) => `${item.name}${item.ncicRoomName ? `（${item.ncicRoomName}）` : ''}`);
            const formatPages = (items) => items.map((item) => `${item.name}${item.system ? `（${item.system}）` : ''}`);
            const section = (label, items, formatter) => `${label}（${items.length}）：${items.length ? formatter(items).join('、') : '无'}`;
            return [
                '根据当前系统状态，今天还没有完成巡检的项目是：',
                section('机房', pending.rooms, formatRooms),
                section('硬件设备', pending.devices, formatDevices),
                section('管理页面', pending.pages, formatPages)
            ].join('\n');
        }

        getAlertDetailText() {
            const alerts = this.getActiveAlertContext();
            if (!alerts.length) {
                return '今天暂无未处理的告警或异常项目。';
            }
            return [
                `今天仍在告警/异常中的项目有 ${alerts.length} 个：`,
                ...alerts.map((item) => `${item.type}：${item.target}（${this.getStatusText(item.status)}，${item.timestamp || '时间未记录'}）`)
            ].join('\n');
        }

        getStatusText(status) {
            return ({ unchecked: '未检查', normal: '正常', warning: '警告', error: '异常' })[status] || status;
        }

        getPendingNamesText() {
            const pending = this.getPendingItems();
            if (!pending.total) {
                return '\u5f53\u524d\u6ca1\u6709\u5f85\u68c0\u67e5\u9879\u76ee\u3002';
            }
            const formatNames = (items) => items.map((item) => item.name).filter(Boolean).join('\u3001') || '\u65e0';
            return [
                `\u673a\u623f\uff1a${formatNames(pending.rooms)}`,
                `\u786c\u4ef6\u8bbe\u5907\uff1a${formatNames(pending.devices)}`,
                `\u7ba1\u7406\u9875\u9762\uff1a${formatNames(pending.pages)}`
            ].join('\n');
        }

        getDutyText() {
            const duty = window.SWPUData?.getTodayDutyRecord?.();
            if (!duty) {
                return '\u4eca\u5929\u6682\u65f6\u6ca1\u6709\u6392\u73ed\u8bb0\u5f55\uff0c\u53ef\u4ee5\u5230\u540e\u53f0\u503c\u73ed\u7ba1\u7406\u91cc\u8865\u5145\u3002';
            }
            return `\u4eca\u65e5\u503c\u73ed\uff1a${duty.swpuUserName || duty.name || '\u672a\u586b\u5199'}\uff0c\u7535\u8bdd ${duty.phone || '\u672a\u586b\u5199'}\u3002`;
        }

        jumpToUsefulPage() {
            const user = window.SWPUData?.getCurrentSwpuUser?.();
            if (user?.role === 'admin' && !location.pathname.endsWith('/admin.html')) {
                window.location.href = 'admin.html';
                return;
            }
            if (user?.role !== 'admin' && !location.pathname.endsWith('/admin.html')) {
                this.say('\u540e\u53f0\u4ec5\u7ba1\u7406\u5458\u53ef\u4ee5\u8fdb\u5165\u3002\u4f60\u53ef\u4ee5\u7ee7\u7eed\u5728\u524d\u53f0\u63d0\u4ea4\u5de1\u67e5\u6216\u67e5\u770b\u5de1\u68c0\u8bb0\u5f55\u3002');
                return;
            }
            if (location.pathname.endsWith('/admin.html')) {
                window.location.href = 'index.html';
                return;
            }
            this.say('\u4f60\u53ef\u4ee5\u70b9\u51fb\u673a\u623f\u3001\u786c\u4ef6\u6216\u7ba1\u7406\u9875\u9762\u5361\u7247\u8fdb\u5165\u5de1\u67e5\u8be6\u60c5\u3002');
        }

        updatePermissionView() {
            const user = window.SWPUData?.getCurrentSwpuUser?.();
            const jumpButton = this.root.querySelector('[data-ai-action="jump"]');
            if (!jumpButton) return;
            if (location.pathname.endsWith('/admin.html')) {
                jumpButton.innerHTML = '<i class="fas fa-house"></i>\u8fd4\u56de\u524d\u53f0';
                return;
            }
            if (user?.role === 'admin') {
                jumpButton.innerHTML = '<i class="fas fa-location-arrow"></i>\u7ba1\u7406\u540e\u53f0';
                return;
            }
            jumpButton.innerHTML = '<i class="fas fa-lock"></i>\u540e\u53f0\u6743\u9650';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        window.swpuAiCharacter = new SwpuAiCharacter();
    });
})();


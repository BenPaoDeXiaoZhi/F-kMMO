// ==UserScript==
// @name         FuckMMO
// @version      v0.9
// @description  What is safety?
// @author       FM
// @match        https://www.ccw.site/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ccw.site
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    const orig = Function.prototype.bind;
    Function.prototype.bind = function(self2, ...args) {
        if (self2?.runtime && self2) {
            window.vm = self2;
            Function.prototype.bind = orig;
            initUI();
        }
        return orig.call(this, self2, ...args);
    };

    let currentGameMode = 'machine_gun_war2';
    let isDrawingBoxes = false;
    let isGodModeEnabled = false;
    let drawAnimationFrame = null;
    let godModeInterval = null;
    let overlayCanvas = null;
    let canvasContext = null;
    let mySessionId = null;
    let myX = 0;
    let myY = 0;

    function autoDetectGameMode() {
        const titleElements = document.querySelectorAll('[class*="title"]');
        for (const element of titleElements) {
            const text = element.textContent.toLowerCase();
            
            if (text.includes('散弹之王') || text.includes('shotgun king')) {
                return 'shotgun_king';
            } else if (text.includes('联机枪战2') || text.includes('machine gun war 2')) {
                return 'machine_gun_war2';
            }
        }
        
        return null;
    }

    function checkMMOAvailable() {
        if (!window.vm || !window.vm.runtime || !window.vm.runtime.ext_CCWMMO) {
            return false;
        }
        
        try {
            const result = window.vm.runtime.ext_CCWMMO.getClientList({FORMAT: "JSON"});
            return result !== undefined && result !== null;
        } catch (error) {
            return false;
        }
    }

    function showMessage(message, isError = false) {
        const existingMessage = document.getElementById('fuckmmo-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.id = 'fuckmmo-message';
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isError ? '#ff4444' : '#4CAF50'};
            color: white;
            padding: 12px 18px;
            border-radius: 8px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            transform: translateY(-20px);
            opacity: 0;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.transform = 'translateY(0)';
            messageDiv.style.opacity = '1';
        }, 10);
        
        setTimeout(() => {
            messageDiv.style.transform = 'translateY(-20px)';
            messageDiv.style.opacity = '0';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    function generateRandomSessionId() {
        const length = Math.floor(Math.random() * 16) + 5;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789（）-+=/\"‘`!@#$%^&*`?>，。《';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function toggleGodMode() {
        if (!checkMMOAvailable()) {
            showMessage('MMO未加载或未将VM暴露全局', true);
            return;
        }
        
        if (isDrawingBoxes) {
            showMessage('请先关闭玩家方框绘制', true);
            return;
        }
        
        isGodModeEnabled = !isGodModeEnabled;
        const godModeButton = document.getElementById('fuckmmo-godmode-button');
        
        if (isGodModeEnabled) {
            godModeButton.textContent = '关闭锁血';
            godModeButton.style.background = 'linear-gradient(135deg, #ff4444, #ff6b6b)';
            
            godModeInterval = setInterval(() => {
                if (window.vm && window.vm.runtime && window.vm.runtime.ext_CCWMMO) {
                    try {
                        const randomSessionId = generateRandomSessionId();
                        window.vm.runtime.ext_CCWMMO.setPlayerState({
                            VALUE: randomSessionId,
                            PLAYER_INFO: "sessionId"
                        });
                    } catch (error) {
                        console.error('锁血功能出错:', error);
                    }
                }
            }, 1000);
            
            showMessage('锁血功能已开启，sessionId将随机更换');
        } else {
            godModeButton.textContent = '开启锁血';
            godModeButton.style.background = 'linear-gradient(135deg, #ff3333, #ff5555)';
            
            if (godModeInterval) {
                clearInterval(godModeInterval);
                godModeInterval = null;
            }
            
            showMessage('锁血功能已关闭');
        }
    }

    function createOverlayCanvas() {
        if (overlayCanvas) return;
        
        overlayCanvas = document.createElement('canvas');
        overlayCanvas.id = 'fuckmmo-overlay';
        overlayCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9998;
        `;
        
        document.body.appendChild(overlayCanvas);
        
        resizeCanvas();
        
        canvasContext = overlayCanvas.getContext('2d');
    }

    function resizeCanvas() {
        if (!overlayCanvas) return;
        
        overlayCanvas.width = window.innerWidth;
        overlayCanvas.height = window.innerHeight;
    }

    function getGameCanvasCenter() {
        const gameCanvas = document.querySelector('canvas[width="1139"][height="640"]');
        if (!gameCanvas) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        
        const rect = gameCanvas.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    function drawPlayerBoxes() {
        if (!isDrawingBoxes || !canvasContext) return;
        
        try {
            canvasContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            
            const result = window.vm.runtime.ext_CCWMMO.getClientList({FORMAT: "JSON"});
            if (!result) {
                drawAnimationFrame = requestAnimationFrame(drawPlayerBoxes);
                return;
            }
            
            const players = JSON.parse(result);
            if (!Array.isArray(players)) {
                drawAnimationFrame = requestAnimationFrame(drawPlayerBoxes);
                return;
            }
            
            try {
                mySessionId = window.vm.runtime.ext_CCWMMO.currentRoom.sessionId;
                
                const currentPlayer = players.find(p => p.sessionId === mySessionId);
                if (currentPlayer) {
                    myX = Number(currentPlayer.x);
                    myY = Number(currentPlayer.y);
                }
            } catch (e) {
                console.error('获取当前玩家信息失败:', e);
            }
            
            const canvasCenter = getGameCanvasCenter();
            
            players.forEach(player => {
                if (player.x !== undefined && player.y !== undefined && player.sessionId !== mySessionId) {
                    const relativeX = (Number(player.x) - myX);
                    const relativeY = (myY - Number(player.y));
                    
                    const screenX = canvasCenter.x + relativeX;
                    const screenY = canvasCenter.y + relativeY;
                    
                    let boxWidth, boxHeight;
                    if (currentGameMode === 'shotgun_king') {
                        boxWidth = 100;
                        boxHeight = 100;
                    } else if (currentGameMode === 'machine_gun_war2') {
                        boxWidth = 100;
                        boxHeight = 200;
                    } else {
                        boxWidth = 100;
                        boxHeight = 100;
                    }
                    
                    drawPlayerBox(screenX, screenY, player.name || '未知玩家', boxWidth, boxHeight);
                }
            });
            
        } catch (error) {
            console.error('绘制玩家方框时出错:', error);
        }
        
        drawAnimationFrame = requestAnimationFrame(drawPlayerBoxes);
    }

    function drawPlayerBox(x, y, playerName, boxWidth, boxHeight) {
        if (!canvasContext) return;
        
        if (isNaN(x) || isNaN(y)) return;
        
        const boxX = x - boxWidth / 2;
        const boxY = y - boxHeight / 2;
        
        if (boxX + boxWidth < 0 || boxX > overlayCanvas.width || 
            boxY + boxHeight < 0 || boxY > overlayCanvas.height) {
            return;
        }
        
        const gradient = canvasContext.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY + boxHeight);
        gradient.addColorStop(0, 'rgba(255, 107, 107, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 107, 107, 0.1)');
        
        canvasContext.fillStyle = gradient;
        canvasContext.fillRect(boxX, boxY, boxWidth, boxHeight);
        
        canvasContext.strokeStyle = '#ff4444';
        canvasContext.lineWidth = 3;
        canvasContext.strokeRect(boxX, boxY, boxWidth, boxHeight);
        
        canvasContext.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        canvasContext.lineWidth = 1;
        canvasContext.strokeRect(boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4);
        
        canvasContext.fillStyle = '#ffffff';
        canvasContext.strokeStyle = '#333333';
        canvasContext.lineWidth = 2;
        canvasContext.font = 'bold 12px Arial';
        canvasContext.textAlign = 'center';
        
        const textX = x;
        const textY = boxY - 10;
        
        canvasContext.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const textWidth = canvasContext.measureText(playerName).width;
        canvasContext.fillRect(textX - textWidth / 2 - 5, textY - 15, textWidth + 10, 20);
        
        canvasContext.fillStyle = '#ffffff';
        canvasContext.fillText(playerName, textX, textY);
        
        canvasContext.fillStyle = '#ff4444';
        canvasContext.beginPath();
        canvasContext.arc(x, y, 4, 0, 2 * Math.PI);
        canvasContext.fill();
        
        canvasContext.strokeStyle = '#ffffff';
        canvasContext.lineWidth = 1;
        canvasContext.stroke();
    }

    function toggleDrawing() {
        if (!checkMMOAvailable()) {
            showMessage('MMO未加载或未将VM暴露全局', true);
            return;
        }
        
        if (isGodModeEnabled) {
            showMessage('请先关闭锁血功能', true);
            return;
        }
        
        if (!currentGameMode) {
            showMessage('请先选择游戏模式', true);
            return;
        }
        
        isDrawingBoxes = !isDrawingBoxes;
        const drawButton = document.getElementById('fuckmmo-draw-button');
        
        if (isDrawingBoxes) {
            createOverlayCanvas();
            drawButton.textContent = '关闭绘制玩家方框';
            drawButton.style.background = 'linear-gradient(135deg, #ff4444, #ff6b6b)';
            drawAnimationFrame = requestAnimationFrame(drawPlayerBoxes);
            showMessage('已开启玩家方框绘制');
        } else {
            drawButton.textContent = '开启绘制玩家方框';
            drawButton.style.background = 'linear-gradient(135deg, #ff3333, #ff5555)';
            if (drawAnimationFrame) {
                cancelAnimationFrame(drawAnimationFrame);
                drawAnimationFrame = null;
            }
            
            if (canvasContext) {
                canvasContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            }
            showMessage('已关闭玩家方框绘制');
        }
    }

    function handleGameModeChange(selectedMode) {
        currentGameMode = selectedMode;
        const gameButtons = document.getElementById('fuckmmo-game-buttons');
        
        if (selectedMode) {
            gameButtons.style.display = 'block';
            gameButtons.style.flexDirection = 'row';
            showMessage(`已选择游戏模式: ${getGameModeName(selectedMode)}`);
        } else {
            gameButtons.style.display = 'none';
            if (isDrawingBoxes) toggleDrawing();
            if (isGodModeEnabled) toggleGodMode();
        }
    }

    function getGameModeName(mode) {
        const modeNames = {
            'shotgun_king': '散弹之王',
            'machine_gun_war2': '联机枪战2'
        };
        return modeNames[mode] || '未知模式';
    }

    function showCustomPrompt(title, placeholder, callback) {
        const existingPrompt = document.getElementById('fuckmmo-custom-prompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        const promptOverlay = document.createElement('div');
        promptOverlay.id = 'fuckmmo-custom-prompt';
        promptOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10002;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const promptBox = document.createElement('div');
        promptBox.style.cssText = `
            background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
            border-radius: 15px;
            padding: 30px;
            width: 400px;
            box-shadow: 0 15px 50px rgba(0,0,0,0.7);
            transform: scale(0.9);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 2px solid #ff3333;
        `;

        const promptTitle = document.createElement('h3');
        promptTitle.textContent = title;
        promptTitle.style.cssText = `
            margin: 0 0 20px 0;
            color: #ffffff;
            font-size: 20px;
            font-weight: 600;
            text-align: center;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        `;

        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            margin-bottom: 25px;
        `;

        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.placeholder = placeholder;
        inputField.style.cssText = `
            width: 100%;
            padding: 15px;
            border: 2px solid #ff3333;
            border-radius: 8px;
            font-size: 16px;
            background: #2a2a2a;
            color: #ffffff;
            box-sizing: border-box;
            transition: all 0.3s ease;
        `;

        inputField.addEventListener('focus', () => {
            inputField.style.borderColor = '#ff5555';
            inputField.style.boxShadow = '0 0 10px rgba(255, 85, 85, 0.5)';
        });

        inputField.addEventListener('blur', () => {
            inputField.style.borderColor = '#ff3333';
            inputField.style.boxShadow = 'none';
        });

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            gap: 15px;
        `;

        const confirmButton = document.createElement('button');
        confirmButton.textContent = '确定';
        confirmButton.style.cssText = `
            background: linear-gradient(135deg, #ff3333, #ff5555);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            flex: 1;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255, 51, 51, 0.3);
        `;

        const cancelButton = document.createElement('button');
        cancelButton.textContent = '取消';
        cancelButton.style.cssText = `
            background: linear-gradient(135deg, #333333, #555555);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            flex: 1;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(51, 51, 51, 0.3);
        `;

        [confirmButton, cancelButton].forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = button === confirmButton ? 
                    '0 6px 20px rgba(255, 85, 85, 0.5)' : 
                    '0 6px 20px rgba(85, 85, 85, 0.5)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = button === confirmButton ? 
                    '0 4px 15px rgba(255, 51, 51, 0.3)' : 
                    '0 4px 15px rgba(51, 51, 51, 0.3)';
            });
        });

        confirmButton.addEventListener('click', () => {
            const value = inputField.value.trim();
            if (value) {
                callback(value);
            }
            promptOverlay.remove();
        });

        cancelButton.addEventListener('click', () => {
            promptOverlay.remove();
        });

        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = inputField.value.trim();
                if (value) {
                    callback(value);
                }
                promptOverlay.remove();
            }
        });

        promptOverlay.addEventListener('click', (e) => {
            if (e.target === promptOverlay) {
                promptOverlay.remove();
            }
        });

        inputContainer.appendChild(inputField);
        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(cancelButton);
        
        promptBox.appendChild(promptTitle);
        promptBox.appendChild(inputContainer);
        promptBox.appendChild(buttonContainer);
        promptOverlay.appendChild(promptBox);
        document.body.appendChild(promptOverlay);

        setTimeout(() => {
            promptOverlay.style.opacity = '1';
            promptBox.style.transform = 'scale(1)';
            inputField.focus();
        }, 10);
    }

    function initUI() {
        const existingUI = document.getElementById('fuckmmo-ui');
        if (existingUI) {
            existingUI.remove();
        }

        const uiContainer = document.createElement('div');
        uiContainer.id = 'fuckmmo-ui';
        uiContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            font-family: 'Segoe UI', Arial, sans-serif;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        const toggleButton = document.createElement('button');
        toggleButton.id = 'fuckmmo-toggle';
        toggleButton.textContent = 'FuckMMO';
        toggleButton.style.cssText = `
            background: linear-gradient(135deg, #ff3333, #ff5555);
            color: white;
            border: none;
            padding: 12px 18px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(255, 51, 51, 0.4);
            margin-bottom: 5px;
            transition: all 0.3s ease;
            user-select: none;
        `;

        toggleButton.addEventListener('mouseenter', () => {
            toggleButton.style.transform = 'translateY(-2px) scale(1.05)';
            toggleButton.style.boxShadow = '0 6px 20px rgba(255, 85, 85, 0.6)';
        });

        toggleButton.addEventListener('mouseleave', () => {
            toggleButton.style.transform = 'translateY(0) scale(1)';
            toggleButton.style.boxShadow = '0 4px 15px rgba(255, 51, 51, 0.4)';
        });

        const panel = document.createElement('div');
        panel.id = 'fuckmmo-panel';
        panel.style.cssText = `
            background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            width: 300px;
            opacity: 0;
            transform: scale(0.9) translateY(10px);
            visibility: hidden;
            border: 2px solid #ff3333;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: absolute;
            bottom: 100%;
            right: 0;
            margin-bottom: 10px;
        `;

        const title = document.createElement('div');
        title.id = 'fuckmmo-panel-title';
        title.textContent = 'Fuck MMO v0.9';
        title.style.cssText = `
            margin: 0 0 15px 0;
            color: #ffffff;
            font-size: 18px;
            font-weight: 600;
            text-align: center;
            padding-bottom: 15px;
            border-bottom: 2px solid #ff3333;
            background: #1a1a1a;
            border-radius: 8px 8px 0 0;
            user-select: none;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        `;

        function createButton(text, color, onClick, id = null) {
            const button = document.createElement('button');
            button.textContent = text;
            if (id) button.id = id;
            button.style.cssText = `
                background: linear-gradient(135deg, ${color}, ${darkenColor(color, 10)});
                color: white;
                border: none;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;

            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            });

            button.addEventListener('click', (e) => {
                e.stopPropagation();
                button.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                    onClick();
                }, 150);
            });

            return button;
        }

        function darkenColor(color, percent) {
            const num = parseInt(color.replace("#", ""), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) - amt;
            const G = (num >> 8 & 0x00FF) - amt;
            const B = (num & 0x0000FF) - amt;
            return "#" + (0x1000000 + (R < 0 ? 0 : R) * 0x10000 +
                (G < 0 ? 0 : G) * 0x100 + (B < 0 ? 0 : B)).toString(16).slice(1);
        }

        const gameSelectContainer = document.createElement('div');
        gameSelectContainer.style.cssText = `
            grid-column: 1 / span 2;
            margin-bottom: 10px;
        `;

        const gameSelectLabel = document.createElement('label');
        gameSelectLabel.textContent = '选择游戏模式:';
        gameSelectLabel.style.cssText = `
            display: block;
            color: #ffffff;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
        `;

        const gameSelect = document.createElement('select');
        gameSelect.id = 'fuckmmo-game-select';
        gameSelect.style.cssText = `
            width: 100%;
            padding: 10px;
            border: 2px solid #ff3333;
            border-radius: 6px;
            background: #2a2a2a;
            color: #ffffff;
            font-size: 14px;
            cursor: pointer;
        `;

        const shotgunKingOption = document.createElement('option');
        shotgunKingOption.value = 'shotgun_king';
        shotgunKingOption.textContent = '散弹之王';
        gameSelect.appendChild(shotgunKingOption);

        const machineGunWarOption = document.createElement('option');
        machineGunWarOption.value = 'machine_gun_war2';
        machineGunWarOption.textContent = '联机枪战2';
        machineGunWarOption.selected = true;
        gameSelect.appendChild(machineGunWarOption);

        gameSelect.addEventListener('change', (e) => {
            handleGameModeChange(e.target.value);
        });

        gameSelectContainer.appendChild(gameSelectLabel);
        gameSelectContainer.appendChild(gameSelect);

        const getInfoBtn = createButton('获取MMO信息', '#ff3333', async () => {
            if (!checkMMOAvailable()) {
                showMessage('MMO未加载或未将VM暴露全局', true);
                return;
            }

            try {
                const result = window.vm.runtime.ext_CCWMMO.getClientList({FORMAT: "JSON"});
                showResultPanel('MMO信息', result);
            } catch (error) {
                showMessage('获取信息失败: ' + error.message, true);
            }
        });

        const changeNameBtn = createButton('修改名称', '#ff3333', () => {
            if (!checkMMOAvailable()) {
                showMessage('MMO未加载或未将VM暴露全局', true);
                return;
            }

            showCustomPrompt('修改MMO名称', '请输入新名称', (newName) => {
                try {
                    window.vm.runtime.ext_CCWMMO.setPlayerState({
                        VALUE: newName.trim(),
                        PLAYER_INFO: "name"
                    });
                    showMessage('MMO名称修改成功');
                } catch (error) {
                    showMessage('修改失败: ' + error.message, true);
                }
            });
        });

        const changeIdBtn = createButton('修改ID', '#ff3333', () => {
            if (!checkMMOAvailable()) {
                showMessage('MMO未加载或未将VM暴露全局', true);
                return;
            }

            showCustomPrompt('修改MMO ID', '请输入新ID', (newId) => {
                try {
                    window.vm.runtime.ext_CCWMMO.setPlayerState({
                        VALUE: newId.trim(),
                        PLAYER_INFO: "sessionId"
                    });
                    showMessage('MMO ID修改成功');
                } catch (error) {
                    showMessage('修改失败: ' + error.message, true);
                }
            });
        });

        const gameButtonsContainer = document.createElement('div');
        gameButtonsContainer.id = 'fuckmmo-game-buttons';
        gameButtonsContainer.style.cssText = `
            grid-column: 1 / span 2;
            display: flex;
            flex-direction: column; /* 初始竖向排列 */
            gap: 10px;
            border-top: 1px solid #ff3333;
            padding-top: 15px;
            margin-top: 5px;
        `;

        const drawBoxesBtn = createButton('开启绘制玩家方框', '#ff3333', toggleDrawing, 'fuckmmo-draw-button');

        const godModeBtn = createButton('开启锁血', '#ff3333', toggleGodMode, 'fuckmmo-godmode-button');

        gameButtonsContainer.appendChild(drawBoxesBtn);
        gameButtonsContainer.appendChild(godModeBtn);

        buttonContainer.appendChild(getInfoBtn);
        buttonContainer.appendChild(changeNameBtn);
        buttonContainer.appendChild(changeIdBtn);
        buttonContainer.appendChild(gameSelectContainer);
        buttonContainer.appendChild(gameButtonsContainer);
        
        panel.appendChild(title);
        panel.appendChild(buttonContainer);
        uiContainer.appendChild(toggleButton);
        uiContainer.appendChild(panel);
        document.body.appendChild(uiContainer);

        let isPanelVisible = false;
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (isPanelVisible) {
                panel.style.opacity = '0';
                panel.style.transform = 'scale(0.9) translateY(10px)';
                panel.style.visibility = 'hidden';
                toggleButton.textContent = 'FuckMMO';
            } else {
                panel.style.visibility = 'visible';
                panel.style.opacity = '1';
                panel.style.transform = 'scale(1) translateY(0)';
                toggleButton.textContent = '收起面板';
            }
            isPanelVisible = !isPanelVisible;
        });

        document.addEventListener('click', (event) => {
            if (!uiContainer.contains(event.target) && isPanelVisible) {
                panel.style.opacity = '0';
                panel.style.transform = 'scale(0.9) translateY(10px)';
                panel.style.visibility = 'hidden';
                toggleButton.textContent = 'FuckMMO';
                isPanelVisible = false;
            }
        });

        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        window.addEventListener('resize', resizeCanvas);
        
        const detectedMode = autoDetectGameMode();
        if (detectedMode) {
            handleGameModeChange(detectedMode);
            gameSelect.value = detectedMode;
            showMessage(`已自动检测到游戏模式: ${getGameModeName(detectedMode)}`);
        }
    }

    function showResultPanel(title, content) {
        const existingPanel = document.getElementById('fuckmmo-result');
        if (existingPanel) {
            existingPanel.remove();
        }

        const resultPanel = document.createElement('div');
        resultPanel.id = 'fuckmmo-result';
        resultPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
            border: 2px solid #ff3333;
            border-radius: 12px;
            padding: 25px;
            z-index: 10001;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.7);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        const resultTitle = document.createElement('h3');
        resultTitle.textContent = title;
        resultTitle.style.cssText = `
            margin: 0 0 20px 0;
            color: #ffffff;
            font-size: 20px;
            font-weight: 600;
            text-align: center;
            border-bottom: 2px solid #ff3333;
            padding-bottom: 10px;
        `;

        const resultContent = document.createElement('pre');
        resultContent.textContent = typeof content === 'object' ? 
            JSON.stringify(content, null, 2) : String(content);
        resultContent.style.cssText = `
            background: #2a2a2a;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.4;
            border: 1px solid #444444;
            color: #ffffff;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 20px;
        `;

        const copyButton = document.createElement('button');
        copyButton.textContent = '复制';
        copyButton.style.cssText = `
            background: linear-gradient(135deg, #ff3333, #ff5555);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
        `;

        copyButton.addEventListener('mouseenter', () => {
            copyButton.style.transform = 'translateY(-2px)';
        });

        copyButton.addEventListener('mouseleave', () => {
            copyButton.style.transform = 'translateY(0)';
        });

        copyButton.addEventListener('click', () => {
            const textArea = document.createElement('textarea');
            textArea.value = resultContent.textContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showMessage('内容已复制到剪贴板');
            
            copyButton.textContent = '已复制';
            setTimeout(() => {
                copyButton.textContent = '复制';
            }, 2000);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = `
            background: linear-gradient(135deg, #333333, #555555);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
        `;

        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.transform = 'translateY(-2px)';
        });

        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.transform = 'translateY(0)';
        });

        closeButton.addEventListener('click', () => {
            resultPanel.style.opacity = '0';
            resultPanel.style.transform = 'translate(-50%, -50%) scale(0.9)';
            setTimeout(() => {
                if (resultPanel.parentNode) {
                    resultPanel.parentNode.removeChild(resultPanel);
                }
            }, 300);
        });

        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(closeButton);

        resultPanel.appendChild(resultTitle);
        resultPanel.appendChild(resultContent);
        resultPanel.appendChild(buttonContainer);

        document.body.appendChild(resultPanel);

        setTimeout(() => {
            resultPanel.style.opacity = '1';
            resultPanel.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);

        resultPanel.addEventListener('click', (event) => {
            if (event.target === resultPanel) {
                resultPanel.style.opacity = '0';
                resultPanel.style.transform = 'translate(-50%, -50%) scale(0.9)';
                setTimeout(() => {
                    if (resultPanel.parentNode) {
                        resultPanel.parentNode.removeChild(resultPanel);
                    }
                }, 300);
            }
        });
    }

    if (document.readyState === 'complete') {
        if (window.vm) {
            initUI();
        } else {
            const observer = new MutationObserver(() => {
                if (window.vm) {
                    observer.disconnect();
                    initUI();
                }
            });
            
            observer.observe(document, {
                childList: true,
                subtree: true
            });
        }
    } else {
        window.addEventListener('load', () => {
            if (window.vm) {
                initUI();
            } else {
                const observer = new MutationObserver(() => {
                    if (window.vm) {
                        observer.disconnect();
                        initUI();
                    }
                });
                
                observer.observe(document, {
                    childList: true,
                    subtree: true
                });
            }
        });
    }

    console.log('FuckMMO v0.9已加载，等待作品加载');
})();
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
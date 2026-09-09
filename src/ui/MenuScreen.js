// =============================================
// PANTALLA DE INICIO - SELECCIÓN DE AXIE
// =============================================

import { getAllAxies } from '../config/axies.js';

export class MenuScreen {
    constructor() {
        this.container = null;
        this.selectedAxie = null;
        this.onStartGame = null;
        this.onSelectAxie = null;
    }

    show(onStartGame, onSelectAxie) {
        this.onStartGame = onStartGame;
        this.onSelectAxie = onSelectAxie;

        this.container = document.createElement('div');
        this.container.id = 'menu-screen';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a2a 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            font-family: 'Segoe UI', Arial, sans-serif;
            overflow-y: auto;
            padding: 20px;
        `;

        const title = document.createElement('h1');
        title.textContent = '⚔️ AXIE LEGENDS ⚔️';
        title.style.cssText = `
            font-size: 56px;
            font-weight: bold;
            color: #ffdd44;
            text-shadow: 0 0 30px rgba(255,220,68,0.3), 0 0 60px rgba(255,220,68,0.1);
            margin-bottom: 8px;
            letter-spacing: 4px;
        `;

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Elige tu Axie y comienza la batalla';
        subtitle.style.cssText = `
            font-size: 18px;
            color: #88aaff;
            margin-bottom: 25px;
            letter-spacing: 2px;
        `;

        this.container.appendChild(title);
        this.container.appendChild(subtitle);

        const selectionContainer = document.createElement('div');
        selectionContainer.style.cssText = `
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            justify-content: center;
            max-width: 1000px;
            margin-bottom: 25px;
        `;

        const axies = getAllAxies();
        axies.forEach((axie, index) => {
            const card = this.createAxieCard(axie, index === 0);
            selectionContainer.appendChild(card);
        });

        this.container.appendChild(selectionContainer);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            gap: 30px;
            margin-top: 10px;
            flex-wrap: wrap;
            justify-content: center;
        `;

        const btn1v1 = this.createGameButton('⚔️ 1 vs 1', 'Disponible', '#44ff88', () => {
            if (this.selectedAxie) {
                this.hide();
                if (this.onStartGame) {
                    this.onStartGame(this.selectedAxie, '1v1');
                }
            } else {
                this.showToast('⚠️ Selecciona un Axie primero');
            }
        }, false);
        buttonsContainer.appendChild(btn1v1);

        const btn5v5 = this.createGameButton('🌟 5 vs 5', 'Próximamente', '#666666', () => {
            this.showToast('🌟 Modo 5 vs 5 en desarrollo... ¡Pronto disponible!');
        }, true);
        buttonsContainer.appendChild(btn5v5);

        this.container.appendChild(buttonsContainer);

        this.infoPanel = document.createElement('div');
        this.infoPanel.id = 'axie-info-panel';
        this.infoPanel.style.cssText = `
            margin-top: 18px;
            padding: 16px 24px;
            background: rgba(0,0,0,0.6);
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
            min-width: 350px;
            text-align: center;
            color: #fff;
            transition: all 0.3s ease;
            max-width: 600px;
        `;
        this.updateInfoPanel(axies[0]);
        this.container.appendChild(this.infoPanel);

        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .menu-card { 
                transition: all 0.3s ease; 
                position: relative;
                margin: 0;
                transform: scale(1);
                transform-origin: center center;
            }
            .menu-card:hover { 
                transform: scale(0.95) !important;
                box-shadow: 0 5px 20px rgba(0,0,0,0.4); 
            }
            .menu-card.selected { 
                border-color: #ffdd44 !important; 
                box-shadow: 0 0 30px rgba(255,220,68,0.3) !important;
                transform: scale(1) !important;
            }
            .btn-5v5 { opacity: 0.5 !important; cursor: not-allowed !important; filter: grayscale(0.5); }
            .btn-5v5:hover { transform: none !important; box-shadow: none !important; }
        `;
        document.head.appendChild(style);

        document.body.appendChild(this.container);
        this.container.style.animation = 'fadeIn 0.5s ease-out';
    }

    createAxieCard(axie, isDefault = false) {
        const card = document.createElement('div');
        card.className = 'menu-card';
        if (isDefault) {
            card.classList.add('selected');
            this.selectedAxie = axie.id;
        }
        card.dataset.axieId = axie.id;

        card.style.cssText = `
            width: 140px;
            padding: 14px;
            background: rgba(255,255,255,0.05);
            border: 2px solid ${isDefault ? '#ffdd44' : 'rgba(255,255,255,0.1)'};
            border-radius: 14px;
            cursor: pointer;
            text-align: center;
            color: #fff;
            backdrop-filter: blur(10px);
            box-shadow: ${isDefault ? '0 0 30px rgba(255,220,68,0.2)' : 'none'};
            transition: all 0.3s ease;
            position: relative;
            margin: 0;
            transform: scale(1);
            transform-origin: center center;
        `;

        const icon = document.createElement('div');
        icon.style.cssText = `font-size: 40px; margin-bottom: 4px;`;
        icon.textContent = axie.habilidades.pasiva.icono || '🐾';

        const name = document.createElement('div');
        name.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: ${axie.color || '#ffffff'};
            margin-bottom: 2px;
        `;
        name.textContent = axie.nombre;

        const type = document.createElement('div');
        type.style.cssText = `font-size: 11px; color: #88aaff; opacity: 0.6;`;
        type.textContent = axie.id.toUpperCase();

        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(type);

        card.addEventListener('click', () => {
            document.querySelectorAll('.menu-card').forEach(c => {
                c.classList.remove('selected');
                c.style.borderColor = 'rgba(255,255,255,0.1)';
                c.style.boxShadow = 'none';
                c.style.transform = 'scale(1)';
            });
            card.classList.add('selected');
            card.style.borderColor = '#ffdd44';
            card.style.boxShadow = '0 0 30px rgba(255,220,68,0.3)';
            card.style.transform = 'scale(1)';

            this.selectedAxie = axie.id;
            this.updateInfoPanel(axie);

            if (this.onSelectAxie) {
                this.onSelectAxie(axie.id);
            }
        });

        return card;
    }

    updateInfoPanel(axie) {
        if (!this.infoPanel) return;

        const hab = axie.habilidades || { pasiva: {}, activa: {}, definitiva: {} };
        const pasiva = hab.pasiva || { nombre: 'Sin pasiva', descripcion: '', icono: '' };
        const activa = hab.activa || { nombre: 'Sin habilidad', descripcion: '', icono: '' };
        const definitiva = hab.definitiva || { nombre: 'Sin definitiva', descripcion: '', icono: '' };
        const stats = axie.stats || { vida: 0, ataque: 0, defensa: 0, velocidad: 0 };

        this.infoPanel.innerHTML = `
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap;justify-content:center;">
                <span style="font-size:28px;">${pasiva.icono || '🐾'}</span>
                <div>
                    <div style="font-size:20px;font-weight:bold;color:${axie.color || '#ffffff'};">${axie.nombre}</div>
                    <div style="font-size:13px;color:#88aaff;">${axie.descripcion || ''}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0;font-size:12px;">
                <div>❤️ ${stats.vida || 0}</div>
                <div>⚔️ ${stats.ataque || 0}</div>
                <div>🛡️ ${stats.defensa || 0}</div>
                <div>💨 ${stats.velocidad || 0}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;text-align:left;">
                <div style="background:rgba(68,255,136,0.1);padding:6px 10px;border-radius:6px;border-left:3px solid #44ff88;">
                    <div style="font-weight:bold;font-size:11px;color:#44ff88;">PASIVA</div>
                    <div style="font-weight:bold;">${pasiva.icono || ''} ${pasiva.nombre || 'Sin pasiva'}</div>
                    <div style="font-size:10px;color:#aaa;">${pasiva.descripcion || ''}</div>
                </div>
                <div style="background:rgba(68,170,255,0.1);padding:6px 10px;border-radius:6px;border-left:3px solid #44aaff;">
                    <div style="font-weight:bold;font-size:11px;color:#44aaff;">ACTIVA</div>
                    <div style="font-weight:bold;">${activa.icono || ''} ${activa.nombre || 'Sin habilidad'}</div>
                    <div style="font-size:10px;color:#aaa;">${activa.descripcion || ''}</div>
                    <div style="font-size:10px;color:#88aaff;">CD: ${activa.cooldown || 0}s</div>
                </div>
                <div style="background:rgba(255,170,68,0.1);padding:6px 10px;border-radius:6px;border-left:3px solid #ffaa44;">
                    <div style="font-weight:bold;font-size:11px;color:#ffaa44;">DEFINITIVA</div>
                    <div style="font-weight:bold;">${definitiva.icono || ''} ${definitiva.nombre || 'Sin definitiva'}</div>
                    <div style="font-size:10px;color:#aaa;">${definitiva.descripcion || ''}</div>
                    <div style="font-size:10px;color:#ffaa44;">CD: ${definitiva.cooldown || 0}s</div>
                </div>
            </div>
        `;
    }

    createGameButton(label, subLabel, color, onClick, isDisabled = false) {
        const btn = document.createElement('button');
        btn.className = isDisabled ? 'btn-5v5' : '';
        btn.style.cssText = `
            padding: 14px 40px;
            font-size: 20px;
            font-weight: bold;
            background: ${isDisabled ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${color}, ${color}dd)`};
            color: ${isDisabled ? '#666' : '#fff'};
            border: ${isDisabled ? '2px solid rgba(255,255,255,0.1)' : `2px solid ${color}`};
            border-radius: 14px;
            cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
            transition: all 0.3s ease;
            box-shadow: ${isDisabled ? 'none' : `0 0 30px ${color}33`};
            font-family: 'Segoe UI', Arial, sans-serif;
            min-width: 180px;
            opacity: ${isDisabled ? 0.5 : 1};
        `;
        if (!isDisabled) {
            btn.onmouseenter = () => {
                btn.style.transform = 'scale(1.05)';
                btn.style.boxShadow = `0 0 50px ${color}55`;
            };
            btn.onmouseleave = () => {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = `0 0 30px ${color}33`;
            };
        }
        const mainText = document.createElement('div');
        mainText.textContent = label;
        mainText.style.fontSize = '22px';
        const subText = document.createElement('div');
        subText.textContent = subLabel;
        subText.style.fontSize = '13px';
        subText.style.opacity = '0.7';
        subText.style.marginTop = '2px';
        btn.appendChild(mainText);
        btn.appendChild(subText);
        btn.addEventListener('click', onClick);
        return btn;
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            padding: 14px 28px;
            background: rgba(0,0,0,0.9);
            color: #ffdd44;
            border: 1px solid #ffdd44;
            border-radius: 12px;
            font-size: 16px;
            font-family: 'Segoe UI', Arial, sans-serif;
            z-index: 3000;
            animation: fadeIn 0.3s ease-out;
            box-shadow: 0 0 30px rgba(255,220,68,0.2);
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500);
        }, 3000);
    }

    hide() {
        if (this.container && this.container.parentNode) {
            this.container.style.opacity = '0';
            this.container.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (this.container && this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                }
            }, 500);
        }
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default MenuScreen;
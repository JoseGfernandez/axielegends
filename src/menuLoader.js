// =============================================
// CARGADOR DEL MENÚ DE INICIO
// =============================================

import { MenuScreen } from './ui/MenuScreen.js';

// Ocultar el canvas y los elementos del juego ANTES de que se rendericen
document.addEventListener('DOMContentLoaded', () => {
    // Inmediatamente ocultar el canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
        canvas.style.display = 'none';
    }
    
    // Ocultar elementos del juego
    const timerDiv = document.getElementById('timer-display');
    const fpsDiv = document.getElementById('fps-display');
    const waveDiv = document.getElementById('wave-display');
    const targetUI = document.getElementById('target-ui');
    
    if (timerDiv) timerDiv.style.display = 'none';
    if (fpsDiv) fpsDiv.style.display = 'none';
    if (waveDiv) waveDiv.style.display = 'none';
    if (targetUI) targetUI.style.display = 'none';
    
    // Esperar a que main.js termine de cargar
    setTimeout(() => {
        // Crear menú
        const menuScreen = new MenuScreen();
        menuScreen.show(
            (axieId, mode) => {
                console.log(`🎮 Iniciando juego con Axie: ${axieId} en modo ${mode}`);
                
                // Mostrar canvas
                const canvas2 = document.querySelector('canvas');
                if (canvas2) {
                    canvas2.style.display = 'block';
                }
                
                // Mostrar elementos del juego
                if (timerDiv) timerDiv.style.display = 'block';
                if (fpsDiv) fpsDiv.style.display = 'block';
                if (waveDiv) waveDiv.style.display = 'block';
                if (targetUI) targetUI.style.display = 'block';
                
                // Iniciar el juego
                if (typeof gameLoop === 'function') {
                    requestAnimationFrame(gameLoop);
                }
            },
            (axieId) => {
                console.log(`✅ Axie seleccionado: ${axieId}`);
            }
        );
        
        window.menuScreen = menuScreen;
        console.log('🎮 Menú de inicio cargado correctamente');
    }, 100);
});
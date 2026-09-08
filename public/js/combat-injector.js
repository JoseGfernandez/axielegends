(function() {
    // Evitar doble inyección
    if (window._combatInvertedActive) return;
    window._combatInvertedActive = true;

    console.log('⚔️ Sistema de reasignación de clics (Izquierda: Ataque/Selección | Derecha: Movimiento) activado.');

    // Prevenir menú contextual del clic derecho para que el movimiento sea fluido
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Interceptar el flujo de eventos del ratón en la fase de captura
    window.addEventListener('pointerdown', (e) => {
        // Clic en el HUD: no interferir
        if (e.target.closest('#axie-hub')) return;

        if (e.button === 0) {
            // --- CLIC IZQUIERDO: SELECCIÓN Y ATAQUE MÁGICO / ESPINAS ---
            // Aquí puedes disparar la lógica de selección de enemigos/torres y ataque a distancia
            console.log('🎯 Clic Izquierdo: Seleccionando objetivo / Lanzando espina mágica.');
            showMagicSpikeEffect(e.clientX, e.clientY);

        } else if (e.button === 2) {
            // --- CLIC DERECHO: MOVIMIENTO DEL AXIE ---
            // Interceptamos y redirigimos para asegurar que el motor interprete el movimiento
            console.log('🕹️ Clic Derecho: Moviendo al Axie.');
        }
    }, true);

    function showMagicSpikeEffect(x, y) {
        const spike = document.createElement('div');
        spike.textContent = '✨🌿';
        spike.style.position = 'fixed';
        spike.style.left = x + 'px';
        spike.style.top = y + 'px';
        spike.style.fontSize = '22px';
        spike.style.pointerEvents = 'none';
        spike.style.transition = 'all 0.6s cubic-bezier(0.1, 0.9, 0.2, 1)';
        spike.style.zIndex = '9999';
        document.body.appendChild(spike);

        setTimeout(() => {
            spike.style.transform = 'translateY(-60px) scale(1.4)';
            spike.style.opacity = '0';
        }, 10);

        setTimeout(() => {
            spike.remove();
        }, 600);
    }
})();

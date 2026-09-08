export function initCombatSystem(scene, camera, player, entities) {
    console.log('⚔️ Sistema de combate y targeting inicializado.');

    let currentTargetPath = null;
    let selectedTarget = null;

    // Prevenir menú contextual en clic derecho para el movimiento
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('pointerdown', (e) => {
        // Clic derecho (button === 2): Mover al Axie
        if (e.button === 2) {
            // Lógica de movimiento por Raycaster al terreno
            // (Se conecta con el sistema de navegación del motor existente)
            console.shout ? null : console.log('Movimiento con clic derecho activado.');
        }

        // Clic izquierdo (button === 0): Seleccionar objetivo / Atacar
        if (e.button === 0) {
            // Aquí se evaluará el Raycast contra minions y torres enemigas
            console.log('Selección de objetivo con clic izquierdo.');
        }
    });
}

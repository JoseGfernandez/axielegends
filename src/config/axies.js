// =============================================
// CONFIGURACIÓN DE AXIES (5 TIPOS)
// =============================================

export const AXIE_TYPES = {
    PLANTA: 'planta',
    AVE: 'ave',
    PEZ: 'pez',
    BESTIA: 'bestia',
    BICHO: 'bicho',
};

export const AXIES_DATA = {
    planta: {
        id: 'planta',
        nombre: '🌿 Planta',
        descripcion: 'Axie de naturaleza con gran resistencia y curación.',
        modelo: '/axie-3d-assets/assets/mascots/planta.glb',
        color: '#44ff88',
        stats: {
            vida: 120,
            ataque: 15,
            defensa: 25,
            velocidad: 1.2,
        },
        habilidades: {
            pasiva: {
                nombre: 'Fotosíntesis',
                descripcion: 'Regenera 5% de vida cada 5 segundos.',
                icono: '🌱',
            },
            activa: {
                nombre: 'Látigo Vegetal',
                descripcion: 'Ataca con enredaderas que ralentizan.',
                icono: '🌿',
                cooldown: 6,
            },
            definitiva: {
                nombre: 'Tormenta de Esporas',
                descripcion: 'Libera esporas que dañan y envenenan.',
                icono: '🍄',
                cooldown: 30,
            },
        },
    },
    ave: {
        id: 'ave',
        nombre: '🦅 Ave',
        descripcion: 'Axie rápido y ágil, experto en ataques aéreos.',
        modelo: '/axie-3d-assets/assets/mascots/ave.glb',
        color: '#44aaff',
        stats: {
            vida: 80,
            ataque: 25,
            defensa: 15,
            velocidad: 1.8,
        },
        habilidades: {
            pasiva: {
                nombre: 'Vista de Águila',
                descripcion: 'Aumenta el rango de ataque en un 20%.',
                icono: '👁️',
            },
            activa: {
                nombre: 'Picotazo Rápido',
                descripcion: 'Ataca al enemigo con gran velocidad.',
                icono: '⚡',
                cooldown: 4,
            },
            definitiva: {
                nombre: 'Tormenta de Plumas',
                descripcion: 'Lanza una ráfaga de plumas que dañan área.',
                icono: '🪶',
                cooldown: 25,
            },
        },
    },
    pez: {
        id: 'pez',
        nombre: '🐟 Pez',
        descripcion: 'Axie acuático con gran control y daño mágico.',
        modelo: '/axie-3d-assets/assets/mascots/pez.glb',
        color: '#44ddff',
        stats: {
            vida: 90,
            ataque: 30,
            defensa: 18,
            velocidad: 1.4,
        },
        habilidades: {
            pasiva: {
                nombre: 'Aleta de Agua',
                descripcion: 'Aumenta la velocidad de ataque en agua.',
                icono: '💧',
            },
            activa: {
                nombre: 'Burbuja Mágica',
                descripcion: 'Lanza una burbuja que atrapa al enemigo.',
                icono: '🫧',
                cooldown: 7,
            },
            definitiva: {
                nombre: 'Oleada Arrasadora',
                descripcion: 'Invoca una ola gigante que daña y empuja.',
                icono: '🌊',
                cooldown: 30,
            },
        },
    },
    bestia: {
        id: 'bestia',
        nombre: '🐻 Bestia',
        descripcion: 'Axie poderoso y resistente, experto en combate cuerpo a cuerpo.',
        modelo: '/axie-3d-assets/assets/mascots/bing.glb',
        color: '#ff8844',
        stats: {
            vida: 150,
            ataque: 20,
            defensa: 30,
            velocidad: 1.0,
        },
        habilidades: {
            pasiva: {
                nombre: 'Piel Dura',
                descripcion: 'Reduce el daño recibido en un 15%.',
                icono: '🛡️',
            },
            activa: {
                nombre: 'Garra Salvaje',
                descripcion: 'Golpea con sus garras causando gran daño.',
                icono: '🐾',
                cooldown: 5,
            },
            definitiva: {
                nombre: 'Furia Bestial',
                descripcion: 'Entra en furia aumentando ataque y defensa.',
                icono: '🔥',
                cooldown: 28,
            },
        },
    },
    bicho: {
        id: 'bicho',
        nombre: '🐛 Bicho',
        descripcion: 'Axie astuto que usa veneno y trampas para vencer.',
        modelo: '/axie-3d-assets/assets/mascots/bicho.glb',
        color: '#ff44aa',
        stats: {
            vida: 70,
            ataque: 22,
            defensa: 12,
            velocidad: 1.6,
        },
        habilidades: {
            pasiva: {
                nombre: 'Veneno Letal',
                descripcion: 'Los ataques envenenan al enemigo por 3s.',
                icono: '☠️',
            },
            activa: {
                nombre: 'Telaraña Trampa',
                descripcion: 'Crea una telaraña que ralentiza enemigos.',
                icono: '🕸️',
                cooldown: 8,
            },
            definitiva: {
                nombre: 'Enjambre de Insectos',
                descripcion: 'Invoca un enjambre que daña y confunde.',
                icono: '🐝',
                cooldown: 25,
            },
        },
    },
};

export function getAxieById(id) {
    return AXIES_DATA[id] || null;
}

export function getAllAxies() {
    return Object.values(AXIES_DATA);
}

export default AXIES_DATA;
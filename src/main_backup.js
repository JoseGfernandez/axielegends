import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// CONFIGURACIÓN
const CONFIG = {
    gravedad: -20,
    velocidadSalto: 7,
    velocidadMovimiento: 5,
    distanciaCamara: 8,      // Distancia inicial
    alturaCamara: 5,         // Altura inicial
    distanciaMin: 3,         // Zoom máximo (cerca)
    distanciaMax: 15,        // Zoom mínimo (lejos)
    velocidadZoom: 0.3,      // Velocidad del zoom
};

// ESCENA
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// CÁMARA
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 4, 8);
camera.lookAt(0, 1, 0);

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

// LUCES
const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffeedd, 2);
mainLight.position.set(10, 15, 10);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// SUELO
const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.8, metalness: 0.2 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(30, 20, 0x446688, 0x224466);
grid.position.y = -0.45;
scene.add(grid);

// ESTRELLAS
const starsGeo = new THREE.BufferGeometry();
const starsPos = new Float32Array(1000 * 3);
for (let i = 0; i < 1000 * 3; i++) starsPos[i] = (Math.random() - 0.5) * 200;
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
const starsMat = new THREE.PointsMaterial({ color: 0x88aaff, size: 0.15, transparent: true, opacity: 0.8 });
const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

// =============================================
// VARIABLES DE CÁMARA
// =============================================
let cameraAngle = 0;
let cameraDistance = CONFIG.distanciaCamara;
let cameraHeight = CONFIG.alturaCamara;

// =============================================
// VARIABLES DEL JUGADOR
// =============================================
let playerModel = null;
let playerBody = null;
let mixer = null;
let animIdle = null;
let animWalk = null;
let animRun = null;

let velocityY = 0;
let isGrounded = false;
let jumpCooldown = 0;
let currentAnim = 'idle';

// INPUT
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ') e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

// =============================================
// ZOOM CON RUEDA DEL MOUSE (LIMITADO)
// =============================================
document.addEventListener('wheel', (e) => {
    // Prevenir scroll de la página
    e.preventDefault();
    
    // Calcular el cambio de zoom (invertido para que sea natural)
    const delta = e.deltaY > 0 ? CONFIG.velocidadZoom : -CONFIG.velocidadZoom;
    
    // Aplicar zoom con límites
    cameraDistance = Math.max(
        CONFIG.distanciaMin,
        Math.min(CONFIG.distanciaMax, cameraDistance + delta)
    );
    
    // Mostrar en consola (opcional, para debug)
    // console.log('📷 Zoom:', cameraDistance.toFixed(1));
}, { passive: false });

// =============================================
// CARGAR AXIE
// =============================================
console.log('📦 Cargando Axie...');
const loader = new GLTFLoader();
loader.load(
    '/axie-3d-assets/assets/mascots/bing.glb',
    (gltf) => {
        console.log('✅ Axie cargado!');
        playerModel = gltf.scene;
        playerModel.scale.set(1.5, 1.5, 1.5);
        playerModel.position.set(0, 0, 0);
        playerModel.castShadow = true;
        playerModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        scene.add(playerModel);

        // Animaciones
        mixer = new THREE.AnimationMixer(playerModel);
        const clips = gltf.animations;
        clips.forEach(clip => {
            const name = clip.name.toLowerCase();
            if (name.includes('idle')) animIdle = mixer.clipAction(clip);
            if (name.includes('walk')) animWalk = mixer.clipAction(clip);
            if (name.includes('run')) animRun = mixer.clipAction(clip);
        });

        if (animIdle) animIdle.play();
        console.log('🎬 Animaciones:', clips.map(c => c.name).join(', '));
    },
    undefined,
    (error) => {
        console.error('❌ Error cargando Axie:', error);
        // Cubo de respaldo
        const fallbackGeo = new THREE.BoxGeometry(1, 1.5, 1);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
        playerBody = new THREE.Mesh(fallbackGeo, fallbackMat);
        playerBody.position.y = 1;
        scene.add(playerBody);
    }
);

// =============================================
// RESET
// =============================================
function resetPlayer() {
    if (playerModel) {
        playerModel.position.set(0, 0, 0);
    } else if (playerBody) {
        playerBody.position.set(0, 1, 0);
    }
    velocityY = 0;
    isGrounded = false;
    jumpCooldown = 0;
    cameraAngle = 0;
    cameraDistance = CONFIG.distanciaCamara;
    cameraHeight = CONFIG.alturaCamara;
}

// =============================================
// LOOP PRINCIPAL
// =============================================
let fps = 0, frames = 0, fpsTimer = 0, lastTime = 0;

function gameLoop(time) {
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    // FPS
    frames++;
    fpsTimer += delta;
    if (fpsTimer >= 0.5) {
        fps = Math.round(frames / fpsTimer);
        frames = 0;
        fpsTimer = 0;
        document.getElementById('fps').textContent = fps;
    }

    // =============================================
    // FÍSICA Y MOVIMIENTO
    // =============================================
    jumpCooldown -= delta;
    velocityY += CONFIG.gravedad * delta;

    let moveX = 0, moveZ = 0;
    const speed = CONFIG.velocidadMovimiento;
    if (keys['w'] || keys['W'] || keys['ArrowUp']) moveZ = -speed;
    if (keys['s'] || keys['S'] || keys['ArrowDown']) moveZ = speed;
    if (keys['a'] || keys['A'] || keys['ArrowLeft']) moveX = -speed;
    if (keys['d'] || keys['D'] || keys['ArrowRight']) moveX = speed;

    const target = playerModel || playerBody;
    if (target) {
        // Movimiento
        target.position.x += moveX * delta;
        target.position.z += moveZ * delta;
        target.position.y += velocityY * delta;

        // Rotar hacia la dirección del movimiento
        if (moveX !== 0 || moveZ !== 0) {
            const angle = Math.atan2(moveX, moveZ);
            target.rotation.y = angle;
        }

        // Suelo
        if (target.position.y <= 0) {
            target.position.y = 0;
            velocityY = 0;
            isGrounded = true;
        } else {
            isGrounded = false;
        }

        // Límites
        const limit = 14;
        target.position.x = Math.max(-limit, Math.min(limit, target.position.x));
        target.position.z = Math.max(-limit, Math.min(limit, target.position.z));

        // Salto
        if ((keys[' '] || keys['Space']) && isGrounded && jumpCooldown <= 0) {
            velocityY = CONFIG.velocidadSalto;
            isGrounded = false;
            jumpCooldown = 0.2;
            console.log('🚀 Salto!');
        }

        // Reiniciar
        if (keys['r'] || keys['R']) {
            resetPlayer();
            keys['r'] = false;
            keys['R'] = false;
        }

        if (target.position.y < -20) resetPlayer();

        // =============================================
        // CÁMARA QUE SIGUE AL JUGADOR CON ZOOM
        // =============================================
        // Rotar cámara con Q y E
        if (keys['q'] || keys['Q']) cameraAngle += delta * 2;
        if (keys['e'] || keys['E']) cameraAngle -= delta * 2;

        // Posición de la cámara orbitando alrededor del jugador
        const targetPos = target.position;
        camera.position.x = targetPos.x + Math.sin(cameraAngle) * cameraDistance;
        camera.position.z = targetPos.z + Math.cos(cameraAngle) * cameraDistance;
        camera.position.y = targetPos.y + cameraHeight;
        camera.lookAt(targetPos);
    }

    // =============================================
    // ANIMACIONES
    // =============================================
    if (mixer) {
        const isMoving = moveX !== 0 || moveZ !== 0;
        let targetAnim = 'idle';
        if (isMoving) targetAnim = 'walk';

        if (targetAnim !== currentAnim) {
            if (currentAnim === 'idle' && animIdle) animIdle.stop();
            if (currentAnim === 'walk' && animWalk) animWalk.stop();
            if (currentAnim === 'run' && animRun) animRun.stop();

            if (targetAnim === 'idle' && animIdle) animIdle.play();
            if (targetAnim === 'walk' && animWalk) animWalk.play();
            if (targetAnim === 'run' && animRun) animRun.play();

            currentAnim = targetAnim;
        }
        mixer.update(delta);
    }

    stars.rotation.y += delta * 0.01;

    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

// =============================================
// RESIZE
// =============================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// =============================================
// INICIAR
// =============================================
console.log('');
console.log('✅ NEXUS ENGINE CON AXIE + ZOOM');
console.log('🎮 CONTROLES:');
console.log('  • WASD → Mover al Axie');
console.log('  • ESPACIO → Saltar');
console.log('  • Q / E → Rotar cámara');
console.log('  • RUEDA MOUSE → Zoom (suave y limitado)');
console.log('  • R → Reiniciar posición');
console.log('');
console.log('📷 ZOOM:');
console.log(`  • Distancia mínima: ${CONFIG.distanciaMin}`);
console.log(`  • Distancia máxima: ${CONFIG.distanciaMax}`);
console.log(`  • Distancia inicial: ${CONFIG.distanciaCamara}`);
console.log('');

requestAnimationFrame(gameLoop);

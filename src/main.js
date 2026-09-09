﻿import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MenuScreen } from './ui/MenuScreen.js';
import { getAxieById, getAllAxies } from './config/axies.js';

// =============================================
// CONFIGURACIÓN
// =============================================
const CONFIG = {
    gravedad: -20,
    velocidadSalto: 7,
    shadowMapSize: 256,
    pixelRatio: 1.2,
    updateInterval: 2,
    minionLimitZ: 26,
    camaraAngulo: 60,
    camaraDistancia: 18,
    camaraAltura: 14,
    SPAWN_DELAY: 15,
    towerRange: 6,
    towerDamage: 20,
    towerFireRate: 1.5,
    projectileSpeed: 8,
    towerHealth: 500,
    nexusHealth: 1000,
    meleeSpacing: 1.1,
    mageSpacing: 0.9,
    meleeSpeed: 1.4,
    mageSpeed: 1.4,
    axieSpeed: 1.5,
    smoothSpeed: 2.5,
    cameraSmoothSpeed: 3.0,
    // ===== SISTEMA DE ATAQUE =====
    attackRange: 4.0,
    attackDamage: 15,
    attackSpeed: 0.7,
    projectileSpeed: 8,
    // ===== AGRO RANGE =====
    agroRange: 12.0,
    // ===== TIEMPO DE RE-EVALUACIÓN =====
    reevaluationTime: 2.0,
    // ===== PERSECUCIÓN =====
    chaseTime: 3.0,
    // ===== VIDA DEL AXIE (INMORTAL) =====
    playerMaxHealth: 999999,
    // ===== PRIMERA OLEADA (fantasmal) =====
    firstWaveGhostDuration: 28,
};

// =============================================
// VARIABLES GLOBALES
// =============================================
let playerHealth = CONFIG.playerMaxHealth;
let playerMaxHealth = CONFIG.playerMaxHealth;
let isPlayerDead = false;
let playerAttackTarget = null;
let gameTime = 0;
let isFirstWave = true;
let firstWaveTimer = 0;
let gameFinished = false;
let victoryScreen = null;
let gamePaused = false;
let pauseMenu = null;
let selectedAxieId = 'bestia';
let axieLoaded = false;
let currentAxieName = 'Bing';

// =============================================
// CACHE DE TEXTURAS
// =============================================
const healthBarCache = new Map();

function getHealthBarTexture(segments, visibleSegments, isEnemy) {
    const key = `${segments}-${visibleSegments}-${isEnemy}`;
    if (healthBarCache.has(key)) {
        return healthBarCache.get(key);
    }
    
    const canvas = document.createElement('canvas');
    const width = 128;
    const height = 20;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
    
    const segmentWidth = (width - 4) / segments;
    const segmentHeight = height - 4;
    const colors = isEnemy ? ['#ff4444', '#ff6666'] : ['#4488ff', '#66aaff'];
    
    for (let i = 0; i < visibleSegments; i++) {
        const x = 2 + i * segmentWidth;
        const y = 2;
        const w = segmentWidth - 1;
        const h = segmentHeight;
        const color = i % 2 === 0 ? colors[0] : colors[1];
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#88aaff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, w, h);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    healthBarCache.set(key, texture);
    return texture;
}

function createHealthBar(segments = 10, isEnemy = false) {
    const texture = getHealthBarTexture(segments, segments, isEnemy);
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.2, 0.2, 1);
    sprite.renderOrder = 999;
    return { sprite, spriteMat };
}

function updateHealthBarSprite(spriteMat, segments, visibleSegments, isEnemy) {
    const texture = getHealthBarTexture(segments, visibleSegments, isEnemy);
    spriteMat.map = texture;
    spriteMat.needsUpdate = true;
}

// =============================================
// ESCENA, CÁMARA Y RENDERER
// =============================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.Fog(0x0a0a1a, 35, 55);

const frustumSize = 7.2;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
    -frustumSize * aspect,
    frustumSize * aspect,
    frustumSize,
    -frustumSize,
    0.1,
    100
);
camera.zoom = 1.0;

const CAMERA_OFFSET = new THREE.Vector3(
    Math.sin(CONFIG.camaraAngulo * Math.PI / 180) * CONFIG.camaraDistancia,
    CONFIG.camaraAltura,
    Math.cos(CONFIG.camaraAngulo * Math.PI / 180) * CONFIG.camaraDistancia
);

let cameraSmoothPos = new THREE.Vector3(0, 0, 0);
let cameraSmoothTarget = new THREE.Vector3(0, 0, 0);

function updateCameraPosition() {
    const targetPos = playerModel ? playerModel.position : new THREE.Vector3(0, 0, 0);
    const targetCamPos = new THREE.Vector3(
        targetPos.x + CAMERA_OFFSET.x,
        targetPos.y + CAMERA_OFFSET.y,
        targetPos.z + CAMERA_OFFSET.z
    );
    cameraSmoothPos.lerp(targetCamPos, 1 - Math.exp(-CONFIG.cameraSmoothSpeed * 0.016));
    cameraSmoothTarget.lerp(targetPos, 1 - Math.exp(-CONFIG.cameraSmoothSpeed * 0.016));
    camera.position.copy(cameraSmoothPos);
    camera.lookAt(cameraSmoothTarget);
    camera.updateProjectionMatrix();
}

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    powerPreference: "high-performance" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.pixelRatio));
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.domElement.style.display = 'none';
document.body.prepend(renderer.domElement);

// =============================================
// LUCES
// =============================================
const ambientLight = new THREE.AmbientLight(0x404060, 0.9);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffeedd, 2);
mainLight.position.set(15, 25, 10);
mainLight.castShadow = false;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
fillLight.position.set(-10, 10, -10);
scene.add(fillLight);

// =============================================
// MAPA
// =============================================
const groundGeo = new THREE.PlaneGeometry(40, 58);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2a2a, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = false;
scene.add(ground);

const grid = new THREE.GridHelper(40, 20, 0x446688, 0x224466);
grid.position.y = -0.45;
scene.add(grid);

const laneGeo = new THREE.PlaneGeometry(10, 52);
const laneMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.8 });
const lane = new THREE.Mesh(laneGeo, laneMat);
lane.rotation.x = -Math.PI / 2;
lane.position.set(0, -0.45, 0);
lane.receiveShadow = false;
scene.add(lane);

const lineMat = new THREE.MeshStandardMaterial({ color: 0x88aaff, emissive: 0x4488ff, emissiveIntensity: 0.2 });
for (let z = -24; z <= 24; z += 4) {
    const lineLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1.5), lineMat);
    lineLeft.rotation.x = -Math.PI / 2;
    lineLeft.position.set(-4.8, -0.4, z);
    scene.add(lineLeft);
    const lineRight = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1.5), lineMat);
    lineRight.rotation.x = -Math.PI / 2;
    lineRight.position.set(4.8, -0.4, z);
    scene.add(lineRight);
}

const centerLineMat = new THREE.MeshStandardMaterial({ color: 0x88aaff, emissive: 0x4488ff, emissiveIntensity: 0.1, transparent: true, opacity: 0.4 });
for (let z = -24; z <= 24; z += 4) {
    const center = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.8), centerLineMat);
    center.rotation.x = -Math.PI / 2;
    center.position.set(0, -0.4, z);
    scene.add(center);
}

// =============================================
// NEXOS
// =============================================
class Nexus {
    constructor(x, z, isEnemy = false) {
        this.isEnemy = isEnemy;
        this.maxHealth = CONFIG.nexusHealth;
        this.health = this.maxHealth;
        this.isDead = false;
        this.segments = 10;
        this.type = 'nexus';
        this.explosionParticles = [];
        this.isExploding = false;
        
        const color = isEnemy ? 0x882222 : 0x224488;
        const emissiveColor = isEnemy ? 0xff4444 : 0x4488ff;
        
        this.group = new THREE.Group();
        this.group.userData.targetRef = this;
        
        const baseGeo = new THREE.CylinderGeometry(3, 3.5, 0.5, 24);
        const baseMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0;
        base.receiveShadow = false;
        base.castShadow = false;
        base.userData.targetRef = this;
        this.group.add(base);
        
        const ringGeo = new THREE.TorusGeometry(2.5, 0.1, 12, 24);
        const ringMat = new THREE.MeshStandardMaterial({ 
            color: emissiveColor, 
            emissive: emissiveColor, 
            emissiveIntensity: 0.3 
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.3;
        ring.rotation.x = Math.PI / 2;
        ring.userData.targetRef = this;
        this.group.add(ring);
        
        this.nexusGeo = new THREE.SphereGeometry(1.5, 24, 24);
        this.nexusMat = new THREE.MeshStandardMaterial({
            color: emissiveColor,
            roughness: 0.1,
            metalness: 0.9,
            emissive: emissiveColor,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.85
        });
        this.nexusMesh = new THREE.Mesh(this.nexusGeo, this.nexusMat);
        this.nexusMesh.position.y = 1.5;
        this.nexusMesh.castShadow = false;
        this.nexusMesh.userData.targetRef = this;
        this.group.add(this.nexusMesh);
        
        const particleMat = new THREE.PointsMaterial({
            color: emissiveColor,
            size: 0.05,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const particleCount = 30;
        const particleGeo = new THREE.BufferGeometry();
        const particlePos = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i++) {
            particlePos[i] = (Math.random() - 0.5) * 4;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
        this.particles = new THREE.Points(particleGeo, particleMat);
        this.particles.position.y = 1.5;
        this.particles.userData.targetRef = this;
        this.group.add(this.particles);
        
        const healthBar = createHealthBar(this.segments, this.isEnemy);
        healthBar.sprite.position.y = 2.8;
        this.group.add(healthBar.sprite);
        this.spriteMat = healthBar.spriteMat;
        this.healthSprite = healthBar.sprite;
        
        this.group.position.set(x, -0.3, z);
        scene.add(this.group);
        this.position = new THREE.Vector3(x, 0, z);
    }
    
    updateHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        const visibleSegments = Math.max(0, Math.min(this.segments, Math.ceil(healthPercent * this.segments)));
        updateHealthBarSprite(this.spriteMat, this.segments, visibleSegments, this.isEnemy);
    }
    
    takeDamage(damage) {
        if (this.isDead) return;
        this.health -= damage;
        this.updateHealthBar();
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            this.startExplosion();
            console.log(`💀 NEXO ${this.isEnemy ? 'ENEMIGO' : 'ALIADO'} DESTRUIDO!`);
            if (this.isEnemy) {
                showVictoryScreen();
            }
        }
    }
    
    startExplosion() {
        if (this.isExploding) return;
        this.isExploding = true;
        this.group.visible = false;
        
        const colors = [0xff4444, 0xff8800, 0xffff00, 0xffaa44, 0xff2244];
        const position = this.group.position.clone();
        position.y = 1.5;
        
        for (let i = 0; i < 80; i++) {
            const size = 0.1 + Math.random() * 0.3;
            const geo = new THREE.SphereGeometry(size, 6, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true,
                opacity: 0.8 + Math.random() * 0.2
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(position);
            p.position.x += (Math.random() - 0.5) * 0.5;
            p.position.z += (Math.random() - 0.5) * 0.5;
            
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            const angleY = Math.random() * Math.PI * 2;
            p.userData.vel = new THREE.Vector3(
                Math.cos(angle) * Math.cos(angleY) * speed,
                Math.sin(angleY) * speed * 1.5,
                Math.sin(angle) * Math.cos(angleY) * speed
            );
            p.userData.life = 1.5 + Math.random() * 1.5;
            p.userData.maxLife = p.userData.life;
            p.userData.rotSpeed = (Math.random() - 0.5) * 10;
            scene.add(p);
            this.explosionParticles.push(p);
        }
        
        const ringGeo2 = new THREE.TorusGeometry(0.5, 0.1, 12, 24);
        const ringMat2 = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.8
        });
        const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
        ring2.position.copy(position);
        ring2.rotation.x = Math.PI / 2;
        ring2.userData.life = 1.0;
        ring2.userData.maxLife = 1.0;
        scene.add(ring2);
        this.explosionParticles.push(ring2);
        
        for (let i = 0; i < 20; i++) {
            const size = 0.02 + Math.random() * 0.06;
            const geo = new THREE.SphereGeometry(size, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(position);
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 2;
            p.position.x += Math.cos(angle) * dist;
            p.position.z += Math.sin(angle) * dist;
            p.position.y += Math.random() * 2;
            p.userData.vel = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 3,
                (Math.random() - 0.5) * 2
            );
            p.userData.life = 0.5 + Math.random() * 0.5;
            p.userData.maxLife = p.userData.life;
            scene.add(p);
            this.explosionParticles.push(p);
        }
    }
    
    updateExplosion(delta) {
        if (!this.isExploding) return;
        
        for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
            const p = this.explosionParticles[i];
            p.userData.life -= delta;
            
            if (p.userData.life <= 0) {
                scene.remove(p);
                this.explosionParticles.splice(i, 1);
                continue;
            }
            
            const lifeRatio = p.userData.life / p.userData.maxLife;
            
            if (p.geometry.type === 'SphereGeometry') {
                p.position.x += p.userData.vel.x * delta;
                p.position.y += p.userData.vel.y * delta;
                p.position.z += p.userData.vel.z * delta;
                p.userData.vel.y -= 2 * delta;
                p.material.opacity = lifeRatio * 0.8;
                const s = 0.5 + lifeRatio * 0.5;
                p.scale.set(s, s, s);
                p.rotation.x += p.userData.rotSpeed * delta;
                p.rotation.y += p.userData.rotSpeed * delta;
            } else if (p.geometry.type === 'TorusGeometry') {
                const scale = 1 + (1 - lifeRatio) * 3;
                p.scale.set(scale, scale, scale);
                p.material.opacity = lifeRatio * 0.8;
            }
        }
    }
    
    die() {
        this.takeDamage(this.health);
    }
}

const nexusAliado = new Nexus(0, -26, false);
const nexusEnemigo = new Nexus(0, 26, true);

// =============================================
// PROYECTIL DE TORRE
// =============================================
class TowerProjectile {
    constructor(startPos, target, isEnemy = false, damage = 20) {
        this.target = target;
        this.damage = damage;
        this.isEnemy = isEnemy;
        this.speed = CONFIG.projectileSpeed;
        this.active = true;
        
        const color = isEnemy ? 0xff4444 : 0x4488ff;
        const geo = new THREE.SphereGeometry(0.12, 8, 8);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.9
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(startPos);
        this.mesh.position.y = 0.3;
        scene.add(this.mesh);
        
        const glowGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15
        });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.glow.position.copy(this.mesh.position);
        scene.add(this.glow);
        
        this.targetPosition = target.group.position.clone();
        this.targetPosition.y = 0.3;
        
        this.direction = new THREE.Vector3()
            .copy(this.targetPosition)
            .sub(this.mesh.position);
        this.direction.y = 0;
        this.direction.normalize();
        
        const angle = Math.atan2(this.direction.x, this.direction.z);
        this.mesh.rotation.y = angle;
        this.targetRef = target;
    }
    
    update(delta) {
        if (!this.active) return;
        
        if (this.targetRef.isDead) {
            this.active = false;
            scene.remove(this.mesh);
            scene.remove(this.glow);
            return;
        }
        
        this.targetPosition.copy(this.targetRef.group.position);
        this.targetPosition.y = 0.3;
        
        this.direction = new THREE.Vector3()
            .copy(this.targetPosition)
            .sub(this.mesh.position);
        this.direction.y = 0;
        this.direction.normalize();
        
        this.mesh.position.x += this.direction.x * this.speed * delta;
        this.mesh.position.z += this.direction.z * this.speed * delta;
        this.glow.position.copy(this.mesh.position);
        
        this.mesh.rotation.x += delta * 5;
        this.mesh.rotation.z += delta * 3;
        
        const dist = this.mesh.position.distanceTo(this.targetRef.group.position);
        if (dist < 0.8) {
            this.hit();
        }
        
        if (Math.abs(this.mesh.position.x) > 20 || Math.abs(this.mesh.position.z) > 30) {
            this.active = false;
            scene.remove(this.mesh);
            scene.remove(this.glow);
        }
    }
    
    hit() {
        if (!this.active) return;
        this.active = false;
        
        if (!this.targetRef.isDead) {
            this.targetRef.health -= this.damage;
            this.targetRef.updateHealthBar();
            this.createExplosion();
            if (this.targetRef.health <= 0) {
                this.targetRef.die();
            }
        }
        
        scene.remove(this.mesh);
        scene.remove(this.glow);
    }
    
    createExplosion() {
        const color = this.isEnemy ? 0xff4444 : 0x4488ff;
        for (let i = 0; i < 8; i++) {
            const size = 0.03 + Math.random() * 0.04;
            const geo = new THREE.SphereGeometry(size, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.7
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(this.mesh.position);
            p.position.y = 0.3;
            
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            p.userData.vel = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 2,
                Math.sin(angle) * speed
            );
            p.userData.life = 0.5 + Math.random() * 0.3;
            scene.add(p);
            
            const startTime = performance.now();
            const animateParticle = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > p.userData.life) {
                    scene.remove(p);
                    return;
                }
                p.position.x += p.userData.vel.x * 0.02;
                p.position.y += p.userData.vel.y * 0.02;
                p.position.z += p.userData.vel.z * 0.02;
                p.userData.vel.y -= 0.05;
                p.material.opacity = 0.7 * (1 - elapsed / p.userData.life);
                requestAnimationFrame(animateParticle);
            };
            animateParticle();
        }
    }
}

// =============================================
// PROYECTIL DEL JUGADOR
// =============================================
class PlayerProjectile {
    constructor(startPos, target, damage = 15) {
        this.target = target;
        this.damage = damage;
        this.speed = CONFIG.projectileSpeed;
        this.active = true;
        this.targetRef = target;
        
        const color = 0x44ff88;
        const geo = new THREE.SphereGeometry(0.15, 8, 8);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.9
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(startPos);
        this.mesh.position.y = 0.5;
        scene.add(this.mesh);
        
        const glowGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15
        });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.glow.position.copy(this.mesh.position);
        scene.add(this.glow);
        
        this.startPos = startPos.clone();
        this.endPos = target.group.position.clone();
        this.endPos.y = 0.5;
        this.progress = 0;
    }
    
    update(delta) {
        if (!this.active) return;
        if (this.targetRef.isDead) {
            this.active = false;
            scene.remove(this.mesh);
            scene.remove(this.glow);
            return;
        }
        this.endPos.copy(this.targetRef.group.position);
        this.endPos.y = 0.5;
        this.progress += delta * this.speed;
        if (this.progress >= 1) {
            this.hit();
            return;
        }
        const currentPos = new THREE.Vector3().lerpVectors(this.startPos, this.endPos, this.progress);
        this.mesh.position.copy(currentPos);
        this.glow.position.copy(currentPos);
        this.mesh.rotation.x += delta * 15;
        this.mesh.rotation.z += delta * 10;
    }
    
    hit() {
        if (!this.active) return;
        this.active = false;
        if (!this.targetRef.isDead) {
            this.targetRef.health -= this.damage;
            if (this.targetRef.updateHealthBar) {
                this.targetRef.updateHealthBar();
            }
            if (window.currentTarget === this.targetRef) {
                window.showTarget(this.targetRef);
            }
            this.createExplosion();
            console.log(`💥 Ataque a ${this.targetRef.type || 'objeto'} (${Math.floor(this.targetRef.health)} HP)`);
            if (this.targetRef.health <= 0) {
                if (this.targetRef.die) {
                    this.targetRef.die();
                }
                if (window.currentTarget === this.targetRef) {
                    window.currentTarget = null;
                    targetUI.style.display = 'none';
                }
            }
            playerAttackTarget = this.targetRef;
            setTimeout(() => { playerAttackTarget = null; }, 2000);
        }
        scene.remove(this.mesh);
        scene.remove(this.glow);
    }
    
    createExplosion() {
        const color = 0x44ff88;
        const pos = this.mesh.position.clone();
        for (let i = 0; i < 8; i++) {
            const size = 0.03 + Math.random() * 0.04;
            const geo = new THREE.SphereGeometry(size, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.6
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.position.y = 0.5;
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            p.userData.vel = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 2,
                Math.sin(angle) * speed
            );
            p.userData.life = 0.3 + Math.random() * 0.3;
            scene.add(p);
            const startTime = performance.now();
            const animateParticle = function() {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > p.userData.life) {
                    scene.remove(p);
                    return;
                }
                p.position.x += p.userData.vel.x * 0.02;
                p.position.y += p.userData.vel.y * 0.02;
                p.position.z += p.userData.vel.z * 0.02;
                p.userData.vel.y -= 0.05;
                p.material.opacity = 0.6 * (1 - elapsed / p.userData.life);
                requestAnimationFrame(animateParticle);
            };
            animateParticle();
        }
    }
}

// =============================================
// TORRES
// =============================================
class AxieTower {
    constructor(x, z, isEnemy = false, tier = 1) {
        this.isEnemy = isEnemy;
        this.tier = tier;
        this.maxHealth = CONFIG.towerHealth + (tier === 2 ? 200 : 0);
        this.health = this.maxHealth;
        this.isDead = false;
        this.range = CONFIG.towerRange + (tier === 2 ? 1 : 0);
        this.damage = CONFIG.towerDamage + (tier === 2 ? 10 : 0);
        this.fireRate = CONFIG.towerFireRate - (tier === 2 ? 0.3 : 0);
        this.cooldown = 0;
        this.target = null;
        this.segments = 10;
        this.type = 'tower';
        
        const scale = tier === 2 ? 1.3 : 1.0;
        const color = isEnemy ? 0xcc4444 : 0x4488cc;
        const emissiveColor = isEnemy ? 0xff4444 : 0x4488ff;
        
        this.group = new THREE.Group();
        this.group.userData.targetRef = this;
        
        const baseGeo = new THREE.CylinderGeometry(0.9 * scale, 1.1 * scale, 0.3 * scale, 12);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.8, metalness: 0.2 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.15 * scale;
        baseMesh.receiveShadow = false;
        baseMesh.castShadow = false;
        baseMesh.userData.targetRef = this;
        this.group.add(baseMesh);
        
        const bodyGeo = new THREE.SphereGeometry(0.5 * scale, 8, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(1, 1.2, 0.8);
        body.position.y = 0.9 * scale;
        body.castShadow = false;
        body.userData.targetRef = this;
        this.group.add(body);
        
        const headGeo = new THREE.SphereGeometry(0.35 * scale, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.2 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.scale.set(1, 0.9, 0.9);
        head.position.set(0, 1.5 * scale, 0);
        head.castShadow = false;
        head.userData.targetRef = this;
        this.group.add(head);
        
        const eyeGeo = new THREE.SphereGeometry(0.06 * scale, 8, 8);
        const eyeMat = new THREE.MeshStandardMaterial({
            color: emissiveColor,
            emissive: emissiveColor,
            emissiveIntensity: 0.8,
        });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.12 * scale, 1.55 * scale, 0.2 * scale);
        eyeL.userData.targetRef = this;
        this.group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.12 * scale, 1.55 * scale, 0.2 * scale);
        eyeR.userData.targetRef = this;
        this.group.add(eyeR);
        
        const earGeo = new THREE.ConeGeometry(0.12 * scale, 0.25 * scale, 6);
        const earMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0xaa3333 : 0x3366aa, roughness: 0.6, metalness: 0.1 });
        const earL = new THREE.Mesh(earGeo, earMat);
        earL.position.set(-0.2 * scale, 1.7 * scale, 0);
        earL.rotation.z = -0.2;
        earL.rotation.x = -0.1;
        earL.userData.targetRef = this;
        this.group.add(earL);
        const earR = new THREE.Mesh(earGeo, earMat);
        earR.position.set(0.2 * scale, 1.7 * scale, 0);
        earR.rotation.z = 0.2;
        earR.rotation.x = 0.1;
        earR.userData.targetRef = this;
        this.group.add(earR);
        
        const armGeo = new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 0.3 * scale, 6);
        const armMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0xaa3333 : 0x3366aa, roughness: 0.5, metalness: 0.2 });
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.35 * scale, 0.9 * scale, 0);
        armR.rotation.z = -0.6;
        armR.rotation.x = 0.2;
        armR.userData.targetRef = this;
        this.group.add(armR);
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.35 * scale, 0.9 * scale, 0);
        armL.rotation.z = 0.6;
        armL.rotation.x = -0.2;
        armL.userData.targetRef = this;
        this.group.add(armL);
        
        this.staffGroup = new THREE.Group();
        this.staffGroup.position.set(0.4 * scale, 0.8 * scale, 0);
        this.staffGroup.rotation.z = -0.3;
        this.staffGroup.userData.targetRef = this;
        
        const staff = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03 * scale, 0.05 * scale, 1.2 * scale, 8),
            new THREE.MeshStandardMaterial({ color: 0xccaa88, metalness: 0.5, roughness: 0.3 })
        );
        staff.position.y = 0.6 * scale;
        staff.castShadow = false;
        staff.userData.targetRef = this;
        this.staffGroup.add(staff);
        
        this.gemGeo = new THREE.OctahedronGeometry(0.12 * scale);
        this.gemMat = new THREE.MeshStandardMaterial({
            color: emissiveColor,
            emissive: emissiveColor,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.9,
            roughness: 0.1,
            metalness: 0.9
        });
        this.gem = new THREE.Mesh(this.gemGeo, this.gemMat);
        this.gem.position.y = 1.2 * scale;
        this.gem.castShadow = false;
        this.gem.userData.targetRef = this;
        this.staffGroup.add(this.gem);
        
        const ringStaffGeo = new THREE.TorusGeometry(0.15 * scale, 0.02 * scale, 8, 12);
        const ringStaffMat = new THREE.MeshStandardMaterial({
            color: emissiveColor,
            emissive: emissiveColor,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.7
        });
        const ringStaff = new THREE.Mesh(ringStaffGeo, ringStaffMat);
        ringStaff.position.y = 1.2 * scale;
        ringStaff.rotation.x = Math.PI / 2;
        ringStaff.userData.targetRef = this;
        this.staffGroup.add(ringStaff);
        
        this.group.add(this.staffGroup);
        
        const ringBaseGeo = new THREE.TorusGeometry(0.8 * scale, 0.04 * scale, 8, 16);
        const ringBaseMat = new THREE.MeshStandardMaterial({
            color: emissiveColor,
            emissive: emissiveColor,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.5
        });
        const ringBase = new THREE.Mesh(ringBaseGeo, ringBaseMat);
        ringBase.position.y = 0.3 * scale;
        ringBase.rotation.x = Math.PI / 2;
        ringBase.userData.targetRef = this;
        this.group.add(ringBase);
        
        const shieldGeo = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 0.02 * scale, 16);
        const shieldMat = new THREE.MeshStandardMaterial({
            color: isEnemy ? 0x882222 : 0x224488,
            metalness: 0.7,
            roughness: 0.3
        });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.position.y = 0.35 * scale;
        shield.userData.targetRef = this;
        this.group.add(shield);
        
        const symbolGeo = new THREE.RingGeometry(0.15 * scale, 0.25 * scale, 12);
        const symbolMat = new THREE.MeshStandardMaterial({
            color: emissiveColor,
            emissive: emissiveColor,
            emissiveIntensity: 0.5,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const symbol = new THREE.Mesh(symbolGeo, symbolMat);
        symbol.position.y = 0.36 * scale;
        symbol.rotation.x = -Math.PI / 2;
        symbol.userData.targetRef = this;
        this.group.add(symbol);
        
        if (tier === 2) {
            const crownGeo = new THREE.TorusGeometry(0.4 * scale, 0.05 * scale, 6, 12);
            const crownMat = new THREE.MeshStandardMaterial({
                color: 0xffdd44,
                emissive: 0xff8800,
                emissiveIntensity: 0.3,
                metalness: 0.8
            });
            const crown = new THREE.Mesh(crownGeo, crownMat);
            crown.position.y = 1.7 * scale;
            crown.rotation.x = Math.PI / 2;
            crown.userData.targetRef = this;
            this.group.add(crown);
            
            for (let i = 0; i < 4; i++) {
                const spikeGeo = new THREE.ConeGeometry(0.04 * scale, 0.12 * scale, 4);
                const spikeMat = new THREE.MeshStandardMaterial({
                    color: 0xffdd44,
                    emissive: 0xff8800,
                    emissiveIntensity: 0.2,
                    metalness: 0.8
                });
                const spike = new THREE.Mesh(spikeGeo, spikeMat);
                const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
                spike.position.set(Math.cos(angle) * 0.4 * scale, 1.8 * scale, Math.sin(angle) * 0.4 * scale);
                spike.rotation.x = Math.PI / 2;
                spike.rotation.z = angle;
                spike.userData.targetRef = this;
                this.group.add(spike);
            }
        }
        
        const glowGeo = new THREE.SphereGeometry(0.5 * scale, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: emissiveColor,
            transparent: true,
            opacity: 0.05
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 1 * scale;
        glow.userData.targetRef = this;
        this.group.add(glow);
        
        const healthBar = createHealthBar(this.segments, this.isEnemy);
        healthBar.sprite.position.y = 2.2 * scale;
        this.group.add(healthBar.sprite);
        this.spriteMat = healthBar.spriteMat;
        this.healthSprite = healthBar.sprite;
        
        this.group.position.set(x, -0.3, z);
        scene.add(this.group);
        
        this.position = new THREE.Vector3(x, 0, z);
        this.projectiles = [];
    }
    
    updateHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        const visibleSegments = Math.max(0, Math.min(this.segments, Math.ceil(healthPercent * this.segments)));
        updateHealthBarSprite(this.spriteMat, this.segments, visibleSegments, this.isEnemy);
    }
    
    takeDamage(damage) {
        if (this.isDead) return;
        this.health -= damage;
        this.updateHealthBar();
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            this.group.visible = false;
            for (const proj of this.projectiles) {
                proj.active = false;
                scene.remove(proj.mesh);
                scene.remove(proj.glow);
            }
            this.projectiles = [];
            console.log(`💀 Torre ${this.isEnemy ? 'enemiga' : 'aliada'} destruida!`);
        }
    }
    
    die() {
        this.takeDamage(this.health);
    }
    
    update(delta, enemies) {
        if (this.isDead) return;
        this.cooldown -= delta;
        
        let closestEnemy = null;
        let closestDist = this.range + 1;
        
        const targets = this.isEnemy ? enemies.aliados : enemies.enemigos;
        for (const enemy of targets) {
            if (enemy.isDead) continue;
            const dist = this.position.distanceTo(enemy.group.position);
            if (dist < closestDist && dist <= this.range) {
                closestDist = dist;
                closestEnemy = enemy;
            }
        }
        
        this.target = closestEnemy;
        
        if (this.target && closestDist <= this.range) {
            const angle = Math.atan2(
                this.target.group.position.x - this.position.x,
                this.target.group.position.z - this.position.z
            );
            this.group.rotation.y = angle;
            
            if (this.cooldown <= 0) {
                this.fire();
                this.cooldown = this.fireRate;
            }
        }
        
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(delta);
            if (!proj.active) {
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    fire() {
        if (!this.target || this.isDead) return;
        
        const startPos = new THREE.Vector3();
        this.gem.getWorldPosition(startPos);
        
        const proj = new TowerProjectile(
            startPos,
            this.target,
            this.isEnemy,
            this.damage
        );
        this.projectiles.push(proj);
    }
}

// =============================================
// CREAR TORRES
// =============================================
const towers = [];

function createTower(x, z, isEnemy = false, tier = 1) {
    const tower = new AxieTower(x, z, isEnemy, tier);
    towers.push(tower);
    return tower;
}

createTower(-3.5, -18, false, 1);
createTower(-3.5, -6, false, 2);
createTower(3.5, 18, true, 1);
createTower(3.5, 6, true, 2);

// =============================================
// ÁRBOLES
// =============================================
function createTree(x, z) {
    if (x > -5 && x < 5 && z > -26 && z < 26) return;
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 0.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.9 })
    );
    trunk.position.y = 0.4;
    trunk.castShadow = false;
    group.add(trunk);
    const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x2d7d3a, roughness: 0.8 })
    );
    foliage.position.y = 1;
    foliage.castShadow = false;
    group.add(foliage);
    group.position.set(x, -0.3, z);
    scene.add(group);
}

for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * 6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(z) < 27 && Math.abs(x) < 16) {
        createTree(x, z);
    }
}

// =============================================
// INTERFAZ DE USUARIO
// =============================================
const timerDiv = document.createElement('div');
timerDiv.id = 'timer-display';
timerDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: #44ff88;
    font-family: 'Courier New', monospace;
    font-size: 28px;
    font-weight: bold;
    background: rgba(0,0,0,0.8);
    padding: 8px 24px;
    border-radius: 12px;
    z-index: 100;
    pointer-events: none;
    text-align: center;
    border: 2px solid rgba(68,255,136,0.3);
    text-shadow: 0 0 20px rgba(68,255,136,0.3);
    letter-spacing: 2px;
`;
timerDiv.textContent = '00:00';
timerDiv.style.display = 'none';
document.body.appendChild(timerDiv);

const fpsDiv = document.createElement('div');
fpsDiv.id = 'fps-display';
fpsDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    color: #88aaff;
    font-family: 'Courier New', monospace;
    font-size: 18px;
    font-weight: bold;
    background: rgba(0,0,0,0.7);
    padding: 6px 14px;
    border-radius: 8px;
    z-index: 100;
    pointer-events: none;
    border: 1px solid rgba(136,170,255,0.2);
`;
fpsDiv.textContent = 'FPS: 0';
fpsDiv.style.display = 'none';
document.body.appendChild(fpsDiv);

const waveDiv = document.createElement('div');
waveDiv.id = 'wave-display';
waveDiv.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    color: #ffaa44;
    font-family: 'Courier New', monospace;
    font-size: 16px;
    font-weight: bold;
    background: rgba(0,0,0,0.7);
    padding: 4px 16px;
    border-radius: 8px;
    z-index: 100;
    pointer-events: none;
    text-align: center;
    border: 1px solid rgba(255,170,68,0.2);
`;
waveDiv.textContent = '⏳ 15s';
waveDiv.style.display = 'none';
document.body.appendChild(waveDiv);

// =============================================
// MINION
// =============================================
class Minion {
    constructor(x, z, isEnemy = false, tipo = 'melee', formationIndex = 0) {
        this.isEnemy = isEnemy;
        this.tipo = tipo;
        this.formationIndex = formationIndex;
        this.minionType = tipo;
        this.maxHealth = tipo === 'mage' ? 60 : 100;
        this.health = this.maxHealth;
        this.speed = tipo === 'melee' ? CONFIG.meleeSpeed : CONFIG.mageSpeed;
        this.direction = isEnemy ? -1 : 1;
        this.attackDamage = tipo === 'mage' ? 15 : 10;
        this.attackRange = tipo === 'mage' ? 3.5 : 1.5;
        this.attackCooldown = 0;
        this.attackSpeed = tipo === 'mage' ? 1.5 : 1.0;
        this.state = 'move';
        this.target = null;
        this.isDead = false;
        this.segments = tipo === 'mage' ? 3 : 6;
        this.hpPerSegment = tipo === 'mage' ? 20 : 17;
        this.currentVisibleSegments = this.segments;
        this.attackTimer = 0;
        this.isAttacking = false;
        this.type = 'minion';
        
        this.agroTarget = null;
        this.chaseTimer = 0;
        this.isChasing = false;
        this.reevaluationTimer = 0;
        this.isGhost = false;
        this.ghostTimer = CONFIG.firstWaveGhostDuration;
        this.hasAttackedPlayer = false;
        
        this.lastAttackTime = 0;
        this.attackCount = 0;
        
        const scale = 0.5;
        let lightColor, darkColor, eyeColor, cloakColor;
        
        if (isEnemy) {
            if (tipo === 'melee') {
                lightColor = 0xff5555;
                darkColor = 0xaa2222;
                cloakColor = 0x881111;
            } else {
                lightColor = 0xdd66cc;
                darkColor = 0x882266;
                cloakColor = 0x661144;
            }
            eyeColor = 0xffaa44;
        } else {
            if (tipo === 'melee') {
                lightColor = 0x5588ff;
                darkColor = 0x2244aa;
                cloakColor = 0x112288;
            } else {
                lightColor = 0x66ccff;
                darkColor = 0x226688;
                cloakColor = 0x114466;
            }
            eyeColor = 0x88ddff;
        }
        
        this.group = new THREE.Group();
        this.group.userData.targetRef = this;
        
        const bodyGeo = new THREE.SphereGeometry(0.3 * scale, 8, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: lightColor, roughness: 0.6 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(0.9, 1.2, 0.8);
        body.position.y = 0.5 * scale;
        body.castShadow = false;
        body.userData.targetRef = this;
        this.group.add(body);
        
        const cloakGeo = new THREE.ConeGeometry(0.35 * scale, 0.3 * scale, 6);
        const cloakMat = new THREE.MeshStandardMaterial({ color: cloakColor, roughness: 0.7 });
        const cloak = new THREE.Mesh(cloakGeo, cloakMat);
        cloak.position.y = 0.15 * scale;
        cloak.scale.set(1, 0.5, 0.8);
        cloak.userData.targetRef = this;
        this.group.add(cloak);
        
        const headGeo = new THREE.SphereGeometry(0.22 * scale, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: lightColor, roughness: 0.5 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.scale.set(1, 0.9, 0.9);
        head.position.set(0, 0.9 * scale, 0);
        head.castShadow = false;
        head.userData.targetRef = this;
        this.group.add(head);
        
        const earGeo = new THREE.ConeGeometry(0.08 * scale, 0.15 * scale, 4);
        const earMat = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.7 });
        const earL = new THREE.Mesh(earGeo, earMat);
        earL.position.set(-0.15 * scale, 1.05 * scale, 0);
        earL.rotation.z = -0.2;
        earL.userData.targetRef = this;
        this.group.add(earL);
        const earR = new THREE.Mesh(earGeo, earMat);
        earR.position.set(0.15 * scale, 1.05 * scale, 0);
        earR.rotation.z = 0.2;
        earR.userData.targetRef = this;
        this.group.add(earR);
        
        const eyeGeo = new THREE.SphereGeometry(0.035 * scale, 6, 6);
        const eyeMat = new THREE.MeshStandardMaterial({ color: eyeColor, emissive: eyeColor, emissiveIntensity: 0.3 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.08 * scale, 0.92 * scale, 0.15 * scale);
        eyeL.userData.targetRef = this;
        this.group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.08 * scale, 0.92 * scale, 0.15 * scale);
        eyeR.userData.targetRef = this;
        this.group.add(eyeR);
        
        const pupilGeo = new THREE.SphereGeometry(0.015 * scale, 6, 6);
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
        pupilL.position.set(-0.08 * scale, 0.90 * scale, 0.18 * scale);
        pupilL.userData.targetRef = this;
        this.group.add(pupilL);
        const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
        pupilR.position.set(0.08 * scale, 0.90 * scale, 0.18 * scale);
        pupilR.userData.targetRef = this;
        this.group.add(pupilR);
        
        const noseGeo = new THREE.SphereGeometry(0.025 * scale, 6, 6);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xff8888 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.88 * scale, 0.18 * scale);
        nose.userData.targetRef = this;
        this.group.add(nose);
        
        function createWhisker(x, y, z, rotY, rotZ) {
            const whiskerGeo = new THREE.CylinderGeometry(0.005 * scale, 0.005 * scale, 0.15 * scale, 3);
            const whiskerMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
            const w = new THREE.Mesh(whiskerGeo, whiskerMat);
            w.position.set(x, y, z);
            w.rotation.y = rotY;
            w.rotation.z = rotZ;
            w.userData.targetRef = this;
            return w;
        }
        this.group.add(createWhisker(-0.12 * scale, 0.86 * scale, 0.15 * scale, -0.4, 0));
        this.group.add(createWhisker(-0.17 * scale, 0.83 * scale, 0.15 * scale, -0.6, 0));
        this.group.add(createWhisker(0.12 * scale, 0.86 * scale, 0.15 * scale, 0.4, 0));
        this.group.add(createWhisker(0.17 * scale, 0.83 * scale, 0.15 * scale, 0.6, 0));
        
        const tailCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.2 * scale, -0.2 * scale),
            new THREE.Vector3(0.05 * scale, 0.3 * scale, -0.25 * scale),
            new THREE.Vector3(0.08 * scale, 0.5 * scale, -0.2 * scale),
            new THREE.Vector3(0.05 * scale, 0.65 * scale, -0.15 * scale)
        ]);
        const tailGeo = new THREE.TubeGeometry(tailCurve, 6, 0.03 * scale, 4, false);
        const tailMat = new THREE.MeshStandardMaterial({ color: lightColor, roughness: 0.6 });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.castShadow = false;
        tail.userData.targetRef = this;
        this.group.add(tail);
        
        const armGeo = new THREE.CylinderGeometry(0.04 * scale, 0.05 * scale, 0.25 * scale, 6);
        const armMat = new THREE.MeshStandardMaterial({ color: lightColor, roughness: 0.6 });
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.3 * scale, 0.6 * scale, 0);
        armR.rotation.z = -0.5;
        armR.rotation.x = 0.2;
        armR.userData.targetRef = this;
        this.group.add(armR);
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.3 * scale, 0.6 * scale, 0);
        armL.rotation.z = 0.5;
        armL.rotation.x = -0.2;
        armL.userData.targetRef = this;
        this.group.add(armL);
        
        if (tipo === 'mage') {
            this.staffGroup = new THREE.Group();
            this.staffGroup.position.set(0.35 * scale, 0.55 * scale, 0);
            this.staffGroup.rotation.z = -0.3;
            this.staffGroup.userData.targetRef = this;
            
            const staff = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02 * scale, 0.03 * scale, 0.5 * scale, 6),
                new THREE.MeshStandardMaterial({ color: 0xccaa88, metalness: 0.5 })
            );
            staff.position.y = 0.25 * scale;
            staff.userData.targetRef = this;
            this.staffGroup.add(staff);
            
            this.mageGem = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.07 * scale),
                new THREE.MeshStandardMaterial({
                    color: isEnemy ? 0xff44aa : 0x44aaff,
                    emissive: isEnemy ? 0xff2288 : 0x2288ff,
                    emissiveIntensity: 0.8,
                    transparent: true,
                    opacity: 0.9
                })
            );
            this.mageGem.position.y = 0.55 * scale;
            this.mageGem.userData.targetRef = this;
            this.staffGroup.add(this.mageGem);
            
            this.group.add(this.staffGroup);
        } else {
            const swordGroup = new THREE.Group();
            swordGroup.position.set(0.35 * scale, 0.5 * scale, 0);
            swordGroup.rotation.z = -0.4;
            swordGroup.userData.targetRef = this;
            
            const blade = new THREE.Mesh(
                new THREE.BoxGeometry(0.03 * scale, 0.4 * scale, 0.03 * scale),
                new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.1 })
            );
            blade.position.y = 0.25 * scale;
            blade.userData.targetRef = this;
            swordGroup.add(blade);
            
            const handle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03 * scale, 0.04 * scale, 0.08 * scale, 6),
                new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8 })
            );
            handle.position.y = -0.02 * scale;
            handle.userData.targetRef = this;
            swordGroup.add(handle);
            
            this.group.add(swordGroup);
        }
        
        const legGeo = new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 0.15 * scale, 6);
        const legMat = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.7 });
        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-0.12 * scale, 0.08 * scale, 0);
        legL.userData.targetRef = this;
        this.group.add(legL);
        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(0.12 * scale, 0.08 * scale, 0);
        legR.userData.targetRef = this;
        this.group.add(legR);
        
        const texture = getHealthBarTexture(this.segments, this.segments, this.isEnemy);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.7, 0.15, 1);
        sprite.position.y = 1.3 * scale;
        sprite.renderOrder = 999;
        this.group.add(sprite);
        this.spriteMat = spriteMat;
        this.healthSprite = sprite;
        
        this.group.rotation.y = isEnemy ? Math.PI : 0;
        
        this.group.position.set(x, -0.3, z);
        scene.add(this.group);
        this.mesh = this.group;
    }
    
    updateHealthBar() {
        const currentSegments = Math.ceil(this.health / this.hpPerSegment);
        const visibleSegments = Math.max(0, Math.min(this.segments, currentSegments));
        if (visibleSegments !== this.currentVisibleSegments) {
            this.currentVisibleSegments = visibleSegments;
            const texture = getHealthBarTexture(this.segments, visibleSegments, this.isEnemy);
            if (this.spriteMat) {
                this.spriteMat.map = texture;
                this.spriteMat.needsUpdate = true;
            }
        }
    }
    
    findBestTarget(aliados, enemigos, towers, playerModel) {
        const enemyMinions = this.isEnemy ? aliados : enemigos;
        const enemyTowers = towers.filter(t => t.isEnemy !== this.isEnemy && !t.isDead);
        const enemyNexus = this.isEnemy ? nexusAliado : nexusEnemigo;
        
        if (this.isEnemy && nexusEnemigo.isDead) {
            return null;
        }
        if (!this.isEnemy && nexusAliado.isDead) {
            return null;
        }
        
        // Prioridad #1: Axie enemigo (SOLO minions ENEMIGOS atacan al jugador)
        if (this.isEnemy && playerModel && !isPlayerDead) {
            const distToPlayer = this.group.position.distanceTo(playerModel.position);
            if (distToPlayer <= CONFIG.agroRange) {
                if (playerAttackTarget && playerAttackTarget.isEnemy === this.isEnemy) {
                    return { target: { group: playerModel, isDead: false, health: 999999, type: 'player', isEnemy: true }, type: 'player', dist: distToPlayer };
                }
                if (distToPlayer < 3.0) {
                    return { target: { group: playerModel, isDead: false, health: 999999, type: 'player', isEnemy: true }, type: 'player', dist: distToPlayer };
                }
            }
        }
        
        // Prioridad #2: Agro (enemigo atacando a un aliado)
        let agroTarget = null;
        let agroDist = Infinity;
        
        for (const enemy of enemyMinions) {
            if (enemy.isDead) continue;
            if (enemy.target && enemy.target.isEnemy !== this.isEnemy) {
                const dist = this.group.position.distanceTo(enemy.group.position);
                if (dist < agroDist && dist <= CONFIG.agroRange) {
                    agroDist = dist;
                    agroTarget = enemy;
                }
            }
        }
        
        if (agroTarget) {
            return { target: agroTarget, type: 'minion', dist: agroDist };
        }
        
        // Prioridad #3: Minions enemigos más cercanos
        let closestMinion = null;
        let closestMinionDist = Infinity;
        for (const enemy of enemyMinions) {
            if (enemy.isDead) continue;
            const dist = this.group.position.distanceTo(enemy.group.position);
            if (dist < closestMinionDist) {
                closestMinionDist = dist;
                closestMinion = enemy;
            }
        }
        
        if (closestMinion && closestMinionDist <= CONFIG.agroRange) {
            return { target: closestMinion, type: 'minion', dist: closestMinionDist };
        }
        
        // Prioridad #4: Torres enemigas
        let closestTower = null;
        let closestTowerDist = Infinity;
        for (const tower of enemyTowers) {
            if (tower.isDead) continue;
            const dist = this.group.position.distanceTo(tower.group.position);
            if (dist < closestTowerDist) {
                closestTowerDist = dist;
                closestTower = tower;
            }
        }
        
        if (closestTower && closestTowerDist < 15) {
            return { target: closestTower, type: 'tower', dist: closestTowerDist };
        }
        
        // Prioridad #5: Nexo enemigo
        if (!enemyNexus.isDead) {
            const distToNexus = this.group.position.distanceTo(enemyNexus.group.position);
            if (distToNexus < 20) {
                return { target: enemyNexus, type: 'nexus', dist: distToNexus };
            }
        }
        
        return null;
    }
    
    fireMageProjectile(target) {
        const color = this.isEnemy ? 0xff44aa : 0x44aaff;
        const startPos = new THREE.Vector3();
        if (this.mageGem) {
            this.mageGem.getWorldPosition(startPos);
        } else {
            startPos.copy(this.group.position);
            startPos.y = 0.5;
        }
        
        const geo = new THREE.SphereGeometry(0.08, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        const proj = new THREE.Mesh(geo, mat);
        proj.position.copy(startPos);
        scene.add(proj);
        
        const glowGeo = new THREE.SphereGeometry(0.15, 6, 6);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(startPos);
        scene.add(glow);
        
        const endPos = target.group.position.clone();
        endPos.y = 0.5;
        const startPosCopy = startPos.clone();
        let t = 0;
        const speed = 6;
        
        const animateMageProj = () => {
            t += 0.02;
            if (t >= 1 || target.isDead) {
                scene.remove(proj);
                scene.remove(glow);
                if (!target.isDead && t >= 1) {
                    if (target.type === 'player') {
                        console.log('⚔️ Minion atacó al Axie (inmortal)');
                    } else {
                        target.health -= this.attackDamage;
                        if (target.updateHealthBar) target.updateHealthBar();
                        if (target.health <= 0) {
                            if (target.die) target.die();
                        }
                    }
                    const expColor = this.isEnemy ? 0xff44aa : 0x44aaff;
                    for (let i = 0; i < 6; i++) {
                        const pGeo = new THREE.SphereGeometry(0.03, 4, 4);
                        const pMat = new THREE.MeshBasicMaterial({
                            color: expColor,
                            transparent: true,
                            opacity: 0.6
                        });
                        const p = new THREE.Mesh(pGeo, pMat);
                        p.position.copy(endPos);
                        p.position.y += 0.2;
                        const angle = Math.random() * Math.PI * 2;
                        p.userData.vel = new THREE.Vector3(
                            Math.cos(angle) * 1.5,
                            Math.random() * 2,
                            Math.sin(angle) * 1.5
                        );
                        scene.add(p);
                        const startTime2 = performance.now();
                        const animateP = () => {
                            const elapsed = (performance.now() - startTime2) / 1000;
                            if (elapsed > 0.5) {
                                scene.remove(p);
                                return;
                            }
                            p.position.x += p.userData.vel.x * 0.02;
                            p.position.y += p.userData.vel.y * 0.02;
                            p.position.z += p.userData.vel.z * 0.02;
                            p.userData.vel.y -= 0.05;
                            p.material.opacity = 0.6 * (1 - elapsed / 0.5);
                            requestAnimationFrame(animateP);
                        };
                        animateP();
                    }
                }
                return;
            }
            const currentPos = new THREE.Vector3().lerpVectors(startPosCopy, endPos, t);
            proj.position.copy(currentPos);
            glow.position.copy(currentPos);
            proj.scale.setScalar(1 + t * 0.5);
            requestAnimationFrame(animateMageProj);
        };
        animateMageProj();
    }
    
    update(delta, aliados, enemigos, towers, playerModel) {
        if (this.isDead || gameFinished) return;
        
        this.reevaluationTimer += delta;
        
        if (isFirstWave && this.ghostTimer > 0) {
            this.ghostTimer -= delta;
            let newZ = this.group.position.z + this.direction * this.speed * delta;
            if (newZ > CONFIG.minionLimitZ) newZ = CONFIG.minionLimitZ;
            if (newZ < -CONFIG.minionLimitZ) newZ = -CONFIG.minionLimitZ;
            this.group.position.z = newZ;
            return;
        }
        
        this.attackCooldown -= delta;
        
        if (this.reevaluationTimer >= CONFIG.reevaluationTime || !this.target || this.target.isDead) {
            this.reevaluationTimer = 0;
            const bestTarget = this.findBestTarget(aliados, enemigos, towers, playerModel);
            
            if (bestTarget) {
                this.target = bestTarget.target;
                this.state = 'attack';
            } else {
                this.state = 'move';
                this.target = null;
            }
        }
        
        if (this.target && this.target.isDead) {
            this.target = null;
            this.state = 'move';
            this.chaseTimer = 0;
            this.reevaluationTimer = CONFIG.reevaluationTime;
        }
        
        if (this.target) {
            const dist = this.group.position.distanceTo(this.target.group.position);
            
            if (dist <= this.attackRange) {
                this.state = 'attack';
                this.isChasing = false;
                this.chaseTimer = 0;
                
                const angle = Math.atan2(
                    this.target.group.position.x - this.group.position.x,
                    this.target.group.position.z - this.group.position.z
                );
                this.group.rotation.y = angle;
                
                if (this.attackCooldown <= 0) {
                    if (this.tipo === 'mage') {
                        this.fireMageProjectile(this.target);
                        this.attackCooldown = this.attackSpeed;
                    } else {
                        if (this.target.type === 'player') {
                            console.log('⚔️ Minion atacó al Axie (inmortal)');
                            this.attackCooldown = this.attackSpeed;
                        } else {
                            this.target.health -= this.attackDamage;
                            this.attackCooldown = this.attackSpeed;
                            if (this.target.updateHealthBar) this.target.updateHealthBar();
                            if (this.target.health <= 0) {
                                if (this.target.die) this.target.die();
                                this.target = null;
                                this.state = 'move';
                                this.reevaluationTimer = CONFIG.reevaluationTime;
                            }
                        }
                    }
                }
            } else {
                this.state = 'move';
                this.isChasing = true;
                this.chaseTimer += delta;
                
                const dx = this.target.group.position.x - this.group.position.x;
                const dz = this.target.group.position.z - this.group.position.z;
                const totalDist = Math.sqrt(dx * dx + dz * dz);
                
                if (totalDist > 0.5 && this.chaseTimer < CONFIG.chaseTime) {
                    const moveSpeed = this.speed * delta;
                    const stepX = (dx / totalDist) * moveSpeed;
                    const stepZ = (dz / totalDist) * moveSpeed;
                    
                    this.group.position.x += stepX;
                    this.group.position.z += stepZ;
                    
                    const angle = Math.atan2(dx, dz);
                    this.group.rotation.y = angle;
                } else if (this.chaseTimer >= CONFIG.chaseTime) {
                    this.target = null;
                    this.state = 'move';
                    this.isChasing = false;
                    this.chaseTimer = 0;
                    this.reevaluationTimer = CONFIG.reevaluationTime;
                }
            }
        } else {
            this.state = 'move';
            let newZ = this.group.position.z + this.direction * this.speed * delta;
            if (newZ > CONFIG.minionLimitZ) newZ = CONFIG.minionLimitZ;
            if (newZ < -CONFIG.minionLimitZ) newZ = -CONFIG.minionLimitZ;
            this.group.position.z = newZ;
        }
        
        this.updateHealthBar();
    }
    
    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.state = 'dead';
        this.group.visible = false;
    }
}

// =============================================
// SISTEMA DE OLEADAS
// =============================================
const aliados = [];
const enemigos = [];
let waveNumber = 1;
let waveCooldown = 0;
const WAVE_DELAY = 1.5;
let gameStarted = false;
let startTimer = CONFIG.SPAWN_DELAY;

function getWaveComposition() {
    if (waveNumber === 1) {
        return { melee: 5, mage: 3 };
    } else {
        return { melee: 3, mage: 2 };
    }
}

function spawnWave() {
    if (gameFinished) return;
    
    for (let i = aliados.length - 1; i >= 0; i--) {
        if (aliados[i].isDead) {
            if (aliados[i].group.parent) scene.remove(aliados[i].group);
            aliados.splice(i, 1);
        }
    }
    for (let i = enemigos.length - 1; i >= 0; i--) {
        if (enemigos[i].isDead) {
            if (enemigos[i].group.parent) scene.remove(enemigos[i].group);
            enemigos.splice(i, 1);
        }
    }

    const comp = getWaveComposition();
    const waveDisplay = waveNumber;
    console.log(`⚔️ OLEADA ${waveDisplay}: ${comp.melee} Melee + ${comp.mage} Mage`);
    waveDiv.textContent = `⚔️ OLEADA ${waveDisplay}`;

    const spacing = CONFIG.meleeSpacing;
    const mageSpacing = CONFIG.mageSpacing;
    const startZ = -18;
    
    const meleeCount = comp.melee;
    const totalMeleeWidth = (meleeCount - 1) * spacing;
    const mageCount = comp.mage;
    const totalMageWidth = (mageCount - 1) * mageSpacing;
    
    const aliadoPositions = [];
    
    for (let i = 0; i < meleeCount; i++) {
        const x = -totalMeleeWidth / 2 + i * spacing;
        const z = startZ - i * 0.3;
        aliadoPositions.push({ x, z, tipo: 'melee', index: i });
        const minion = new Minion(x, z, false, 'melee', i);
        aliados.push(minion);
    }
    const mageStartZ = startZ - meleeCount * 0.3 - 1.0;
    for (let i = 0; i < mageCount; i++) {
        const x = -totalMageWidth / 2 + i * mageSpacing;
        const z = mageStartZ - i * 0.2;
        aliadoPositions.push({ x, z, tipo: 'mage', index: i + meleeCount });
        const minion = new Minion(x, z, false, 'mage', i + meleeCount);
        aliados.push(minion);
    }

    for (const pos of aliadoPositions) {
        const mirrorX = -pos.x;
        const mirrorZ = -pos.z;
        const minion = new Minion(mirrorX, mirrorZ, true, pos.tipo, pos.index);
        enemigos.push(minion);
    }

    waveNumber++;
    waveCooldown = 0;
    
    if (waveNumber === 2) {
        isFirstWave = true;
        for (const minion of aliados) {
            minion.isGhost = true;
            minion.ghostTimer = CONFIG.firstWaveGhostDuration;
        }
        for (const minion of enemigos) {
            minion.isGhost = true;
            minion.ghostTimer = CONFIG.firstWaveGhostDuration;
        }
        console.log('👻 PRIMERA OLEADA: Minions fantasmales activados');
    }
}

// =============================================
// JUGADOR (AXIE) - INMORTAL
// =============================================
let playerModel = null;
let mixer = null;
let animIdle = null;
let animWalk = null;
let currentAnim = 'idle';

let targetPosition = null;
let isMovingToTarget = false;
let playerSpeed = CONFIG.axieSpeed;
const playerSpawnPosition = new THREE.Vector3(0, 0, -20);

let smoothPlayerPos = new THREE.Vector3(0, 0, -20);
let smoothTargetPos = new THREE.Vector3(0, 0, -20);

let isDragging = false;
let isMouseDown = false;
let mouseDownPos = { x: 0, y: 0 };

let attackCooldown = 0;
let playerProjectiles = [];
let isAttacking = false;
let attackRange = CONFIG.attackRange;
let attackDamage = CONFIG.attackDamage;
let attackSpeed = CONFIG.attackSpeed;

let isAutoMovingToTarget = false;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getGroundIntersection(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    const intersectPoint = raycaster.ray.intersectPlane(plane, intersection);
    if (intersectPoint) {
        const limitX = 17, limitZ = 27;
        intersectPoint.x = Math.max(-limitX, Math.min(limitX, intersectPoint.x));
        intersectPoint.z = Math.max(-limitZ, Math.min(limitZ, intersectPoint.z));
        return intersectPoint;
    }
    return null;
}

renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 2) { 
        isMouseDown = true;
        isDragging = false;
        mouseDownPos.x = e.clientX;
        mouseDownPos.y = e.clientY;
    }
});

renderer.domElement.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
            isDragging = true;
        }
    }
});

renderer.domElement.addEventListener('mouseup', (e) => {
    if (e.button === 2) { 
        if (!isDragging && playerModel) {
            const point = getGroundIntersection(e);
            if (point) {
                targetPosition = point.clone();
                smoothTargetPos.copy(targetPosition);
                isMovingToTarget = true;
                isAutoMovingToTarget = false;
                window.currentTarget = null;
                targetUI.style.display = 'none';
            }
        }
        isMouseDown = false;
        isDragging = false;
    }
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

// =============================================
// FUNCIÓN PARA CARGAR AXIE SELECCIONADO
// =============================================
function loadSelectedAxie(axieId) {
    const axieData = getAxieById(axieId);
    if (!axieData) {
        console.warn(`⚠️ Axie ${axieId} no encontrado, usando Bestia por defecto`);
        loadDefaultAxie();
        return;
    }
    
    console.log(`🔄 Cargando Axie: ${axieData.nombre} desde ${axieData.modelo}`);
    
    const loader = new GLTFLoader();
    loader.load(
        axieData.modelo,
        (gltf) => {
            console.log(`✅ Axie ${axieData.nombre} cargado correctamente`);
            if (playerModel) {
                scene.remove(playerModel);
                if (mixer) {
                    mixer.stopAllAction();
                    mixer = null;
                }
            }
            
            playerModel = gltf.scene;
            const escala = axieData.escala || 1.2;
            playerModel.scale.set(escala, escala, escala);
            playerModel.position.copy(playerSpawnPosition);
            smoothPlayerPos.copy(playerSpawnPosition);
            playerModel.castShadow = false;
            playerModel.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = false;
                    node.receiveShadow = false;
                }
            });
            scene.add(playerModel);
            
            mixer = new THREE.AnimationMixer(playerModel);
            const clips = gltf.animations;
            clips.forEach(clip => {
                const name = clip.name.toLowerCase();
                if (name.includes('idle')) animIdle = mixer.clipAction(clip);
                if (name.includes('walk')) animWalk = mixer.clipAction(clip);
            });
            
            if (animIdle) {
                animIdle.play();
                console.log('🎬 Animación idle iniciada');
            }
            if (animWalk) {
                console.log('🎬 Animación walk disponible');
            }
            console.log(`🎬 Animaciones del Axie ${axieData.nombre} cargadas`);
            
            cameraSmoothPos.copy(playerModel.position);
            cameraSmoothTarget.copy(playerModel.position);
            axieLoaded = true;
            
            currentAxieName = axieData.nombre;
            actualizarHUD(currentAxieName);
        },
        undefined,
        (error) => {
            console.error(`❌ Error cargando Axie ${axieData.nombre}:`, error);
            loadDefaultAxie();
        }
    );
}

function loadDefaultAxie() {
    console.log('📦 Cargando Axie por defecto (Bestia)...');
    const loader = new GLTFLoader();
    loader.load(
        '/axie-3d-assets/assets/mascots/bing.glb',
        (gltf) => {
            console.log('✅ Axie por defecto cargado!');
            if (playerModel) {
                scene.remove(playerModel);
                if (mixer) {
                    mixer.stopAllAction();
                    mixer = null;
                }
            }
            
            playerModel = gltf.scene;
            playerModel.scale.set(1.2, 1.2, 1.2);
            playerModel.position.copy(playerSpawnPosition);
            smoothPlayerPos.copy(playerSpawnPosition);
            playerModel.castShadow = false;
            playerModel.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = false;
                    node.receiveShadow = false;
                }
            });
            scene.add(playerModel);
            
            mixer = new THREE.AnimationMixer(playerModel);
            const clips = gltf.animations;
            clips.forEach(clip => {
                const name = clip.name.toLowerCase();
                if (name.includes('idle')) animIdle = mixer.clipAction(clip);
                if (name.includes('walk')) animWalk = mixer.clipAction(clip);
            });
            
            if (animIdle) {
                animIdle.play();
                console.log('🎬 Animación idle iniciada');
            }
            if (animWalk) {
                console.log('🎬 Animación walk disponible');
            }
            console.log('🎬 Animaciones del Axie por defecto cargadas');
            
            cameraSmoothPos.copy(playerModel.position);
            cameraSmoothTarget.copy(playerModel.position);
            axieLoaded = true;
            
            currentAxieName = 'Bing';
            actualizarHUD(currentAxieName);
        },
        undefined,
        (error) => {
            console.error('❌ Error cargando Axie por defecto:', error);
            const fallback = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1.5, 1),
                new THREE.MeshStandardMaterial({ color: 0xff4444 })
            );
            fallback.position.copy(playerSpawnPosition);
            scene.add(fallback);
            playerModel = fallback;
            smoothPlayerPos.copy(playerSpawnPosition);
            axieLoaded = true;
            
            currentAxieName = 'Bing';
            actualizarHUD(currentAxieName);
        }
    );
}

// =============================================
// ACTUALIZAR HUD
// =============================================
function actualizarHUD(nombre) {
    console.log(`🔄 Actualizando HUD: ${nombre}`);
    
    const nameElements = document.querySelectorAll('.name, #hub-name, .player-name, [class*="name"]');
    nameElements.forEach(el => {
        if (el.textContent.includes('Puff') || el.textContent.includes('Bing') || el.textContent.includes('Axie') || el.textContent.includes('⚔️')) {
            el.textContent = `⚔️ ${nombre}`;
        }
    });
    
    const spanName = document.querySelector('.name');
    if (spanName) {
        spanName.textContent = `⚔️ ${nombre}`;
    }
    
    if (window.hubControl && typeof window.hubControl.updateName === 'function') {
        window.hubControl.updateName(nombre);
    }
    
    if (window.hubInjector && typeof window.hubInjector.updateName === 'function') {
        window.hubInjector.updateName(nombre);
    }
}

// =============================================
// 🟢 SISTEMA DE AXIE ENEMIGO CON IA
// =============================================
let enemyAxie = null;
let enemyAxieModel = null;
let enemyAxieMixer = null;
let enemyAxieAnimIdle = null;
let enemyAxieAnimWalk = null;
let enemyAxieCurrentAnim = 'idle';
let enemyAxieTarget = null;
let enemyAxieState = 'move';
let enemyAxieAttackCooldown = 0;
let enemyAxieVelocityY = 0;
let enemyAxieIsGrounded = false;
let enemyAxieJumpCooldown = 0;
let enemyAxieHealth = 999999;
let enemyAxieMaxHealth = 999999;
let enemyAxieIsDead = false;
let enemyAxieSpawnTimer = 0;
let enemyAxieSpawned = false;
const ENEMY_AXIE_SPAWN_DELAY = 3.0;

const ENEMY_AXIE_ATTACK_RANGE = 2.5;
const ENEMY_AXIE_ATTACK_DAMAGE = 15;
const ENEMY_AXIE_ATTACK_SPEED = 0.8;
const ENEMY_AXIE_SPEED = 1.2;
const ENEMY_AXIE_AGRO_RANGE = 10.0;
const ENEMY_AXIE_SPAWN_POS = new THREE.Vector3(0, 0, 22);

let enemyHealthBarSprite = null;
let enemyHealthBarMat = null;
const ENEMY_HEALTH_SEGMENTS = 10;

function spawnEnemyAxie() {
    if (enemyAxieSpawned || gameFinished) return;
    
    const allAxies = getAllAxies();
    const availableAxies = allAxies.filter(a => a.id !== selectedAxieId);
    const randomAxie = availableAxies[Math.floor(Math.random() * availableAxies.length)];
    
    console.log(`🤖 Axie Enemigo: ${randomAxie.nombre} (${randomAxie.id})`);
    
    enemyAxie = {
        id: randomAxie.id,
        nombre: randomAxie.nombre,
        data: randomAxie,
        health: enemyAxieHealth,
        maxHealth: enemyAxieMaxHealth,
        isDead: false,
    };
    
    const loader = new GLTFLoader();
    const path = randomAxie.modelo;
    
    loader.load(
        path,
        (gltf) => {
            console.log(`✅ Axie enemigo ${randomAxie.nombre} cargado!`);
            enemyAxieModel = gltf.scene;
            enemyAxieModel.position.copy(ENEMY_AXIE_SPAWN_POS);
            const escala = randomAxie.escala || 1.2;
            enemyAxieModel.scale.set(escala, escala, escala);
            enemyAxieModel.rotation.y = Math.PI;
            enemyAxieModel.castShadow = false;
            enemyAxieModel.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = false;
                    node.receiveShadow = false;
                }
            });
            scene.add(enemyAxieModel);
            
            enemyAxieMixer = new THREE.AnimationMixer(enemyAxieModel);
            const clips = gltf.animations;
            clips.forEach(clip => {
                const name = clip.name.toLowerCase();
                if (name.includes('idle')) enemyAxieAnimIdle = enemyAxieMixer.clipAction(clip);
                if (name.includes('walk')) enemyAxieAnimWalk = enemyAxieMixer.clipAction(clip);
            });
            
            if (enemyAxieAnimIdle) {
                enemyAxieAnimIdle.play();
                enemyAxieCurrentAnim = 'idle';
            }
            
            const healthBar = createHealthBar(ENEMY_HEALTH_SEGMENTS, true);
            healthBar.sprite.position.set(0, 1.8, 0);
            enemyAxieModel.add(healthBar.sprite);
            enemyHealthBarSprite = healthBar.sprite;
            enemyHealthBarMat = healthBar.spriteMat;
            
            enemyAxieSpawned = true;
            console.log(`✅ Axie enemigo ${randomAxie.nombre} listo!`);
        },
        undefined,
        (error) => {
            console.error(`❌ Error cargando Axie enemigo:`, error);
            crearEnemyAxieFallback(randomAxie);
        }
    );
}

function crearEnemyAxieFallback(axieData) {
    console.log('📦 Creando fallback para Axie enemigo...');
    const group = new THREE.Group();
    group.position.copy(ENEMY_AXIE_SPAWN_POS);
    group.rotation.y = Math.PI;
    
    const color = new THREE.Color(axieData.color || '#ff4444');
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 })
    );
    body.position.y = 0.6;
    group.add(body);
    
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 })
    );
    head.position.set(0, 1.0, 0.25);
    group.add(head);
    
    scene.add(group);
    enemyAxieModel = group;
    enemyAxieSpawned = true;
    
    // Barra de vida para el fallback
    const healthBar = createHealthBar(ENEMY_HEALTH_SEGMENTS, true);
    healthBar.sprite.position.set(0, 1.8, 0);
    group.add(healthBar.sprite);
    enemyHealthBarSprite = healthBar.sprite;
    enemyHealthBarMat = healthBar.spriteMat;
}

function updateEnemyHealthBar() {
    if (!enemyHealthBarMat || !enemyAxie) return;
    const healthPercent = enemyAxie.health / enemyAxie.maxHealth;
    const visibleSegments = Math.max(0, Math.min(ENEMY_HEALTH_SEGMENTS, Math.ceil(healthPercent * ENEMY_HEALTH_SEGMENTS)));
    updateHealthBarSprite(enemyHealthBarMat, ENEMY_HEALTH_SEGMENTS, visibleSegments, true);
}

function findBestEnemyTarget() {
    if (!enemyAxieModel) return null;
    
    const enemyPos = enemyAxieModel.position;
    let bestTarget = null;
    let bestPriority = 0;
    
    // 1. JUGADOR
    if (playerModel && !isPlayerDead) {
        const distToPlayer = enemyPos.distanceTo(playerModel.position);
        if (distToPlayer <= ENEMY_AXIE_AGRO_RANGE) {
            bestTarget = {
                position: playerModel.position,
                type: 'player',
                health: playerHealth,
                isDead: isPlayerDead,
                priority: 4,
                dist: distToPlayer
            };
            bestPriority = 4;
        }
    }
    
    // 2. TORRES ALIADAS
    if (bestPriority < 4) {
        let closestTower = null;
        let closestDist = Infinity;
        for (const tower of towers) {
            if (tower.isDead || tower.isEnemy) continue;
            const dist = enemyPos.distanceTo(tower.position);
            if (dist < closestDist && dist < 15) {
                closestDist = dist;
                closestTower = tower;
            }
        }
        if (closestTower) {
            bestTarget = {
                position: closestTower.position,
                type: 'tower',
                health: closestTower.health,
                isDead: closestTower.isDead,
                ref: closestTower,
                priority: 3,
                dist: closestDist
            };
            bestPriority = 3;
        }
    }
    
    // 3. MINIONS ALIADOS
    if (bestPriority < 3) {
        let closestMinion = null;
        let closestDist = Infinity;
        for (const minion of aliados) {
            if (minion.isDead) continue;
            const dist = enemyPos.distanceTo(minion.group.position);
            if (dist < closestDist && dist < ENEMY_AXIE_AGRO_RANGE) {
                closestDist = dist;
                closestMinion = minion;
            }
        }
        if (closestMinion) {
            bestTarget = {
                position: closestMinion.group.position,
                type: 'minion',
                health: closestMinion.health,
                isDead: closestMinion.isDead,
                ref: closestMinion,
                priority: 2,
                dist: closestDist
            };
            bestPriority = 2;
        }
    }
    
    // 4. NEXO ALIADO
    if (bestPriority < 2 && !nexusAliado.isDead) {
        const distToNexus = enemyPos.distanceTo(nexusAliado.position);
        if (distToNexus < 20) {
            bestTarget = {
                position: nexusAliado.position,
                type: 'nexus',
                health: nexusAliado.health,
                isDead: nexusAliado.isDead,
                ref: nexusAliado,
                priority: 1,
                dist: distToNexus
            };
            bestPriority = 1;
        }
    }
    
    return bestTarget;
}

function enemyAxieAttack(target) {
    if (!target || target.isDead) return;
    
    if (target.type === 'player') {
        console.log('⚔️ Axie enemigo atacó al jugador (inmortal)');
        return;
    }
    
    if (target.type === 'minion' && target.ref) {
        target.ref.health -= ENEMY_AXIE_ATTACK_DAMAGE;
        if (target.ref.updateHealthBar) target.ref.updateHealthBar();
        if (target.ref.health <= 0) {
            target.ref.die();
        }
        console.log(`💥 Axie enemigo atacó a minion (${Math.floor(target.ref.health)} HP)`);
    }
    
    if (target.type === 'tower' && target.ref) {
        target.ref.health -= ENEMY_AXIE_ATTACK_DAMAGE;
        if (target.ref.updateHealthBar) target.ref.updateHealthBar();
        if (target.ref.health <= 0) {
            target.ref.die();
        }
        console.log(`💥 Axie enemigo atacó a torre (${Math.floor(target.ref.health)} HP)`);
    }
    
    if (target.type === 'nexus' && target.ref) {
        target.ref.health -= ENEMY_AXIE_ATTACK_DAMAGE;
        if (target.ref.updateHealthBar) target.ref.updateHealthBar();
        if (target.ref.health <= 0) {
            target.ref.die();
        }
        console.log(`💥 Axie enemigo atacó al nexo!`);
    }
}

function updateEnemyAxie(delta) {
    if (!enemyAxieSpawned || !enemyAxieModel || enemyAxieIsDead || gameFinished) return;
    
    // Gravedad
    enemyAxieJumpCooldown -= delta;
    enemyAxieVelocityY += CONFIG.gravedad * delta;
    enemyAxieModel.position.y += enemyAxieVelocityY * delta;
    
    if (enemyAxieModel.position.y <= 0) {
        enemyAxieModel.position.y = 0;
        enemyAxieVelocityY = 0;
        enemyAxieIsGrounded = true;
    } else {
        enemyAxieIsGrounded = false;
    }
    
    enemyAxieAttackCooldown -= delta;
    
    const bestTarget = findBestEnemyTarget();
    
    if (bestTarget) {
        const distToTarget = enemyAxieModel.position.distanceTo(bestTarget.position);
        
        if (distToTarget <= ENEMY_AXIE_ATTACK_RANGE) {
            enemyAxieState = 'attack';
            enemyAxieTarget = bestTarget;
            
            const angle = Math.atan2(
                bestTarget.position.x - enemyAxieModel.position.x,
                bestTarget.position.z - enemyAxieModel.position.z
            );
            enemyAxieModel.rotation.y = angle;
            
            if (enemyAxieAttackCooldown <= 0) {
                enemyAxieAttack(bestTarget);
                enemyAxieAttackCooldown = ENEMY_AXIE_ATTACK_SPEED;
            }
            
            if (enemyAxieCurrentAnim !== 'idle' && enemyAxieAnimIdle) {
                if (enemyAxieAnimWalk) enemyAxieAnimWalk.stop();
                enemyAxieAnimIdle.play();
                enemyAxieCurrentAnim = 'idle';
            }
        } else {
            enemyAxieState = 'chase';
            enemyAxieTarget = bestTarget;
            
            const dx = bestTarget.position.x - enemyAxieModel.position.x;
            const dz = bestTarget.position.z - enemyAxieModel.position.z;
            const totalDist = Math.sqrt(dx * dx + dz * dz);
            
            if (totalDist > 0.5) {
                const moveSpeed = ENEMY_AXIE_SPEED * delta;
                const stepX = (dx / totalDist) * moveSpeed;
                const stepZ = (dz / totalDist) * moveSpeed;
                
                enemyAxieModel.position.x += stepX;
                enemyAxieModel.position.z += stepZ;
                
                const angle = Math.atan2(dx, dz);
                enemyAxieModel.rotation.y = angle;
                
                if (enemyAxieCurrentAnim !== 'walk' && enemyAxieAnimWalk) {
                    if (enemyAxieAnimIdle) enemyAxieAnimIdle.stop();
                    enemyAxieAnimWalk.play();
                    enemyAxieCurrentAnim = 'walk';
                }
            }
        }
    } else {
        enemyAxieState = 'move';
        enemyAxieTarget = null;
        
        const moveSpeed = ENEMY_AXIE_SPEED * delta * 0.8;
        enemyAxieModel.position.z -= moveSpeed;
        
        if (enemyAxieModel.position.z < -26) {
            enemyAxieModel.position.z = -26;
        }
        
        if (enemyAxieCurrentAnim !== 'walk' && enemyAxieAnimWalk) {
            if (enemyAxieAnimIdle) enemyAxieAnimIdle.stop();
            enemyAxieAnimWalk.play();
            enemyAxieCurrentAnim = 'walk';
        }
    }
    
    const limitX = 17;
    enemyAxieModel.position.x = Math.max(-limitX, Math.min(limitX, enemyAxieModel.position.x));
    
    updateEnemyHealthBar();
    
    if (enemyAxieMixer) {
        enemyAxieMixer.update(delta);
    }
}

function resetEnemyAxie() {
    if (enemyAxieModel) {
        scene.remove(enemyAxieModel);
        enemyAxieModel = null;
    }
    enemyAxie = null;
    enemyAxieMixer = null;
    enemyAxieAnimIdle = null;
    enemyAxieAnimWalk = null;
    enemyAxieSpawned = false;
    enemyAxieSpawnTimer = 0;
    enemyAxieIsDead = false;
    enemyAxieHealth = enemyAxieMaxHealth;
    enemyHealthBarSprite = null;
    enemyHealthBarMat = null;
}

// =============================================
// PANTALLA DE PAUSA
// =============================================
function showPauseMenu() {
    if (gameFinished || gamePaused) return;
    gamePaused = true;
    
    pauseMenu = document.createElement('div');
    pauseMenu.id = 'pause-menu';
    pauseMenu.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1500;
        animation: fadeIn 0.3s ease-out;
    `;
    
    const title = document.createElement('div');
    title.textContent = '⏸️ PAUSA';
    title.style.cssText = `
        font-size: 64px;
        font-weight: bold;
        color: #88ddff;
        text-shadow: 0 0 30px rgba(136,221,255,0.3);
        font-family: 'Arial Black', sans-serif;
        margin-bottom: 40px;
    `;
    
    const button = document.createElement('button');
    button.textContent = '🚪 Volver al Inicio';
    button.style.cssText = `
        padding: 16px 48px;
        font-size: 24px;
        font-weight: bold;
        background: linear-gradient(135deg, #ff4444, #cc2222);
        color: #fff;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-family: 'Arial', sans-serif;
        transition: transform 0.3s, box-shadow 0.3s;
        box-shadow: 0 0 30px rgba(255,68,68,0.3);
    `;
    button.onmouseenter = () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 0 50px rgba(255,68,68,0.5)';
    };
    button.onmouseleave = () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 0 30px rgba(255,68,68,0.3)';
    };
    button.onclick = () => {
        abandonGame();
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '↩️ Reanudar';
    cancelBtn.style.cssText = `
        padding: 12px 36px;
        font-size: 18px;
        font-weight: bold;
        background: rgba(255,255,255,0.1);
        color: #88aaff;
        border: 2px solid rgba(136,170,255,0.3);
        border-radius: 12px;
        cursor: pointer;
        font-family: 'Arial', sans-serif;
        transition: transform 0.3s;
        margin-top: 15px;
    `;
    cancelBtn.onmouseenter = () => {
        cancelBtn.style.transform = 'scale(1.05)';
    };
    cancelBtn.onmouseleave = () => {
        cancelBtn.style.transform = 'scale(1)';
    };
    cancelBtn.onclick = () => {
        hidePauseMenu();
    };
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    pauseMenu.appendChild(title);
    pauseMenu.appendChild(button);
    pauseMenu.appendChild(cancelBtn);
    document.body.appendChild(pauseMenu);
}

function hidePauseMenu() {
    gamePaused = false;
    if (pauseMenu && pauseMenu.parentNode) {
        pauseMenu.parentNode.removeChild(pauseMenu);
        pauseMenu = null;
    }
}

function abandonGame() {
    gameFinished = true;
    gamePaused = false;
    
    if (pauseMenu && pauseMenu.parentNode) {
        pauseMenu.parentNode.removeChild(pauseMenu);
        pauseMenu = null;
    }
    
    if (victoryScreen && victoryScreen.parentNode) {
        victoryScreen.parentNode.removeChild(victoryScreen);
        victoryScreen = null;
    }
    
    for (const minion of aliados) {
        if (minion.group && minion.group.parent) {
            scene.remove(minion.group);
        }
    }
    for (const minion of enemigos) {
        if (minion.group && minion.group.parent) {
            scene.remove(minion.group);
        }
    }
    aliados.length = 0;
    enemigos.length = 0;
    
    for (const proj of playerProjectiles) {
        if (proj.mesh && proj.mesh.parent) scene.remove(proj.mesh);
        if (proj.glow && proj.glow.parent) scene.remove(proj.glow);
    }
    playerProjectiles.length = 0;
    
    for (const tower of towers) {
        if (tower.group && tower.group.parent) {
            scene.remove(tower.group);
        }
    }
    towers.length = 0;
    
    nexusAliado.isDead = false;
    nexusAliado.health = nexusAliado.maxHealth;
    nexusAliado.group.visible = true;
    nexusAliado.isExploding = false;
    nexusAliado.updateHealthBar();
    
    nexusEnemigo.isDead = false;
    nexusEnemigo.health = nexusEnemigo.maxHealth;
    nexusEnemigo.group.visible = true;
    nexusEnemigo.isExploding = false;
    nexusEnemigo.updateHealthBar();
    
    createTower(-3.5, -18, false, 1);
    createTower(-3.5, -6, false, 2);
    createTower(3.5, 18, true, 1);
    createTower(3.5, 6, true, 2);
    
    gameStarted = false;
    startTimer = CONFIG.SPAWN_DELAY;
    waveNumber = 1;
    gameTime = 0;
    isFirstWave = true;
    firstWaveTimer = 0;
    gameFinished = false;
    axieLoaded = false;
    currentAxieName = 'Bing';
    
    // Resetear Axie enemigo
    resetEnemyAxie();
    
    if (renderer && renderer.domElement) {
        renderer.domElement.style.display = 'none';
    }
    
    showMainMenu();
}

// =============================================
// PANTALLA DE VICTORIA
// =============================================
function showVictoryScreen() {
    if (gameFinished) return;
    gameFinished = true;
    
    victoryScreen = document.createElement('div');
    victoryScreen.id = 'victory-screen';
    victoryScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        animation: fadeIn 1s ease-out;
    `;
    
    const title = document.createElement('div');
    title.textContent = '🏆 GANASTE 🏆';
    title.style.cssText = `
        font-size: 80px;
        font-weight: bold;
        color: #ffdd44;
        text-shadow: 0 0 30px rgba(255,220,68,0.5), 0 0 60px rgba(255,220,68,0.3);
        font-family: 'Arial Black', sans-serif;
        animation: pulse 1.5s ease-in-out infinite;
        margin-bottom: 30px;
    `;
    
    const subtitle = document.createElement('div');
    subtitle.textContent = '¡Has destruido el Nexo Enemigo!';
    subtitle.style.cssText = `
        font-size: 28px;
        color: #88ddff;
        font-family: 'Arial', sans-serif;
        margin-bottom: 40px;
        text-shadow: 0 0 20px rgba(136,221,255,0.3);
    `;
    
    const button = document.createElement('button');
    button.textContent = '🏠 Ir a Inicio';
    button.style.cssText = `
        padding: 16px 48px;
        font-size: 24px;
        font-weight: bold;
        background: linear-gradient(135deg, #44ff88, #22aa66);
        color: #fff;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-family: 'Arial', sans-serif;
        transition: transform 0.3s, box-shadow 0.3s;
        box-shadow: 0 0 30px rgba(68,255,136,0.3);
    `;
    button.onmouseenter = () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 0 50px rgba(68,255,136,0.5)';
    };
    button.onmouseleave = () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 0 30px rgba(68,255,136,0.3)';
    };
    button.onclick = () => {
        abandonGame();
    };
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    document.head.appendChild(style);
    
    victoryScreen.appendChild(title);
    victoryScreen.appendChild(subtitle);
    victoryScreen.appendChild(button);
    document.body.appendChild(victoryScreen);
    
    gameFinished = true;
}

// =============================================
// FUNCIONES DEL MENÚ PRINCIPAL
// =============================================
let menuScreen = null;

function showMainMenu() {
    if (renderer && renderer.domElement) {
        renderer.domElement.style.display = 'none';
    }
    
    if (timerDiv) timerDiv.style.display = 'none';
    if (fpsDiv) fpsDiv.style.display = 'none';
    if (waveDiv) waveDiv.style.display = 'none';
    if (targetUI) targetUI.style.display = 'none';
    
    if (menuScreen) {
        menuScreen.destroy();
        menuScreen = null;
    }
    
    menuScreen = new MenuScreen();
    menuScreen.show(
        (axieId, mode) => {
            console.log(`🎮 Iniciando juego con Axie: ${axieId} en modo ${mode}`);
            selectedAxieId = axieId;
            startGame(axieId);
        },
        (axieId) => {
            console.log(`✅ Axie seleccionado: ${axieId}`);
            selectedAxieId = axieId;
        }
    );
}

function startGame(axieId) {
    if (renderer && renderer.domElement) {
        renderer.domElement.style.display = 'block';
    }
    
    if (timerDiv) timerDiv.style.display = 'block';
    if (fpsDiv) fpsDiv.style.display = 'block';
    if (waveDiv) waveDiv.style.display = 'block';
    
    // Resetear Axie enemigo antes de empezar
    resetEnemyAxie();
    enemyAxieSpawnTimer = 0;
    
    loadSelectedAxie(axieId);
    
    gameFinished = false;
    gameStarted = false;
    startTimer = CONFIG.SPAWN_DELAY;
    waveNumber = 1;
    gameTime = 0;
    isFirstWave = true;
    firstWaveTimer = 0;
    axieLoaded = false;
    
    for (const minion of aliados) {
        if (minion.group && minion.group.parent) {
            scene.remove(minion.group);
        }
    }
    for (const minion of enemigos) {
        if (minion.group && minion.group.parent) {
            scene.remove(minion.group);
        }
    }
    aliados.length = 0;
    enemigos.length = 0;
    
    if (playerModel) {
        cameraSmoothPos.copy(playerModel.position);
        cameraSmoothTarget.copy(playerModel.position);
    }
    updateCameraPosition();
    requestAnimationFrame(gameLoop);
}

// =============================================
// ESCUCHAR TECLA ESC
// =============================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (gameFinished) return;
        if (gameStarted) {
            if (gamePaused) {
                hidePauseMenu();
            } else {
                showPauseMenu();
            }
        }
    }
});

// =============================================
// LOOP PRINCIPAL
// =============================================
let frameCounter = 0;
let lastTime = 0;
let realFPS = 0;
let fpsCounter = 0;
let fpsTimer = 0;

function gameLoop(time) {
    if (gameFinished) {
        nexusEnemigo.updateExplosion(0.016);
        renderer.render(scene, camera);
        requestAnimationFrame(gameLoop);
        return;
    }
    
    if (gamePaused) {
        renderer.render(scene, camera);
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    frameCounter++;
    gameTime += delta;

    if (isFirstWave) {
        firstWaveTimer += delta;
        if (firstWaveTimer >= CONFIG.firstWaveGhostDuration) {
            isFirstWave = false;
            console.log('👻 Fin de la primera oleada fantasma');
        }
    }

    timerDiv.textContent = `${Math.floor(gameTime / 60).toString().padStart(2, '0')}:${Math.floor(gameTime % 60).toString().padStart(2, '0')}`;

    fpsCounter++;
    fpsTimer += delta;
    if (fpsTimer >= 1.0) {
        realFPS = Math.round(fpsCounter / fpsTimer);
        fpsCounter = 0;
        fpsTimer = 0;
        fpsDiv.textContent = `FPS: ${realFPS}`;
    }

    // =============================================
    // MOVIMIENTO DEL JUGADOR
    // =============================================
    if (playerModel && isMovingToTarget && targetPosition) {
        const dx = smoothTargetPos.x - smoothPlayerPos.x;
        const dz = smoothTargetPos.z - smoothPlayerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < 0.05) {
            smoothPlayerPos.copy(smoothTargetPos);
            isMovingToTarget = false;
            targetPosition = null;
            isAutoMovingToTarget = false;
            if (animIdle && animWalk) {
                animWalk.stop();
                animIdle.play();
                currentAnim = 'idle';
            }
        } else {
            const moveSpeed = playerSpeed * delta;
            const stepX = (dx / dist) * moveSpeed;
            const stepZ = (dz / dist) * moveSpeed;
            
            if (Math.abs(stepX) > Math.abs(dx)) {
                smoothPlayerPos.x = smoothTargetPos.x;
            } else {
                smoothPlayerPos.x += stepX;
            }
            
            if (Math.abs(stepZ) > Math.abs(dz)) {
                smoothPlayerPos.z = smoothTargetPos.z;
            } else {
                smoothPlayerPos.z += stepZ;
            }
            
            if (currentAnim !== 'walk' && animWalk) {
                if (animIdle) animIdle.stop();
                animWalk.play();
                currentAnim = 'walk';
            }
            
            const angle = Math.atan2(dx, dz);
            let currentAngle = playerModel.rotation.y;
            let diff = angle - currentAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            playerModel.rotation.y += diff * Math.min(1, 6 * delta);
        }
        
        playerModel.position.copy(smoothPlayerPos);
    } else if (playerModel && smoothPlayerPos) {
        playerModel.position.copy(smoothPlayerPos);
        if (currentAnim !== 'idle' && animIdle && !isMovingToTarget && !isAutoMovingToTarget) {
            if (animWalk) animWalk.stop();
            animIdle.play();
            currentAnim = 'idle';
        }
    }

    // =============================================
    // SISTEMA DE TARGET Y ATAQUE DEL JUGADOR
    // =============================================
    if (playerModel && window.currentTarget && !window.currentTarget.isDead) {
        if (!window.currentTarget.isEnemy) {
            if (window.currentTarget) {
                window.showTarget(window.currentTarget);
            }
            attackCooldown = 0;
            isAttacking = false;
        } else {
            const targetPos = window.currentTarget.group.position;
            const playerPos = playerModel.position;
            const distToTarget = Math.sqrt(
                Math.pow(targetPos.x - playerPos.x, 2) + 
                Math.pow(targetPos.z - playerPos.z, 2)
            );
            
            if (distToTarget <= attackRange) {
                if (isAutoMovingToTarget) {
                    isAutoMovingToTarget = false;
                    isMovingToTarget = false;
                    targetPosition = null;
                }
                
                const angle = Math.atan2(
                    targetPos.x - playerPos.x,
                    targetPos.z - playerPos.z
                );
                playerModel.rotation.y = angle;
                
                if (currentAnim !== 'idle' && animIdle) {
                    if (animWalk) animWalk.stop();
                    animIdle.play();
                    currentAnim = 'idle';
                }
                
                attackCooldown -= delta;
                if (attackCooldown <= 0 && !isAttacking) {
                    const startPos = playerModel.position.clone();
                    startPos.y = 0.5;
                    const proj = new PlayerProjectile(startPos, window.currentTarget, attackDamage);
                    playerProjectiles.push(proj);
                    attackCooldown = attackSpeed;
                    isAttacking = true;
                    setTimeout(() => { isAttacking = false; }, 100);
                }
            } else {
                if (!isMovingToTarget || isAutoMovingToTarget) {
                    const dx = targetPos.x - playerPos.x;
                    const dz = targetPos.z - playerPos.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist > 0.5) {
                        isAutoMovingToTarget = true;
                        isMovingToTarget = true;
                        targetPosition = new THREE.Vector3(targetPos.x, 0, targetPos.z);
                        smoothTargetPos.copy(targetPosition);
                    }
                }
            }
        }
    } else {
        attackCooldown = 0;
        isAttacking = false;
        if (!window.currentTarget || window.currentTarget.isDead) {
            if (isAutoMovingToTarget) {
                isAutoMovingToTarget = false;
                isMovingToTarget = false;
                targetPosition = null;
            }
        }
    }
    
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const proj = playerProjectiles[i];
        proj.update(delta);
        if (!proj.active) {
            playerProjectiles.splice(i, 1);
        }
    }

    updateTargetUI();

    if (mixer) {
        mixer.update(delta);
    }

    // =============================================
    // INICIO DEL JUEGO
    // =============================================
    if (!gameStarted) {
        startTimer -= delta;
        waveDiv.textContent = `⏳ ${Math.ceil(startTimer)}s`;
        if (startTimer <= 0) {
            gameStarted = true;
            spawnWave();
            // Spawnear Axie enemigo 3 segundos después de empezar
            setTimeout(() => {
                if (!gameFinished && gameStarted) {
                    spawnEnemyAxie();
                }
            }, ENEMY_AXIE_SPAWN_DELAY * 1000);
        }
        if (playerModel) updateCameraPosition();
        renderer.render(scene, camera);
        requestAnimationFrame(gameLoop);
        return;
    }

    // =============================================
    // ACTUALIZAR TORRES
    // =============================================
    const enemies = { aliados, enemigos };
    for (const tower of towers) {
        tower.update(delta, enemies);
    }

    // =============================================
    // ACTUALIZAR MINIONS
    // =============================================
    if (frameCounter % CONFIG.updateInterval === 0) {
        for (const minion of aliados) {
            minion.update(delta, aliados, enemigos, towers, playerModel);
        }
        for (const minion of enemigos) {
            minion.update(delta, aliados, enemigos, towers, playerModel);
        }
    }

    // =============================================
    // ACTUALIZAR AXIE ENEMIGO (IA)
    // =============================================
    if (gameStarted && !gameFinished) {
        updateEnemyAxie(delta);
    }

    nexusEnemigo.updateExplosion(delta);

    // =============================================
    // SISTEMA DE OLEADAS
    // =============================================
    const aliveAliados = aliados.filter(m => !m.isDead);
    const aliveEnemigos = enemigos.filter(m => !m.isDead);
    if (aliveAliados.length === 0 || aliveEnemigos.length === 0) {
        waveCooldown += delta;
        if (waveCooldown > WAVE_DELAY) {
            waveCooldown = 0;
            spawnWave();
        }
    } else {
        waveCooldown = 0;
    }

    if (playerModel) updateCameraPosition();
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

// =============================================
// EVENTOS DE VENTANA
// =============================================
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 7.2;
    camera.left = -frustumSize * aspect;
    camera.right = frustumSize * aspect;
    camera.top = frustumSize;
    camera.bottom = -frustumSize;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('beforeunload', () => {
    healthBarCache.clear();
    renderer.dispose();
});

// =============================================
// 🎯 SISTEMA DE TARGET
// =============================================
const targetUI = document.createElement('div');
targetUI.id = 'target-ui';
targetUI.style.cssText = "position:fixed;top:20px;left:20px;width:240px;background:rgba(0,0,0,0.85);border:2px solid rgba(255,200,50,0.6);border-radius:8px;padding:8px 12px;z-index:150;font-family:'Segoe UI',Arial,sans-serif;color:#fff;display:none;pointer-events:none;box-shadow:0 0 30px rgba(0,0,0,0.9);";
targetUI.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span id="target-name" style="font-weight:bold;font-size:14px;color:#ffcc44;">Enemigo</span><span id="target-level" style="font-size:11px;color:#88aaff;background:rgba(255,255,255,0.1);padding:0 8px;border-radius:4px;">Lv.1</span><span id="target-type" style="font-size:10px;color:#88aaff;background:rgba(255,255,255,0.1);padding:0 8px;border-radius:4px;">Minion</span></div><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12px;color:#ff6644;">❤️</span><div style="flex:1;height:16px;background:rgba(255,255,255,0.12);border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);"><div id="target-health-bar" style="width:100%;height:100%;background:linear-gradient(90deg,#ff2244,#ff6644);border-radius:4px;transition:width 0.2s;"></div></div><span id="target-health-text" style="font-size:11px;font-weight:bold;min-width:50px;text-align:right;color:#fff;">100/100</span></div>';
document.body.appendChild(targetUI);

window.currentTarget = null;

window.showTarget = function(target) {
    window.currentTarget = target;
    if (!target || target.isDead) {
        targetUI.style.display = 'none';
        return;
    }
    targetUI.style.display = 'block';
    let nameEl = document.getElementById('target-name');
    let levelEl = document.getElementById('target-level');
    let typeEl = document.getElementById('target-type');
    let healthBar = document.getElementById('target-health-bar');
    let healthText = document.getElementById('target-health-text');
    
    let name = 'Enemigo';
    let tipoTexto = '';
    
    if (target.type === 'minion') {
        if (target.isEnemy) {
            if (target.minionType === 'melee' || target.tipo === 'melee') {
                name = '⚔️ Guerrero Rojo';
                tipoTexto = 'Melee';
            } else if (target.minionType === 'mage' || target.tipo === 'mage') {
                name = '🧙 Mago Rojo';
                tipoTexto = 'Mago';
            } else {
                name = '🔴 Minion Enemigo';
                tipoTexto = 'Minion';
            }
        } else {
            if (target.minionType === 'melee' || target.tipo === 'melee') {
                name = '🛡️ Guerrero Azul';
                tipoTexto = 'Melee';
            } else if (target.minionType === 'mage' || target.tipo === 'mage') {
                name = '🔮 Mago Azul';
                tipoTexto = 'Mago';
            } else {
                name = '🔵 Minion Aliado';
                tipoTexto = 'Minion';
            }
        }
    } else if (target.type === 'tower') {
        if (target.isEnemy) {
            name = '🗼 Torre Enemiga';
            tipoTexto = 'Torre';
        } else {
            name = '🏰 Torre Aliada';
            tipoTexto = 'Torre';
        }
    } else if (target.type === 'nexus') {
        if (target.isEnemy) {
            name = '🔥 Nexo Enemigo';
            tipoTexto = 'Nexo';
        } else {
            name = '💎 Nexo Aliado';
            tipoTexto = 'Nexo';
        }
    } else if (target.type === 'player') {
        name = '🦊 Axie (Inmortal)';
        tipoTexto = 'Jugador';
    }
    
    nameEl.textContent = name;
    levelEl.textContent = 'Lv.1';
    typeEl.textContent = tipoTexto;
    
    let pct = (target.health / target.maxHealth) * 100;
    healthBar.style.width = Math.max(0, pct) + '%';
    healthText.textContent = Math.floor(target.health) + '/' + target.maxHealth;
};

window.updateTargetUI = function() {
    if (window.currentTarget && !window.currentTarget.isDead) {
        window.showTarget(window.currentTarget);
    } else if (window.currentTarget) {
        window.currentTarget = null;
        targetUI.style.display = 'none';
    }
};

window.getTargetFromClick = function(event) {
    let rect = renderer.domElement.getBoundingClientRect();
    let mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    let selectables = [];
    let allEntities = [].concat(enemigos, aliados, towers, [nexusAliado, nexusEnemigo]);
    if (playerModel) {
        playerModel.traverse(function(child) {
            if (child.isMesh) selectables.push(child);
        });
    }
    for (let i = 0; i < allEntities.length; i++) {
        let entity = allEntities[i];
        if (entity.isDead || !entity.group) continue;
        entity.group.traverse(function(child) {
            if (child.isMesh) selectables.push(child);
        });
    }
    let intersects = raycaster.intersectObjects(selectables);
    if (intersects.length > 0) {
        let parent = intersects[0].object;
        while (parent) {
            if (parent.userData && parent.userData.targetRef) return parent.userData.targetRef;
            parent = parent.parent;
        }
        if (playerModel && intersects[0].object.parent === playerModel) {
            return { 
                group: playerModel, 
                isDead: false, 
                health: playerHealth, 
                maxHealth: playerMaxHealth, 
                type: 'player',
                isEnemy: true,
                updateHealthBar: function() {},
                die: function() {}
            };
        }
    }
    return null;
};

renderer.domElement.addEventListener('mousedown', function(e) {
    if (e.button === 0 && playerModel) {
        let target = window.getTargetFromClick(e);
        if (target && !target.isDead) {
            window.showTarget(target);
            console.log('🎯 Target seleccionado:', target.type || 'objeto', target.isEnemy ? '(Enemigo)' : '(Aliado)');
            isMovingToTarget = false;
            targetPosition = null;
            isAutoMovingToTarget = false;
            return;
        }
        if (window.currentTarget) {
            window.currentTarget = null;
            targetUI.style.display = 'none';
            console.log('❌ Target cancelado');
        }
    } else if (e.button === 2 && window.currentTarget) {
        window.currentTarget = null;
        targetUI.style.display = 'none';
        console.log('❌ Target cancelado (click derecho)');
    }
});

console.log('✅ SISTEMA DE TARGET CARGADO CORRECTAMENTE');
console.log('⚔️ AUTOATAQUE ACTIVADO: Rango ' + CONFIG.attackRange + ', Daño ' + CONFIG.attackDamage + ', Velocidad ' + CONFIG.attackSpeed);
console.log('🔹 Solo ataca a enemigos');
console.log('🔹 Movimiento automático hacia el target');
console.log('🔹 Click derecho para mover al Axie');
console.log('🔹 MINIONS: Comportamiento League of Legends CORREGIDO');
console.log('   - PRIORIDAD #1: Axie enemigo si está en rango de agro - SOLO minions ENEMIGOS');
console.log('   - PRIORIDAD #2: Enemigo atacando a un aliado (agro)');
console.log('   - PRIORIDAD #3: Minions enemigos');
console.log('   - PRIORIDAD #4: Torres enemigas (solo si están vivas)');
console.log('   - Reevaluación cada ' + CONFIG.reevaluationTime + ' segundos');
console.log('   - Persecución por ' + CONFIG.chaseTime + ' segundos');
console.log('🔹 TORRES: Mueren correctamente al llegar a 0 HP');
console.log('🔹 NEXO: Animación de explosión al destruirse');
console.log('🔹 VICTORIA: Pantalla de "GANASTE" al destruir el nexo enemigo');
console.log('🔹 Axie del jugador es INMORTAL');
console.log('🔹 Minions ALIADOS NO atacan al Axie del jugador');
console.log('🔹 ESC: Abre menú de pausa con "Volver al Inicio"');
console.log('🔹 Selección de Axie: Carga el modelo del Axie elegido');
console.log('🔹 Canvas oculto al inicio (sin flash)');
console.log('🔹 El Axie se carga SOLO cuando se selecciona en el menú');
console.log('🔹 HUD actualiza el nombre del Axie seleccionado');
console.log('🤖 SISTEMA DE AXIE ENEMIGO CON IA ACTIVADO');
console.log('   - Aparece 3 segundos después de empezar el juego');
console.log('   - Prioriza: Jugador > Torres > Minions > Nexo');

// =============================================
// INICIAR CON EL MENÚ PRINCIPAL
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
    
    if (timerDiv) timerDiv.style.display = 'none';
    if (fpsDiv) fpsDiv.style.display = 'none';
    if (waveDiv) waveDiv.style.display = 'none';
    if (targetUI) targetUI.style.display = 'none';
    
    showMainMenu();
});
const axieData = {
    name: 'Puff',
    level: 1,
    maxHealth: 500,
    health: 500,
    maxEnergy: 100,
    energy: 100,
    attack: 20,
    defense: 10,
    speed: 1.5,
    items: [null, null, null, null, null, null],
    exp: 0,
    expToNext: 100,
};

function updateHub() {
    const healthPercent = (axieData.health / axieData.maxHealth) * 100;
    const energyPercent = (axieData.energy / axieData.maxEnergy) * 100;
    
    const healthBar = document.getElementById('health-bar');
    const energyBar = document.getElementById('energy-bar');
    const healthLabel = document.getElementById('health-label');
    const energyLabel = document.getElementById('energy-label');
    
    if (healthBar) healthBar.style.width = Math.max(0, healthPercent) + '%';
    if (energyBar) energyBar.style.width = Math.max(0, energyPercent) + '%';
    if (healthLabel) healthLabel.textContent = '❤️ ' + Math.floor(axieData.health) + ' / ' + axieData.maxHealth;
    if (energyLabel) energyLabel.textContent = '🔵 ' + Math.floor(axieData.energy) + ' / ' + axieData.maxEnergy;
    
    const attackEl = document.getElementById('stat-attack');
    const defenseEl = document.getElementById('stat-defense');
    const speedEl = document.getElementById('stat-speed');
    if (attackEl) attackEl.textContent = axieData.attack;
    if (defenseEl) defenseEl.textContent = axieData.defense;
    if (speedEl) speedEl.textContent = axieData.speed.toFixed(1);
    
    const levelEl = document.querySelector('#axie-name .level');
    if (levelEl) levelEl.textContent = 'Nv. ' + axieData.level;
    
    const expFill = document.getElementById('exp-fill');
    if (expFill) {
        const percent = (axieData.exp / axieData.expToNext) * 100;
        expFill.style.width = Math.min(100, percent) + '%';
    }
}

const skillData = {
    q: { name: 'Garra Salvaje', level: 1, maxLevel: 5 },
    w: { name: 'Rugido', level: 1, maxLevel: 5 },
    e: { name: 'Escudo', level: 1, maxLevel: 5 },
    r: { name: 'Furia Bestial', level: 1, maxLevel: 3 },
};

let skillPoints = 1;

function levelUpSkill(skillKey) {
    const skill = skillData[skillKey];
    if (!skill) return;
    if (skillPoints <= 0) {
        console.log('Sin puntos de habilidad');
        return;
    }
    if (skill.level >= skill.maxLevel) {
        console.log(skill.name + ' ya está al máximo');
        return;
    }
    skill.level++;
    skillPoints--;
    console.log(skill.name + ' → Nv. ' + skill.level);
    updateSkillUI();
}

function updateSkillUI() {
    const slots = document.querySelectorAll('#axie-skills .skill-slot');
    slots.forEach(function(slot) {
        const key = slot.dataset.skill;
        const skill = skillData[key];
        if (skill) {
            const levelEl = slot.querySelector('.skill-level');
            if (levelEl) levelEl.textContent = skill.level;
        }
    });
    const nameEl = document.querySelector('#axie-name .name');
    if (nameEl && skillPoints > 0) {
        nameEl.textContent = '⚔️ Puff ✨+' + skillPoints;
    } else if (nameEl) {
        nameEl.textContent = '⚔️ Puff';
    }
}

document.querySelectorAll('#axie-skills .skill-slot').forEach(function(slot) {
    slot.addEventListener('click', function() {
        levelUpSkill(slot.dataset.skill);
    });
});

setTimeout(function() {
    updateHub();
    updateSkillUI();
    console.log('HUB controlador iniciado');
}, 500);

window.axieHub = {
    data: axieData,
    update: updateHub,
    addExp: function(amount) {
        axieData.exp += amount;
        while (axieData.exp >= axieData.expToNext) {
            axieData.exp -= axieData.expToNext;
            axieData.level++;
            axieData.expToNext = Math.floor(axieData.expToNext * 1.3) + 50;
            axieData.maxHealth += 30;
            axieData.health = Math.min(axieData.health + 30, axieData.maxHealth);
            axieData.attack += 2;
            axieData.defense += 1;
            skillPoints++;
            console.log('🎉 Nv. ' + axieData.level + '! Puntos: ' + skillPoints);
        }
        updateHub();
        updateSkillUI();
    },
    levelUpSkill: levelUpSkill,
};

// Evitar que los clics e interacciones en el HUB traspasen al Canvas de Three.js
const hubElement = document.getElementById('axie-hub');
if (hubElement) {
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu'].forEach(eventType => {
        hubElement.addEventListener(eventType, function(e) {
            e.stopPropagation();
        });
    });
}

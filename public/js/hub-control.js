window.axieHubData = {
    name: 'Puff',
    level: 1,
    maxHealth: 500,
    health: 500,
    maxEnergy: 100,
    energy: 100,
    attack: 20,
    defense: 10,
    speed: 1.5,
    exp: 0,
    expToNext: 100,
};

function updateHubUI() {
    const data = window.axieHubData;
    const healthPercent = (data.health / data.maxHealth) * 100;
    const energyPercent = (data.energy / data.maxEnergy) * 100;
    
    const healthBar = document.getElementById('health-bar');
    const energyBar = document.getElementById('energy-bar');
    const healthLabel = document.getElementById('health-label');
    const energyLabel = document.getElementById('energy-label');
    
    if (healthBar) healthBar.style.width = Math.max(0, healthPercent) + '%';
    if (energyBar) energyBar.style.width = Math.max(0, energyPercent) + '%';
    if (healthLabel) healthLabel.textContent = '❤️ ' + Math.floor(data.health) + ' / ' + data.maxHealth;
    if (energyLabel) energyLabel.textContent = '🔵 ' + Math.floor(data.energy) + ' / ' + data.maxEnergy;
    
    const attackEl = document.getElementById('stat-attack');
    const defenseEl = document.getElementById('stat-defense');
    const speedEl = document.getElementById('stat-speed');
    if (attackEl) attackEl.textContent = data.attack;
    if (defenseEl) defenseEl.textContent = data.defense;
    if (speedEl) speedEl.textContent = data.speed.toFixed(1);
    
    const levelEl = document.querySelector('#axie-name .level');
    if (levelEl) levelEl.textContent = 'Nv. ' + data.level;
    
    const expFill = document.getElementById('exp-fill');
    if (expFill) {
        const percent = (data.exp / data.expToNext) * 100;
        expFill.style.width = Math.min(100, percent) + '%';
    }
}

const skillData = {
    q: { name: 'Garra Salvaje', level: 1, maxLevel: 5 },
    w: { name: 'Rugido', level: 1, maxLevel: 5 },
    e: { name: 'Escudo', level: 1, maxLevel: 5 },
    r: { name: 'Furia Bestial', level: 1, maxLevel: 3 },
};

let skillPoints = 0;

function levelUpSkill(skillKey) {
    const skill = skillData[skillKey];
    if (!skill) return;
    if (skillPoints <= 0) return;
    if (skill.level >= skill.maxLevel) return;
    skill.level++;
    skillPoints--;
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
        nameEl.textContent = '⚔️ ' + window.axieHubData.name + ' ✨+' + skillPoints;
    } else if (nameEl) {
        nameEl.textContent = '⚔️ ' + window.axieHubData.name;
    }
}

document.querySelectorAll('#axie-skills .skill-slot').forEach(function(slot) {
    slot.addEventListener('click', function() {
        levelUpSkill(slot.dataset.skill);
    });
});

// Exponer API global para que main.js actualice el HUD en tiempo real
window.axieHub = {
    update: updateHubUI,
    setData: function(newData) {
        Object.assign(window.axieHubData, newData);
        updateHubUI();
    },
    addExp: function(amount) {
        window.axieHubData.exp += amount;
        while (window.axieHubData.exp >= window.axieHubData.expToNext) {
            window.axieHubData.exp -= window.axieHubData.expToNext;
            window.axieHubData.level++;
            window.axieHubData.expToNext = Math.floor(window.axieHubData.expToNext * 1.3) + 50;
            window.axieHubData.maxHealth += 30;
            window.axieHubData.health = window.axieHubData.maxHealth;
            window.axieHubData.attack += 2;
            skillPoints++;
        }
        updateHubUI();
        updateSkillUI();
    }
};

setInterval(updateHubUI, 200);
console.log('✅ HUB controlador integrado correctamente.');

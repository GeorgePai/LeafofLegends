'use strict';
/* =========================================================
   v2.6 新英雄：死靈召喚力夫（神話）— 原著資料格式的資料定義
   數值依 Pai 的設計；MP、成長、技能解鎖等級等為暫定（見 VALUES.md 6i）
   ========================================================= */
// 普攻武器：暗黑法杖射出的暗黑尖刺
G.ORIG.weapons.darkspike = { id: 900, name: 'darkspike', type: '2d_bullet', resource: 'bullet_darkspike', speed: 520, attack_type: 'normal', curve: false, height_rate: 0, start_sound: 'darkshot', trail: true };
G.ORIG.units.necroleafy = {
  id: 11, type: 'player', name: 'necroleafy', order: 11, exp: 500, leaf: false, cost: 30000, normal: 50, hard: 0, hell: 0, unit_point: 0,
  hp: 200, mp: 180, speed: 90, power: 25, armor: 5, critical: 2, delay: 1000, range: 140, heal_hp: 1, heal_mp: 1.2,
  grow_hp: 11, grow_mp: 12, grow_speed: 0, grow_power: 3, grow_armor: 1, grow_critical: 0, grow_delay: -6, grow_range: 0, grow_heal_hp: 0.5, grow_heal_mp: 0.5,
  weapon_id: 900, weapon_name: 'darkspike', weapon_option: 0, weapon_grow_option: 0
};
// 技能（type 'necro'：由 06d_necro.js 處理）。cds：每級冷卻（秒），不走原本的 −10%/級公式
G.ORIG.skills[4001] = { id: 4001, name: 'Sacrifice Summon', active: true, type: 'necro', leaf: false, cost: 100, attribute: 'sac', value_1: 0, grow_value_1: 0, value_2: 0, grow_value_2: 0, range: 80, delay: 7, cds: [7, 6.3, 5.6], mp: 30, grow_mp: 0, effect_id: 0, weapon_id: 0, lv1: 1, lv2: 3, lv3: 5 };
G.ORIG.skills[4002] = { id: 4002, name: 'Blood Rite', active: true, type: 'necro', leaf: false, cost: 100, attribute: 'ctrl', value_1: 50, grow_value_1: 0, value_2: 0, grow_value_2: 0, range: 80, delay: 18, cds: [18, 16.2, 14.6], mp: 50, grow_mp: 0, effect_id: 0, weapon_id: 0, lv1: 2, lv2: 4, lv3: 6 };
G.ORIG.skills[4003] = { id: 4003, name: 'Clone', active: true, type: 'necro', leaf: false, cost: 100, attribute: 'clone', value_1: 1, grow_value_1: 0, value_2: 0, grow_value_2: 0, range: 0, delay: 40, cds: [40, 32, 25], mp: 80, grow_mp: 0, effect_id: 0, weapon_id: 0, lv1: 5, lv2: 8, lv3: 12 };
G.ORIG.skills[4004] = { id: 4004, name: 'Scapegoat', active: false, type: 'necro', leaf: false, cost: 100, attribute: 'scape', value_1: 50, grow_value_1: 10, value_2: 0, grow_value_2: 0, range: 120, delay: 0, mp: 0, grow_mp: 0, effect_id: 0, weapon_id: 0, lv1: 1, lv2: 4, lv3: 7 };
G.ORIG.heroSkills[11] = [4001, 4004, 4002, 4003];

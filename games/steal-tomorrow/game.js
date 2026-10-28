(() => {
  "use strict";

  const L = window.I18N ? window.I18N.t : ((value, ...rest) => typeof value === "string" ? value : value.reduce((out, part, index) => out + part + (rest[index] ?? ""), ""));

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    start: document.querySelector("#start-screen"),
    startButton: document.querySelector("#start-button"),
    result: document.querySelector("#result-screen"),
    resultTitle: document.querySelector("#result-title"),
    resultStory: document.querySelector("#result-story"),
    resultGrid: document.querySelector("#result-grid"),
    restartButton: document.querySelector("#restart-button"),
    continueButton: document.querySelector("#continue-button"),
    pause: document.querySelector("#pause-screen"),
    missionStrip: document.querySelector("#mission-strip"),
    missionCopy: document.querySelector("#mission-copy"),
    lootCount: document.querySelector("#loot-count"),
    clockBox: document.querySelector("#clock-box"),
    clock: document.querySelector("#clock"),
    phaseName: document.querySelector("#phase-name"),
    objectiveList: document.querySelector("#objective-list"),
    escapeCard: document.querySelector("#escape-card"),
    escapeNote: document.querySelector("#escape-note"),
    bonusCard: document.querySelector("#bonus-card"),
    bonusTitle: document.querySelector("#bonus-title"),
    bonusNote: document.querySelector("#bonus-note"),
    targetPanel: document.querySelector("#target-panel"),
    targetName: document.querySelector("#target-name"),
    targetKind: document.querySelector("#target-kind"),
    historyTime: document.querySelector("#history-time"),
    historyFill: document.querySelector("#history-fill"),
    targetState: document.querySelector("#target-state"),
    alertPanel: document.querySelector("#alert-panel"),
    alertLabel: document.querySelector("#alert-label"),
    alertPips: [...document.querySelectorAll("#alert-pips i")],
    eventBanner: document.querySelector("#event-banner"),
    eventCode: document.querySelector("#event-code"),
    eventTitle: document.querySelector("#event-title"),
    eventCopy: document.querySelector("#event-copy"),
    feed: document.querySelector("#feed"),
    healthFill: document.querySelector("#health-fill"),
    healthValue: document.querySelector("#health-value"),
    tools: document.querySelector("#tools"),
    keyCount: document.querySelector("#key-count"),
    chipCount: document.querySelector("#chip-count"),
    archiveFile: document.querySelector("#archive-file"),
    disguiseName: document.querySelector("#disguise-name"),
    carryName: document.querySelector("#carry-name"),
    contextHint: document.querySelector("#context-hint"),
    crosshair: document.querySelector("#crosshair"),
    wash: document.querySelector("#rewind-wash")
  };

  const TAU = Math.PI * 2;
  const WORLD_W = 2400;
  const WORLD_H = 1500;
  const SNAP_DT = .08;
  const BASE_HISTORY = 8;
  const VISION_SCALE = .62;
  const ENEMY_HEALTH = 10;
  const CUSTODIAN_HEALTH = ENEMY_HEALTH * 10;
  const PLAYER_HEALTH = 100;
  const SHOCK_SECONDS = 5;
  const GUARD_CALM_SECONDS = 6;
  const ATTACK_CHAIN_WINDOW = 4.5;
  const ATTACK_CHAIN_REQUIRED = 3;
  const ALERT_ATTACK_CHAIN_WINDOW = 6;
  const ALERT_ATTACK_CHAIN_REQUIRED = 6;
  const EVIDENCE_ATTENTION_SECONDS = 5;
  const ALERT_DECAY_SECONDS = 30;
  const BODY_RESPONSE_DELAY = 10;
  const SWAT_CALM_SECONDS = 30;
  const SWAT_COUNT = 3;
  const GANG_WAVE_SECONDS = 120;
  const GANG_WAVE_SIZE = 5;
  const GANG_HEALTH = 15;
  const GANG_DAMAGE = 1.5;
  const GANG_AGGRO_VISION = 460;
  const GANG_MEMORY_SECONDS = 8;
  const GANG_ENTRIES = [
    { x: 2320, y: 760 }, { x: 80, y: 760 }, { x: 1200, y: 80 }, { x: 2320, y: 1400 }
  ];
  const GANG_ANCHORS = [
    [300, 720], [520, 800], [760, 720], [900, 780], [1080, 760], [1240, 820], [1380, 760],
    [1520, 800], [1680, 740], [1860, 860], [2040, 940], [2200, 1040], [2260, 1240],
    [1900, 1420], [1500, 1410], [1120, 880], [1440, 980], [260, 960]
  ];
  const OBJECTIVES = [
    { id: "dawn", index: "I", name: "黎明印", place: "西北 · 档案馆", note: "让档案官签发，或搜查西北角发光档案箱，穿巡卫制服请撰写员签字", color: "#72c5ff" },
    { id: "solar", index: "II", name: "太阳芯", place: "东北 · 铸造庭", note: "制造停机条件并取得检修工单", color: "#f4c86a" },
    { id: "memory", index: "III", name: "记忆种", place: "南部 · 玻璃园", note: "让园丁确认守园兽已经沉睡", color: "#a99bff" }
  ];
  const BONUS_CONTRACTS = [
    { id: "clean", title: "不留下任何尸体", note: "击晕、诱离与回溯复活均可维持条件" },
    { id: "shadow", title: "警戒不超过 2 级", note: "关闭通信与处理证据比清场更重要" },
    { id: "paradox", title: "带走一件遗物重复体", note: "取得遗物后，尝试只重建遗物本身" },
    { id: "complete", title: "三件遗物全部撤离", note: "更长路线会经历更多城区变化" }
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const choose = list => list[Math.floor(Math.random() * list.length)];
  const distanceXY = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const distance = (a, b) => distanceXY(a.x, a.y, b.x, b.y);
  const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const deepCopy = value => JSON.parse(JSON.stringify(value));
  const formatTime = seconds => {
    const whole = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
  };

  class AudioEngine {
    constructor() { this.context = null; this.master = null; this.rewindNode = null; }
    enable() {
      try {
        if (!this.context) {
          this.context = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.context.createGain();
          this.master.gain.value = .22;
          this.master.connect(this.context.destination);
        }
        if (this.context.state === "suspended") this.context.resume();
        return true;
      } catch { return false; }
    }
    tone(frequency, duration = .08, type = "triangle", volume = .08, endFrequency = frequency) {
      if (!this.enable()) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain); gain.connect(this.master);
      oscillator.start(now); oscillator.stop(now + duration + .02);
    }
    rewind(active, rate = 1) {
      if (!this.enable()) return;
      if (active && !this.rewindNode) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = "sawtooth";
        oscillator.frequency.value = 75 + rate * 28;
        gain.gain.value = .025;
        oscillator.connect(gain); gain.connect(this.master); oscillator.start();
        this.rewindNode = { oscillator, gain };
      } else if (!active && this.rewindNode) {
        this.rewindNode.gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + .06);
        this.rewindNode.oscillator.stop(this.context.currentTime + .07);
        this.rewindNode = null;
      }
    }
  }

  let entitySerial = 0;
  class TemporalEntity {
    constructor(options) {
      Object.assign(this, {
        id: `entity-${++entitySerial}`,
        name: L("未命名因果体"),
        kind: "prop",
        x: 0, y: 0, vx: 0, vy: 0,
        r: 15, w: 30, h: 30,
        shape: "circle",
        rotation: 0,
        health: 40, maxHealth: 40,
        dead: false,
        dynamic: false,
        actor: false,
        carryable: false,
        rewindable: true,
        rewindRate: 1.65,
        team: "neutral",
        color: "#a8bbb5",
        state: {},
        route: [],
        history: [],
        historyClock: 0,
        rewindClock: 0,
        age: 0,
        carried: false
      }, options);
      this.capture();
    }
    snapshot() {
      return {
        x: this.x, y: this.y, vx: this.vx, vy: this.vy,
        rotation: this.rotation, health: this.health, dead: this.dead,
        carried: this.carried, state: deepCopy(this.state)
      };
    }
    capture() {
      if (!this.rewindable) return;
      this.history.push(this.snapshot());
      const maximum = Math.ceil((world?.historySeconds || BASE_HISTORY) / SNAP_DT);
      if (this.history.length > maximum) this.history.splice(0, this.history.length - maximum);
    }
    applySnapshot(snapshot) {
      this.x = snapshot.x; this.y = snapshot.y; this.vx = snapshot.vx; this.vy = snapshot.vy;
      this.rotation = snapshot.rotation; this.health = snapshot.health; this.dead = snapshot.dead;
      this.carried = snapshot.carried; this.state = deepCopy(snapshot.state);
    }
  }

  const audio = new AudioEngine();
  let viewW = innerWidth, viewH = innerHeight, dpr = 1, renderScale = 1, logicalViewW = innerWidth, logicalViewH = innerHeight;
  let entities = [], walls = [], zones = [], fires = [], gasClouds = [], noises = [], particles = [], floaters = [];
  let world = null, player = null, selectedTarget = null, rewindTarget = null;
  let playing = false, paused = false, resultShown = false, lastFrame = performance.now();
  const camera = { x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0 };
  const input = { keys: new Set(), pressed: new Set(), left: false, leftPressed: false, right: false, mouseX: innerWidth * .5, mouseY: innerHeight * .5, worldX: 0, worldY: 0 };

  function addEntity(options) {
    const entity = options instanceof TemporalEntity ? options : new TemporalEntity(options);
    entities.push(entity);
    return entity;
  }

  function addWall(x, y, w, h, district, color = "#223036") {
    const wall = { x, y, w, h, district, color };
    walls.push(wall);
    return wall;
  }

  function createDoor(name, x, y, w, h, options = {}) {
    return addEntity({
      name, kind: options.kind || "door", x, y, w, h, shape: "rect", health: options.health || 85,
      maxHealth: options.health || 85, color: options.color || "#7ba8a0", state: {
        open: !!options.open, locked: options.locked !== false, electric: !!options.electric,
        powerId: options.powerId || "", key: options.key || "", hack: 0, disabled: 0,
        alarm: options.alarm || "", glass: !!options.glass
      }
    });
  }

  function createGuard(name, x, y, route, options = {}) {
    const health = options.gang ? GANG_HEALTH : options.custodian ? CUSTODIAN_HEALTH : ENEMY_HEALTH;
    return addEntity({
      name, kind: options.kind || "guard", x, y, r: options.r || 16, dynamic: true, actor: true,
      team: options.team || "city", health, maxHealth: health,
      color: options.color || "#ef9a75", rotation: options.rotation || 0, route,
      state: {
        waypoint: 0, suspicion: 0, alert: false, radioed: false, lastSeenX: x, lastSeenY: y,
        shootCooldown: rand(.1, .8), stunned: 0, investigateX: x, investigateY: y,
        hasKey: options.key || "", rank: options.rank || L("巡卫"), vision: options.vision || 300,
        memoryPlayer: false, hitCooldown: 0, speed: options.speed || 118,
        uniform: options.uniform || "city", uniformTaken: false,
        evidenceTarget: "", verification: 0, reportProgress: 0, reportHinted: false,
        custodian: options.custodian || "", scribe: !!options.scribe,
        lastSeenAt: 0, lastHostilityAt: -99, lastAttackedAt: -99, calmTimer: 0,
        shockForgot: false, suspicionHinted: false, lockedHealth: false, swat: false,
        bodyId: "", retreating: false, exitX: x, exitY: y, retreatDeadline: 0, removed: false,
        bodyResponseScheduled: false, collected: false, noCorpse: false,
        gang: !!options.gang, combatTargetId: null, combatSince: 0, combatSeenAt: 0,
        combatSeenX: x, combatSeenY: y, roamX: x, roamY: y, roamUntil: 0,
        anchorX: x, anchorY: y, strafeSign: Math.random() < .5 ? -1 : 1,
        swatScanAt: 0, targetScanAt: 0, peaceUntil: 0
      }
    });
  }

  function createProp(name, kind, x, y, options = {}) {
    return addEntity({
      name, kind, x, y, r: options.r || 17, w: options.w || 34, h: options.h || 34,
      shape: options.shape || "circle", dynamic: true, carryable: options.carryable !== false,
      health: options.health || 38, maxHealth: options.health || 38, color: options.color || "#b4c2ae",
      state: { explosive: !!options.explosive, hitCooldown: 0, serial: options.serial || "", contents: options.contents || "", searchable: options.searchable || "", taken: false }
    });
  }

  function createArtifact(id, name, x, y, color, alarmRelay) {
    return addEntity({
      name, kind: "artifact", x, y, r: 19, dynamic: false, carryable: false, health: 35, maxHealth: 35,
      color, state: { artifactId: id, alarmRelay, secured: false, pulse: Math.random() * TAU }
    });
  }

  function createEvidence(x, y, evidenceType, name) {
    const evidence = addEntity({
      name, kind: "evidence", x, y, r: evidenceType === "casing" ? 5 : 9,
      dynamic: false, carryable: false, health: 1, maxHealth: 1, color: evidenceType === "casing" ? "#f4c86a" : "#a99bff",
      rewindRate: 2.2, state: { evidenceType, createdAt: world.time }
    });
    const alive = evidence.snapshot();
    const beforeCreation = deepCopy(alive); beforeCreation.dead = true;
    evidence.history = [beforeCreation, alive];
    world.evidence.push(evidence.id);
    return evidence;
  }

  function buildMap() {
    walls = []; zones = [];
    addWall(0, 0, WORLD_W, 48, "edge", "#182229");
    addWall(0, WORLD_H - 48, WORLD_W, 48, "edge", "#182229");
    addWall(0, 0, 48, WORLD_H, "edge", "#182229");
    addWall(WORLD_W - 48, 0, 48, WORLD_H, "edge", "#182229");

    zones.push({ id: "archive", name: L("档案馆"), x: 260, y: 180, w: 620, h: 440, restricted: true, color: "#132535" });
    addWall(260, 180, 620, 26, "archive", "#28445a");
    addWall(260, 594, 235, 26, "archive", "#28445a");
    addWall(640, 594, 240, 26, "archive", "#28445a");
    addWall(260, 180, 26, 440, "archive", "#28445a");
    addWall(854, 180, 26, 155, "archive", "#28445a");
    addWall(854, 435, 26, 185, "archive", "#28445a");
    addWall(430, 275, 260, 20, "archive", "#355269");
    addWall(430, 275, 20, 215, "archive", "#355269");
    addWall(670, 275, 20, 215, "archive", "#355269");
    addWall(430, 470, 88, 20, "archive", "#355269");
    addWall(622, 470, 68, 20, "archive", "#355269");

    zones.push({ id: "foundry", name: L("铸造庭"), x: 1460, y: 170, w: 680, h: 510, restricted: true, color: "#352217" });
    addWall(1460, 170, 680, 26, "foundry", "#5a3d2d");
    addWall(1460, 654, 250, 26, "foundry", "#5a3d2d");
    addWall(1850, 654, 290, 26, "foundry", "#5a3d2d");
    addWall(1460, 170, 26, 510, "foundry", "#5a3d2d");
    addWall(2114, 170, 26, 510, "foundry", "#5a3d2d");
    addWall(1760, 235, 20, 150, "foundry", "#6a4731");
    addWall(1760, 485, 20, 110, "foundry", "#6a4731");
    addWall(1760, 235, 310, 20, "foundry", "#6a4731");
    addWall(2050, 235, 20, 360, "foundry", "#6a4731");
    addWall(1760, 575, 310, 20, "foundry", "#6a4731");

    zones.push({ id: "garden", name: L("玻璃园"), x: 650, y: 900, w: 750, h: 430, restricted: true, color: "#1d2931" });
    addWall(650, 900, 330, 22, "garden", "#31505b");
    addWall(1120, 900, 280, 22, "garden", "#31505b");
    addWall(650, 1308, 750, 22, "garden", "#31505b");
    addWall(650, 900, 22, 430, "garden", "#31505b");
    addWall(1378, 900, 22, 160, "garden", "#31505b");
    addWall(1378, 1180, 22, 150, "garden", "#31505b");
    addWall(910, 1045, 300, 18, "garden", "#3b5d68");
    addWall(910, 1045, 18, 205, "garden", "#3b5d68");
    addWall(1192, 1045, 18, 205, "garden", "#3b5d68");
    addWall(910, 1232, 100, 18, "garden", "#3b5d68");
    addWall(1115, 1232, 95, 18, "garden", "#3b5d68");

    zones.push({ id: "safehouse", name: L("无灯旅舍"), x: 70, y: 1080, w: 390, h: 310, restricted: false, color: "#182326" });
    addWall(70, 1080, 390, 20, "safehouse", "#243337");
    addWall(70, 1370, 390, 20, "safehouse", "#243337");
    addWall(70, 1080, 20, 310, "safehouse", "#243337");
    addWall(440, 1080, 20, 110, "safehouse", "#243337");
    addWall(440, 1290, 20, 100, "safehouse", "#243337");
  }

  function buildEntities() {
    entities = []; fires = []; gasClouds = []; noises = []; particles = []; floaters = [];

    player = addEntity({
      name: L("回溯者"), kind: "player", x: 380, y: 1260, r: 16, dynamic: true, actor: true,
      team: "player", health: PLAYER_HEALTH, maxHealth: PLAYER_HEALTH, color: "#78f0d0", rewindRate: 1.8,
      state: { crouching: false, dash: 0, shotCooldown: 0, recentShot: 0, invulnerable: 0, deathAt: 0 }
    });

    const archiveRelay = addEntity({ name: L("档案馆电网继电器"), kind: "relay", x: 925, y: 245, w: 38, h: 46, shape: "rect", health: 45, maxHealth: 45, color: "#72c5ff", state: { on: true, disabled: 0, network: "archive" } });
    const foundryRelay = addEntity({ name: L("铸造庭动力继电器"), kind: "relay", x: 2200, y: 280, w: 38, h: 46, shape: "rect", health: 55, maxHealth: 55, color: "#f4c86a", state: { on: true, disabled: 0, network: "foundry" } });
    world.relays = { archive: archiveRelay.id, foundry: foundryRelay.id };

    world.doors = [
      createDoor(L("档案馆电控卷门"), 567, 607, 144, 26, { electric: true, powerId: "archive", alarm: "archive", health: 100, color: "#72c5ff" }),
      createDoor(L("档案馆侧门"), 867, 385, 26, 100, { key: "archive", alarm: "archive", health: 75, color: "#7193ad" }),
      createDoor(L("黎明印保险栅"), 570, 480, 104, 20, { kind: "case", key: "archive", alarm: "archive", health: 52, color: "#72c5ff", glass: true }),
      createDoor(L("铸造庭重门"), 1780, 667, 140, 26, { electric: true, powerId: "foundry", key: "foundry", alarm: "foundry", health: 120, color: "#f4c86a" }),
      createDoor(L("玻璃园北门"), 1050, 911, 140, 22, { key: "garden", alarm: "garden", health: 48, color: "#a99bff", glass: true }),
      createDoor(L("玻璃园侧门"), 1389, 1120, 22, 120, { key: "garden", alarm: "garden", health: 48, color: "#a99bff", glass: true }),
      createDoor(L("记忆种培养栅"), 1062, 1241, 105, 18, { kind: "case", key: "garden", alarm: "garden", health: 42, color: "#a99bff", glass: true })
    ];

    world.valve = addEntity({ name: L("铸造庭泄压阀"), kind: "valve", x: 1575, y: 575, r: 19, health: 55, maxHealth: 55, color: "#f4c86a", state: { open: false } });
    world.gasControl = addEntity({ name: L("温室沉睡气体阀"), kind: "gas", x: 755, y: 1005, r: 18, health: 40, maxHealth: 40, color: "#a99bff", state: { used: false, pressure: 100 } });
    world.escape = addEntity({ name: L("南码头撤离艇"), kind: "escape", x: 2180, y: 1270, r: 58, health: 999, maxHealth: 999, rewindable: false, color: "#78f0d0", state: { ready: false } });

    world.artifacts = {
      dawn: createArtifact("dawn", L("黎明印"), 560, 375, "#72c5ff", "archive"),
      solar: createArtifact("solar", L("太阳芯"), 1930, 405, "#f4c86a", "foundry"),
      memory: createArtifact("memory", L("记忆种"), 1060, 1145, "#a99bff", "garden")
    };

    world.cameras = [
      addEntity({ name: L("档案馆识别镜"), kind: "camera", x: 805, y: 235, r: 13, rotation: 2.1, health: 30, maxHealth: 30, color: "#72c5ff", state: { powerId: "archive", disabled: 0, scan: 0 } }),
      addEntity({ name: L("档案馆库室识别镜"), kind: "camera", x: 455, y: 320, r: 13, rotation: .3, health: 30, maxHealth: 30, color: "#72c5ff", state: { powerId: "archive", disabled: 0, scan: 0 } }),
      addEntity({ name: L("铸造庭热像镜"), kind: "camera", x: 2050, y: 625, r: 13, rotation: -2.3, health: 35, maxHealth: 35, color: "#f4c86a", state: { powerId: "foundry", disabled: 0, scan: 0 } })
    ];

    world.guards = [
      createGuard(L("档案官 伊莱"), 370, 520, [[370,520],[770,520],[760,235],[360,235]], { key: "archive", rank: L("档案官"), vision: 285, color: "#72c5ff", uniform: "archive", custodian: "dawn" }),
      createGuard(L("撰写员 佩尔"), 745, 330, [[745,330],[745,540],[520,540],[520,330]], { rank: L("撰写员"), vision: 245, speed: 92, color: "#8bb7cf", uniform: "archive", scribe: true }),
      createGuard(L("巡卫 塔恩"), 1000, 420, [[990,410],[1210,300],[1340,540],[1130,700]], { rank: L("巡卫"), vision: 310 }),
      createGuard(L("炉卫长 阿什"), 1650, 560, [[1640,560],[1680,250],[2020,290],[2010,610]], { key: "foundry", rank: L("炉卫长"), health: 95, vision: 330, color: "#f4c86a", speed: 108, uniform: "foundry", custodian: "solar" }),
      createGuard(L("炉卫 米卡"), 1910, 610, [[1910,610],[2050,500],[1900,280],[1530,300]], { rank: L("炉卫"), vision: 300, color: "#dc8b63", uniform: "foundry" }),
      createGuard(L("园丁 莫"), 760, 1190, [[760,1190],[760,980],[1300,980],[1310,1260]], { key: "garden", rank: L("园丁"), vision: 265, color: "#a99bff", speed: 100, uniform: "garden", custodian: "memory" }),
      createGuard(L("温室学徒 茵"), 1290, 1010, [[1290,1010],[1320,1260],[820,1260],[820,1010]], { rank: L("温室学徒"), vision: 235, speed: 88, color: "#b3a9e8", uniform: "garden" }),
      createGuard(L("街区巡卫"), 1250, 800, [[1240,800],[2050,850],[2220,1080],[1550,1180],[520,760]], { rank: L("机动巡卫"), vision: 330, speed: 132 })
    ];

    world.beast = addEntity({
      name: L("守园兽 灰苔"), kind: "beast", x: 1140, y: 1120, r: 23, dynamic: true, actor: true,
      team: "beast", health: 140, maxHealth: 140, color: "#9acb80", state: { asleep: false, stunned: 0, attackCooldown: 0, targetX: 1140, targetY: 1120, enraged: false }
    });

    const props = [
      [L("黎明印档案箱"), "crate", 400, 345, { color: "#7793a4", contents: L("黎明印移交档案"), searchable: "dawn", carryable: false }],
      [L("磁带箱"), "crate", 735, 555, { color: "#7793a4", contents: L("磁带") }],
      [L("压缩气罐"), "barrel", 1515, 520, { explosive: true, color: "#ff7069", health: 28 }],
      [L("压缩气罐"), "barrel", 1715, 310, { explosive: true, color: "#ff7069", health: 28 }],
      [L("铸铁料箱"), "crate", 1600, 270, { color: "#a98762", health: 55 }],
      [L("铸铁料箱"), "crate", 2000, 550, { color: "#a98762", health: 55 }],
      [L("肥料罐"), "barrel", 710, 1260, { explosive: true, color: "#bd9b64", health: 32 }],
      [L("园艺箱"), "crate", 1280, 1180, { color: "#718d75" }],
      [L("街边货箱"), "crate", 1120, 730, { color: "#778782" }],
      [L("街边货箱"), "crate", 1420, 1040, { color: "#778782" }],
      [L("燃料罐"), "barrel", 2050, 1010, { explosive: true, color: "#ff7069", health: 28 }]
    ];
    world.props = props.map(([name, kind, x, y, options], index) => createProp(name, kind, x, y, { ...options, serial: `C-${17 + index}` }));

    world.civilians = [
      addEntity({ name: L("报童"), kind: "civilian", x: 590, y: 780, r: 13, dynamic: true, actor: true, team: "civilian", health: 45, maxHealth: 45, color: "#c7b98c", route: [[590,780],[820,760],[1020,810],[760,850]], state: { waypoint: 0, panic: 0, speed: 72, stunned: 0 } }),
      addEntity({ name: L("夜班工人"), kind: "civilian", x: 1520, y: 790, r: 14, dynamic: true, actor: true, team: "civilian", health: 55, maxHealth: 55, color: "#b89b7c", route: [[1520,790],[1840,790],[2080,900],[1640,930]], state: { waypoint: 0, panic: 0, speed: 68, stunned: 0 } }),
      addEntity({ name: L("无灯旅舍老板"), kind: "informant", x: 320, y: 1260, r: 15, dynamic: false, actor: true, team: "civilian", health: 60, maxHealth: 60, color: "#d6c4a4", state: { spoke: false, stunned: 0 } })
    ];
  }

  function resetGame(begin = true) {
    entitySerial = 0;
    world = {
      time: 0, limit: 300, overtime: 30, alertScore: 0, alarms: 0, kills: 0, stuns: 0, cleanedEvidence: 0,
      propertyDamage: 0, explosions: 0, rewindCount: 0, rewoundKinds: new Set(), loot: new Set(),
      artifactOrder: [], duplicates: 0, keys: new Set(), archiveFile: false, chips: 2, tool: "rivet", carrying: null,
      historySeconds: BASE_HISTORY, rewindRange: 720, rivetDamage: 6, rivetStructureDamage: 26, detectionScale: 1,
      alertLevel: 0, lastMajorEventAt: 0, majorEvents: 0, attackChain: 0, lastAttackAt: -99, lastHostilityAt: -99,
      alertAttackChain: 0, lastAlertAttackAt: -99, nextGangWaveAt: GANG_WAVE_SECONDS, gangWaveCount: 0,
      bodySites: [], swatTeams: [], playerCorpseAt: 0,
      disguise: "", disguiseSource: "", burnedCovers: new Set(), evidence: [], discoveredEvidence: new Set(), discoveredBodies: new Set(),
      responseLevels: new Set(), reinforcements: [], contract: choose(BONUS_CONTRACTS), bonusFailed: false,
      authorizations: { dawn: false, solar: false, memory: false }, authorizationSigners: {},
      relays: {}, doors: [], guards: [], cameras: [], props: [], civilians: [], artifacts: {},
      valve: null, gasControl: null, beast: null, escape: null, courier: null, rivals: [],
      events: { audit: false, courier: false, purge: false, rivals: false, feeding: false, storm: false, lockdown: false },
      routine: { auditCloseAt: 0, auditClosed: false, purgeCloseAt: 0, purgeClosed: false },
      raining: false, lockdown: false, freeplay: false, playerDown: 0, eventHideAt: 0,
      eventSeed: Math.random(), mapPulse: 0, result: ""
    };
    buildMap(); buildEntities();
    selectedTarget = null; rewindTarget = null; paused = false; resultShown = false;
    camera.x = clamp(player.x - logicalViewW * .5, 0, WORLD_W - logicalViewW);
    camera.y = clamp(player.y - logicalViewH * .5, 0, WORLD_H - logicalViewH);
    ui.result.classList.add("hidden"); ui.pause.classList.add("hidden");
    ui.feed.innerHTML = ""; document.body.classList.remove("rewinding");
    playing = begin;
    renderObjectives();
    updateBonusContract();
    addFeed(L("目标已标记：<b>任取两件遗物，然后去南码头</b>。方法不计入任务条件。"), "");
    if (begin) showEvent("CONTRACT 00:05", L("今晚只规定结果"), L("三处目标均已开放；城区不会等待你逐个清理。"), 4.6);
  }

  function resize() {
    viewW = innerWidth; viewH = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(viewW * dpr); canvas.height = Math.round(viewH * dpr);
    canvas.style.width = `${viewW}px`; canvas.style.height = `${viewH}px`;
    renderScale = clamp(viewH / 900, .7, 1.18);
    logicalViewW = viewW / renderScale; logicalViewH = viewH / renderScale;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", event => {
    if (["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","Space","KeyE","KeyF","Digit1","Digit2","Escape"].includes(event.code)) event.preventDefault();
    if (!input.keys.has(event.code)) input.pressed.add(event.code);
    input.keys.add(event.code);
    if (event.code === "Escape" && ui.start.classList.contains("hidden") && ui.result.classList.contains("hidden")) togglePause();
    if (event.code === "Digit1") setTool("rivet");
    if (event.code === "Digit2") setTool("inductor");
  });
  window.addEventListener("keyup", event => input.keys.delete(event.code));
  window.addEventListener("mousemove", event => {
    input.mouseX = event.clientX; input.mouseY = event.clientY;
    ui.crosshair.style.left = `${event.clientX}px`; ui.crosshair.style.top = `${event.clientY}px`;
  });
  window.addEventListener("mousedown", event => {
    if (event.button === 0) { input.left = true; input.leftPressed = true; }
    if (event.button === 2) input.right = true;
  });
  window.addEventListener("mouseup", event => {
    if (event.button === 0) input.left = false;
    if (event.button === 2) { input.right = false; stopRewind(); }
  });
  window.addEventListener("contextmenu", event => event.preventDefault());
  window.addEventListener("blur", () => { input.keys.clear(); input.pressed.clear(); input.left = input.right = false; stopRewind(); });

  ui.startButton.addEventListener("click", () => { ui.start.classList.add("hidden"); resetGame(true); audio.tone(150, .32, "sine", .12, 410); });
  ui.restartButton.addEventListener("click", () => resetGame(true));
  ui.continueButton.addEventListener("click", () => { ui.result.classList.add("hidden"); world.freeplay = true; playing = true; resultShown = false; addFeed(L("零点账本已经写定；城区仍可继续实验。"), ""); });
  ui.tools.querySelectorAll(".tool").forEach(button => button.addEventListener("click", () => setTool(button.dataset.tool)));
  ui.tools.addEventListener("mousedown", event => event.stopPropagation());

  function togglePause() {
    if (!playing) return;
    paused = !paused; ui.pause.classList.toggle("hidden", !paused); stopRewind();
  }

  function setTool(tool) {
    world.tool = tool;
    ui.tools.querySelectorAll(".tool").forEach(button => button.classList.toggle("active", button.dataset.tool === tool));
    audio.tone(tool === "rivet" ? 230 : 410, .05, "square", .04, tool === "rivet" ? 150 : 650);
  }

  resize();
  resetGame(false);
  updateUI();
  const launchParams = new URLSearchParams(location.search);
  if (launchParams.has("qa")) {
    window.__heistQa = () => ({
      player: { x: player.x, y: player.y, health: player.health, dead: player.dead },
      camera: { x: camera.x, y: camera.y },
      scale: renderScale,
      view: { width: logicalViewW, height: logicalViewH },
      worldTime: world.time,
      entities: entities.length,
      loot: [...world.loot],
      actors: entities.filter(entity => entity.actor && !entity.dead).map(entity => ({ id: entity.id, name: entity.name, kind: entity.kind, team: entity.team, x: entity.x, y: entity.y, alert: !!entity.state?.alert })),
      artifacts: Object.values(world.artifacts).map(entity => ({ id: entity.id, name: entity.name, x: entity.x, y: entity.y })),
      doors: world.doors.map(entity => ({ name: entity.name, x: entity.x, y: entity.y, open: doorPassable(entity) }))
    });
  }
  if (launchParams.has("autostart") || launchParams.has("selftest")) {
    setTimeout(() => { ui.startButton.click(); if (launchParams.has("selftest")) setTimeout(runSelfTest, 650); }, 80);
  }

  function entityById(id) { return entities.find(entity => entity.id === id); }
  function relayFor(network) { return entityById(world.relays[network]); }
  function powerOn(network) {
    const relay = relayFor(network);
    return !!relay && !relay.dead && relay.state.on && (relay.state.disabled || 0) <= 0;
  }
  function doorPassable(door) {
    return door.dead || door.state.open || (door.state.electric && !powerOn(door.state.powerId)) || (door.state.disabled || 0) > 0;
  }
  function insideRect(x, y, rect, padding = 0) {
    return x >= rect.x - padding && x <= rect.x + rect.w + padding && y >= rect.y - padding && y <= rect.y + rect.h + padding;
  }
  function entityRect(entity) {
    return { x: entity.x - entity.w * .5, y: entity.y - entity.h * .5, w: entity.w, h: entity.h };
  }
  function activeSolids(except = null) {
    const solids = [...walls];
    for (const entity of world.doors) if (entity !== except && !doorPassable(entity)) solids.push(entityRect(entity));
    return solids;
  }
  function resolveCircleRect(actor, rect) {
    const nearestX = clamp(actor.x, rect.x, rect.x + rect.w);
    const nearestY = clamp(actor.y, rect.y, rect.y + rect.h);
    let dx = actor.x - nearestX, dy = actor.y - nearestY;
    let distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= actor.r * actor.r) return false;
    if (distanceSquared < .0001) {
      const left = Math.abs(actor.x - rect.x), right = Math.abs(rect.x + rect.w - actor.x);
      const top = Math.abs(actor.y - rect.y), bottom = Math.abs(rect.y + rect.h - actor.y);
      const minimum = Math.min(left, right, top, bottom);
      if (minimum === left) { dx = -1; dy = 0; distanceSquared = 1; }
      else if (minimum === right) { dx = 1; dy = 0; distanceSquared = 1; }
      else if (minimum === top) { dx = 0; dy = -1; distanceSquared = 1; }
      else { dx = 0; dy = 1; distanceSquared = 1; }
    }
    const currentDistance = Math.sqrt(distanceSquared);
    const overlap = actor.r - currentDistance + .1;
    actor.x += dx / currentDistance * overlap;
    actor.y += dy / currentDistance * overlap;
    if (Math.abs(dx) > Math.abs(dy)) actor.vx *= .15; else actor.vy *= .15;
    return true;
  }
  function moveCircle(actor, dt, collide = true) {
    const speed = Math.hypot(actor.vx, actor.vy);
    const steps = Math.max(1, Math.ceil(speed * dt / 12));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      actor.x += actor.vx * step; actor.y += actor.vy * step;
      if (collide) for (const rect of activeSolids()) resolveCircleRect(actor, rect);
      actor.x = clamp(actor.x, 48 + actor.r, WORLD_W - 48 - actor.r);
      actor.y = clamp(actor.y, 48 + actor.r, WORLD_H - 48 - actor.r);
    }
  }
  function segmentIntersectsRect(x1, y1, x2, y2, rect) {
    if (insideRect(x1, y1, rect) || insideRect(x2, y2, rect)) return true;
    const dx = x2 - x1, dy = y2 - y1;
    let t0 = 0, t1 = 1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - rect.x, rect.x + rect.w - x1, y1 - rect.y, rect.y + rect.h - y1];
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < .00001) { if (q[i] < 0) return false; }
      else {
        const ratio = q[i] / p[i];
        if (p[i] < 0) { if (ratio > t1) return false; if (ratio > t0) t0 = ratio; }
        else { if (ratio < t0) return false; if (ratio < t1) t1 = ratio; }
      }
    }
    return true;
  }
  function clearLine(x1, y1, x2, y2) {
    for (const rect of activeSolids()) if (segmentIntersectsRect(x1, y1, x2, y2, rect)) return false;
    return true;
  }
  function currentZone(entity) {
    return zones.find(zone => insideRect(entity.x, entity.y, zone)) || null;
  }
  function addNoise(x, y, radius, kind = "impact", maxInvestigators = 0) {
    const noise = { x, y, radius, kind, life: 1.15, maxLife: 1.15, attendees: null };
    if (maxInvestigators > 0) {
      const candidates = entities
        .filter(entity => !entity.dead && !entity.state?.removed && ["guard","courier","rival"].includes(entity.kind))
        .filter(entity => distanceXY(entity.x, entity.y, x, y) <= radius)
        .sort((a,b) => distanceXY(a.x,a.y,x,y) - distanceXY(b.x,b.y,x,y))
        .slice(0, maxInvestigators);
      noise.attendees = new Set(candidates.map(entity => entity.id));
    }
    noises.push(noise);
  }
  function addParticle(x, y, color, options = {}) {
    particles.push({ x, y, vx: options.vx ?? rand(-45,45), vy: options.vy ?? rand(-45,45), life: options.life || .55, maxLife: options.life || .55, size: options.size || rand(1.5,3.5), color });
  }
  function addFloater(x, y, text, color = "#e8eee8") { floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 }); }
  function addFeed(html, cls = "") {
    const node = document.createElement("div"); node.className = `feed-item ${cls}`; node.innerHTML = html;
    ui.feed.prepend(node); while (ui.feed.children.length > 5) ui.feed.lastElementChild.remove();
    setTimeout(() => { if (node.isConnected) node.remove(); }, 7000);
  }
  function showEvent(code, title, copy, duration = 4.2) {
    ui.eventCode.textContent = code; ui.eventTitle.textContent = title; ui.eventCopy.textContent = copy;
    ui.eventBanner.classList.remove("hidden"); world.eventHideAt = world.time + duration;
  }
  function raiseAlert(amount, reason, source = null) {
    world.alarms++;
    if (source?.state) { source.state.radioed = true; source.state.memoryPlayer = true; }
    addFeed(reason, amount >= 8 ? "bad" : "warn");
  }
  function alertLevel() { return clamp(world.alertLevel || 0, 0, 5); }
  function escalateCityAlert(reason, source = null) {
    const previous = alertLevel();
    world.alertLevel = clamp(previous + 1, 0, 5);
    world.alertScore = world.alertLevel * 20;
    world.lastMajorEventAt = world.time;
    world.majorEvents++;
    if (source?.state) { source.state.radioed = true; source.state.memoryPlayer = true; }
    if (world.alertLevel > previous) {
      camera.shake = Math.max(camera.shake, 5);
      audio.tone(150 + world.alertLevel * 22, .22, "square", .08, 90);
      addFeed(L`<b>全城警戒升至 ${world.alertLevel}</b> · ${reason}`, "bad");
      showEvent("CITY ALERT", L`${world.alertLevel} 级警戒`, L("爆炸、死亡与连续攻击会推高全城警戒；30 秒没有新的恶性事件后自动降一级。"), 4.2);
    } else addFeed(reason, "warn");
  }
  function updateCityAlert() {
    if (world.alertLevel > 0 && world.time - world.lastMajorEventAt >= ALERT_DECAY_SECONDS) {
      world.alertLevel--;
      world.alertScore = world.alertLevel * 20;
      world.lastMajorEventAt = world.time;
      addFeed(L`30 秒内没有新的恶性事件；全城警戒降至 ${world.alertLevel} 级。`, "");
    }
  }
  function patrolRange(guard) {
    return Math.max(110, (guard.state.vision || 300) * VISION_SCALE * world.detectionScale);
  }
  function guardsInPatrolRange(x, y, multiplier = 1) {
    return entities.filter(entity => !entity.dead && !entity.state?.removed && !entity.state?.gang &&
      (entity.kind === "guard" || entity.kind === "courier" || entity.kind === "rival") &&
      distanceXY(entity.x, entity.y, x, y) <= patrolRange(entity) * multiplier);
  }
  function setGuardHostile(guard, reason, silent = false) {
    if (!guard || guard.dead || guard.state?.removed || (guard.state.stunned || 0) > 0) return false;
    if (guard.state.swat) interruptSwatRetreat(guard);
    if (!guard.state.alert) guard.capture();
    guard.state.alert = true;
    guard.state.lastHostilityAt = world.time;
    guard.state.lastSeenAt = world.time;
    guard.state.lastSeenX = player.x;
    guard.state.lastSeenY = player.y;
    guard.state.calmTimer = 0;
    if (!silent) addFloater(guard.x, guard.y - 30, "HOSTILE", "#ff7069");
    return true;
  }
  function calmGuard(guard, forget = false) {
    if (!guard || guard.dead) return;
    clearCombatTarget(guard);
    guard.state.alert = false;
    guard.state.radioed = false;
    guard.state.reportProgress = 0;
    guard.state.reportHinted = false;
    guard.state.suspicion = 0;
    guard.state.suspicionHinted = false;
    guard.state.memoryPlayer = false;
    guard.state.lastSeenAt = world.time;
    guard.state.lastHostilityAt = -99;
    guard.state.calmTimer = 0;
    guard.state.investigateX = guard.x;
    guard.state.investigateY = guard.y;
    if (forget) {
      guard.state.shockForgot = false;
      guard.state.peaceUntil = world.time + 4;
      addFloater(guard.x, guard.y - 28, "FORGET", "#78f0d0");
    }
  }
  function notePlayerAttack(target, cause) {
    if (!target?.state) return;
    target.state.peaceUntil = 0;
    target.state.memoryPlayer = true;
    target.state.suspicion = Math.max(target.state.suspicion || 0, .85);
    target.state.lastSeenAt = world.time;
    target.state.lastSeenX = player.x;
    target.state.lastSeenY = player.y;
    if (target.state.swat) {
      interruptSwatRetreat(target);
      setGuardHostile(target, cause, true);
      target.state.lastAttackedAt = world.time;
      setCombatTarget(target, player);
    }
    else if (target.state.gang) setCombatTarget(target, player);
  }
  function alertGuardsInPatrolRange(x, y, reason, multiplier = 1) {
    let count = 0;
    for (const guard of guardsInPatrolRange(x, y, multiplier)) {
      if (setGuardHostile(guard, reason, true)) count++;
    }
    return count;
  }
  function recordAttack(kind = "attack") {
    if (world.time - world.lastAttackAt > ATTACK_CHAIN_WINDOW) world.attackChain = 0;
    world.attackChain++;
    world.lastAttackAt = world.time;
    if (world.time - (world.lastAlertAttackAt ?? -99) > ALERT_ATTACK_CHAIN_WINDOW) world.alertAttackChain = 0;
    world.alertAttackChain = (world.alertAttackChain || 0) + 1;
    world.lastAlertAttackAt = world.time;
    if (world.alertAttackChain === ALERT_ATTACK_CHAIN_REQUIRED - 1) addFeed(L("攻击链 5/6：下一次攻击将提升全城警戒。"), "warn");
    const cityAlert = world.alertAttackChain >= ALERT_ATTACK_CHAIN_REQUIRED;
    if (cityAlert) world.alertAttackChain = 0;
    if (world.attackChain >= ATTACK_CHAIN_REQUIRED && world.time - world.lastHostilityAt > .8) {
      world.attackChain = 0;
      world.lastHostilityAt = world.time;
      const count = alertGuardsInPatrolRange(player.x, player.y, L("连续 3 次攻击行为"), 1.45);
      addFeed(L`连续攻击触发敌意：<b>${count} 名巡卫进入敌对状态</b>。`, count ? "bad" : "warn");
      if (count) showEvent("HOSTILE RESPONSE", L("连续攻击已越过警戒线"), L("只有仍在巡查范围内的巡卫会响应；离开范围并保持冷静可让他们恢复正常路线。"), 3.8);
    }
    if (cityAlert) escalateCityAlert(L("连续 6 次攻击行为"));
  }

  function authorizationLabel(id){
    return id==="dawn"?L("档案移交单"):id==="solar"?L("停机检修工单"):L("生物安全确认");
  }
  function hasCredential(id){
    const uniform=id==="dawn"?"archive":id==="solar"?"foundry":"garden";
    const key=id==="dawn"?"archive":id==="solar"?"foundry":"garden";
    return world.keys.has("master")||world.keys.has(key)||(world.disguise===uniform&&!world.burnedCovers.has(uniform));
  }
  function authorizationReady(id,custodian=null){
    if(!hasCredential(id))return false;
    if(id==="dawn")return !!custodian?.state.handover||(world.events.audit&&world.routine.auditClosed);
    if(id==="solar")return !powerOn("foundry")||world.valve.state.open;
    return world.beast.state.asleep||(world.beast.state.stunned||0)>1.2;
  }
  function authorizationBlocker(id,custodian=null){
    if(authorizationReady(id,custodian))return "";
    if(!hasCredential(id))return L("缺少对应凭证");
    if(id==="dawn"&&!custodian?.state.handover)return L("等待 00:28 的档案交接时段，或回溯档案官取得交接记忆");
    if(id==="solar"&&powerOn("foundry")&&!world.valve.state.open)return L("铸造庭仍在供电；断开动力或打开泄压阀");
    if(id==="memory"&&!world.beast.state.asleep&&(world.beast.state.stunned||0)<=1.2)return L("守园兽仍清醒；先让它稳定沉睡");
    return "";
  }
  function hasPatrolUniform(){
    return world.disguise==="city"&&!world.burnedCovers.has("city");
  }
  function scribeBlockReason(){
    const missing=[];
    if(!world.archiveFile)missing.push(L("档案箱中的黎明印移交档案"));
    if(!hasPatrolUniform())missing.push(L("街区巡卫制服"));
    if(missing.length)return L`需要${missing.join(L("与"))}`;
    return "";
  }
  function issueScribeAuthorization(target,silent=false){
    if(!target?.state?.scribe)return false;
    if(target.dead||(target.state.stunned||0)>0){
      if(!silent)addFeed(L`${target.name}${target.dead?L("已经死亡，需要回溯恢复"):L("仍在昏迷，苏醒后才能核对档案")}。`,"warn");
      return true;
    }
    if(world.authorizations.dawn){
      if(!silent)addFeed(L`${target.name}确认：<b>黎明印移交单已经签发</b>。`);
      return true;
    }
    if(target.state.alert){
      if(!silent)addFeed(L`${target.name}正在警戒，无法核对档案。先让他恢复平静。`,"warn");
      return true;
    }
    const blocker=scribeBlockReason();
    if(blocker){
      if(!silent)addFeed(L`${target.name}拒绝签字：<b>${blocker}</b>。`,"warn");
      return true;
    }
    world.authorizations.dawn=true;world.authorizationSigners.dawn=target.id;
    if(!silent){
      addFeed(L`<b>${target.name}</b>核对了档案箱移交档案与街区巡卫制服，签发了<b>档案移交单</b>。`);
      showEvent("SOCIAL AUTHORIZATION",L("档案移交单已经生效"),L("档案、制服与签字记录彼此独立；即使回溯佩尔，已经写入账本的授权仍然存在。"),5.2);
      audio.tone(330,.32,"triangle",.08,680);renderObjectives();
    }
    return true;
  }
  function issueAuthorization(custodian,silent=false){
    if(custodian.state?.scribe)return issueScribeAuthorization(custodian,silent);
    const id=custodian.state.custodian;
    if(!id||world.authorizations[id])return false;
    if(custodian.dead||(custodian.state.stunned||0)>0)return false;
    if(custodian.state.alert){addFeed(L`${custodian.name}当前无法签字。可以恢复他的行动与个人记忆，再利用仍留在你手中的凭证。`,"warn");return true;}
    if(!hasCredential(id))return false;
    if(!authorizationReady(id,custodian)){
      const reason=authorizationBlocker(id,custodian);
      if(!silent)addFeed(L`${custodian.name}拒绝签字：<b>${reason}</b>。`,"warn");return true;
    }
    world.authorizations[id]=true;world.authorizationSigners[id]=custodian.id;
    if(!silent){addFeed(L`<b>${custodian.name}</b>签发了${authorizationLabel(id)}。现在即使只回溯签字者，城市记录仍然存在。`);showEvent("SOCIAL AUTHORIZATION",L`${authorizationLabel(id)}已经生效`,L("保管人的个人记忆可以返回过去；已经写入设施账本的授权不会连带消失。"),5.2);audio.tone(310,.32,"triangle",.08,650);renderObjectives();}return true;
  }
  function interactWithActor(target){
    if(!issueAuthorization(target))pickpocket(target);
  }

  function update(dt) {
    if (!playing || paused) return;
    world.time += dt;
    world.mapPulse += dt;
    updateDirector();
    updateSecurityResponse();
    updateCityAlert();
    updateBodyResponse();
    updateBonusContract();
    if (ui.eventBanner.classList.contains("hidden") === false && world.time > world.eventHideAt) ui.eventBanner.classList.add("hidden");

    input.worldX = camera.x + input.mouseX / renderScale;
    input.worldY = camera.y + input.mouseY / renderScale;

    if (input.right && !rewindTarget && selectedTarget) beginRewind(selectedTarget);
    if (!input.right && rewindTarget) stopRewind();

    if (rewindTarget === player) rewindEntity(player, dt); else updatePlayer(dt);
    updateCarrying(dt);

    for (const entity of entities) {
      entity.age += dt;
      if (entity === player || entity === rewindTarget) continue;
      if (entity.kind === "guard" || entity.kind === "rival" || entity.kind === "courier") updateGuard(entity, dt);
      else if (entity.kind === "civilian") updateCivilian(entity, dt);
      else if (entity.kind === "beast") updateBeast(entity, dt);
      else if (entity.kind === "camera") updateSecurityCamera(entity, dt);
      else if (entity.kind === "projectile") updateProjectile(entity, dt);
      else if (["crate","barrel","key","lure"].includes(entity.kind)) updateProp(entity, dt);
      else if (["relay","door","case"].includes(entity.kind) && entity.state.disabled > 0) entity.state.disabled = Math.max(0, entity.state.disabled - dt);
    }
    if (rewindTarget && rewindTarget !== player) rewindEntity(rewindTarget, dt);

    handleInteraction(dt);
    updateHazards(dt);
    updateTransient(dt);
    captureHistories(dt);
    selectTarget();
    updateCamera(dt);
    updateUI();

    input.pressed.clear(); input.leftPressed = false;
  }

  function updatePlayer(dt) {
    if (player.dead) {
      player.vx *= Math.pow(.04, dt); player.vy *= Math.pow(.04, dt); moveCircle(player, dt);
      world.playerDown += dt;
      if (world.playerDown > 10 && !world.freeplay) showResults(false, L("你没能从自己的倒下中回来。"));
      return;
    }
    world.playerDown = 0;
    if (player.state.invulnerable > 0) player.state.invulnerable -= dt;
    if (player.state.shotCooldown > 0) player.state.shotCooldown -= dt;
    if (player.state.recentShot > 0) player.state.recentShot -= dt;
    const x = (input.keys.has("KeyD") ? 1 : 0) - (input.keys.has("KeyA") ? 1 : 0);
    const y = (input.keys.has("KeyS") ? 1 : 0) - (input.keys.has("KeyW") ? 1 : 0);
    const magnitude = Math.hypot(x, y) || 1;
    const crouching = input.keys.has("ShiftLeft") || input.keys.has("ShiftRight");
    player.state.crouching = crouching;
    let speed = crouching ? 115 : 215;
    if (player.state.dash > 0) { player.state.dash -= dt; speed = 510; player.state.invulnerable = Math.max(player.state.invulnerable, .05); }
    else if (input.pressed.has("Space") && (x || y)) {
      player.state.dash = .16; speed = 510; audio.tone(105, .09, "triangle", .06, 55);
      for (let i = 0; i < 7; i++) addParticle(player.x, player.y, "#78f0d0", { vx: rand(-80,80), vy: rand(-80,80), life: .35 });
    }
    const targetVx = x / magnitude * speed, targetVy = y / magnitude * speed;
    const response = player.state.dash > 0 ? 18 : 11;
    player.vx = lerp(player.vx, targetVx, 1 - Math.exp(-response * dt));
    player.vy = lerp(player.vy, targetVy, 1 - Math.exp(-response * dt));
    if (!x && !y) { player.vx *= Math.pow(.0008, dt); player.vy *= Math.pow(.0008, dt); }
    if (x || y) player.rotation = Math.atan2(y, x);
    moveCircle(player, dt);

    if (world.loot.has("memory") && player.health < player.maxHealth && alertLevel() < 3) player.health = Math.min(player.maxHealth, player.health + dt * 1.8);
    if (input.left && player.state.shotCooldown <= 0 && !rewindTarget) useTool();
    if (input.pressed.has("KeyF")) toggleCarry();
  }

  function useTool() {
    const dx = input.worldX - player.x, dy = input.worldY - player.y;
    const length = Math.hypot(dx, dy) || 1;
    const tool = world.tool;
    const speed = tool === "rivet" ? 780 : 590;
    const projectile = addEntity({
      name: tool === "rivet" ? L("飞行铆钉") : L("感应针"), kind: "projectile",
      x: player.x + dx / length * 23, y: player.y + dy / length * 23,
      vx: dx / length * speed, vy: dy / length * speed, r: tool === "rivet" ? 5 : 7,
      dynamic: true, health: 1, maxHealth: 1, color: tool === "rivet" ? "#78f0d0" : "#a99bff",
      team: "player", rewindRate: 2.2, state: { tool, damage: tool === "rivet" ? 1 : 0, life: 1.65, spent: false, hitIds: [] }
    });
    projectile.rotation = Math.atan2(dy, dx);
    player.state.shotCooldown = tool === "rivet" ? .28 : .48;
    player.state.recentShot = .75;
    createEvidence(player.x - dx / length * 8 + rand(-4,4), player.y - dy / length * 8 + rand(-4,4), tool === "rivet" ? "casing" : "arc", tool === "rivet" ? L("铆钉弹壳") : L("感应灼痕"));
    addNoise(player.x, player.y, tool === "rivet" ? 390 : 130, tool === "rivet" ? "gunshot" : "pulse");
    camera.shake = Math.max(camera.shake, tool === "rivet" ? 3 : 1.5);
    audio.tone(tool === "rivet" ? 115 : 480, tool === "rivet" ? .07 : .13, tool === "rivet" ? "square" : "sine", .07, tool === "rivet" ? 55 : 170);
    recordAttack(tool);
  }

  function toggleCarry() {
    if (world.carrying) {
      const held = entityById(world.carrying);
      if (held) {
        const dx = input.worldX - player.x, dy = input.worldY - player.y, length = Math.hypot(dx, dy) || 1;
        held.carried = false; held.vx = dx / length * 470 + player.vx * .35; held.vy = dy / length * 470 + player.vy * .35;
        held.state.hitCooldown = 0; addNoise(player.x, player.y, 180, "throw"); recordAttack("throw");
        addFeed(L`抛出了 <b>${held.name}</b>。它的轨迹现在可以单独回溯。`);
      }
      world.carrying = null; return;
    }
    let nearest = null, best = 58;
    for (const entity of entities) {
      const d = distance(player, entity);
      if (!entity.dead && entity.carryable && !entity.carried && d < best) { nearest = entity; best = d; }
    }
    if (nearest) {
      nearest.carried = true; nearest.vx = nearest.vy = 0; world.carrying = nearest.id;
      addFeed(L`搬起了 <b>${nearest.name}</b> · F 向准星抛出。`);
      audio.tone(190, .08, "triangle", .045, 130);
    }
  }

  function updateCarrying() {
    if (!world.carrying) return;
    const held = entityById(world.carrying);
    if (!held || held.dead || player.dead || rewindTarget === held) {
      if (held) held.carried = false; world.carrying = null; return;
    }
    const angle = Math.atan2(input.worldY - player.y, input.worldX - player.x);
    held.x = player.x + Math.cos(angle) * (player.r + held.r + 9);
    held.y = player.y + Math.sin(angle) * (player.r + held.r + 9);
    held.vx = player.vx; held.vy = player.vy;
  }

  function updateProp(entity, dt) {
    if (entity.dead || entity.carried) return;
    if (entity.state.hitCooldown > 0) entity.state.hitCooldown -= dt;
    const speed = Math.hypot(entity.vx, entity.vy);
    if (speed > 4) {
      moveCircle(entity, dt);
      entity.vx *= Math.pow(.06, dt); entity.vy *= Math.pow(.06, dt);
      if (speed > 175 && entity.state.hitCooldown <= 0) {
        let impacted = false;
        for (const actor of entities.filter(candidate => candidate.actor && candidate !== player && !candidate.dead)) {
          if (distance(entity, actor) < entity.r + actor.r + 4) {
            damageEntity(actor, speed > 340 ? 32 : 15, entity, L("撞击"));
            actor.state.stunned = Math.max(actor.state.stunned || 0, speed > 300 ? 2.8 : 1.1);
            entity.state.hitCooldown = .32; entity.vx *= -.28; entity.vy *= -.28;
            addNoise(entity.x, entity.y, 260, "impact"); world.stuns++;
            impacted = true;
            break;
          }
        }
        if (!impacted) for (const door of world.doors) {
          if (doorPassable(door)) continue;
          const rect=entityRect(door),nx=clamp(entity.x,rect.x,rect.x+rect.w),ny=clamp(entity.y,rect.y,rect.y+rect.h);
          if (distanceXY(entity.x,entity.y,nx,ny)<=entity.r+3) {
            damageEntity(door,Math.max(8,speed*.085),entity,L("重物撞击"));
            entity.state.hitCooldown=.32;entity.vx*=-.32;entity.vy*=-.32;addNoise(entity.x,entity.y,330,"impact");
            break;
          }
        }
      }
    } else { entity.vx = entity.vy = 0; }
    if (entity.health <= 0 && !entity.dead) {
      if (entity.state.explosive) explode(entity); else { entity.dead = true; world.propertyDamage++; addNoise(entity.x, entity.y, 170, "break"); }
    }
  }

  function updateProjectile(projectile, dt) {
    if (projectile.dead || projectile.state.spent) return;
    projectile.state.life -= dt;
    if (projectile.state.life <= 0) { projectile.dead = true; projectile.state.spent = true; return; }
    const oldX = projectile.x, oldY = projectile.y;
    projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt;
    let hitSolid = null;
    for (const wall of walls) if (segmentIntersectsRect(oldX, oldY, projectile.x, projectile.y, wall)) { hitSolid = wall; break; }
    if (!hitSolid) {
      for (const door of world.doors) if (!doorPassable(door) && segmentIntersectsRect(oldX, oldY, projectile.x, projectile.y, entityRect(door))) { hitSolid = door; break; }
    }
    if (hitSolid) {
      if (hitSolid instanceof TemporalEntity) {
        if (projectile.state.tool === "rivet") damageEntity(hitSolid, world.rivetStructureDamage, projectile, L("结构射击"));
        else if (projectile.state.tool === "hostile") damageEntity(hitSolid, projectile.state.damage || 1, projectile, L("枪击"));
        else { hitSolid.state.disabled = Math.max(hitSolid.state.disabled || 0, 7); addFloater(hitSolid.x,hitSolid.y-20,"JAMMED","#a99bff"); }
      }
      projectile.dead = true; projectile.state.spent = true;
      for (let i = 0; i < 5; i++) addParticle(projectile.x, projectile.y, projectile.color, { life: .28 });
      return;
    }
    for (const target of entities) {
      if (target === projectile || target.dead || target === player && projectile.team === "player") continue;
      if (!target.actor && !["relay","camera","barrel","crate","gas","valve"].includes(target.kind)) continue;
      if (target.team === projectile.team && target.actor) continue;
      const radius = target.shape === "rect" ? Math.max(target.w, target.h) * .45 : target.r;
      if (distance(projectile, target) > radius + projectile.r) continue;
      if (projectile.state.tool === "inductor") {
        if (target.actor) {
          target.state.stunned=Math.max(target.state.stunned||0,SHOCK_SECONDS);
          target.state.shockForgot=true;
          target.state.reportProgress=0;
          world.stuns++;
          addFloater(target.x,target.y-24,"STUN 5s","#a99bff");
        }
        else { target.state.disabled = Math.max(target.state.disabled || 0, 8); addFloater(target.x, target.y - 24, "OFFLINE", "#a99bff"); }
      } else if (projectile.state.tool === "hostile") {
        damageEntity(target, projectile.state.damage || 1, projectile, L("枪击"));
      } else {
        damageEntity(target,target.actor?1:world.rivetStructureDamage,projectile,target.actor?L("铆钉压制"):L("结构射击"));
        if(target.actor){target.state.stunned=Math.max(target.state.stunned||0,.42);notePlayerAttack(target,L("铆钉压制"));addFloater(target.x,target.y-24,"SUPPRESSED","#f4c86a");}
        if(target.dynamic){const speed=target.actor?270:120;target.vx+=projectile.vx/Math.max(1,Math.hypot(projectile.vx,projectile.vy))*speed;target.vy+=projectile.vy/Math.max(1,Math.hypot(projectile.vx,projectile.vy))*speed;}
      }
      projectile.dead = true; projectile.state.spent = true; break;
    }
  }

  function damageEntity(target, amount, source, cause) {
    if (target.dead) return;
    if (target === player && player.state.invulnerable > 0) return;
    const playerCaused = source?.team === "player";
    if (target.state?.lockedHealth && target.team !== "player") {
      target.health = ENEMY_HEALTH;
      if (playerCaused) notePlayerAttack(target, cause);
      else noteNpcAttack(target, source);
      addFloater(target.x, target.y - 26, "LOCKED", "#f4c86a");
      return;
    }
    if (amount <= 0) return;
    target.health -= amount;
    if (amount >= 1) {
      addFloater(target.x, target.y - (target.r || target.h * .5) - 7, `-${Math.ceil(amount)}`, amount > 20 ? "#ff7069" : "#f4c86a");
      for (let i = 0; i < Math.min(8, Math.ceil(amount / 5)); i++) addParticle(target.x, target.y, target.color, { life: .32 });
    }
    if (target.actor && target !== player) {
      if (playerCaused) notePlayerAttack(target, cause);
      else noteNpcAttack(target, source);
    }
    if (target.kind === "relay" && target.health <= 0) { target.dead = true; world.propertyDamage++; addFeed(L`<b>${target.name}</b> 被毁，所属网络失去供电。`, "warn"); addNoise(target.x, target.y, 330, "power"); }
    if (target.kind === "camera" && target.health <= 0) { target.dead = true; world.propertyDamage++; addFeed(L`<b>${target.name}</b> 已离线。`, "warn"); }
    if (target.kind === "valve" && target.health <= 0) { target.dead = true; target.state.open = true; world.propertyDamage++; addNoise(target.x,target.y,310,"steam"); addFeed(L("泄压阀被打碎；铸造庭高温永久失去当前压力来源。"), "warn"); }
    if (target.kind === "gas" && target.health <= 0) {
      target.dead = true; world.propertyDamage++;
      if (target.state.pressure > 0) { gasClouds.push({x:1060,y:1145,r:235,life:20,maxLife:20}); target.state.pressure=0; }
      addNoise(target.x,target.y,260,"gas"); addFeed(L("沉睡气体阀破裂；气云已经离开容器。"), "warn");
    }
    if (target.kind === "artifact" && target.health <= 0) { target.dead = true; world.propertyDamage++; raiseAlert(12,L`${target.name}被毁；它仍有一段可供重建的历史`); }
    if (["door","case"].includes(target.kind) && target.health <= 0) {
      target.dead = true; target.state.open = true; world.propertyDamage++;
      addNoise(target.x, target.y, 430, "breach", 2); raiseAlert(8, L`${target.name}遭到强行破坏`);
    }
    if (target.kind === "barrel" && target.health <= 0) explode(target);
    if (target.actor && target.health <= 0) {
      target.dead = true; target.vx = target.vy = 0; target.state.deathAt = world.time; target.state.collected = false;
      for (const actor of entities) if (actor.state?.combatTargetId === target.id) clearCombatTarget(actor);
      if (target === player) {
        world.playerCorpseAt = world.time;
        addFeed(L("你倒下了。尸体留在原地：<b>把准星移到自己的身体上，按住右键回溯复活</b>；城区不会暂停。"), "bad");
        audio.tone(90, .7, "sine", .12, 38);
      }
      else {
        world.kills++;
        escalateCityAlert(L`${target.name}死亡（${cause}）`, target);
        if (target.state.hasKey) dropKey(target);
        if (["guard","courier","rival"].includes(target.kind) && !target.state.swat) scheduleBodyResponse(target);
      }
    }
  }

  function explode(entity) {
    if (entity.dead && entity.state.exploded) return;
    entity.dead = true; entity.state.exploded = true; world.explosions++; world.propertyDamage++;
    const radius = 155;
    for (const target of entities) {
      if (target === entity || target.dead) continue;
      const d = distance(entity, target);
      if (d < radius && clearLine(entity.x, entity.y, target.x, target.y)) {
        damageEntity(target, Math.max(8, 78 * (1 - d / radius)), entity, L("爆炸"));
        if (target.dynamic) { const nx = (target.x - entity.x) / (d || 1), ny = (target.y - entity.y) / (d || 1); target.vx += nx * 320; target.vy += ny * 320; }
      }
    }
    for (let i = 0; i < 4; i++) fires.push({ x: entity.x + rand(-55,55), y: entity.y + rand(-55,55), r: rand(24,43), life: rand(18,32), spread: rand(2.5,5), sourceId: entity.id });
    for (let i = 0; i < 35; i++) addParticle(entity.x, entity.y, choose(["#ff7069","#f4c86a","#d9d0af"]), { vx: rand(-260,260), vy: rand(-260,260), life: rand(.4,1.2), size: rand(2,6) });
    addNoise(entity.x, entity.y, 850, "explosion", 2);
    escalateCityAlert(L`${entity.name}爆炸；火势成为独立后果`, entity);
    camera.shake = Math.max(camera.shake, 16); audio.tone(72, .5, "sawtooth", .17, 28);
  }

  function dropKey(holder) {
    if (!holder.state.hasKey) return;
    addEntity({ name: keyLabel(holder.state.hasKey), kind: "key", x: holder.x + 10, y: holder.y + 8, r: 9, dynamic: true, carryable: false, health: 10, maxHealth: 10, color: "#f4c86a", state: { key: holder.state.hasKey, hitCooldown: 0 } });
    holder.state.hasKey = "";
  }

  function keyLabel(key) {
    return key === "master" ? L("巡城总钥") : key === "archive" ? L("档案钥匙") : key === "foundry" ? L("铸造钥匙") : L("温室钥匙");
  }

  function canSeeActor(observer, target, vision = null, fov = Math.PI * .58) {
    if (!observer || !target || observer.dead || target.dead || target.state?.removed) return false;
    const dx = target.x - observer.x, dy = target.y - observer.y;
    let range = (vision || observer.state.vision || 290) * VISION_SCALE;
    if (target === player) {
      const zone = currentZone(player);
      if (player.state.crouching) range *= .68;
      if (zone && zone.id === "archive" && !powerOn("archive")) range *= .58;
      if (zone && zone.id === "foundry" && !powerOn("foundry")) range *= .65;
    }
    range *= world.detectionScale;
    if (Math.hypot(dx, dy) > range) return false;
    const angle = Math.atan2(dy, dx);
    if (Math.abs(angleDelta(angle, observer.rotation)) > fov * .5) return false;
    return clearLine(observer.x, observer.y, target.x, target.y);
  }
  function canSeePlayer(observer, vision = null, fov = Math.PI * .58) {
    return canSeeActor(observer, player, vision, fov);
  }

  function isGangActor(actor) { return !!actor?.state?.gang; }
  function isLiveActor(entity) { return !!entity?.actor && !entity.dead && !entity.state?.removed; }
  function setCombatTarget(actor, target) {
    if (!actor?.state || !target) return;
    if (actor.state.combatTargetId !== target.id) actor.state.combatSince = world.time;
    actor.state.combatTargetId = target.id;
    actor.state.combatSeenAt = world.time;
    actor.state.combatSeenX = target.x; actor.state.combatSeenY = target.y;
  }
  function clearCombatTarget(actor) {
    if (!actor?.state) return;
    actor.state.combatTargetId = null;
    actor.state.combatSince = 0;
    actor.state.combatSeenAt = 0;
  }
  function resolveCombatTarget(actor, memory = GANG_MEMORY_SECONDS) {
    if (!actor?.state?.combatTargetId) return null;
    const target = entityById(actor.state.combatTargetId);
    if (!isLiveActor(target) || target === actor) { clearCombatTarget(actor); return null; }
    if (canSeeActor(actor, target)) {
      actor.state.combatSeenAt = world.time;
      actor.state.combatSeenX = target.x; actor.state.combatSeenY = target.y;
      return target;
    }
    if (world.time - (actor.state.combatSeenAt || actor.state.combatSince || 0) > memory) {
      clearCombatTarget(actor); return null;
    }
    return target;
  }
  function noteNpcAttack(target, source) {
    if (target === player || !target?.state) return;
    const attacker = entityById(source?.state?.ownerId) || source;
    if (!attacker?.actor || attacker === target || attacker === player || attacker.dead) return;
    if (attacker.team === target.team) return;
    target.state.peaceUntil = 0;
    setCombatTarget(target, attacker);
    if (target.state.swat) { interruptSwatRetreat(target); target.state.alert = true; target.state.lastAttackedAt = world.time; }
  }
  function gangTargetPriority(target) {
    if (target.team === "city" && !target.state.swat) return 0;
    if (target === player) return 1;
    if (target.team === "civilian") return 2;
    if (target.state.swat) return 3;
    if (target.team === "beast") return 4;
    return 5;
  }
  function chooseGangTarget(gang) {
    let best = null, bestScore = Infinity;
    for (const candidate of entities) {
      if (!isLiveActor(candidate) || candidate === gang || isGangActor(candidate)) continue;
      if (!canSeeActor(gang, candidate, GANG_AGGRO_VISION)) continue;
      const score = gangTargetPriority(candidate) * 10000 + distance(gang, candidate);
      if (score < bestScore) { best = candidate; bestScore = score; }
    }
    return best;
  }
  function chooseCityGangTarget(guard) {
    let best = null, bestD = Infinity;
    for (const candidate of entities) {
      if (!isLiveActor(candidate) || !isGangActor(candidate)) continue;
      if (!canSeeActor(guard, candidate)) continue;
      const d = distance(guard, candidate);
      if (d < bestD) { best = candidate; bestD = d; }
    }
    return best;
  }
  function swatTargetCandidates(swat) {
    return entities.filter(candidate => isLiveActor(candidate) && candidate !== swat && candidate.team !== "swat" &&
      (candidate === player || candidate.team === "city" || isGangActor(candidate)) &&
      canSeeActor(swat, candidate, 600));
  }
  function engageActor(actor, target, dt, options = {}) {
    if (!isLiveActor(target)) { clearCombatTarget(actor); return; }
    const visible = canSeeActor(actor, target, options.vision || null);
    if (visible) {
      actor.state.combatSeenAt = world.time;
      actor.state.combatSeenX = target.x; actor.state.combatSeenY = target.y;
    }
    const targetX = visible ? target.x : (actor.state.combatSeenX ?? target.x);
    const targetY = visible ? target.y : (actor.state.combatSeenY ?? target.y);
    const d = distanceXY(actor.x, actor.y, targetX, targetY);
    if (d > 1) actor.rotation = Math.atan2(targetY - actor.y, targetX - actor.x);
    if (visible && d < (options.shootRange || 410) && actor.state.shootCooldown <= 0) actorShoot(actor, target);
    if (options.keepDistance) {
      if (d < (options.minDistance || 150)) {
        const away = Math.atan2(actor.y - target.y, actor.x - target.x) || rand(0, TAU);
        steerToward(actor, actor.x + Math.cos(away) * 120, actor.y + Math.sin(away) * 120, actor.state.speed * 1.12, dt);
      } else if (d > (options.maxDistance || 300) || !visible) {
        steerToward(actor, targetX, targetY, actor.state.speed * 1.16, dt);
      } else {
        const strafe = Math.atan2(target.y - actor.y, target.x - actor.x) + Math.PI * .5 * (actor.state.strafeSign || 1);
        steerToward(actor, actor.x + Math.cos(strafe) * 90, actor.y + Math.sin(strafe) * 90, actor.state.speed * .62, dt);
        if (Math.random() < dt * .25) actor.state.strafeSign = -(actor.state.strafeSign || 1);
      }
    } else if (d > (options.stopDistance || 105) || !visible) {
      steerToward(actor, targetX, targetY, actor.state.speed * (visible ? 1.3 : 1.05), dt);
    } else {
      actor.vx *= Math.pow(.02, dt); actor.vy *= Math.pow(.02, dt);
    }
  }

  function uniformLabel(uniform){return uniform==="archive"?L("档案官制服"):uniform==="foundry"?L("炉卫制服"):uniform==="garden"?L("园丁制服"):uniform==="city"?L("街区巡卫制服"):L("无");}
  function coverValid(zone){
    if(!world.disguise||world.burnedCovers.has(world.disguise)||!zone?.restricted)return false;
    return world.disguise===zone.id;
  }
  function coverViolation(observer){
    return player.state.recentShot>0||!!world.carrying||Math.hypot(player.vx,player.vy)>245||distance(observer,player)<38||observer.id===world.disguiseSource&&!observer.state.uniformTaken;
  }

  function nearestNoise(observer, ignoreAttendees = false) {
    let best = null, bestD = Infinity;
    for (const noise of noises) {
      if (!ignoreAttendees && noise.attendees && !noise.attendees.has(observer.id)) continue;
      const d = distanceXY(observer.x, observer.y, noise.x, noise.y);
      if (d < noise.radius && d < bestD) { best = noise; bestD = d; }
    }
    return best;
  }

  function steerToward(entity, x, y, speed, dt) {
    const dx = x - entity.x, dy = y - entity.y, length = Math.hypot(dx, dy) || 1;
    entity.vx = lerp(entity.vx, dx / length * speed, 1 - Math.exp(-8 * dt));
    entity.vy = lerp(entity.vy, dy / length * speed, 1 - Math.exp(-8 * dt));
    if (length > 2) entity.rotation = Math.atan2(dy, dx);
    moveCircle(entity, dt);
    return length;
  }

  function openNearbyDoorFor(actor) {
    for (const door of world.doors) {
      if (doorPassable(door) || distance(actor, door) > 52) continue;
      if (!door.state.locked || actor.team === "city" || actor.team === "swat" || actor.state.hasKey === "master" || actor.state.hasKey === door.state.key) {
        door.state.open = true;
        if (actor.team === "city" || actor.team === "swat") door.state.locked = false;
      }
    }
  }

  function nearestEvidenceFor(guard) {
    if (guard.team !== "city" || guard.dead || guard.state.alert) return null;
    let best=null,bestD=170;
    for(const candidate of entities){
      if(candidate===guard)continue;
      let key="",severity=0;
      if(candidate.state?.collected||candidate.state?.noCorpse)continue;
      if(candidate.kind==="evidence"&&!candidate.dead){
        if(candidate.state.evidenceType==="casing"&&world.time-candidate.state.createdAt>=EVIDENCE_ATTENTION_SECONDS)continue;
        key=`evidence:${candidate.id}`;severity=candidate.state.evidenceType==="casing"?5:3;
      }
      else if(["guard","courier","rival"].includes(candidate.kind)&&candidate.dead&&!candidate.state?.swat){key=`body:${candidate.id}`;severity=16;}
      else if(["door","case","camera","relay"].includes(candidate.kind)&&candidate.dead){key=`damage:${candidate.id}`;severity=8;}
      else continue;
      if(world.discoveredEvidence.has(key)||world.discoveredBodies.has(key))continue;
      const d=distance(guard,candidate);if(d<bestD&&clearLine(guard.x,guard.y,candidate.x,candidate.y)){best={entity:candidate,key,severity};bestD=d;}
    }
    return best;
  }

  function inspectEvidence(guard,dt){
    const clue=nearestEvidenceFor(guard);if(!clue)return false;
    const d=distance(guard,clue.entity);guard.state.evidenceTarget=clue.entity.id;
    if(d>32){steerToward(guard,clue.entity.x,clue.entity.y,guard.state.speed*.78,dt);return true;}
    if(clue.key.startsWith("body:"))world.discoveredBodies.add(clue.key);else world.discoveredEvidence.add(clue.key);
    guard.state.suspicion = Math.max(guard.state.suspicion || 0, .8);
    guard.state.investigateX = clue.entity.x; guard.state.investigateY = clue.entity.y;
    guard.state.lastSeenAt=world.time;guard.state.lastSeenX=clue.entity.x;guard.state.lastSeenY=clue.entity.y;
    raiseAlert(clue.severity,clue.key.startsWith("body:")?L`${guard.name}发现了同僚尸体`:L`${guard.name}发现了${clue.entity.name}`,guard);
    return true;
  }

  function spawnResponseGuard(name,x,y,route,options={}){
    const guard=createGuard(name,x,y,route,{rank:options.rank||L("增援巡卫"),vision:options.vision||340,speed:options.speed||142,health:options.health||82,color:options.color||"#ff8a78",uniform:options.uniform||"city"});
    guard.state.alert=true;guard.state.radioed=true;guard.state.lastSeenAt=world.time;guard.state.lastHostilityAt=world.time;guard.state.lastSeenX=player.x;guard.state.lastSeenY=player.y;
    world.guards.push(guard);world.reinforcements.push(guard.id);return guard;
  }

  function updateSecurityResponse(){
    const level=alertLevel();
    if(level>=2&&!world.responseLevels.has(2)){
      world.responseLevels.add(2);
      spawnResponseGuard(L("调查员 西门"),90,790,[[520,790],[1040,760],[player.x,player.y]],{rank:L("痕迹调查员"),speed:130});
      spawnResponseGuard(L("调查员 东门"),2310,900,[[2050,900],[1540,840],[player.x,player.y]],{rank:L("痕迹调查员"),speed:130});
      showEvent("RESPONSE LEVEL II",L("痕迹调查组进入街区"),L("尸体、弹壳和遭到破坏的设备会引导他们改变路线。"),4.8);
    }
    if(level>=3&&!world.responseLevels.has(3)){
      world.responseLevels.add(3);
      for(const door of world.doors)if(!door.dead&&!door.state.open){door.state.locked=true;}
      showEvent("RESPONSE LEVEL III",L("目标区开始局部封门"),L("封门后的每扇门仍拥有独立历史，但正面战斗正在制造更多工作。"),5);
    }
    if(level>=4&&!world.responseLevels.has(4)){
      world.responseLevels.add(4);
      spawnResponseGuard(L("零点猎手 一"),1180,80,[[1180,500],[900,780],[player.x,player.y]],{rank:L("零点猎手"),vision:390,speed:168,health:115,color:"#ff7069"});
      spawnResponseGuard(L("零点猎手 二"),2310,1230,[[1950,1120],[1500,900],[player.x,player.y]],{rank:L("零点猎手"),vision:390,speed:168,health:115,color:"#ff7069"});
      showEvent("RESPONSE LEVEL IV",L("零点猎手获准实弹介入"),L("他们更快、更耐击；环境与身份比交换火力更可靠。"),5.2);
    }
    if(level>=5&&!world.responseLevels.has(5)){
      world.responseLevels.add(5);
      spawnResponseGuard(L("码头封锁官"),2250,1170,[[2250,1170],[2080,1270],[1880,1110]],{rank:L("封锁官"),vision:420,speed:176,health:130,color:"#ff5c58"});
      showEvent("RESPONSE LEVEL V",L("撤离区进入猎杀状态"),L("任务仍可完成，但所有暴力后果已经汇聚到了出口。"),5.5);
    }
  }

  function scheduleBodyResponse(body) {
    if (!body || body.state.swat || body.state.bodyResponseScheduled || body.team === "player") return;
    if (!["guard","courier","rival"].includes(body.kind)) return;
    body.state.bodyResponseScheduled = true;
    world.bodySites.push({ id: body.id, x: body.x, y: body.y, at: world.time + BODY_RESPONSE_DELAY, spawned: false, collected: false });
    addFeed(L`<b>${body.name}</b> 的尸体留在原地；10 秒后会有 ${SWAT_COUNT} 名特警前来收尸。`, "bad");
  }

  function spawnSwatTeam(site) {
    const exits = [
      { x: 80, y: clamp(site.y, 120, WORLD_H - 120) },
      { x: WORLD_W - 80, y: clamp(site.y, 120, WORLD_H - 120) },
      { x: clamp(site.x, 120, WORLD_W - 120), y: 80 },
      { x: clamp(site.x, 120, WORLD_W - 120), y: WORLD_H - 80 }
    ];
    const base = exits.sort((a,b) => distanceXY(a.x,a.y,site.x,site.y) - distanceXY(b.x,b.y,site.x,site.y))[0];
    for (let i = 0; i < SWAT_COUNT; i++) {
      const sx = clamp(base.x + (i - 1) * 34, 70, WORLD_W - 70);
      const sy = clamp(base.y + (i - 1) * 34, 70, WORLD_H - 70);
      const guard = createGuard(L`收尸特警 ${i + 1}`, sx, sy, [[site.x, site.y], [sx, sy]], {
        rank: L("收尸特警"), vision: 600, speed: 150, color: "#ff5c58", team: "swat"
      });
      guard.state.swat = true;
      guard.state.lockedHealth = true;
      guard.state.bodyId = site.id;
      guard.state.alert = false;
      guard.state.radioed = true;
      guard.state.lastAttackedAt = -99;
      guard.state.exitX = sx; guard.state.exitY = sy;
      world.guards.push(guard); world.swatTeams.push(guard.id);
    }
    showEvent("BODY RESPONSE", L("三名特警进入城区收尸"), L("他们视野是普通巡卫的两倍、伤害更高且锁血；被攻击后会在各阵营间随机索敌，并需要 30 秒平静才会撤退。"), 5.2);
    addFeed(L("三名特警前来收尸。他们不主动攻击，除非遭到攻击；交火后会随机索敌玩家、普通角色与帮派。"), "bad");
  }

  function updateBodyResponse() {
    for (const site of world.bodySites) {
      if (site.spawned) continue;
      if (world.time < site.at) continue;
      const body = entityById(site.id);
      site.spawned = true;
      if (body && body.dead) spawnSwatTeam(site);
      else addFeed(L("收尸队失去目标：尸体已经从时间线上消失。"), "warn");
    }
  }

  function updateSwat(guard, dt) {
    guard.state.shootCooldown -= dt;
    if (guard.state.alert) {
      if (world.time - (guard.state.lastAttackedAt || -99) >= SWAT_CALM_SECONDS) {
        calmGuard(guard);
        beginSwatRetreat(guard);
        addFloater(guard.x, guard.y - 30, "WITHDRAW", "#78f0d0");
      } else {
        let target = resolveCombatTarget(guard, GANG_MEMORY_SECONDS);
        if (!target || world.time >= (guard.state.swatScanAt || 0)) {
          const candidates = swatTargetCandidates(guard);
          if (candidates.length) {
            target = choose(candidates);
            setCombatTarget(guard, target);
          }
          guard.state.swatScanAt = world.time + rand(.9, 1.7);
        }
        if (target) engageActor(guard, target, dt, { stopDistance: 120, shootRange: 520, vision: 600 });
        else { guard.vx *= Math.pow(.02, dt); guard.vy *= Math.pow(.02, dt); }
        openNearbyDoorFor(guard);
        return;
      }
    }
    const site = world.bodySites.find(candidate => candidate.id === guard.state.bodyId);
    const body = site ? entityById(site.id) : null;
    if (!guard.state.retreating && site && body && body.dead && !site.collected) {
      const d = steerToward(guard, body.x, body.y, guard.state.speed, dt);
      if (d < 44) {
        site.collected = true; body.state.collected = true;
        beginSwatRetreat(guard);
        addFeed(L`<b>特警收走了 ${body.name} 的尸体</b>。`, "bad");
      }
    } else beginSwatRetreat(guard);
    if (guard.state.retreating) {
      if (world.time >= guard.state.retreatDeadline) {
        guard.state.removed = true; guard.state.noCorpse = true; guard.dead = true;
        return;
      }
      const d = steerToward(guard, guard.state.exitX, guard.state.exitY, guard.state.speed * 1.08, dt);
      if (d < 36) { guard.state.removed = true; guard.state.noCorpse = true; guard.dead = true; }
    }
    openNearbyDoorFor(guard);
  }

  function beginSwatRetreat(guard) {
    if (!guard || guard.state.retreating) return;
    guard.state.retreating = true;
    guard.state.retreatDeadline = world.time + 8;
  }
  function interruptSwatRetreat(guard) {
    if (!guard?.state?.retreating) return;
    guard.state.retreating = false;
    guard.state.retreatDeadline = 0;
  }

  function updateGuard(guard, dt) {
    if (guard.dead || guard.state.removed) return;
    if ((guard.state.disabled || 0) > 0) guard.state.disabled -= dt;
    if ((guard.state.hitCooldown || 0) > 0) guard.state.hitCooldown -= dt;
    if ((guard.state.stunned || 0) > 0) {
      guard.state.stunned -= dt;
      guard.vx *= Math.pow(.02, dt); guard.vy *= Math.pow(.02, dt); moveCircle(guard, dt);
      if (guard.state.stunned <= 0 && guard.state.shockForgot) {
        calmGuard(guard, true);
        if (guard.state.swat) beginSwatRetreat(guard);
      }
      return;
    }
    if (guard.state.swat) { updateSwat(guard, dt); return; }
    if (guard.state.gang) { updateGang(guard, dt); return; }
    guard.state.shootCooldown -= dt;
    if (!guard.state.alert) {
      let enemy = resolveCombatTarget(guard, GUARD_CALM_SECONDS);
      if (!enemy && world.time >= (guard.state.targetScanAt || 0)) {
        guard.state.targetScanAt = world.time + rand(.25, .45);
        enemy = chooseCityGangTarget(guard);
        if (enemy) setCombatTarget(guard, enemy);
      }
      if (enemy) {
        engageActor(guard, enemy, dt, { stopDistance: 105, shootRange: 410 });
        openNearbyDoorFor(guard);
        return;
      }
    }
    if(inspectEvidence(guard,dt))return;
    const sees = canSeePlayer(guard);
    if (sees) {
      guard.state.lastSeenAt = world.time;
      guard.state.lastSeenX = player.x; guard.state.lastSeenY = player.y;
      guard.state.memoryPlayer = true;
    }
    if (guard.state.alert && !sees && world.time - (guard.state.lastSeenAt || 0) >= GUARD_CALM_SECONDS) {
      calmGuard(guard);
      addFloater(guard.x, guard.y - 28, "CALM", "#78f0d0");
    }
    const zone = currentZone(player);
    const validCover=guard.team==="city"&&coverValid(zone),violation=validCover&&coverViolation(guard);
    if (!guard.state.alert) {
      const suspiciousPresence = guard.kind === "rival" || (!!zone?.restricted && (!validCover || violation));
      if (sees && suspiciousPresence) {
        guard.state.suspicion = Math.min(1.25, guard.state.suspicion + dt * (player.state.crouching ? .35 : .75));
        if (guard.state.suspicion > .95 && !guard.state.suspicionHinted) {
          guard.state.suspicionHinted = true;
          addFloater(guard.x, guard.y - 30, "?", "#f4c86a");
        }
      } else {
        guard.state.suspicion = Math.max(0, guard.state.suspicion - dt * .36);
        if (guard.state.suspicion <= .2) guard.state.suspicionHinted = false;
      }
    }

    const heard = nearestNoise(guard);
    if (heard && !guard.state.alert) {
      guard.state.investigateX = heard.x; guard.state.investigateY = heard.y;
      if (["gunshot","explosion","breach"].includes(heard.kind)) guard.state.suspicion = Math.max(guard.state.suspicion, .42);
    }

    if (guard.state.alert) {
      if (!guard.state.radioed && guard.team === "city") {
        guard.state.reportProgress=(guard.state.reportProgress||0)+dt;
        if(!guard.state.reportHinted){guard.state.reportHinted=true;addFeed(L`<b>${guard.name}</b>正在呼叫中枢（2 秒）。现在回溯他可以截断报告。`,"bad");addFloater(guard.x,guard.y-30,"REPORTING","#ff7069");}
        if(guard.state.reportProgress>=2){guard.state.reportProgress=0;guard.state.reportHinted=false;raiseAlert(12,L`${guard.name}完成了身份报告`,guard);}
      }
      const targetX = sees ? player.x : guard.state.lastSeenX;
      const targetY = sees ? player.y : guard.state.lastSeenY;
      const d = distanceXY(guard.x, guard.y, targetX, targetY);
      if (sees && d < 410 && guard.state.shootCooldown <= 0) actorShoot(guard, player);
      if (d > 105 || !sees) steerToward(guard, targetX, targetY, guard.state.speed * 1.32, dt);
      else { guard.vx *= Math.pow(.02, dt); guard.vy *= Math.pow(.02, dt); }
    } else if (distanceXY(guard.x, guard.y, guard.state.investigateX, guard.state.investigateY) > 28 && heard) {
      guard.state.reportProgress=0;guard.state.reportHinted=false;
      steerToward(guard, guard.state.investigateX, guard.state.investigateY, guard.state.speed * .9, dt);
    } else if (guard.route.length) {
      guard.state.reportProgress=0;guard.state.reportHinted=false;
      const point = guard.route[guard.state.waypoint % guard.route.length];
      if (steerToward(guard, point[0], point[1], guard.state.speed, dt) < 18) guard.state.waypoint = (guard.state.waypoint + 1) % guard.route.length;
    }
    openNearbyDoorFor(guard);
  }

  function updateGang(gang, dt) {
    gang.state.shootCooldown -= dt;
    if (world.time >= (gang.state.peaceUntil || 0)) {
      let target = resolveCombatTarget(gang, GANG_MEMORY_SECONDS);
      if (!target && world.time >= (gang.state.targetScanAt || 0)) {
        gang.state.targetScanAt = world.time + rand(.25, .5);
        target = chooseGangTarget(gang);
        if (target) setCombatTarget(gang, target);
      }
      if (target) {
        gang.state.alert = true;
        gang.state.lastHostilityAt = world.time;
        engageActor(gang, target, dt, {
          keepDistance: true, minDistance: 150, maxDistance: 300,
          shootRange: 420, vision: GANG_AGGRO_VISION
        });
        openNearbyDoorFor(gang);
        return;
      }
    }
    const anchorX = gang.state.anchorX ?? gang.x, anchorY = gang.state.anchorY ?? gang.y;
    const roamX = gang.state.roamX ?? anchorX, roamY = gang.state.roamY ?? anchorY;
    const d = distanceXY(gang.x, gang.y, roamX, roamY);
    if (d > 26) steerToward(gang, roamX, roamY, gang.state.speed * .56, dt);
    else {
      gang.vx *= Math.pow(.08, dt); gang.vy *= Math.pow(.08, dt);
      if (world.time >= (gang.state.roamUntil || 0)) {
        gang.state.roamX = anchorX; gang.state.roamY = anchorY;
        for (let i = 0; i < 8; i++) {
          const x = anchorX + rand(-90, 90), y = anchorY + rand(-65, 65);
          if (isPointClear(x, y, 18)) { gang.state.roamX = x; gang.state.roamY = y; break; }
        }
        gang.state.roamUntil = world.time + rand(4.5, 8.5);
        gang.rotation = rand(0, TAU);
      }
    }
    openNearbyDoorFor(gang);
  }

  function actorShoot(guard, target = player) {
    if (!isLiveActor(target)) return;
    const dx = target.x - guard.x, dy = target.y - guard.y, length = Math.hypot(dx, dy) || 1;
    const spread = rand(-.055,.055), cosine = Math.cos(spread), sine = Math.sin(spread);
    const nx = (dx / length) * cosine - (dy / length) * sine;
    const ny = (dx / length) * sine + (dy / length) * cosine;
    const damage = guard.state.swat ? 2 : isGangActor(guard) ? GANG_DAMAGE : 1;
    addEntity({
      name: L`${guard.name}的弹丸`, kind: "projectile", x: guard.x + nx * 21, y: guard.y + ny * 21,
      vx: nx * 560, vy: ny * 560, r: 5, dynamic: true, health: 1, maxHealth: 1,
      team: guard.team, color: isGangActor(guard) ? "#a99bff" : "#ff7069", rewindRate: 2.35,
      state: { tool: "hostile", damage, life: 2, spent: false, hitIds: [], ownerId: guard.id }
    });
    guard.state.shootCooldown = guard.state.swat ? .72 : isGangActor(guard) ? .78 : .92;
    addNoise(guard.x, guard.y, 430, "gunshot"); audio.tone(95, .055, "square", .045, 48);
  }

  function updateCivilian(civilian, dt) {
    if (civilian.dead || civilian.kind === "informant") return;
    if ((civilian.state.stunned || 0) > 0) { civilian.state.stunned -= dt; civilian.vx *= Math.pow(.03, dt); civilian.vy *= Math.pow(.03, dt); return; }
    const heard = nearestNoise(civilian, true);
    if (heard) civilian.state.panic = Math.max(civilian.state.panic, 4.5);
    if (civilian.state.panic > 0) {
      civilian.state.panic -= dt;
      const dx = civilian.x - (heard?.x ?? player.x), dy = civilian.y - (heard?.y ?? player.y), length = Math.hypot(dx, dy) || 1;
      steerToward(civilian, civilian.x + dx / length * 100, civilian.y + dy / length * 100, civilian.state.speed * 2.1, dt);
    } else if (civilian.route.length) {
      const point = civilian.route[civilian.state.waypoint % civilian.route.length];
      if (steerToward(civilian, point[0], point[1], civilian.state.speed, dt) < 15) civilian.state.waypoint = (civilian.state.waypoint + 1) % civilian.route.length;
    }
  }

  function updateBeast(beast, dt) {
    if (beast.dead) return;
    if ((beast.state.stunned || 0) > 0) { beast.state.stunned -= dt; beast.vx *= Math.pow(.02, dt); beast.vy *= Math.pow(.02, dt); return; }
    const inGas = gasClouds.some(cloud => distanceXY(beast.x, beast.y, cloud.x, cloud.y) < cloud.r);
    if (inGas) { beast.state.asleep = true; beast.state.stunned = Math.max(beast.state.stunned, .35); return; }
    if (beast.state.asleep) return;
    beast.state.attackCooldown -= dt;
    const lure=entities.find(entity=>entity.kind==="lure"&&!entity.dead),lureNear=lure&&distance(beast,lure)<480;
    const candidates = entities.filter(entity => entity.actor && !entity.dead && entity !== beast && entity.kind !== "civilian" && distance(beast, entity) < (lureNear?170:410));
    let target = candidates.sort((a,b) => distance(beast,a) - distance(beast,b))[0];
    const heard = nearestNoise(beast, true);
    if (target) {
      const d = steerToward(beast, target.x, target.y, beast.state.enraged ? 210 : 165, dt);
      if (d < beast.r + target.r + 8 && beast.state.attackCooldown <= 0) {
        damageEntity(target, 4.8, beast, L("守园兽撕咬")); target.vx += Math.cos(beast.rotation) * 250; target.vy += Math.sin(beast.rotation) * 250;
        beast.state.attackCooldown = 1.05; addNoise(beast.x, beast.y, 320, "beast");
      }
    } else if(lureNear)steerToward(beast,lure.x,lure.y,135,dt);
    else if (heard) steerToward(beast, heard.x, heard.y, 145, dt);
    else steerToward(beast, beast.state.targetX, beast.state.targetY, 70, dt);
  }

  function updateSecurityCamera(cameraEntity, dt) {
    if (cameraEntity.dead) return;
    cameraEntity.state.disabled = Math.max(0, (cameraEntity.state.disabled || 0) - dt);
    if (!powerOn(cameraEntity.state.powerId) || cameraEntity.state.disabled > 0) return;
    cameraEntity.rotation += dt * .46;
    cameraEntity.state.reportCooldown = Math.max(0, (cameraEntity.state.reportCooldown || 0) - dt);
    const zone=currentZone(player),validCover=coverValid(zone),acceptedCover=validCover&&!coverViolation(cameraEntity);
    if (canSeePlayer(cameraEntity, 390, Math.PI * .42) && !acceptedCover) {
      cameraEntity.state.scan += dt * (player.state.crouching ? .5 : 1.35);
      if (cameraEntity.state.scan > .55 && cameraEntity.state.reportCooldown <= 0) {
        cameraEntity.state.scan = 0; cameraEntity.state.reportCooldown = 2;
        const count = alertGuardsInPatrolRange(player.x, player.y, L`${cameraEntity.name}确认目标`, 1);
        raiseAlert(14, count ? L`${cameraEntity.name}记录了你的位置；${count} 名巡查范围内的巡卫转入敌对` : L`${cameraEntity.name}确认目标，但附近没有巡卫处于巡查范围内`, cameraEntity);
        if (validCover && coverViolation(cameraEntity)) {
          world.burnedCovers.add(world.disguise); world.bonusFailed = world.contract.id === "shadow";
          addFeed(L`<b>${uniformLabel(world.disguise)}</b> 已被监控识破；该身份不会因回溯一名巡卫而恢复。`, "bad");
        }
      }
    } else cameraEntity.state.scan = Math.max(0, cameraEntity.state.scan - dt);
  }

  function updateHazards(dt) {
    const heatActive = powerOn("foundry") && !world.valve.dead && !world.valve.state.open;
    if (heatActive) {
      const heatRect = { x: 1780, y: 255, w: 270, h: 320 };
      for (const entity of entities) if (entity.actor && !entity.dead && insideRect(entity.x, entity.y, heatRect)) damageEntity(entity, dt * (entity === player ? 24 : 17), world.valve, L("铸造高温"));
      if (Math.random() < dt * 9) addParticle(rand(1790,2040), rand(270,565), choose(["#f4c86a","#ff7069"]), { vy: rand(-45,-15), vx: rand(-10,10), life: rand(.5,1.2), size: rand(2,5) });
    }
    for (let i = fires.length - 1; i >= 0; i--) {
      const fire = fires[i];
      fire.life -= dt * (world.raining ? 2.4 : 1);
      fire.spread -= dt;
      if (fire.life <= 0) { fires.splice(i,1); continue; }
      if (fire.spread <= 0 && fires.length < 18) {
        fire.spread = rand(3.2,5.8);
        fires.push({ x: fire.x + rand(-70,70), y: fire.y + rand(-70,70), r: rand(18,34), life: rand(10,20), spread: rand(3,6), sourceId: fire.sourceId });
      }
      for (const entity of entities) if (!entity.dead && distanceXY(entity.x, entity.y, fire.x, fire.y) < fire.r + (entity.r || 12)) damageEntity(entity, dt * 10, null, L("火灾"));
      if (Math.random() < dt * 5) addParticle(fire.x + rand(-fire.r*.5,fire.r*.5), fire.y + rand(-fire.r*.4,fire.r*.4), choose(["#ff7069","#f4c86a"]), { vy: rand(-55,-18), vx: rand(-15,15), life: rand(.35,.8), size: rand(2,5) });
    }
    for (let i = gasClouds.length - 1; i >= 0; i--) { gasClouds[i].life -= dt; if (gasClouds[i].life <= 0) gasClouds.splice(i,1); }
  }

  function updateTransient(dt) {
    for (let i = noises.length - 1; i >= 0; i--) { noises[i].life -= dt; if (noises[i].life <= 0) noises.splice(i,1); }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i]; particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= Math.pow(.1,dt); particle.vy *= Math.pow(.1,dt);
      if (particle.life <= 0) particles.splice(i,1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].life -= dt; floaters[i].y -= 18 * dt; if (floaters[i].life <= 0) floaters.splice(i,1); }
    for (const entity of entities) if (entity.state?.disabled > 0 && !["camera","relay","door","case"].includes(entity.kind)) entity.state.disabled = Math.max(0, entity.state.disabled - dt);
  }

  function updateDirector() {
    if(!world.events.audit&&world.time>=28){world.events.audit=true;const door=world.doors[1],custodian=world.guards.find(guard=>guard.state.custodian==="dawn");if(!door.dead){door.state.locked=false;door.state.open=true;}if(custodian)custodian.state.handover=true;world.routine.auditCloseAt=world.time+12;showEvent("ARCHIVE ROUTINE 00:28",L("档案官开始交接签字"),L("侧门与签字窗口同时开放。错过后，可分别回溯门和档案官重组这个机会。"),5.5);}
    if(world.events.audit&&!world.routine.auditClosed&&world.time>=world.routine.auditCloseAt){world.routine.auditClosed=true;const door=world.doors[1],custodian=world.guards.find(guard=>guard.state.custodian==="dawn");if(!door.dead){door.state.open=false;door.state.locked=true;}if(custodian)custodian.state.handover=false;addFeed(L("档案交接结束：侧门与档案官都保留了刚才的个人历史。"),"warn");}
    if (!world.events.courier && world.time >= 48) { world.events.courier = true; spawnCourier(); }
    if(!world.events.purge&&world.time>=80){world.events.purge=true;world.valve.state.open=true;world.routine.purgeCloseAt=world.time+13;showEvent("FOUNDRY ROUTINE 01:20",L("铸造庭进入自动泄压"),L("高温区暂时冷却。阀门稍后会自行复位，也可以被干预。"),5);}
    if(world.events.purge&&!world.routine.purgeClosed&&world.time>=world.routine.purgeCloseAt){world.routine.purgeClosed=true;if(!world.valve.dead)world.valve.state.open=false;addFeed(L("铸造庭自动泄压结束；高温正在恢复。"),"warn");}
    while (world.time >= world.nextGangWaveAt) {
      spawnGangWave();
      world.nextGangWaveAt += GANG_WAVE_SECONDS;
    }
    if(!world.events.feeding&&world.time>=138){world.events.feeding=true;const lure=createProp(L("守园兽饲料筐"),"lure",760,960,{color:"#9acb80",health:24});world.props.push(lure);world.beast.state.targetX=lure.x;world.beast.state.targetY=lure.y;showEvent("GARDEN ROUTINE 02:18",L("温室投喂开始"),L("饲料筐会吸引守园兽；它也是普通可搬物，可以被带去任何地方。"),5.5);}
    if (!world.events.storm && world.time >= 166) { world.events.storm = true; triggerStorm(); }
    if (!world.events.lockdown && world.time >= 226) { world.events.lockdown = true; triggerLockdown(); }
    if (world.time >= world.limit && !world.freeplay && !resultShown) {
      world.lockdown = true;
      if (world.time < world.limit + world.overtime) {
        ui.phaseName.textContent = L("零点封锁");
      } else showResults(false, L("撤离艇离港，零点账本封存了你的失败。 "));
    }
  }

  function spawnCourier() {
    const reverse = world.eventSeed > .5;
    const route = reverse ? [[2240,760],[1880,790],[1350,760],[900,720],[110,690]] : [[110,690],[700,720],[1260,760],[1850,790],[2240,760]];
    world.courier = createGuard(L("巡城钥匙信使"), route[0][0], route[0][1], route, { kind: "courier", key: "master", rank: L("信使"), vision: 235, speed: 155, health: 58, color: "#78f0d0", team: "city" });
    showEvent("MOVING OPPORTUNITY 00:48", L("总钥匙正在穿过主街"), L("偷、击晕、诱入冲突，或者完全无视它。信使不会等在原地。"), 5.5);
    addFeed(L("移动机会：<b>巡城总钥匙</b>进入街区。"), "warn");
  }

  function isPointClear(x, y, radius = 22) {
    if (x < 48 + radius || x > WORLD_W - 48 - radius || y < 48 + radius || y > WORLD_H - 48 - radius) return false;
    for (const rect of activeSolids()) {
      const nx = clamp(x, rect.x, rect.x + rect.w), ny = clamp(y, rect.y, rect.y + rect.h);
      if ((x - nx) ** 2 + (y - ny) ** 2 < radius * radius) return false;
    }
    return true;
  }
  function randomGangSpawnPoints(count) {
    const pool = GANG_ANCHORS.filter(([x, y]) => isPointClear(x, y, 22) && distanceXY(x, y, player.x, player.y) > 210);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = pool.slice(0, count);
    while (selected.length < count) {
      const fallback = GANG_ENTRIES[selected.length % GANG_ENTRIES.length];
      selected.push([fallback.x + rand(-18, 18), fallback.y + rand(-18, 18)]);
    }
    return selected;
  }
  function spawnGangWave() {
    world.gangWaveCount++;
    world.events.rivals = true;
    const points = randomGangSpawnPoints(GANG_WAVE_SIZE);
    for (let i = 0; i < GANG_WAVE_SIZE; i++) {
      const [x, y] = points[i];
      const rival = createGuard(L`玻璃帮 打手 ${world.gangWaveCount}-${i + 1}`, x, y, [[x, y]], {
        kind: "rival", rank: L("帮派打手"), vision: GANG_AGGRO_VISION, speed: 148,
        color: "#a99bff", team: "rival", gang: true, uniform: "none", key: i === 0 ? "master" : ""
      });
      rival.state.alert = true; rival.state.radioed = true;
      rival.state.anchorX = x; rival.state.anchorY = y;
      rival.state.roamX = x + rand(-45, 45); rival.state.roamY = y + rand(-35, 35);
      rival.state.roamUntil = world.time + rand(2, 5);
      rival.state.strafeSign = Math.random() < .5 ? -1 : 1;
      world.rivals.push(rival.id);
    }
    showEvent("GANG WAVE", L`玻璃帮第 ${world.gangWaveCount} 波进入街区`, L("五名帮派成员潜伏到可达街口；他们优先攻击普通角色，也会向玩家与特警开火。"), 5.8);
    addFeed(L`五名玻璃帮成员进入城区：<b>${GANG_HEALTH} 生命 / ${GANG_DAMAGE} 伤害</b>，攻击除同伴外所有人。`, "bad");
  }

  function triggerStorm() {
    world.raining = true;
    for (const id of Object.values(world.relays)) { const relay = entityById(id); if (relay && !relay.dead) relay.state.on = false; }
    showEvent("WEATHER FRONT 02:46", L("导电雨切断了两处电网"), L("火势正在减弱，电控门失压。回溯单个继电器可以让局部重新通电。"), 6);
    addFeed(L("暴雨造成全城断电；已经打开的门和已经触发的警报不受影响。"), "warn");
  }

  function triggerLockdown() {
    world.lockdown = true;
    for (const door of world.doors) if (!door.dead) { door.state.open = false; door.state.locked = true; }
    showEvent("CITY LOCKDOWN 03:46", L("所有尚存的门重新锁闭"), L("封锁是全城事实，但每扇门仍保留自己锁闭前的历史。"), 6.5);
  }

  function handleInteraction(dt) {
    const interact = nearestInteractable();
    if (!interact) return;
    if (input.pressed.has("KeyE")) {
      if (interact.kind === "artifact") secureArtifact(interact);
      else if (interact.kind === "key") collectKey(interact);
      else if (interact.kind === "evidence") collectEvidence(interact);
      else if (interact.kind === "crate" && interact.state?.searchable) searchArchiveCrate(interact);
      else if (["relay","valve","gas"].includes(interact.kind)) operateDevice(interact);
      else if (["door","case"].includes(interact.kind)) operateDoor(interact);
      else if (["guard","courier","rival"].includes(interact.kind)) interactWithActor(interact);
      else if (interact.kind === "informant") speakInformant(interact);
      else if (interact.kind === "escape") attemptEscape();
    }
    if (input.keys.has("KeyE") && ["door","case"].includes(interact.kind) && interact.state.locked && !hasKeyFor(interact) && world.chips > 0) {
      interact.state.hack = (interact.state.hack || 0) + dt;
      if (Math.random() < dt * 12) addParticle(interact.x + rand(-interact.w*.4,interact.w*.4), interact.y + rand(-interact.h*.4,interact.h*.4), "#a99bff", { life: .3 });
      if (interact.state.hack >= 2.2) {
        interact.state.locked = false; interact.state.open = true; interact.state.hack = 0; world.chips--;
        addFeed(L`破解器烧毁；<b>${interact.name}</b> 已开启。`, "warn"); addNoise(interact.x, interact.y, 190, "hack"); audio.tone(520,.18,"square",.07,120);
      }
    }
  }

  function nearestInteractable() {
    let best = null, bestScore = Infinity;
    for (const entity of entities) {
      if (entity.state?.removed || entity.state?.collected || entity.carried) continue;
      const searchableCrate = entity.kind === "crate" && !!entity.state?.searchable && !entity.state.taken;
      if (entity.dead && !searchableCrate && !["guard","courier","rival"].includes(entity.kind)) continue;
      if (!searchableCrate && !["artifact","key","evidence","relay","valve","gas","door","case","guard","courier","rival","informant","escape"].includes(entity.kind)) continue;
      const limit = searchableCrate ? 96 : 66;
      const d = distance(player, entity);
      if (d >= limit) continue;
      const score = d / limit;
      if (score < bestScore) { bestScore = score; best = entity; }
    }
    return best;
  }

  function hasKeyFor(door) { return world.keys.has("master") || (door.state.key && world.keys.has(door.state.key)); }
  function operateDoor(door) {
    if (doorPassable(door) && door.state.electric && !powerOn(door.state.powerId)) { addFeed(L`${door.name}因断电保持失压；恢复供电会让它再次响应自身状态。`); return; }
    if (door.state.locked) {
      if (hasKeyFor(door)) {
        door.state.locked = false; door.state.open = true;
        addFeed(L`<b>${keyLabel(world.keys.has("master") ? "master" : door.state.key)}</b> 打开了 ${door.name}。钥匙留在你手中。`);
        audio.tone(360,.09,"triangle",.05,190);
      } else if (world.chips > 0) addFeed(L`按住 E 破解 ${door.name}（约 2 秒，消耗 1 枚破解器）。`, "warn");
      else addFeed(L`${door.name}已锁定：需要钥匙、断电或足够的破坏力。`, "warn");
    } else { door.state.open = !door.state.open; addNoise(door.x,door.y,80,"door"); }
  }

  function operateDevice(device) {
    if (device.kind === "relay") {
      device.state.on = !device.state.on;
      addFeed(L`<b>${device.name}</b>：${device.state.on ? L("恢复供电") : L("切断供电")}。`);
      addNoise(device.x,device.y,130,"power"); audio.tone(device.state.on?330:120,.14,"square",.05,device.state.on?620:55);
    } else if (device.kind === "valve") {
      device.state.open = !device.state.open;
      addFeed(L`铸造庭泄压阀${device.state.open ? L("开启，高温正在下降") : L("关闭，高温区重新升温")}。`, device.state.open ? "" : "warn");
      addNoise(device.x,device.y,230,"steam");
    } else if (device.kind === "gas" && device.state.pressure > 0) {
      device.state.used = true; device.state.pressure = Math.max(0, device.state.pressure - 50);
      gasClouds.push({ x: 1060, y: 1145, r: 210, life: 17, maxLife: 17 });
      addFeed(L("沉睡气体进入温室。气云是已经释放的外部后果。"), "warn");
      addNoise(device.x,device.y,150,"gas");
    }
  }

  function pickpocket(target) {
    if (!target.state.hasKey) {
      if((target.dead||(target.state.stunned||0)>0)&&!target.state.uniformTaken&&target.state.uniform!=="none"){takeUniform(target);return;}
      addFeed(L`${target.name}身上没有仍可偷取的钥匙或制服。`); return;
    }
    const incapacitated = target.dead || (target.state.stunned || 0) > 0;
    const facingToPlayer = Math.abs(angleDelta(Math.atan2(player.y-target.y,player.x-target.x), target.rotation));
    if (target.state.alert && !incapacitated) { addFeed(L`${target.name}正在警戒，无法直接偷取。可以先击晕或制造干扰。`, "warn"); return; }
    if (facingToPlayer < 1.65 && !incapacitated) { addFeed(L`需要从 ${target.name} 身后接近，或者先让其失去行动能力。`, "warn"); return; }
    const key = target.state.hasKey; target.state.hasKey = ""; world.keys.add(key);
    addFeed(L`偷到了 <b>${keyLabel(key)}</b>。回溯持有者不会从你手中取回它。`);
    addFloater(target.x,target.y-28,"PICKPOCKET","#78f0d0"); audio.tone(520,.08,"sine",.05,760);
  }

  function takeUniform(target){
    if(target.state.uniform==="none")return;
    target.state.uniformTaken=true;world.disguise=target.state.uniform||"city";world.disguiseSource=target.id;
    addFeed(L`换上 <b>${uniformLabel(world.disguise)}</b>。对应区域会暂时接受身份，近距离核验、奔跑、携带重物或开火会暴露。`);
    addFloater(target.x,target.y-28,"UNIFORM","#78f0d0");audio.tone(280,.12,"triangle",.05,520);
  }

  function collectEvidence(evidence){
    evidence.dead=true;world.cleanedEvidence++;addFeed(L`收起了 <b>${evidence.name}</b>。已经被报告的警戒不会因此撤销。`);audio.tone(440,.06,"triangle",.04,620);
  }

  function collectKey(keyEntity) {
    world.keys.add(keyEntity.state.key); keyEntity.dead = true;
    addFeed(L`拾取 <b>${keyLabel(keyEntity.state.key)}</b>。`); audio.tone(490,.08,"triangle",.05,740);
  }

  function searchArchiveCrate(crate){
    if(crate.state.taken||!crate.state.searchable)return;
    crate.state.taken=true;
    if(crate.state.searchable==="dawn"){
      world.archiveFile=true;
      addFeed(L`从<b>${crate.name}${crate.dead?L("残骸"):""}</b>中取得<b>${crate.state.contents||L("黎明印移交档案")}</b>。还需要街区巡卫制服，才能请撰写员佩尔签字。`);
      addFloater(crate.x,crate.y-28,"ARCHIVE FILE","#72c5ff");
      audio.tone(430,.14,"triangle",.06,660);
      return;
    }
    addFeed(L`从<b>${crate.name}</b>中取得<b>${crate.state.contents||L("档案")}</b>。`);
    audio.tone(390,.1,"triangle",.05,520);
  }

  function speakInformant(informant) {
    if (!informant.state.spoke) {
      informant.state.spoke = true;
      addFeed(L("老板：<b>“门只记得自己开没开，不记得是谁拿走了钥匙。”</b>"));
    } else addFeed(L("老板：信使会沿主街走；温室里的东西比守卫更容易被噪声骗走。 "));
  }

  function secureArtifact(artifact) {
    const id = artifact.state.artifactId;
    if (world.loot.has(id)) {
      world.duplicates++; artifact.dead = true; artifact.state.secured = true;
      raiseAlert(15, L`${artifact.name}出现了无法解释的第二份`);
      addFeed(L`<b>${artifact.name}的重复体</b>已收入袋中；目标记录没有增加，但账本会记住悖论。`, "bad");
      return;
    }
    if(!world.authorizations[id]){
      raiseAlert(7,L`${artifact.name}拒绝脱离基座：缺少社会授权`);
      const signer=id==="dawn"?L("档案官"):id==="solar"?L("炉卫长"):L("园丁");
      addFeed(L`<b>${artifact.name}无法直接取得</b>：先让${signer}在可信条件下签发${authorizationLabel(id)}。砸开房间并不会伪造账本。`,"bad");
      return;
    }
    world.loot.add(id); world.artifactOrder.push(id); artifact.dead = true; artifact.state.secured = true;
    const powered = artifact.state.alarmRelay && powerOn(artifact.state.alarmRelay);
    if (powered) raiseAlert(18, L`${artifact.name}离开基座时触发了安保网络`);
    if (id === "dawn") { world.historySeconds = 12; world.rewindRange = 1050; addFeed(L("<b>黎明印</b>：个人历史延长至 12 秒，回溯距离扩大。"), ""); }
    if (id === "solar") { world.rivetDamage = 10; world.rivetStructureDamage = 44; addFeed(L("<b>太阳芯</b>：铆钉推力与结构破坏强化，但它仍不是高效杀人工具。"), ""); }
    if (id === "memory") { world.detectionScale = .62; addFeed(L("<b>记忆种</b>：你的轮廓更难被视线确认，脱战时缓慢恢复。"), ""); }
    showEvent("ARTIFACT SECURED", L`${artifact.name}已成为你的本局成长`, id === "dawn" ? L("更远、更长的单体回溯已经生效。") : id === "solar" ? L("破坏与推动能力已经增强。") : L("潜行轮廓与恢复能力已经增强。"), 5.2);
    renderObjectives(); audio.tone(id === "solar" ? 190 : id === "memory" ? 420 : 310, .75, "sine", .12, 720);
  }

  function validateAuthorizationGraph(){
    const snapshot={disguise:world.disguise,events:world.events.audit,auditCloseAt:world.routine.auditCloseAt,power:relayFor("foundry")?.state.on,valve:world.valve.state.open,beastAsleep:world.beast.state.asleep,auth:{...world.authorizations},burned:new Set(world.burnedCovers)};
    const dawn=world.guards.find(guard=>guard.state.custodian==="dawn"),solar=world.guards.find(guard=>guard.state.custodian==="solar"),memory=world.guards.find(guard=>guard.state.custodian==="memory");
    for(const signer of [dawn,solar,memory]){signer.dead=false;signer.state.stunned=0;signer.state.alert=false;}
    world.burnedCovers.clear();world.events.audit=true;world.routine.auditCloseAt=world.time+10;world.disguise="archive";dawn.state.handover=true;issueAuthorization(dawn,true);
    world.disguise="foundry";relayFor("foundry").state.on=false;issueAuthorization(solar,true);
    world.disguise="garden";world.beast.state.asleep=true;issueAuthorization(memory,true);
    const valid=world.authorizations.dawn&&world.authorizations.solar&&world.authorizations.memory;
    document.body.dataset.authgraph=`${world.authorizations.dawn}|${world.authorizations.solar}|${world.authorizations.memory}`;
    world.disguise=snapshot.disguise;world.events.audit=snapshot.events;world.routine.auditCloseAt=snapshot.auditCloseAt;relayFor("foundry").state.on=snapshot.power;world.valve.state.open=snapshot.valve;world.beast.state.asleep=snapshot.beastAsleep;world.authorizations={...snapshot.auth};world.burnedCovers=new Set(snapshot.burned);
    return valid;
  }

  function attemptEscape() {
    if (world.loot.size < 2) { addFeed(L`撤离艇拒绝靠岸：还需要 <b>${2-world.loot.size} 件遗物</b>。`, "warn"); return; }
    showResults(true);
  }

  function captureHistories(dt) {
    for (const entity of entities) {
      if (!entity.rewindable || entity === rewindTarget) continue;
      entity.historyClock += dt;
      while (entity.historyClock >= SNAP_DT) { entity.historyClock -= SNAP_DT; entity.capture(); }
    }
    if (entities.length > 165) {
      entities = entities.filter(entity => entity.kind !== "projectile" || !entity.dead || entity.history.some(snapshot => !snapshot.dead));
    }
  }

  function temporalRadius(entity) {
    if (entity.shape === "rect") return Math.max(entity.w, entity.h) * .52;
    return entity.r || 16;
  }
  function targetScore(entity) {
    if (!entity.rewindable || entity.history.length < 2) return Infinity;
    if (distance(player, entity) > world.rewindRange && entity !== player) return Infinity;
    const radius = temporalRadius(entity);
    if (entity.shape === "rect") {
      const rect = entityRect(entity);
      const dx = Math.max(rect.x - input.worldX, 0, input.worldX - (rect.x + rect.w));
      const dy = Math.max(rect.y - input.worldY, 0, input.worldY - (rect.y + rect.h));
      return Math.hypot(dx, dy);
    }
    return Math.max(0, distanceXY(input.worldX, input.worldY, entity.x, entity.y) - radius);
  }
  function selectTarget() {
    if (rewindTarget) { selectedTarget = rewindTarget; return; }
    let best = null, score = 26 / renderScale;
    for (const entity of entities) {
      const candidate = targetScore(entity);
      if (candidate <= score) { best = entity; score = candidate; }
    }
    selectedTarget = best;
  }
  function beginRewind(entity) {
    if (!entity || entity.history.length < 2) return;
    if (entity === player && world.carrying) {
      const held = entityById(world.carrying); if (held) held.carried = false; world.carrying = null;
    }
    if (world.carrying === entity.id) { entity.carried = false; world.carrying = null; }
    rewindTarget = entity; selectedTarget = entity; entity.rewindClock = 0;
    world.rewindCount++; world.rewoundKinds.add(entity.kind);
    document.body.classList.add("rewinding"); ui.crosshair.classList.add("rewinding"); audio.rewind(true, entity.rewindRate);
    addFloater(entity.x, entity.y-temporalRadius(entity)-10, "REWIND", "#78f0d0");
  }
  function rewindEntity(entity, dt) {
    entity.rewindClock += dt * entity.rewindRate;
    let changed = false;
    while (entity.rewindClock >= SNAP_DT && entity.history.length > 1) {
      entity.rewindClock -= SNAP_DT; entity.history.pop(); entity.applySnapshot(entity.history[entity.history.length - 1]); changed = true;
    }
    if (changed && Math.random() < dt * 34) addParticle(entity.x+rand(-temporalRadius(entity),temporalRadius(entity)),entity.y+rand(-temporalRadius(entity),temporalRadius(entity)),"#78f0d0",{vy:rand(-25,25),vx:rand(-25,25),life:.35});
    if (entity === player && !player.dead) world.playerDown = 0;
    if (entity.history.length <= 1) stopRewind();
  }
  function stopRewind() {
    if (!rewindTarget) return;
    rewindTarget.rewindClock = 0; rewindTarget.historyClock = 0;
    if (rewindTarget.carried && world.carrying !== rewindTarget.id) rewindTarget.carried = false;
    rewindTarget.capture(); rewindTarget = null;
    document.body.classList.remove("rewinding"); ui.crosshair.classList.remove("rewinding"); audio.rewind(false); audio.tone(390,.06,"triangle",.045,180);
  }

  function renderObjectives() {
    ui.objectiveList.innerHTML = OBJECTIVES.map(objective => {
      const secured = world.loot.has(objective.id);
      const authorized=world.authorizations[objective.id];
      return `<div class="objective ${secured ? "secured" : authorized?"authorized":""}" data-index="${objective.index}" style="--accent:${objective.color}"><span>${L(objective.place)}</span><b>${secured ? L`${L(objective.name)} · 已取得` : authorized?L`${L(objective.name)} · 已授权`:L(objective.name)}</b><small>${secured ? boonLabel(objective.id) : authorized?L`${authorizationLabel(objective.id)}已写入账本 · 可取走`:L(objective.note)}</small></div>`;
    }).join("");
    const remaining = Math.max(0, 2-world.loot.size);
    ui.escapeCard.classList.toggle("locked", remaining > 0); ui.escapeCard.classList.toggle("ready", remaining === 0);
    ui.escapeNote.textContent = remaining ? L`还需要 ${remaining} 件遗物` : L("撤离条件满足 · 前往东南码头");
    ui.missionStrip.classList.toggle("ready", remaining === 0);
  }
  function boonLabel(id) { return id === "dawn" ? L("成长：12 秒历史 / 扩大距离") : id === "solar" ? L("成长：铆钉枪穿甲强化") : L("成长：视线隐匿 / 脱战恢复"); }
  function bonusComplete(){
    if(world.contract.id==="clean")return world.kills===0;
    if(world.contract.id==="shadow")return alertLevel()<=2&&!world.bonusFailed;
    if(world.contract.id==="paradox")return world.duplicates>0;
    return world.loot.size===3;
  }
  function updateBonusContract(){
    if(world.contract.id==="clean"&&world.kills>0)world.bonusFailed=true;
    if(world.contract.id==="shadow"&&alertLevel()>2)world.bonusFailed=true;
    const complete=bonusComplete();
    ui.bonusCard.classList.toggle("failed",world.bonusFailed);ui.bonusCard.classList.toggle("complete",complete&&!world.bonusFailed);
    ui.bonusTitle.textContent=L(world.contract.title);
    ui.bonusNote.textContent=world.bonusFailed?L("条件已失败；主任务仍可继续"):complete?L("附加条件当前已达成"):L(world.contract.note);
  }
  function typeLabel(kind) {
    return ({player:L("能力持有者"),guard:L("巡卫"),courier:L("移动机会"),rival:L("竞争者"),civilian:L("市民"),informant:L("线人"),beast:L("生物"),door:L("门体"),case:L("保险结构"),relay:L("电力设备"),camera:L("识别镜"),valve:L("压力设备"),gas:L("气体设备"),crate:L("可搬物"),lure:L("生物诱饵"),barrel:L("爆炸物"),artifact:L("任务遗物"),projectile:L("飞行物"),key:L("钥匙"),evidence:L("行动证据"),escape:L("撤离载具")})[kind] || L("因果体");
  }
  function describeTarget(entity) {
    if (entity === player) return L`${entity.dead ? L("尸体 · 右键回溯复活") : L("行动中")} · 生命 ${Math.max(0,Math.ceil(entity.health))}/${entity.maxHealth} · 回溯自己不会撤销已偷钥匙与遗物记录。`;
    if (["guard","courier","rival"].includes(entity.kind)) return L`${entity.dead ? L("尸体") : (entity.state.stunned||0)>0 ? L`昏迷 ${entity.state.stunned.toFixed(1)} 秒` : entity.state.alert&&!entity.state.radioed ? L`正在上报 ${Math.round((entity.state.reportProgress||0)/2*100)}%` : entity.state.alert ? (entity.state.gang?L("帮派 · 交战中"):L("敌对 · 正在追捕")) : entity.state.combatTargetId ? L("交战中") : entity.state.suspicion>.2 ? L("观察 · 尚未敌对") : L("正常行为")} · 生命 ${Math.max(0,Math.ceil(entity.health))}/${entity.maxHealth} · ${entity.state.swat?L("收尸特警 · 锁血"):entity.state.scribe?L`撰写职责：${authorizationLabel("dawn")}${world.authorizations.dawn?L(" · 已签发"):L(" · 未签发")}`:entity.state.custodian?L`保管职责：${authorizationLabel(entity.state.custodian)}`:entity.state.hasKey?L`携带${keyLabel(entity.state.hasKey)}`:entity.state.gang?L("帮派成员 · 无制服"):entity.state.uniformTaken?L("制服已被取走"):L`可取得${uniformLabel(entity.state.uniform)}`}。`;
    if (entity.kind === "beast") return L`${entity.dead?L("死亡"):entity.state.asleep?L("沉睡"):entity.state.stunned>0?L("失衡"):L("正在狩猎")} · 噪声和气云属于其他对象。`;
    if (["door","case"].includes(entity.kind)) return L`${doorPassable(entity)?L("可以通过"):entity.state.locked?L("锁闭"):L("关闭")} · 结构 ${Math.max(0,Math.ceil(entity.health/entity.maxHealth*100))}% · 门能重建，但已经通过的人不会被带回来。`;
    if (entity.kind === "relay") return L`${powerOn(entity.state.network)?L("网络供电"):L("网络断电")} · ${entity.state.disabled>0?L`干扰 ${entity.state.disabled.toFixed(1)} 秒`:L("可操作")} · 供电变化只影响仍依赖它的设备。`;
    if (entity.kind === "camera") return L`${entity.dead||entity.state.disabled>0||!powerOn(entity.state.powerId)?L("离线"):L("扫描中")} · 已经写入全城的警报不随镜头返回。`;
    if (entity.kind === "artifact") return L`${world.loot.has(entity.state.artifactId)?L("账本已经登记；重建后可制造重复体"):L("尚未取得")} · 遗物自身历史与任务记录相互独立。`;
    if (entity.kind === "crate" && entity.state.searchable) return L`${entity.state.taken?L("移交档案已经取走"):L`可搜查：${entity.state.contents}`} · ${entity.dead?L("箱体已毁，仍可从残骸取走档案"):L("打开搜查不会破坏箱体")}。`;
    if (entity.kind === "barrel") return L`${entity.dead?L("容器毁坏"):L("压力稳定")} · ${entity.state.explosive?L("爆炸后可重建，已生成的火仍存在"):L("可搬运")}。`;
    if (entity.kind === "projectile") return L`${entity.dead?L("撞击已经发生"):L("仍在飞行")} · 弹道历史可回溯，命中的对象各自保留结果。`;
    if (entity.kind === "evidence") return L`${world.discoveredEvidence.has(`evidence:${entity.id}`)?L("已经被巡卫报告"):L("尚未被发现")} · 可以收起或回溯到产生之前；已经上报的警戒仍然保留。`;
    if (entity.kind === "gas") return L`压力 ${Math.ceil(entity.state.pressure)}% · 已经释放的气云属于城区环境。`;
    if (entity.kind === "valve") return L`${entity.state.open?L("泄压开启"):L("泄压关闭")} · 高温由当前供电与阀门共同决定。`;
    return L`${entity.dead?L("已毁坏"):L("结构正常")} · 结构 ${Math.max(0,Math.ceil(entity.health/entity.maxHealth*100))}% · 位置、速度与内部状态共同回到过去。`;
  }
  function phaseLabel() {
    if (world.freeplay) return L("账本之后");
    if (world.time >= world.limit) return L("零点封锁");
    if (world.lockdown) return L("提前封锁");
    if (world.raining) return L("导电雨");
    if (world.events.rivals) return L("多方争夺");
    if (world.events.courier) return L("移动机会");
    return L("自由潜入");
  }
  function alertText(level) { return [L("无人知晓"),L("风声初起"),L("局部搜查"),L("武装响应"),L("全城追捕"),L("零点猎杀")][level]; }
  function contextText() {
    if (player.dead) return L("把准星移到自己的身体上，按住右键回溯；倒地计时不会暂停城区。");
    if (world.carrying) return L`F　向准星抛出 ${entityById(world.carrying)?.name || L("物体")}`;
    const target = nearestInteractable();
    if (!target) {
      const fileCrate=world.props.find(prop=>prop.state.searchable==="dawn"&&!prop.state.taken);
      if(fileCrate&&distance(player,fileCrate)<150)return L`靠近 ${fileCrate.dead?L("黎明印档案箱残骸"):L("黎明印档案箱")} · E 搜查黎明印移交档案`;
      return world.loot.size >= 2 ? L("撤离条件满足 · 前往地图东南方的南码头") : L("观察巡逻、门、电源与可搬物；目标只规定结果。");
    }
    if (target.kind === "artifact") return world.authorizations[target.state.artifactId]?L`E　凭${authorizationLabel(target.state.artifactId)}取得 ${target.name}`:L`账本尚未授权 · 找到对应保管人并制造可信条件`;
    if (target.kind === "escape") return world.loot.size>=2 ? L("E　登上撤离艇并结算") : L`仍需 ${2-world.loot.size} 件遗物才能撤离`;
    if (target.kind === "key") return L`E　拾取 ${target.name}`;
    if (target.kind === "evidence") return L`E　收起 ${target.name} · 或右键回溯至产生之前`;
    if (target.kind === "crate" && target.state.searchable) return target.state.taken ? L`${target.name}已经取空` : L`E　搜查 ${target.name} · 取得${target.state.contents}`;
    if (["guard","courier","rival"].includes(target.kind) && target.state.scribe) {
      if (world.authorizations.dawn) return L`E　请${target.name}确认档案移交单`;
      if (target.dead) return L("撰写员已死亡 · 可以回溯恢复签字");
      if ((target.state.stunned||0)>0) return L`撰写员昏迷 ${target.state.stunned.toFixed(1)} 秒 · 苏醒后可签字`;
      if (target.state.alert) return L("撰写员正在警戒 · 先让他恢复平静");
      const blocker=scribeBlockReason();
      return blocker?L`E　与${target.name}交谈 · ${blocker}`:L`E　请${target.name}核对档案与身份并签字`;
    }
    if (["guard","courier","rival"].includes(target.kind) && target.state.custodian) {
      const id=target.state.custodian,blocker=authorizationBlocker(id,target);
      return hasCredential(id)&&!blocker?L`E　请求${target.name}签发${authorizationLabel(id)}`:L`E　交谈 / 偷取凭证${blocker?` · ${blocker}`:""}`;
    }
    if (["guard","courier","rival"].includes(target.kind) && target.state.hasKey) return L`E　尝试偷取 ${keyLabel(target.state.hasKey)}`;
    if (["guard","courier","rival"].includes(target.kind) && (target.dead||target.state.stunned>0) && !target.state.uniformTaken && target.state.uniform !== "none") return L`E　取走 ${uniformLabel(target.state.uniform)}`;
    if (["relay","valve","gas","informant"].includes(target.kind)) return L`E　操作 / 交谈：${target.name}`;
    if (["door","case"].includes(target.kind)) return target.state.locked && !hasKeyFor(target) && world.chips>0 ? L`按住 E 破解 ${target.name} · 或寻找其他手段` : L`E　操作 ${target.name}`;
    return L("E　互动");
  }

  function updateUI() {
    const remainingTime = world.limit - world.time;
    ui.clock.textContent = formatTime(remainingTime);
    ui.clockBox.classList.toggle("danger", remainingTime < 45);
    ui.phaseName.textContent = phaseLabel();
    ui.lootCount.textContent = `${world.loot.size} / 2`;
    ui.missionCopy.textContent = world.loot.size >= 2 ? L("前往南码头撤离艇") : L("取得任意 2 件明日遗物");
    const level = alertLevel(); ui.alertLabel.textContent = alertText(level);
    ui.alertPanel.title = level > 0 ? L`距下次降级 ${Math.max(0, Math.ceil(ALERT_DECAY_SECONDS - (world.time - world.lastMajorEventAt)))} 秒` : L("没有恶性事件");
    ui.alertLabel.style.color = level < 2 ? "var(--mint)" : level < 4 ? "var(--amber)" : "var(--red)";
    ui.alertPips.forEach((pip,index) => pip.classList.toggle("on", index < level));
    ui.healthFill.style.width = `${clamp(player.health/player.maxHealth*100,0,100)}%`;
    ui.healthFill.style.background = player.health < 30 ? "var(--red)" : "var(--mint)";
    ui.healthValue.textContent = Math.max(0,Math.ceil(player.health));
    ui.keyCount.textContent = world.keys.size; ui.chipCount.textContent = world.chips;
    ui.archiveFile.textContent = world.archiveFile ? L("已取得") : L("未取得");
    ui.archiveFile.style.color = world.archiveFile ? "var(--mint)" : "";
    ui.disguiseName.textContent=world.disguise?`${uniformLabel(world.disguise)}${world.burnedCovers.has(world.disguise)?L("（暴露）"):""}`:L("无");
    ui.carryName.textContent = world.carrying ? entityById(world.carrying)?.name || "—" : L("空");
    ui.contextHint.textContent = contextText();
    ui.crosshair.classList.toggle("targeted", !!selectedTarget);
    if (selectedTarget) {
    ui.targetPanel.classList.remove("hidden"); ui.targetName.textContent = selectedTarget.name; ui.targetKind.textContent = selectedTarget.state?.gang ? L("帮派") : typeLabel(selectedTarget.kind);
      ui.historyTime.textContent = L`${(selectedTarget.history.length*SNAP_DT).toFixed(1)} 秒`;
      ui.historyFill.style.width = `${clamp(selectedTarget.history.length*SNAP_DT/world.historySeconds*100,0,100)}%`;
      ui.targetState.textContent = describeTarget(selectedTarget);
    } else ui.targetPanel.classList.add("hidden");
    ui.wash.style.setProperty("--rx", `${input.mouseX/Math.max(1,viewW)*100}%`); ui.wash.style.setProperty("--ry", `${input.mouseY/Math.max(1,viewH)*100}%`);
  }

  function showResults(success, forcedReason = "") {
    if (resultShown) return;
    resultShown = true; playing = false; stopRewind(); world.result = success ? "success" : "failure";
    const livingGuards = world.guards.filter(guard => !guard.dead).length;
    const elapsed = Math.min(world.time, world.limit + world.overtime);
    const style = world.kills === 0 && alertLevel() <= 2 ? L("幽灵") : world.kills === 0 ? L("无血闯入者") : world.explosions >= 2 ? L("燃烧的强盗") : L("正面劫匪");
    ui.resultTitle.textContent = success ? world.loot.size === 3 ? L("你把三个明天都带出了零点。") : L("你选择了要让哪两个明天存在。") : L("零点替你做出了选择。");
    const names = OBJECTIVES.filter(objective => world.loot.has(objective.id)).map(objective => L(objective.name));
    const story = [];
    if (forcedReason) story.push(forcedReason);
    if (success) story.push(L`撤离艇带走了${names.join(L("与"))}。${world.loot.size<3?L("未被选择的遗物仍留在城区，继续成为下一场争夺的理由。"):L("城区第一次发现，完整的明天也可以被一个人搬走。")}`);
    if (world.duplicates) story.push(L`账本还记录了 ${world.duplicates} 件来源相同的重复体；这是无法用普通盗窃解释的证据。`);
    if (fires.length) story.push(L`你离开时，仍有 ${fires.length} 处独立火源在燃烧。`);
    story.push(bonusComplete()&&!world.bonusFailed?L`附加委托“${L(world.contract.title)}”已经兑现。`:L`附加委托“${L(world.contract.title)}”没有兑现，但它没有取代主任务。`);
    ui.resultStory.textContent = story.join(window.I18N && window.I18N.lang === "en" ? " " : "");
    const items = [
      {label:L("任务"),value:success?L`${world.loot.size}/3 件撤离`: L`${world.loot.size}/3 件`,cls:success?"good":"bad"},
      {label:L("手段画像"),value:style,cls:world.kills?"warn":"good"},
      {label:L("全城警戒"),value:`${alertLevel()} / 5`,cls:alertLevel()<3?"good":alertLevel()<5?"warn":"bad"},
      {label:L("回溯实验"),value:L`${world.rewindCount} 次 / ${world.rewoundKinds.size} 类`,cls:world.rewoundKinds.size>=5?"good":""},
      {label:L("伤亡"),value:L`${world.kills} 人`,cls:world.kills?"bad":"good"},
      {label:L("用时"),value:formatTime(elapsed),cls:elapsed<180?"good":"warn"},
      {label:L("爆破"),value:L`${world.explosions} 次`,cls:world.explosions?"warn":""},
      {label:L("城区火源"),value:L`${fires.length} 处`,cls:fires.length?"bad":"good"},
      {label:L("附加委托"),value:bonusComplete()&&!world.bonusFailed?L("已兑现"):L("未兑现"),cls:bonusComplete()&&!world.bonusFailed?"good":"warn"}
    ];
    ui.resultGrid.innerHTML = items.map(item=>`<div class="result-item ${item.cls}"><span>${item.label}</span><b>${item.value}</b></div>`).join("");
    ui.result.classList.remove("hidden"); audio.tone(success?330:72,1.1,"sine",.14,success?690:34);
  }

  function updateCamera(dt) {
    const targetX = clamp(player.x - logicalViewW * .5, 0, Math.max(0, WORLD_W - logicalViewW));
    const targetY = clamp(player.y - logicalViewH * .52, 0, Math.max(0, WORLD_H - logicalViewH));
    camera.x = lerp(camera.x, targetX, 1 - Math.exp(-4.8 * dt));
    camera.y = lerp(camera.y, targetY, 1 - Math.exp(-4.8 * dt));
    camera.shake *= Math.pow(.018, dt);
    camera.shakeX = rand(-camera.shake,camera.shake); camera.shakeY = rand(-camera.shake,camera.shake);
  }

  function render() {
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = "#070b0f"; ctx.fillRect(0,0,viewW,viewH);
    ctx.setTransform(dpr*renderScale,0,0,dpr*renderScale,0,0);
    ctx.save(); ctx.translate(-camera.x+camera.shakeX,-camera.y+camera.shakeY);
    drawGround(); drawDistricts(); drawVision(); drawEnvironmentalFields(); drawWalls(); drawHistory(selectedTarget);
    const sorted = [...entities].sort((a,b) => (a.y+(a.dead? -20:0))-(b.y+(b.dead? -20:0)));
    for (const entity of sorted) drawEntity(entity);
    drawFires(); drawParticles(); drawFloaters(); drawWorldLabels();
    ctx.restore();
    drawMarkers(); drawRain();
  }

  function drawGround() {
    const gradient = ctx.createLinearGradient(0,0,0,WORLD_H);
    gradient.addColorStop(0,"#0b1118"); gradient.addColorStop(1,"#0a0e12");
    ctx.fillStyle = gradient; ctx.fillRect(0,0,WORLD_W,WORLD_H);
    ctx.strokeStyle = "rgba(105,140,139,.055)"; ctx.lineWidth = 1;
    for (let x=70;x<WORLD_W;x+=70){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_H);ctx.stroke();}
    for (let y=70;y<WORLD_H;y+=70){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_W,y);ctx.stroke();}
    ctx.fillStyle = "rgba(26,38,42,.72)";
    ctx.fillRect(48,700,WORLD_W-96,175); ctx.fillRect(1040,48,210,WORLD_H-96); ctx.fillRect(1400,820,950,175);
    ctx.strokeStyle = "rgba(154,190,181,.12)"; ctx.lineWidth=2; ctx.setLineDash([18,20]);
    ctx.beginPath();ctx.moveTo(65,787);ctx.lineTo(WORLD_W-65,787);ctx.stroke();
    ctx.beginPath();ctx.moveTo(1145,60);ctx.lineTo(1145,WORLD_H-60);ctx.stroke();
    ctx.beginPath();ctx.moveTo(1420,906);ctx.lineTo(2335,906);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#07131a";ctx.fillRect(2050,1130,350,320);
    ctx.strokeStyle="rgba(114,197,255,.16)";ctx.lineWidth=2;
    for(let y=1160;y<1450;y+=28){ctx.beginPath();ctx.moveTo(2050,y);for(let x=2050;x<=2400;x+=35)ctx.lineTo(x,y+Math.sin(x*.035+world.time)*4);ctx.stroke();}
    ctx.fillStyle="rgba(244,200,106,.04)";ctx.fillRect(78,1088,370,292);
  }

  function drawDistricts() {
    for (const zone of zones) {
      ctx.save(); ctx.fillStyle=zone.color; ctx.fillRect(zone.x,zone.y,zone.w,zone.h);
      ctx.globalAlpha=.18; ctx.strokeStyle=zone.id==="archive"?"#72c5ff":zone.id==="foundry"?"#f4c86a":zone.id==="garden"?"#a99bff":"#78f0d0";ctx.lineWidth=1;
      for(let x=zone.x+25;x<zone.x+zone.w;x+=45){ctx.beginPath();ctx.moveTo(x,zone.y);ctx.lineTo(x,zone.y+zone.h);ctx.stroke();}
      for(let y=zone.y+25;y<zone.y+zone.h;y+=45){ctx.beginPath();ctx.moveTo(zone.x,y);ctx.lineTo(zone.x+zone.w,y);ctx.stroke();}
      ctx.globalAlpha=1;ctx.fillStyle="rgba(230,240,235,.42)";ctx.font="600 12px Consolas, monospace";ctx.fillText(zone.name.toUpperCase(),zone.x+16,zone.y+42);
      ctx.fillStyle="rgba(230,240,235,.16)";ctx.font="700 48px Consolas, monospace";ctx.textAlign="right";ctx.fillText(zone.id==="archive"?"A-01":zone.id==="foundry"?"F-02":zone.id==="garden"?"G-03":"SAFE",zone.x+zone.w-16,zone.y+58);ctx.textAlign="left";ctx.restore();
    }
    ctx.fillStyle="rgba(120,240,208,.045)";ctx.beginPath();ctx.arc(world.escape.x,world.escape.y,95,0,TAU);ctx.fill();
    ctx.strokeStyle=world.loot.size>=2?"rgba(120,240,208,.75)":"rgba(132,152,145,.25)";ctx.lineWidth=2;ctx.setLineDash([8,8]);ctx.beginPath();ctx.arc(world.escape.x,world.escape.y,82+Math.sin(world.mapPulse*2)*4,0,TAU);ctx.stroke();ctx.setLineDash([]);
  }

  function drawVisionCone(entity, range, fov, color) {
    if (entity.dead || (entity.state.stunned||0)>0) return;
    const gradient=ctx.createRadialGradient(entity.x,entity.y,8,entity.x,entity.y,range);
    gradient.addColorStop(0,color.replace("ALPHA",".16"));gradient.addColorStop(1,color.replace("ALPHA","0"));
    ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(entity.x,entity.y);ctx.arc(entity.x,entity.y,range,entity.rotation-fov*.5,entity.rotation+fov*.5);ctx.closePath();ctx.fill();
  }
  function drawVision() {
    for(const entity of entities){
      if (entity.state?.removed) continue;
      if (["guard","courier","rival"].includes(entity.kind)) drawVisionCone(entity,(entity.state.vision||290)*VISION_SCALE*world.detectionScale,Math.PI*.58,entity.state.gang?"rgba(169,155,255,ALPHA)":entity.state.alert?"rgba(255,112,105,ALPHA)":entity.state.swat?"rgba(255,92,88,ALPHA)":"rgba(244,200,106,ALPHA)");
      if(entity.kind==="camera"&&!entity.dead&&powerOn(entity.state.powerId)&&entity.state.disabled<=0)drawVisionCone(entity,390*VISION_SCALE,Math.PI*.42,"rgba(114,197,255,ALPHA)");
    }
  }

  function drawEnvironmentalFields() {
    if(powerOn("foundry")&&!world.valve.dead&&!world.valve.state.open){
      const pulse=.12+Math.sin(world.mapPulse*4)*.025;ctx.fillStyle=`rgba(255,112,60,${pulse})`;ctx.fillRect(1780,255,270,320);
      ctx.strokeStyle="rgba(244,200,106,.32)";ctx.lineWidth=2;for(let x=1800;x<2050;x+=28){ctx.beginPath();ctx.moveTo(x,575);ctx.lineTo(x+18,255);ctx.stroke();}
    }
    for(const cloud of gasClouds){
      const gradient=ctx.createRadialGradient(cloud.x,cloud.y,10,cloud.x,cloud.y,cloud.r);gradient.addColorStop(0,"rgba(169,155,255,.2)");gradient.addColorStop(1,"rgba(169,155,255,0)");ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(cloud.x,cloud.y,cloud.r,0,TAU);ctx.fill();
    }
    for(const noise of noises){ctx.strokeStyle=noise.kind==="gunshot"?"rgba(255,112,105,.18)":"rgba(244,200,106,.12)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(noise.x,noise.y,noise.radius*(1-noise.life/noise.maxLife),0,TAU);ctx.stroke();}
  }

  function drawWalls() {
    for(const wall of walls){
      ctx.fillStyle="rgba(0,0,0,.38)";ctx.fillRect(wall.x+7,wall.y+8,wall.w,wall.h);
      ctx.fillStyle=wall.color;ctx.fillRect(wall.x,wall.y,wall.w,wall.h);
      ctx.fillStyle="rgba(205,225,218,.11)";ctx.fillRect(wall.x,wall.y,wall.w,3);
    }
  }

  function drawHistory(entity) {
    if(!entity||entity.history.length<2)return;
    ctx.save();ctx.strokeStyle="rgba(120,240,208,.34)";ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.beginPath();
    const step=Math.max(1,Math.floor(entity.history.length/34));let started=false;
    for(let i=0;i<entity.history.length;i+=step){const point=entity.history[i];if(!started){ctx.moveTo(point.x,point.y);started=true;}else ctx.lineTo(point.x,point.y);}
    ctx.stroke();ctx.setLineDash([]);
    for(let i=0;i<entity.history.length;i+=step*4){const point=entity.history[i];ctx.globalAlpha=.15+i/entity.history.length*.35;ctx.fillStyle="#78f0d0";ctx.beginPath();ctx.arc(point.x,point.y,3,0,TAU);ctx.fill();}
    ctx.restore();
  }

  function drawEntity(entity) {
    if(entity.state?.removed||entity.state?.collected)return;
    if(entity.dead){
      if(entity.actor)drawCorpse(entity);
      drawTemporalScar(entity);
      return;
    }
    ctx.save();ctx.translate(entity.x,entity.y);ctx.rotate(entity.rotation||0);
    if(entity.kind==="player")drawPlayer(entity);
    else if(["guard","courier","rival"].includes(entity.kind))drawGuard(entity);
    else if(["civilian","informant"].includes(entity.kind))drawCivilian(entity);
    else if(entity.kind==="beast")drawBeast(entity);
    else if(["door","case"].includes(entity.kind))drawDoor(entity);
    else if(entity.kind==="relay")drawRelay(entity);
    else if(entity.kind==="camera")drawCamera(entity);
    else if(entity.kind==="valve")drawValve(entity);
    else if(entity.kind==="gas")drawGasControl(entity);
    else if(entity.kind==="artifact")drawArtifact(entity);
    else if(entity.kind==="projectile")drawProjectile(entity);
    else if(entity.kind==="crate"||entity.kind==="lure")drawCrate(entity);
    else if(entity.kind==="barrel")drawBarrel(entity);
    else if(entity.kind==="key")drawKey(entity);
    else if(entity.kind==="evidence")drawEvidence(entity);
    else if(entity.kind==="escape")drawBoat(entity);
    if(entity===selectedTarget){ctx.strokeStyle="#78f0d0";ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(0,0,temporalRadius(entity)+10+Math.sin(world.mapPulse*5)*2,0,TAU);ctx.stroke();ctx.setLineDash([]);}
    ctx.restore();
  }

  function drawPlayer(entity){
    if(world.disguise){ctx.strokeStyle=world.burnedCovers.has(world.disguise)?"#ff7069":world.disguise==="archive"?"#72c5ff":world.disguise==="foundry"?"#f4c86a":world.disguise==="garden"?"#a99bff":"#d2c3a3";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,22,0,TAU);ctx.stroke();}
    ctx.shadowColor="#78f0d0";ctx.shadowBlur=12;ctx.fillStyle=entity.state.crouching?"#4db49e":"#78f0d0";ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(-12,-12);ctx.lineTo(-7,0);ctx.lineTo(-12,12);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#07100e";ctx.beginPath();ctx.arc(2,0,5,0,TAU);ctx.fill();
    if(entity.state.dash>0){ctx.strokeStyle="rgba(120,240,208,.55)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-16,-10);ctx.lineTo(-31,-10);ctx.moveTo(-16,10);ctx.lineTo(-31,10);ctx.stroke();}
  }
  function drawCorpse(entity){
    const playerCorpse=entity.kind==="player";
    ctx.save();ctx.translate(entity.x,entity.y);ctx.rotate((entity.rotation||0)+.45);
    ctx.fillStyle="rgba(0,0,0,.5)";ctx.beginPath();ctx.ellipse(0,7,20,10,0,0,TAU);ctx.fill();
    ctx.globalAlpha=playerCorpse?.9:.62;
    ctx.fillStyle=playerCorpse?"#78f0d0":entity.color;
    ctx.beginPath();ctx.ellipse(0,0,17,9,0,0,TAU);ctx.fill();
    ctx.strokeStyle=playerCorpse?"#78f0d0":"rgba(232,238,232,.55)";ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle="rgba(7,14,16,.75)";ctx.beginPath();ctx.arc(15,-2,5,0,TAU);ctx.fill();
    ctx.restore();
    if(playerCorpse){
      ctx.save();ctx.strokeStyle="#78f0d0";ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.globalAlpha=.55+.2*Math.sin(world.mapPulse*5);
      ctx.beginPath();ctx.arc(entity.x,entity.y,28,0,TAU);ctx.stroke();ctx.restore();
    }
  }
  function drawGuard(entity){
    ctx.fillStyle="rgba(0,0,0,.38)";ctx.beginPath();ctx.ellipse(-2,8,16,9,0,0,TAU);ctx.fill();
    ctx.fillStyle=entity.color;ctx.beginPath();ctx.arc(0,0,entity.r,0,TAU);ctx.fill();
    ctx.fillStyle="#101519";ctx.beginPath();ctx.arc(3,0,7,0,TAU);ctx.fill();
    ctx.fillStyle=entity.state.gang?"#a99bff":entity.state.alert?"#ff7069":entity.state.combatTargetId?"#ff9a6a":entity.state.suspicion>.2?"#f4c86a":"#dce8e3";ctx.beginPath();ctx.moveTo(entity.r+8,0);ctx.lineTo(entity.r-1,-5);ctx.lineTo(entity.r-1,5);ctx.closePath();ctx.fill();
    if(entity.state.stunned>0){ctx.strokeStyle="#a99bff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,entity.r+6,world.mapPulse*3,world.mapPulse*3+Math.PI*1.5);ctx.stroke();}
    if(entity.state.hasKey){ctx.save();ctx.rotate(-entity.rotation);ctx.fillStyle="#f4c86a";ctx.font="700 10px Consolas";ctx.textAlign="center";ctx.fillText("KEY",0,-25);ctx.textAlign="left";ctx.restore();}
    if(entity.state.swat){ctx.save();ctx.rotate(-entity.rotation);ctx.fillStyle="#ff5c58";ctx.font="700 9px Consolas";ctx.textAlign="center";ctx.fillText("SWAT",0,-25);ctx.textAlign="left";ctx.restore();}
    if(entity.state.gang){ctx.save();ctx.rotate(-entity.rotation);ctx.fillStyle="#a99bff";ctx.font="700 9px Consolas";ctx.textAlign="center";ctx.fillText("GANG",0,-25);ctx.textAlign="left";ctx.restore();}
  }
  function drawCivilian(entity){ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(0,8,14,8,0,0,TAU);ctx.fill();ctx.fillStyle=entity.color;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-8,-11);ctx.lineTo(-12,10);ctx.closePath();ctx.fill();ctx.fillStyle="#11191a";ctx.beginPath();ctx.arc(2,0,4,0,TAU);ctx.fill();}
  function drawBeast(entity){ctx.fillStyle="rgba(0,0,0,.4)";ctx.beginPath();ctx.ellipse(0,12,27,13,0,0,TAU);ctx.fill();ctx.fillStyle=entity.color;ctx.beginPath();ctx.ellipse(0,0,25,17,0,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(19,-2,13,0,TAU);ctx.fill();ctx.fillStyle="#172116";ctx.beginPath();ctx.arc(23,-5,3,0,TAU);ctx.fill();for(const y of [-11,11]){ctx.fillRect(-15,y,9,8);ctx.fillRect(7,y,9,8);}if(entity.state.asleep){ctx.rotate(-entity.rotation);ctx.fillStyle="#a99bff";ctx.font="700 13px Consolas";ctx.fillText("Z Z",-8,-28);}}
  function drawDoor(entity){
    const passable=doorPassable(entity);ctx.rotate(-entity.rotation);ctx.globalAlpha=passable?.42:1;
    if(entity.state.glass){ctx.fillStyle="rgba(169,155,255,.13)";ctx.strokeStyle=entity.color;ctx.lineWidth=2;ctx.fillRect(-entity.w*.5,-entity.h*.5,entity.w,entity.h);ctx.strokeRect(-entity.w*.5,-entity.h*.5,entity.w,entity.h);}
    else{ctx.fillStyle="#1a272c";ctx.fillRect(-entity.w*.5,-entity.h*.5,entity.w,entity.h);ctx.strokeStyle=entity.color;ctx.lineWidth=2;ctx.strokeRect(-entity.w*.5,-entity.h*.5,entity.w,entity.h);for(let x=-entity.w*.4;x<entity.w*.45;x+=14){ctx.beginPath();ctx.moveTo(x,-entity.h*.4);ctx.lineTo(x,entity.h*.4);ctx.stroke();}}
    ctx.globalAlpha=1;ctx.fillStyle=entity.state.locked?"#f4c86a":"#78f0d0";ctx.fillRect(-3,-3,6,6);
  }
  function drawRelay(entity){ctx.rotate(-entity.rotation);ctx.fillStyle="#142027";ctx.fillRect(-entity.w*.5,-entity.h*.5,entity.w,entity.h);ctx.strokeStyle=entity.color;ctx.lineWidth=2;ctx.strokeRect(-entity.w*.5,-entity.h*.5,entity.w,entity.h);ctx.fillStyle=powerOn(entity.state.network)?"#78f0d0":"#ff7069";ctx.beginPath();ctx.arc(0,-9,4,0,TAU);ctx.fill();ctx.strokeStyle="rgba(220,235,230,.25)";ctx.beginPath();ctx.moveTo(-10,5);ctx.lineTo(10,5);ctx.moveTo(-10,12);ctx.lineTo(5,12);ctx.stroke();}
  function drawCamera(entity){ctx.fillStyle="#1a252b";ctx.beginPath();ctx.arc(0,0,13,0,TAU);ctx.fill();ctx.fillStyle=entity.state.disabled>0?"#a99bff":"#72c5ff";ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(2,-8);ctx.lineTo(2,8);ctx.closePath();ctx.fill();ctx.fillStyle="#081014";ctx.beginPath();ctx.arc(8,0,3,0,TAU);ctx.fill();}
  function drawValve(entity){ctx.strokeStyle=entity.state.open?"#78f0d0":"#f4c86a";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,14,0,TAU);ctx.stroke();for(let a=0;a<TAU;a+=Math.PI*.5){ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);ctx.lineTo(Math.cos(a)*20,Math.sin(a)*20);ctx.stroke();}}
  function drawGasControl(entity){ctx.fillStyle="#25203a";ctx.beginPath();ctx.arc(0,0,18,0,TAU);ctx.fill();ctx.strokeStyle="#a99bff";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#a99bff";ctx.fillRect(-4,-12,8,24);ctx.fillStyle="#d9d3ff";ctx.font="700 8px Consolas";ctx.textAlign="center";ctx.fillText(Math.ceil(entity.state.pressure),0,3);ctx.textAlign="left";}
  function drawArtifact(entity){const pulse=1+Math.sin(world.mapPulse*3+entity.state.pulse)*.12;ctx.shadowColor=entity.color;ctx.shadowBlur=22;ctx.fillStyle=entity.color;ctx.rotate(world.mapPulse*.4);ctx.beginPath();ctx.moveTo(0,-18*pulse);ctx.lineTo(15*pulse,0);ctx.lineTo(0,18*pulse);ctx.lineTo(-15*pulse,0);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle="rgba(235,245,240,.8)";ctx.lineWidth=1;ctx.stroke();}
  function drawProjectile(entity){ctx.strokeStyle=entity.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(5,0);ctx.stroke();ctx.fillStyle=entity.color;ctx.beginPath();ctx.arc(5,0,entity.r*.7,0,TAU);ctx.fill();}
  function drawCrate(entity){
    ctx.rotate(-entity.rotation);ctx.fillStyle="#11191b";ctx.fillRect(-entity.r+3,-entity.r+5,entity.r*2,entity.r*2);ctx.fillStyle=entity.color;ctx.fillRect(-entity.r,-entity.r,entity.r*2,entity.r*2);ctx.strokeStyle="rgba(10,18,18,.55)";ctx.lineWidth=3;ctx.strokeRect(-entity.r+4,-entity.r+4,(entity.r-4)*2,(entity.r-4)*2);ctx.beginPath();ctx.moveTo(-entity.r+5,-entity.r+5);ctx.lineTo(entity.r-5,entity.r-5);ctx.stroke();
    if(entity.state?.searchable&&!entity.state.taken){
      ctx.strokeStyle="#72c5ff";ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(-entity.r-6,-entity.r-6,(entity.r+6)*2,(entity.r+6)*2);ctx.setLineDash([]);
      ctx.fillStyle="#72c5ff";ctx.fillRect(-5,-7,10,14);ctx.fillStyle="#0a1114";ctx.fillRect(-3,-4,6,1);ctx.fillRect(-3,-1,6,1);ctx.fillRect(-3,2,4,1);
    }
  }
  function drawBarrel(entity){ctx.rotate(-entity.rotation);ctx.fillStyle=entity.color;ctx.fillRect(-entity.r*.7,-entity.r,entity.r*1.4,entity.r*2);ctx.strokeStyle="#16191a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-entity.r*.7,-entity.r*.45);ctx.lineTo(entity.r*.7,-entity.r*.45);ctx.moveTo(-entity.r*.7,entity.r*.45);ctx.lineTo(entity.r*.7,entity.r*.45);ctx.stroke();ctx.fillStyle="#101314";ctx.font="900 14px Consolas";ctx.textAlign="center";ctx.fillText("!",0,5);ctx.textAlign="left";}
  function drawKey(){ctx.strokeStyle="#f4c86a";ctx.lineWidth=3;ctx.beginPath();ctx.arc(-4,0,5,0,TAU);ctx.moveTo(1,0);ctx.lineTo(12,0);ctx.lineTo(12,5);ctx.moveTo(7,0);ctx.lineTo(7,4);ctx.stroke();}
  function drawEvidence(entity){ctx.rotate(-entity.rotation);ctx.fillStyle=entity.color;ctx.shadowColor=entity.color;ctx.shadowBlur=7;if(entity.state.evidenceType==="casing"){ctx.fillRect(-5,-2,10,4);ctx.fillStyle="#11181a";ctx.fillRect(2,-1,3,2);}else{ctx.strokeStyle=entity.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,7,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(5,5);ctx.stroke();}ctx.shadowBlur=0;}
  function drawBoat(entity){ctx.rotate(-entity.rotation);ctx.fillStyle=world.loot.size>=2?"#173a35":"#1b2528";ctx.beginPath();ctx.ellipse(0,0,58,31,0,0,TAU);ctx.fill();ctx.strokeStyle=world.loot.size>=2?"#78f0d0":"#667a74";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#0a1114";ctx.fillRect(-25,-17,38,34);ctx.fillStyle=world.loot.size>=2?"#78f0d0":"#667a74";ctx.fillRect(19,-5,24,10);}

  function drawTemporalScar(entity){
    if(!entity.rewindable||!entity.history.some(snapshot=>!snapshot.dead))return;
    ctx.save();ctx.globalAlpha=.3+.1*Math.sin(world.mapPulse*5);ctx.strokeStyle="#78f0d0";ctx.lineWidth=1.5;ctx.setLineDash([3,5]);
    if(entity.shape==="rect")ctx.strokeRect(-entity.w*.5,-entity.h*.5,entity.w,entity.h);else{ctx.beginPath();ctx.arc(0,0,temporalRadius(entity),0,TAU);ctx.stroke();}
    ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(-6,-6);ctx.lineTo(6,6);ctx.moveTo(6,-6);ctx.lineTo(-6,6);ctx.stroke();
    if(entity===selectedTarget){ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(0,0,temporalRadius(entity)+10,0,TAU);ctx.stroke();}ctx.restore();
  }

  function drawFires(){
    for(const fire of fires){const flicker=fire.r*(.82+Math.sin(world.mapPulse*9+fire.x)*.12);const gradient=ctx.createRadialGradient(fire.x,fire.y,2,fire.x,fire.y,flicker);gradient.addColorStop(0,"rgba(255,238,150,.8)");gradient.addColorStop(.35,"rgba(255,112,68,.48)");gradient.addColorStop(1,"rgba(255,70,50,0)");ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(fire.x,fire.y,flicker,0,TAU);ctx.fill();}
  }
  function drawParticles(){for(const particle of particles){ctx.globalAlpha=clamp(particle.life/particle.maxLife,0,1);ctx.fillStyle=particle.color;ctx.beginPath();ctx.arc(particle.x,particle.y,particle.size,0,TAU);ctx.fill();}ctx.globalAlpha=1;}
  function drawFloaters(){ctx.textAlign="center";ctx.font="700 10px Consolas";for(const floater of floaters){ctx.globalAlpha=clamp(floater.life/floater.maxLife,0,1);ctx.fillStyle=floater.color;ctx.fillText(floater.text,floater.x,floater.y);}ctx.globalAlpha=1;ctx.textAlign="left";}

  function drawWorldLabels(){
    ctx.textAlign="center";
    for(const objective of OBJECTIVES){const artifact=world.artifacts[objective.id];if(world.loot.has(objective.id))continue;ctx.fillStyle=objective.color;ctx.font="700 11px Consolas";ctx.fillText(L(objective.name),artifact.x,artifact.y-42);ctx.strokeStyle=objective.color;ctx.globalAlpha=.4;ctx.beginPath();ctx.arc(artifact.x,artifact.y,32+Math.sin(world.mapPulse*2)*3,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
    const fileCrate=world.props.find(prop=>prop.state.searchable==="dawn"&&!prop.state.taken);
    if(fileCrate){ctx.fillStyle="#72c5ff";ctx.font="700 10px Microsoft YaHei UI";ctx.fillText(fileCrate.dead?L("黎明印档案残骸"):L("黎明印档案箱"),fileCrate.x,fileCrate.y-32);}
    if(player.dead&&!player.state?.removed){ctx.fillStyle="#78f0d0";ctx.font="700 11px Microsoft YaHei UI";ctx.fillText(L("回溯者尸体 · 右键回溯复活"),player.x,player.y-38);}
    ctx.fillStyle=world.loot.size>=2?"#78f0d0":"#73857f";ctx.font="700 12px Consolas";ctx.fillText(world.loot.size>=2?L("撤离艇已响应"):L("南码头 · 等待遗物"),world.escape.x,world.escape.y-78);ctx.textAlign="left";
  }

  function drawMarkers(){
    const markers=[];
    for(const objective of OBJECTIVES){if(world.loot.has(objective.id))continue;const artifact=world.artifacts[objective.id];markers.push({x:artifact.x,y:artifact.y,label:L(objective.name),color:objective.color});}
    if(world.loot.size>=2)markers.push({x:world.escape.x,y:world.escape.y,label:L("撤离"),color:"#78f0d0"});
    ctx.save();ctx.setTransform(dpr*renderScale,0,0,dpr*renderScale,0,0);ctx.font="700 10px Microsoft YaHei UI";ctx.textAlign="center";
    for(const marker of markers){let sx=marker.x-camera.x,sy=marker.y-camera.y;if(sx>65&&sx<logicalViewW-65&&sy>105&&sy<logicalViewH-90)continue;const cx=clamp(sx,330,logicalViewW-315),cy=clamp(sy,115,logicalViewH-92);const angle=Math.atan2(sy-cy,sx-cx);ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.fillStyle=marker.color;ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,-7);ctx.lineTo(-4,0);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle=marker.color;ctx.fillText(marker.label,cx,cy+19);}
    ctx.restore();
  }
  function drawRain(){
    if(!world.raining)return;ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.strokeStyle="rgba(150,200,215,.13)";ctx.lineWidth=1;for(let i=0;i<80;i++){const x=(i*173+world.time*190)%viewW,y=(i*89+world.time*330)%viewH;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-10,y+26);ctx.stroke();}ctx.restore();
  }

  function runSelfTest(){
    const checks=[];const check=(value,label)=>{if(!value)throw new Error(`Self-test failed: ${label}`);checks.push(label);};
    try{
      const guard=world.guards[0],timer=world.time;guard.x=370;guard.capture();guard.x=455;guard.capture();beginRewind(guard);rewindEntity(guard,.18);stopRewind();check(guard.x<455,"actor position rewinds");check(world.time>=timer,"city clock persists");
      check(player.maxHealth===PLAYER_HEALTH&&guard.maxHealth===CUSTODIAN_HEALTH&&world.guards[1].maxHealth===ENEMY_HEALTH,"health model uses player 100 / enemy 10 / custodian 100");
      const healthBefore=player.health;const testShot=addEntity({name:L("测试敌方弹丸"),kind:"projectile",x:player.x-40,y:player.y,vx:560,vy:0,r:5,dynamic:true,health:1,maxHealth:1,team:"city",rewindRate:2,state:{tool:"hostile",damage:1,life:1,spent:false}});updateProjectile(testShot,.1);check(player.health===healthBefore-1,"enemy projectile deals one point of damage");player.health=healthBefore;
      guard.state.alert=false;guard.state.radioed=false;guard.state.reportProgress=0;guard.capture();guard.state.alert=true;guard.state.reportProgress=1.3;guard.capture();beginRewind(guard);rewindEntity(guard,.18);stopRewind();check(!guard.state.alert,"rewind interrupts unfinished report");
      const levelBefore=world.alertLevel;escalateCityAlert(L("测试爆炸"));check(world.alertLevel===Math.min(5,levelBefore+1),"major event escalates city alert by one level");world.lastMajorEventAt=world.time-ALERT_DECAY_SECONDS;updateCityAlert();check(world.alertLevel===levelBefore,"city alert falls one level after 30 quiet seconds");
      world.alertLevel=0;world.alertScore=0;world.alertAttackChain=0;world.lastAlertAttackAt=-99;
      const chainLevel=world.alertLevel;for(let i=0;i<5;i++)recordAttack("rivet");check(world.alertLevel===chainLevel,"five attacks do not raise city alert");recordAttack("rivet");check(world.alertLevel===chainLevel+1,"six chained attacks raise city alert by one level");check(world.alertAttackChain===0,"six-attack chain resets after escalating");
      const fakeGang=createGuard(L("测试帮派"),player.x+220,player.y,[],{kind:"rival",team:"rival",gang:true});const npcChainBefore=world.alertAttackChain;const npcBullet=addEntity({name:L("测试帮派弹丸"),kind:"projectile",x:fakeGang.x,y:fakeGang.y,vx:560,vy:0,r:5,dynamic:true,health:1,maxHealth:1,team:"rival",rewindRate:2,state:{tool:"hostile",damage:GANG_DAMAGE,life:1,spent:false,ownerId:fakeGang.id}});damageEntity(world.guards[1],1,npcBullet,L("枪击"));check(world.alertAttackChain===npcChainBefore,"npc crossfire does not build the player attack chain");clearCombatTarget(world.guards[1]);fakeGang.dead=true;fakeGang.state.removed=true;
      const hostileGuard=world.guards[2];hostileGuard.x=player.x+30;hostileGuard.y=player.y;hostileGuard.state.alert=false;hostileGuard.state.lastSeenAt=0;world.attackChain=0;world.lastAttackAt=-99;world.lastHostilityAt=-99;recordAttack("rivet");recordAttack("rivet");recordAttack("rivet");check(hostileGuard.state.alert,"three chained attacks make nearby guard hostile");
      calmGuard(hostileGuard);hostileGuard.x=player.x+30;alertGuardsInPatrolRange(player.x,player.y,L("测试监控"));check(hostileGuard.state.alert,"camera lock makes an in-range guard hostile");
      calmGuard(hostileGuard);hostileGuard.x=player.x+800;alertGuardsInPatrolRange(player.x,player.y,L("测试监控"));check(!hostileGuard.state.alert,"camera lock ignores guards outside patrol range");
      const hitHealth=hostileGuard.health;damageEntity(hostileGuard,1,player,L("枪击"));check(!hostileGuard.state.alert&&hostileGuard.health===hitHealth-1&&hostileGuard.state.memoryPlayer,"one hit suspects but does not make a normal guard hostile");
      hostileGuard.state.alert=true;hostileGuard.state.lastSeenAt=world.time-GUARD_CALM_SECONDS-.1;updateGuard(hostileGuard,.1);check(!hostileGuard.state.alert&&!hostileGuard.state.memoryPlayer,"lost contact returns a hostile guard to normal patrol");
      const shockedGuard=world.guards[2];shockedGuard.state.alert=true;shockedGuard.state.stunned=SHOCK_SECONDS;shockedGuard.state.shockForgot=true;updateGuard(shockedGuard,SHOCK_SECONDS+.1);check(!shockedGuard.state.alert,"electric shock grants 5s stun then friendly amnesia");
      const door=world.doors[1];world.keys.add("archive");door.state.locked=true;door.capture();door.state.locked=false;door.state.open=true;door.capture();beginRewind(door);rewindEntity(door,.18);stopRewind();check(door.state.locked,"door lock state rewinds");check(world.keys.has("archive"),"stolen key persists");
      const archiveRelay=relayFor("archive"),powerDoor=world.doors[0];archiveRelay.state.on=true;powerDoor.state.open=false;powerDoor.state.locked=true;check(!doorPassable(powerDoor),"powered shutter blocks entry");archiveRelay.state.on=false;check(doorPassable(powerDoor),"shared power offers alternate entry");archiveRelay.state.on=true;operateDevice(world.gasControl);updateBeast(world.beast,.1);check(world.beast.state.asleep&&gasClouds.length>0,"released gas changes living security");
      guard.state.hasKey="";guard.state.stunned=2;interactWithActor(guard);check(world.disguise==="archive"&&guard.state.uniformTaken,"stunned custodian interaction falls back to taking a uniform");const evidence=createEvidence(guard.x+5,guard.y+5,"casing",L("测试弹壳"));const witness=world.guards[1];witness.x=evidence.x+10;witness.y=evidence.y;witness.state.alert=false;witness.state.radioed=false;inspectEvidence(witness,.1);check(world.discoveredEvidence.has(`evidence:${evidence.id}`),"guard discovers physical evidence");beginRewind(evidence);rewindEntity(evidence,.1);stopRewind();check(evidence.dead&&world.discoveredEvidence.has(`evidence:${evidence.id}`),"evidence erases but report persists");
      const evidenceTestTime=world.time,staleCasing=createEvidence(100,100,"casing",L("超时弹壳")),staleWitness=world.guards[1];staleWitness.x=110;staleWitness.y=100;staleWitness.state.alert=false;world.time=staleCasing.state.createdAt+EVIDENCE_ATTENTION_SECONDS-.1;check(nearestEvidenceFor(staleWitness)?.entity===staleCasing,"fresh casing draws guard attention");world.time=staleCasing.state.createdAt+EVIDENCE_ATTENTION_SECONDS+.1;check(nearestEvidenceFor(staleWitness)?.entity!==staleCasing,"casing attention expires after five seconds");world.time=evidenceTestTime;
      const barrel=world.props.find(prop=>prop.kind==="barrel"&&prop.x>2000);barrel.capture();explode(barrel);const blastNoise=noises[noises.length-1];check(blastNoise?.attendees&&blastNoise.attendees.size<=2,"large explosion attracts at most two investigators");barrel.capture();const fireCount=fires.length;beginRewind(barrel);rewindEntity(barrel,.22);stopRewind();check(!barrel.dead,"explosive reconstructs");check(fires.length===fireCount&&fireCount>0,"fire consequence persists");
      const scribe=world.guards.find(candidate=>candidate.state.scribe),dawnCrate=world.props.find(prop=>prop.state.searchable==="dawn");
      const savedScribeTest={archiveFile:world.archiveFile,dawnAuth:world.authorizations.dawn,dawnSigner:world.authorizationSigners.dawn,disguise:world.disguise,burned:new Set(world.burnedCovers),taken:dawnCrate.state.taken,dead:dawnCrate.dead,player:{x:player.x,y:player.y},scribe:{dead:scribe.dead,alert:scribe.state.alert,stunned:scribe.state.stunned,uniformTaken:scribe.state.uniformTaken}};
      world.archiveFile=false;world.authorizations.dawn=false;delete world.authorizationSigners.dawn;world.disguise="";world.burnedCovers.delete("city");dawnCrate.state.taken=false;dawnCrate.dead=false;scribe.dead=false;scribe.state.alert=false;scribe.state.stunned=0;
      issueAuthorization(scribe,true);check(!world.authorizations.dawn,"scribe refuses without archive file or patrol uniform");
      check(!dawnCrate.carryable,"archive file crate is a fixed container");player.x=dawnCrate.x;player.y=dawnCrate.y+80;check(nearestInteractable()===dawnCrate,"archive crate search range covers eighty pixels");player.y=dawnCrate.y+40;check(nearestInteractable()===dawnCrate,"archive crate is the nearest interactable");input.pressed.add("KeyE");handleInteraction(.016);input.pressed.delete("KeyE");check(world.archiveFile&&dawnCrate.state.taken,"pressing E extracts the dawn transfer file");
      issueAuthorization(scribe,true);check(!world.authorizations.dawn,"scribe refuses with the file but no patrol uniform");
      world.disguise="city";issueAuthorization(scribe,true);check(world.authorizations.dawn,"scribe signs with transfer file and patrol uniform");
      world.authorizations.dawn=false;world.burnedCovers.add("city");issueAuthorization(scribe,true);check(!world.authorizations.dawn,"burned patrol uniform cannot obtain a scribe signature");
      world.burnedCovers.delete("city");world.disguise="city";scribe.state.uniformTaken=false;scribe.state.stunned=1;interactWithActor(scribe);check(!world.authorizations.dawn&&!scribe.state.uniformTaken&&world.disguise==="city","stunned scribe cannot sign and is not pickpocketed");scribe.state.stunned=0;
      world.archiveFile=false;dawnCrate.dead=true;dawnCrate.state.taken=false;player.x=dawnCrate.x;player.y=dawnCrate.y+12;check(nearestInteractable()===dawnCrate,"destroyed archive crate remains searchable");input.pressed.add("KeyE");handleInteraction(.016);input.pressed.delete("KeyE");check(world.archiveFile,"pressing E recovers the archive file from crate debris");
      world.archiveFile=savedScribeTest.archiveFile;world.authorizations.dawn=savedScribeTest.dawnAuth;if(savedScribeTest.dawnSigner)world.authorizationSigners.dawn=savedScribeTest.dawnSigner;else delete world.authorizationSigners.dawn;world.disguise=savedScribeTest.disguise;world.burnedCovers=new Set(savedScribeTest.burned);dawnCrate.state.taken=savedScribeTest.taken;dawnCrate.dead=savedScribeTest.dead;player.x=savedScribeTest.player.x;player.y=savedScribeTest.player.y;scribe.dead=savedScribeTest.scribe.dead;scribe.state.alert=savedScribeTest.scribe.alert;scribe.state.stunned=savedScribeTest.scribe.stunned;scribe.state.uniformTaken=savedScribeTest.scribe.uniformTaken;
      check(validateAuthorizationGraph(),"three social authorization routes work");
      const solarSigner=world.guards.find(candidate=>candidate.state.custodian==="solar"),savedKeys=new Set(world.keys),savedDisguise=world.disguise,savedPlayer={x:player.x,y:player.y,rotation:player.rotation},savedSigner={x:solarSigner.x,y:solarSigner.y,rotation:solarSigner.rotation,alert:solarSigner.state.alert,stunned:solarSigner.state.stunned,hasKey:solarSigner.state.hasKey,uniformTaken:solarSigner.state.uniformTaken},savedSolarAuth=world.authorizations.solar,savedSolarSigner=world.authorizationSigners.solar,savedFoundryPower=relayFor("foundry").state.on;
      world.keys.delete("foundry");world.keys.delete("master");world.disguise="";solarSigner.state.hasKey="foundry";solarSigner.state.alert=false;solarSigner.state.stunned=0;solarSigner.state.uniformTaken=false;solarSigner.rotation=0;player.x=solarSigner.x-20;player.y=solarSigner.y;
      interactWithActor(solarSigner);check(!solarSigner.state.hasKey&&world.keys.has("foundry"),"custodian interaction falls back to pickpocket without credential");
      relayFor("foundry").state.on=false;const solarSigned=issueAuthorization(solarSigner,true);check(solarSigned&&world.authorizations.solar,"foundry custodian signs with credential and shutdown");
      world.authorizations.solar=savedSolarAuth;if(savedSolarSigner)world.authorizationSigners.solar=savedSolarSigner;else delete world.authorizationSigners.solar;world.keys.clear();for(const key of savedKeys)world.keys.add(key);world.disguise=savedDisguise;player.x=savedPlayer.x;player.y=savedPlayer.y;player.rotation=savedPlayer.rotation;solarSigner.x=savedSigner.x;solarSigner.y=savedSigner.y;solarSigner.rotation=savedSigner.rotation;solarSigner.state.alert=savedSigner.alert;solarSigner.state.stunned=savedSigner.stunned;solarSigner.state.hasKey=savedSigner.hasKey;solarSigner.state.uniformTaken=savedSigner.uniformTaken;relayFor("foundry").state.on=savedFoundryPower;
      const artifact=world.artifacts.dawn;world.authorizations.dawn=true;artifact.capture();secureArtifact(artifact);artifact.capture();beginRewind(artifact);rewindEntity(artifact,.2);stopRewind();check(!artifact.dead,"artifact reconstructs");check(world.loot.has("dawn"),"objective record persists");
      const victim=world.guards[1];victim.state.hasKey="";victim.health=1;damageEntity(victim,1,player,L("枪击"));check(victim.dead,"enemy dies at ten-point health model");const bodySite=world.bodySites[world.bodySites.length-1];world.time=bodySite.at;updateBodyResponse();const swat=entities.find(entity=>entity.state.swat);check(swat&&swat.maxHealth===ENEMY_HEALTH&&swat.state.lockedHealth&&swat.state.vision===600,"dead enemy summons three locked-health swat with double patrol range");damageEntity(swat,999,player,L("枪击"));check(!swat.dead&&swat.health===ENEMY_HEALTH,"swat health is locked");swat.state.lastAttackedAt=world.time-SWAT_CALM_SECONDS;updateSwat(swat,.1);check(!swat.state.alert&&swat.state.retreating,"attacked swat retreats after 30 calm seconds");
      world.time=swat.state.retreatDeadline+.1;updateSwat(swat,.1);check(swat.state.removed&&swat.state.noCorpse&&swat.dead,"swat escapes when retreat deadline expires");
      world.time=28;updateDirector();check(world.events.audit&&world.doors[1].state.open,"archive routine opens side door");world.time=41;updateDirector();check(world.routine.auditClosed&&!world.doors[1].state.open,"archive routine closes with history");world.time=80;updateDirector();check(world.courier&&world.valve.state.open,"moving key and foundry purge spawn");world.time=94;updateDirector();check(world.routine.purgeClosed&&!world.valve.state.open,"foundry purge ends");
      world.time=120;updateDirector();check(world.rivals.length===5&&world.gangWaveCount===1&&world.rivals.every(id=>{const gang=entityById(id);return gang?.state.gang&&gang.health===GANG_HEALTH&&gang.maxHealth===GANG_HEALTH;}),"first gang wave spawns five 15-health gangsters");
      const firstGang=entityById(world.rivals[0]);firstGang.state.shootCooldown=0;const shotsBefore=entities.filter(entity=>entity.kind==="projectile").length;actorShoot(firstGang,player);const gangShot=entities.filter(entity=>entity.kind==="projectile").slice(shotsBefore).find(entity=>entity.state.ownerId===firstGang.id);check(gangShot?.state.damage===GANG_DAMAGE,"gang projectile deals 1.5 damage");check(gangTargetPriority(world.guards[1])<gangTargetPriority(player)&&gangTargetPriority(player)<gangTargetPriority(world.beast),"gang prioritizes city characters over player");
      const prey=createGuard(L("测试仇恨目标"),firstGang.x+60,firstGang.y,[],{team:"player"});firstGang.state.combatTargetId=prey.id;damageEntity(prey,999,player,L("枪击"));check(!firstGang.state.combatTargetId,"death clears gang combat target");
      const savedPriority={player:{x:player.x,y:player.y,rotation:player.rotation},city:{x:guard.x,y:guard.y,rotation:guard.rotation},gang:{x:firstGang.x,y:firstGang.y,rotation:firstGang.rotation}};
      player.x=1120;player.y=760;player.rotation=0;guard.x=1180;guard.y=760;guard.rotation=Math.PI;firstGang.x=1100;firstGang.y=760;firstGang.rotation=0;check(chooseGangTarget(firstGang)===guard,"gang chooses city character over a closer player");clearCombatTarget(firstGang);firstGang.state.shootCooldown=0;firstGang.state.targetScanAt=0;const gangShotsBefore=entities.filter(entity=>entity.state?.ownerId===firstGang.id).length;updateGang(firstGang,.1);check(firstGang.state.combatTargetId===guard.id&&entities.filter(entity=>entity.state?.ownerId===firstGang.id).length>gangShotsBefore,"gang engages city target with gunfire");clearCombatTarget(firstGang);
      const swatWitness=entities.find(entity=>entity.state.swat&&!entity.state.removed&&!entity.state.retreating);
      if(swatWitness){const savedSwat={x:swatWitness.x,y:swatWitness.y,rotation:swatWitness.rotation};swatWitness.x=900;swatWitness.y=760;swatWitness.rotation=0;player.x=1000;player.y=760;guard.x=1010;guard.y=760;firstGang.x=1020;firstGang.y=760;const candidates=swatTargetCandidates(swatWitness);check([player,guard,firstGang].every(target=>candidates.includes(target)),"swat random scan includes player, city and gang");swatWitness.x=savedSwat.x;swatWitness.y=savedSwat.y;swatWitness.rotation=savedSwat.rotation;}
      player.x=savedPriority.player.x;player.y=savedPriority.player.y;player.rotation=savedPriority.player.rotation;guard.x=savedPriority.city.x;guard.y=savedPriority.city.y;guard.rotation=savedPriority.city.rotation;firstGang.x=savedPriority.gang.x;firstGang.y=savedPriority.gang.y;firstGang.rotation=savedPriority.gang.rotation;
      world.time=138;updateDirector();check(world.rivals.length===5&&entities.some(entity=>entity.kind==="lure"),"garden feeding arrives after the first gang wave");world.time=166;updateDirector();check(world.raining&&!powerOn("archive")&&!powerOn("foundry"),"storm changes shared power state");world.alertLevel=3;world.alertScore=60;updateSecurityResponse();check(world.responseLevels.has(3)&&world.reinforcements.length>=2,"evidence escalation creates coordinated response");world.time=226;updateDirector();check(world.lockdown&&world.doors.every(door=>door.dead||door.state.locked),"lockdown changes surviving doors");world.time=240;updateDirector();check(world.rivals.length===10&&world.gangWaveCount===2,"second gang wave arrives at 240 seconds");
      check(!guard.state.handover&&authorizationReady("dawn",guard)&&!authorizationBlocker("dawn",guard),"archive handover can be rechecked after the first window");
      world.loot.add("memory");renderObjectives();showResults(true);check(!ui.result.classList.contains("hidden")&&ui.resultGrid.children.length===9,"goal completion renders");
      document.body.dataset.selftest=`pass:${checks.join("|")}`;
    }catch(error){document.body.dataset.selftest=`fail:${error.message}`;console.error(error);}
  }

  function frame(now){
    const dt=Math.min(.033,Math.max(0,(now-lastFrame)/1000));lastFrame=now;update(dt);render();requestAnimationFrame(frame);
  }
  window.addEventListener("i18n:change", () => {
    if (playing) return;
    resetGame(false);
    updateUI();
  });

  requestAnimationFrame(frame);
})();

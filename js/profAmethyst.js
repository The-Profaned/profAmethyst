/// <reference path="./types/titan-plugin-sdk.d.ts" />
/// <reference path="./types/titan-gamevals.d.ts" />

/*
 * [Prof] Amethyst - Mining Guild amethyst miner + chisel crafter for TitanClient (QuickJS).
 *
 * Run: `.\gradlew.bat runViaTitan` (dev tab, hot reload) or `.\js\deploy.ps1`
 * (permanent install), then enable "[Prof] Amethyst". See js/README.md.
 *
 * Loop:
 *   walk to mining area -> mine amethyst (least crowded crystal) -> inventory
 *   full: chisel into the selected product -> gem bag/sack full: open the
 *   bank chest, "Empty" the container into the bank, deposit loose gems ->
 *   walk back -> repeat.
 *   If every crystal in the area is crowded, hop to another members world.
 *
 * ============================================================================
 *  FILL-IN SECTION - edit these before running
 * ============================================================================
 *
 *  [REQUIRED] 1. MINING AREAS
 *     PUBLIC_MINING_AREA  - the normal amethyst section of the Mining Guild.
 *     PRIVATE_MINING_AREA - the Falador ELITE diary-only amethyst section.
 *     Format: new titan.WorldArea(x, y, width, height, plane), where (x, y)
 *     is the SOUTH-WEST corner in absolute world tiles. Draw them broad
 *     enough to cover every crystal plus the tiles miners stand on. The
 *     private area can only be entered with the Falador elite diary done, so
 *     the plugin only walks there when that diary's varbit is set.
 *
 *  [VERIFY] 2. MAKE_X_OPTION_ORDER
 *     Fallback only: the order the chisel Make-X menu lists the amethyst
 *     products in, used for the 1-4 hotkey when the plugin can't match the
 *     product button by item id.
 *
 *  [OPTIONAL] 3. WORLD HOP FILTERS
 *     HOP_WORLD_WHITELIST (only hop to these worlds, [] = any members world),
 *     HOP_REGIONS (e.g. ["US", "UK"], matched against world metadata region,
 *     [] = any), HOP_MAX_POPULATION, HOP_ACTIVITY_BLACKLIST.
 *
 *  [OPTIONAL] 4. MINING_ANIMATION_IDS
 *     Animations that count as "mining" when judging crowding: one id or an
 *     array of ids. null = built from every titan.gamevals.AnimationID key
 *     containing MINING + PICKAXE.
 * ============================================================================
 */

const CONFIG = {
    // 1. [REQUIRED] new titan.WorldArea(x, y, width, height, plane)
    PUBLIC_MINING_AREA: new titan.WorldArea(3017, 9698, 13, 10, 0),
    PRIVATE_MINING_AREA: new titan.WorldArea(3001, 9705, 12, 10, 0),

    // 2. Product keys in the order the Make-X interface shows them.
    MAKE_X_OPTION_ORDER: ["BOLT_TIPS", "ARROWTIPS", "JAVELIN_HEADS", "DART_TIPS"],

    // 3.
    HOP_WORLD_WHITELIST: [],
    HOP_REGIONS: [],
    HOP_MAX_POPULATION: 1500,
    HOP_ACTIVITY_BLACKLIST: [
        "skill total", "pvp", "high risk", "deadman", "beta", "fresh start",
        "tournament", "speedrun", "league", "bounty", "last man", "lms",
        "grid", "seasonal", "private", "wilderness", "restricted",
    ],

    // 4.
    MINING_ANIMATION_IDS: null,

    // Tuning.
    OBJECT_SCAN_RADIUS: 40,
    CROWD_CHECK_INTERVAL_TICKS: 5,
    // A crowd must be seen on this many consecutive checks before hopping,
    // so a player walking past doesn't trigger a hop.
    CROWD_CONFIRM_CHECKS: 3,
    GEAR_WARN_INTERVAL_TICKS: 1000, // ~10 minutes
    HOP_TIMEOUT_TICKS: 40,
};

// ---------------------------------------------------------------------------
// Game ids (verified against titan-gamevals.d.ts)
// ---------------------------------------------------------------------------

const ITEM = {
    AMETHYST: 21347,
    CHISEL: 1755,
    UNCUT_DIAMOND: 1617,
    UNCUT_RUBY: 1619,
    UNCUT_EMERALD: 1621,
    UNCUT_SAPPHIRE: 1623,
    UNCUT_OPAL: 1625,
    UNCUT_JADE: 1627,
    UNCUT_RED_TOPAZ: 1629,
    UNCUT_DRAGONSTONE: 1631,
};

const VARROCK_ARMOUR = { 13104: 1, 13105: 2, 13106: 3, 13107: 4 };
const VARROCK_ARMOUR_ELITE = 13107;

const MINING_GLOVES = { 21343: "Mining gloves", 21345: "Superior mining gloves", 21392: "Expert mining gloves" };
const MINING_GLOVES_EXPERT = 21392;

const AMETHYST_ROCK_IDS = [11388, 11389]; // AMETHYSTROCK1/2; 11393 is the depleted wall

const GEM_CONTAINERS = [
    {
        name: "gem bag",
        closedId: 12020,
        openId: 24481,
        holds: [ITEM.UNCUT_SAPPHIRE, ITEM.UNCUT_EMERALD, ITEM.UNCUT_RUBY, ITEM.UNCUT_DIAMOND, ITEM.UNCUT_DRAGONSTONE],
    },
    {
        name: "gem sack",
        closedId: 33393,
        openId: 33395,
        holds: [ITEM.UNCUT_SAPPHIRE, ITEM.UNCUT_EMERALD, ITEM.UNCUT_RUBY, ITEM.UNCUT_DIAMOND, ITEM.UNCUT_DRAGONSTONE,
                ITEM.UNCUT_OPAL, ITEM.UNCUT_JADE, ITEM.UNCUT_RED_TOPAZ],
    },
];
const ALL_UNCUT_GEM_IDS = GEM_CONTAINERS[1].holds;

// Crafting products from one amethyst with a chisel (wiki: Amethyst).
const PRODUCTS = {
    BOLT_TIPS:     { key: "BOLT_TIPS",     name: "Amethyst bolt tips",     itemId: 21338, level: 83 },
    ARROWTIPS:     { key: "ARROWTIPS",     name: "Amethyst arrowtips",     itemId: 21350, level: 85 },
    JAVELIN_HEADS: { key: "JAVELIN_HEADS", name: "Amethyst javelin heads", itemId: 21352, level: 87 },
    DART_TIPS:     { key: "DART_TIPS",     name: "Amethyst dart tips",     itemId: 25853, level: 89 },
};
const PRODUCT_BY_LEVEL_DESC = [PRODUCTS.DART_TIPS, PRODUCTS.JAVELIN_HEADS, PRODUCTS.ARROWTIPS, PRODUCTS.BOLT_TIPS];

// titan.Varbits.DIARY_FALADOR_ELITE / VarbitID.FALADOR_DIARY_ELITE_COMPLETE.
const FALADOR_ELITE_DIARY_VARBIT = 4465;

const MINING_LEVEL_REQUIRED = 92;
const MINING_GUILD_INVISIBLE_BOOST = 7;

// Make-X (interface 270, "Skillmulti").
const SKILLMULTI_GROUP = 270;
const SKILLMULTI_ALL_CHILD = 12;
const SKILLMULTI_FIRST_BUTTON_CHILD = 15; // "A"; buttons run A..P
const CC_OP = 57;

// WebWalkPhase values.
const WALK_ARRIVED = 4;

const State = {
    WALK_TO_AREA: "Walking to mining area",
    MINING: "Mining",
    CRAFTING: "Crafting",
    BANKING: "Banking",
    HOPPING: "Hopping worlds",
    STOPPED: "Stopped",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMiningAnimationSet() {
    const configured = CONFIG.MINING_ANIMATION_IDS;
    if (configured != null) {
        return new Set(Array.isArray(configured) ? configured : [configured]);
    }
    const ids = new Set();
    try {
        const anims = titan.gamevals.AnimationID;
        for (const key of Object.keys(anims)) {
            if (key.includes("MINING") && key.includes("PICKAXE") && typeof anims[key] === "number") {
                ids.add(anims[key]);
            }
        }
    } catch (e) {
        titan.log("[ProfAmethyst] gamevals unavailable; any animation will count as mining.");
    }
    return ids;
}

/** Chebyshev distance from a point to an object's footprint (0 = on it). */
function distanceToFootprint(p, obj) {
    const wp = obj.worldPoint;
    if (p.z !== wp.z) return Number.MAX_SAFE_INTEGER;
    const maxX = wp.x + Math.max(obj.sizeX, 1) - 1;
    const maxY = wp.y + Math.max(obj.sizeY, 1) - 1;
    const dx = Math.max(wp.x - p.x, 0, p.x - maxX);
    const dy = Math.max(wp.y - p.y, 0, p.y - maxY);
    return Math.max(dx, dy);
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

class ProfAmethystPlugin extends titan.Plugin {
    id = "prof_amethyst";
    name = "[Prof] Amethyst";
    description = "Mines amethyst in the Mining Guild, chisels it, banks gem bag contents and hops crowded worlds.";
    author = "Prof";
    version = "0.1.0";

    general = this.section("general", "General", { position: 0 });
    crowding = this.section("crowding", "Crowding & world hopping", { position: 1 });

    product = this.comboSetting({
        key: "product", name: "Craft into", default: 0, section: this.general, position: 0,
        tooltip: "Auto picks the highest product your Crafting level allows.",
        choices: [
            { value: 0, label: "Auto (best for level)" },
            { value: 1, label: "Bolt tips (83)" },
            { value: 2, label: "Arrowtips (85)" },
            { value: 3, label: "Javelin heads (87)" },
            { value: 4, label: "Dart tips (89)" },
        ],
    });
    areaMode = this.comboSetting({
        key: "areaMode", name: "Mining area", default: 0, section: this.general, position: 1,
        tooltip: "Auto uses the private area when the Falador elite diary is complete.",
        choices: [
            { value: 0, label: "Auto (Falador diary)" },
            { value: 1, label: "Public area" },
            { value: 2, label: "Private (elite) area" },
        ],
    });
    warnGear = this.boolSetting({
        key: "warnGear", name: "Warn about missing gear", default: true, section: this.general, position: 2,
        tooltip: "Warn in chat when Varrock armour / mining gloves aren't worn.",
    });

    crowdThreshold = this.intSetting({
        key: "crowdThreshold", name: "Crowded at N other miners", default: 2, min: 1, max: 10,
        section: this.crowding, position: 0,
        tooltip: "A crystal counts as crowded when this many other players are mining inside its 3x3 area.",
    });
    crowdRadius = this.intSetting({
        key: "crowdRadius", name: "Crowd radius (tiles)", default: 1, min: 1, max: 5,
        section: this.crowding, position: 1,
        tooltip: "1 = the 3x3 around the crystal.",
    });
    hopEnabled = this.boolSetting({
        key: "hopEnabled", name: "Hop when every spot is crowded", default: true,
        section: this.crowding, position: 2,
    });
    hopCooldownSec = this.intSetting({
        key: "hopCooldownSec", name: "Min seconds between hops", default: 60, min: 15, max: 900,
        section: this.crowding, position: 3,
    });

    sceneOverlay = this.overlay({
        layer: "AboveScene",
        render: () => {
            if (this.targetRock && this.targetRock.exists) {
                titan.overlay.tileObjectOutline(this.targetRock, 0xFFB06BFF);
            }
        },
    });
    hudOverlay = this.overlay({
        layer: "AboveWidgets",
        render: () => {
            titan.overlay.screenText(10, 40, `Prof Amethyst: ${this.status || "Idle"}`, 0xFFD9B3FF);
        },
    });

    onEnable() {
        this.state = State.STOPPED;
        this.status = "Starting";
        this.waitUntil = 0;
        this.walkHandle = null;
        this.walkFailures = 0;
        this.targetRock = null;
        this.idleTicks = 0;
        this.lastCrowdCheck = 0;
        this.crowdStrikes = 0;
        this.gemFull = false;
        this.fillTick = -1;
        this.bankStep = "open";
        this.bankRounds = 0;
        this.craftAttempts = 0;
        this.lastAmethystCount = -1;
        this.lastCraftProgressTick = 0;
        this.makeAllSet = false;
        this.hopTarget = -1;
        this.hopStartTick = 0;
        this.lastHopAt = 0;
        this.lastGearWarnTick = -CONFIG.GEAR_WARN_INTERVAL_TICKS;
        this.miningAnims = buildMiningAnimationSet();
        this.area = null;
        this.started = false;
    }

    onDisable() {
        this.cancelWalk();
        this.state = State.STOPPED;
        this.targetRock = null;
    }

    onSettingChanged(key) {
        if (key === "areaMode" && this.started) {
            this.area = this.resolveArea();
            this.targetRock = null;
            if (this.state === State.MINING) this.setState(State.WALK_TO_AREA);
        }
    }

    // --- lifecycle -----------------------------------------------------------

    /** Deferred to the first logged-in tick so varbits/equipment are readable. */
    start(tick) {
        this.started = true;
        if (!CONFIG.PUBLIC_MINING_AREA && !CONFIG.PRIVATE_MINING_AREA) {
            return this.stop("No mining area configured. Fill in PUBLIC_MINING_AREA / PRIVATE_MINING_AREA at the top of profAmethyst.js.");
        }
        if (!this.checkRequiredItems()) return;
        this.checkGear(tick, true);
        this.area = this.resolveArea();
        if (!this.area) return;
        this.setState(this.inventoryCount(ITEM.AMETHYST) > 0 && titan.utils.inventory.isFull
            ? State.CRAFTING : State.WALK_TO_AREA);
    }

    stop(reason) {
        this.cancelWalk();
        this.state = State.STOPPED;
        this.status = `Stopped: ${reason}`;
        this.warn(`Stopped - ${reason}`);
    }

    setState(next) {
        if (this.state !== next) titan.log(`[ProfAmethyst] ${this.state} -> ${next}`);
        this.state = next;
        this.status = next;
    }

    onGameTick(tick) {
        if (!titan.state.login.isLoggedIn) return; // hopping / logged out
        const me = titan.state.client.localPlayer;
        if (!me) return;

        if (!this.started) this.start(tick);
        if (this.state === State.STOPPED) return;

        if (this.state === State.HOPPING) return this.tickHopping(tick);
        if (tick < this.waitUntil) return;

        // Level-ups interrupt crafting/mining; clear them.
        if (titan.utils.dialogue.continueWidgetPackedId !== 0 && !this.isMakeXOpen()) {
            titan.utils.dialogue.continueDialogue();
            return this.wait(tick, 1);
        }

        this.checkGear(tick, false);

        switch (this.state) {
            case State.WALK_TO_AREA: return this.tickWalkToArea(tick, me);
            case State.MINING:       return this.tickMining(tick, me);
            case State.CRAFTING:     return this.tickCrafting(tick, me);
            case State.BANKING:      return this.tickBanking(tick, me);
        }
    }

    wait(tick, ticks) {
        this.waitUntil = tick + ticks;
    }

    // --- checks --------------------------------------------------------------

    checkRequiredItems() {
        if (!titan.utils.inventory.contains(ITEM.CHISEL)) {
            this.stop("No chisel in the inventory.");
            return false;
        }
        if (!this.findGemContainer()) {
            this.stop("No gem bag or gem sack in the inventory.");
            return false;
        }
        if (!titan.utils.equipment.find("pickaxe") && !titan.utils.inventory.find("pickaxe")) {
            this.stop("No pickaxe equipped or in the inventory.");
            return false;
        }
        const mining = titan.state.skills.real(titan.Skill.MINING);
        if (mining + MINING_GUILD_INVISIBLE_BOOST < MINING_LEVEL_REQUIRED) {
            this.warn(`Mining level ${mining} is too low for amethyst (${MINING_LEVEL_REQUIRED}, the guild's +${MINING_GUILD_INVISIBLE_BOOST} boost included).`);
        }
        return true;
    }

    /** Warn about Varrock armour / mining gloves, on start and then periodically. */
    checkGear(tick, force) {
        if (!this.warnGear.value) return;
        if (!force && tick - this.lastGearWarnTick < CONFIG.GEAR_WARN_INTERVAL_TICKS) return;
        this.lastGearWarnTick = tick;

        const equipment = titan.utils.equipment;
        const armour = equipment.getByIds(Object.keys(VARROCK_ARMOUR).map(Number))[0];
        if (!armour) {
            this.warn("Varrock armour is not equipped (Varrock armour 4 gives a chance of double amethyst).");
        } else if (armour.id !== VARROCK_ARMOUR_ELITE) {
            this.warn(`Varrock armour ${VARROCK_ARMOUR[armour.id]} is equipped, but only Varrock armour 4 affects amethyst.`);
        }

        const gloves = equipment.getByIds(Object.keys(MINING_GLOVES).map(Number))[0];
        if (!gloves) {
            this.warn("Mining gloves are not equipped (Expert mining gloves can stop crystals depleting).");
        } else if (gloves.id !== MINING_GLOVES_EXPERT) {
            this.warn(`${MINING_GLOVES[gloves.id]} are equipped, but only Expert mining gloves affect amethyst.`);
        }
    }

    warn(message) {
        titan.log(`[ProfAmethyst] ${message}`);
        titan.chat.system(`<col=b06bff>[Prof Amethyst]</col> ${message}`);
    }

    /** Pick the mining area from the setting and the Falador elite diary varbit. */
    resolveArea() {
        const eliteDone = titan.state.vars.varbit(FALADOR_ELITE_DIARY_VARBIT) > 0;
        const mode = this.areaMode.value;
        const wantPrivate = mode === 2 || (mode === 0 && eliteDone);

        if (wantPrivate && !eliteDone) {
            this.warn("Private area selected but the Falador elite diary isn't complete; using the public area.");
        } else if (wantPrivate && CONFIG.PRIVATE_MINING_AREA) {
            this.warn("Falador elite diary complete: mining in the private amethyst area.");
            return CONFIG.PRIVATE_MINING_AREA;
        } else if (wantPrivate) {
            this.warn("PRIVATE_MINING_AREA is not configured; using the public area.");
        }

        if (!CONFIG.PUBLIC_MINING_AREA) {
            this.stop("PUBLIC_MINING_AREA is not configured and the private area can't be used.");
            return null;
        }
        return CONFIG.PUBLIC_MINING_AREA;
    }

    /** Selected product, falling back to the best one the Crafting level allows. */
    resolveProduct() {
        const level = titan.state.skills.boosted(titan.Skill.CRAFTING);
        const choice = [null, PRODUCTS.BOLT_TIPS, PRODUCTS.ARROWTIPS, PRODUCTS.JAVELIN_HEADS, PRODUCTS.DART_TIPS][this.product.value];
        if (choice && level >= choice.level) return choice;
        const best = PRODUCT_BY_LEVEL_DESC.find(p => level >= p.level) || null;
        if (choice && best) this.warn(`Crafting ${level} is too low for ${choice.name}; making ${best.name} instead.`);
        return best;
    }

    // --- inventory helpers ----------------------------------------------------

    inventoryCount(id) {
        return titan.utils.inventory.count(id);
    }

    findGemContainer() {
        for (const def of GEM_CONTAINERS) {
            const open = titan.utils.inventory.find(def.openId);
            if (open) return { def, item: open, isOpen: true };
            const closed = titan.utils.inventory.find(def.closedId);
            if (closed) return { def, item: closed, isOpen: false };
        }
        return null;
    }

    markGemFull(reason) {
        if (!this.gemFull) this.warn(`Gem container full (${reason}); will bank after crafting.`);
        this.gemFull = true;
    }

    /**
     * No var exposes the gem bag/sack contents, so "full" is inferred: an open
     * container auto-collects mined gems, so an uncut gem (amethyst doesn't
     * count) showing up in the inventory means the container is full. A
     * "Fill" is tried first; if the gem goes into the container it wasn't
     * full, otherwise it's marked full and the plugin banks after crafting.
     */
    updateGemFull(tick) {
        if (this.gemFull) return;
        const container = this.findGemContainer();
        if (!container) return this.stop("Gem bag/sack is no longer in the inventory.");

        if (!container.isOpen) {
            container.item.interact("Open");
            this.wait(tick, 1);
            return;
        }

        const looseGems = titan.utils.inventory.getByIds(ALL_UNCUT_GEM_IDS);
        if (looseGems.length === 0) {
            this.fillTick = -1;
            return;
        }
        if (this.fillTick < 0) {
            container.item.interact("Fill");
            this.fillTick = tick;
            this.wait(tick, 1);
            return;
        }
        if (tick - this.fillTick >= 3) this.markGemFull("gems overflowing into inventory");
    }

    // --- walking --------------------------------------------------------------

    /** Returns "walking", "arrived" or "failed". */
    walkTo(point, radius) {
        if (this.walkHandle != null) {
            const status = titan.webWalk.status(this.walkHandle);
            if (status && !status.finished) return "walking";
            const arrived = status && status.phase === WALK_ARRIVED;
            titan.webWalk.release(this.walkHandle);
            this.walkHandle = null;
            return arrived ? "arrived" : "failed";
        }
        const handle = titan.webWalk.walkTo(point, { arriveRadius: radius });
        if (handle == null) return "failed";
        this.walkHandle = handle;
        return "walking";
    }

    cancelWalk() {
        if (this.walkHandle != null) {
            titan.webWalk.cancel(this.walkHandle);
            titan.webWalk.release(this.walkHandle);
            this.walkHandle = null;
        }
    }

    tickWalkToArea(tick, me) {
        if (this.area.contains(me.worldPoint)) {
            this.cancelWalk();
            this.walkFailures = 0;
            return this.setState(State.MINING);
        }
        const radius = Math.max(1, Math.floor(Math.min(this.area.width, this.area.height) / 2) - 1);
        const result = this.walkTo(this.area.center(), radius);
        if (result === "failed") {
            this.walkFailures++;
            if (this.walkFailures >= 5) return this.stop("Couldn't path to the mining area. Check the area coordinates.");
            this.wait(tick, 3);
        }
    }

    // --- mining ---------------------------------------------------------------

    isMining(player) {
        if (player.animation === -1) return false;
        return this.miningAnims.size === 0 || this.miningAnims.has(player.animation);
    }

    /** Crystals in the area, least crowded first, then nearest. */
    rankRocks(me) {
        const radius = this.crowdRadius.value;
        const rocks = titan.queries.objects(CONFIG.OBJECT_SCAN_RADIUS)
            .ids(...AMETHYST_ROCK_IDS)
            .within(this.area)
            .toArray();
        const miners = titan.queries.players()
            .excludingSelf()
            .within(this.area)
            .where(p => this.isMining(p))
            .toArray();
        return rocks
            .map(rock => ({
                rock,
                crowd: miners.filter(p => distanceToFootprint(p.worldPoint, rock) <= radius).length,
                dist: distanceToFootprint(me.worldPoint, rock),
            }))
            .sort((a, b) => a.crowd - b.crowd || a.dist - b.dist);
    }

    tickMining(tick, me) {
        this.updateGemFull(tick);
        if (this.state !== State.MINING || tick < this.waitUntil) return;

        const hasAmethyst = this.inventoryCount(ITEM.AMETHYST) > 0;
        if (titan.utils.inventory.isFull || this.gemFull) {
            this.targetRock = null;
            if (hasAmethyst) return this.setState(State.CRAFTING);
            return this.setState(State.BANKING);
        }
        if (!this.area.contains(me.worldPoint)) {
            this.targetRock = null;
            return this.setState(State.WALK_TO_AREA);
        }

        const mining = this.isMining(me);
        this.idleTicks = mining || !me.isStationary ? 0 : this.idleTicks + 1;
        const rockGone = !this.targetRock || !this.targetRock.exists;

        // Re-evaluate crowding periodically while mining, or whenever a new rock is needed.
        const crowdDue = tick - this.lastCrowdCheck >= CONFIG.CROWD_CHECK_INTERVAL_TICKS;
        const needRock = rockGone || this.idleTicks >= 2;
        if (!crowdDue && !needRock) return;
        this.lastCrowdCheck = tick;

        const ranked = this.rankRocks(me);
        if (ranked.length === 0) {
            this.status = "Waiting for crystals to respawn";
            return;
        }

        const threshold = this.crowdThreshold.value;
        const best = ranked[0];
        const current = this.targetRock && ranked.find(r => r.rock === this.targetRock);
        const allCrowded = best.crowd >= threshold;

        if (allCrowded) {
            this.crowdStrikes++;
            this.status = `Every spot crowded (${this.crowdStrikes}/${CONFIG.CROWD_CONFIRM_CHECKS})`;
            if (this.crowdStrikes >= CONFIG.CROWD_CONFIRM_CHECKS && this.tryHop(tick)) return;
        } else {
            this.crowdStrikes = 0;
        }

        // Switch rocks when the current one is crowded and a quieter one exists.
        const currentCrowded = current && current.crowd >= threshold && best.crowd < current.crowd;
        if (!needRock && !currentCrowded) {
            if (!allCrowded) this.status = State.MINING;
            return;
        }

        if (best.rock.interact("Mine")) {
            this.targetRock = best.rock;
            this.idleTicks = 0;
            if (!allCrowded) this.status = `Mining (${best.crowd} nearby)`;
            this.wait(tick, 2);
        }
    }

    // --- crafting -------------------------------------------------------------

    isMakeXOpen() {
        const root = titan.state.widgets.find(titan.state.widgets.pack(SKILLMULTI_GROUP, 0));
        return !!(root && root.visible);
    }

    /** Click the product's button in the Make-X menu; fall back to its 1-4 hotkey. */
    selectMakeXProduct(product) {
        const widgets = titan.state.widgets;
        if (!this.makeAllSet) {
            const all = widgets.find(widgets.pack(SKILLMULTI_GROUP, SKILLMULTI_ALL_CHILD));
            if (all && all.visible) all.interact(CC_OP, 1);
            this.makeAllSet = true;
        }
        const needle = product.name.toLowerCase();
        for (let i = 0; i < 16; i++) {
            const button = widgets.find(widgets.pack(SKILLMULTI_GROUP, SKILLMULTI_FIRST_BUTTON_CHILD + i));
            if (!button || !button.visible) continue;
            const matches = (w) => w.itemId === product.itemId || (w.text || "").toLowerCase().includes(needle);
            if (matches(button) || widgets.children(button.packedId).some(matches)) {
                return button.interact(CC_OP, 1);
            }
        }
        const index = CONFIG.MAKE_X_OPTION_ORDER.indexOf(product.key);
        if (index < 0) return false;
        return titan.keyboard.sendString(String(index + 1));
    }

    tickCrafting(tick, me) {
        const amethyst = this.inventoryCount(ITEM.AMETHYST);
        if (amethyst === 0) {
            this.craftAttempts = 0;
            this.lastAmethystCount = -1;
            return this.setState(this.gemFull || titan.utils.inventory.isFull ? State.BANKING : State.MINING);
        }

        if (amethyst !== this.lastAmethystCount) {
            if (this.lastAmethystCount !== -1 && amethyst < this.lastAmethystCount) {
                this.lastCraftProgressTick = tick;
                this.craftAttempts = 0;
            }
            this.lastAmethystCount = amethyst;
        }

        const product = this.resolveProduct();
        if (!product) return this.stop("Crafting level is below 83; no amethyst product can be made.");

        if (this.isMakeXOpen()) {
            this.selectMakeXProduct(product);
            this.lastCraftProgressTick = tick;
            return this.wait(tick, 2);
        }

        // Still cutting: amethyst count dropped recently.
        if (tick - this.lastCraftProgressTick < 5) return;

        if (this.craftAttempts >= 4) return this.stop("Crafting isn't progressing (chisel -> amethyst didn't start).");
        const chisel = titan.utils.inventory.find(ITEM.CHISEL);
        const stone = titan.utils.inventory.find(ITEM.AMETHYST);
        if (!chisel) return this.stop("Chisel is missing.");
        if (chisel.useOn(stone)) {
            this.craftAttempts++;
            this.status = `Crafting ${product.name}`;
            this.wait(tick, 2);
        }
    }

    // --- banking --------------------------------------------------------------

    /** Opens the closest bank (the Mining Guild's bank chest). */
    openBank(tick, me) {
        const bank = titan.utils.bank;
        if (bank.isPinVisible) return this.stop("Bank PIN prompt is open. Enter it manually, then re-enable the plugin.");

        // bank.open() walks to the bank itself; don't re-click while still moving.
        if (!me.isStationary) return;

        if (!bank.open()) {
            const chest = titan.queries.objects(CONFIG.OBJECT_SCAN_RADIUS).nameContains("Bank chest").nearest();
            if (!chest || !(chest.interact("Use") || chest.interact("Bank"))) {
                return this.stop("Couldn't find the bank chest.");
            }
        }
        this.wait(tick, 3);
    }

    tickBanking(tick, me) {
        const bank = titan.utils.bank;
        if (!bank.isOpen) {
            if (this.bankStep === "done") return this.finishBanking();
            this.bankStep = "open";
            return this.openBank(tick, me);
        }
        this.cancelWalk();

        switch (this.bankStep) {
            case "open":
                this.bankRounds = 0;
                this.bankStep = "empty";
                return;
            case "empty": {
                // Empty the gem bag/sack into the bank; the container itself stays in the inventory.
                const container = this.findGemContainer();
                if (!container) return this.stop("Gem bag/sack disappeared while banking.");
                container.item.interact("Empty");
                this.bankRounds++;
                this.bankStep = "deposit";
                return this.wait(tick, 2);
            }
            case "deposit": {
                // Only gems are banked. If "Empty" sent them to the inventory
                // instead of the bank, deposit them and empty again.
                const gemIds = [...new Set(titan.utils.inventory.getByIds(ALL_UNCUT_GEM_IDS).map(i => i.id))];
                gemIds.forEach(id => bank.depositAllOfItem(id));
                this.bankStep = gemIds.length > 0 && this.bankRounds < 6 ? "empty" : "close";
                return this.wait(tick, 2);
            }
            case "close":
                bank.close();
                this.bankStep = "done";
                return this.wait(tick, 1);
            case "done":
                bank.close();
                return this.wait(tick, 1);
        }
    }

    finishBanking() {
        this.bankStep = "open";
        this.gemFull = false;
        this.fillTick = -1;
        this.targetRock = null;
        this.setState(State.WALK_TO_AREA);
    }

    // --- world hopping --------------------------------------------------------

    pickWorld() {
        const current = titan.state.world.current();
        const blacklist = CONFIG.HOP_ACTIVITY_BLACKLIST.map(s => s.toLowerCase());
        const whitelist = CONFIG.HOP_WORLD_WHITELIST;
        const regions = CONFIG.HOP_REGIONS.map(r => r.toLowerCase());

        let ids = titan.state.world.metadata().filter(w =>
            w.isMembers && !w.isBeta && w.id !== current
            && (whitelist.length === 0 || whitelist.includes(w.id))
            && (regions.length === 0 || regions.includes((w.region || "").toLowerCase()))
            && !blacklist.some(b => (w.activity || "").toLowerCase().includes(b))
            && (w.population < 0 || w.population <= CONFIG.HOP_MAX_POPULATION))
            .map(w => w.id);

        if (ids.length === 0) {
            // No SLR metadata; fall back to the native list (no activity info there).
            ids = titan.state.world.list().filter(w =>
                w.isMembers && !w.isBeta && w.id !== current
                && (whitelist.length === 0 || whitelist.includes(w.id)))
                .map(w => w.id);
        }
        return ids.length ? shuffle(ids)[0] : -1;
    }

    tryHop(tick) {
        if (!this.hopEnabled.value) return false;
        if (Date.now() - this.lastHopAt < this.hopCooldownSec.value * 1000) return false;

        const world = this.pickWorld();
        if (world < 0) {
            this.warn("Every spot is crowded but no suitable world was found to hop to.");
            this.lastHopAt = Date.now();
            return false;
        }
        this.cancelWalk();
        if (titan.utils.bank.isOpen) titan.utils.bank.close();
        if (!titan.state.world.hopIngame(world)) return false;

        this.warn(`Every amethyst spot is crowded - hopping to world ${world}.`);
        this.lastHopAt = Date.now();
        this.hopTarget = world;
        this.hopStartTick = tick;
        this.crowdStrikes = 0;
        this.targetRock = null;
        this.setState(State.HOPPING);
        return true;
    }

    tickHopping(tick) {
        if (titan.state.world.current() === this.hopTarget) {
            this.hopTarget = -1;
            this.lastCrowdCheck = 0;
            return this.setState(State.WALK_TO_AREA);
        }
        if (tick - this.hopStartTick > CONFIG.HOP_TIMEOUT_TICKS) {
            this.warn(`Hop to world ${this.hopTarget} timed out; carrying on in this world.`);
            this.hopTarget = -1;
            this.setState(State.WALK_TO_AREA);
        }
    }
}

titan.register(new ProfAmethystPlugin());

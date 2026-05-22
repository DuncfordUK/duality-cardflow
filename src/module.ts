import { mount } from 'svelte';
import PlayerArea    from './components/PlayerArea.svelte';
import GmDashboard   from './components/GmDashboard.svelte';
import TheStage      from './components/TheStage.svelte';
import CardSpotlight from './components/CardSpotlight.svelte';
import CardReveal    from './components/CardReveal.svelte';
import HopeReveal    from './components/HopeReveal.svelte';

export const MODULE_ID = 'duality-cardflow';

type AnimationSpeed = 'fast' | 'normal' | 'cinematic';

interface DomainCardData {
  id: string; name: string; img: string;
  itemId?: string;     // real Foundry item id for identity cards (id is a stable display id)
  level?: number; recallCost?: number; description?: string; subtype?: string;
  domain?: string;     // e.g. "grace", "midnight", "blade"
  uses?: { value: number; max: number };
}

type AreaInstance = {
  addDomainCard:    (card: DomainCardData) => void;
  removeDomainCard: (id: string, mode?: 'play' | 'discard') => void;
  getDomainCardIds: () => string[];
  clearDomainCards: () => void;
  updateDomainCard: (id: string, updates: Partial<DomainCardData>) => void;
};

type SpotlightInstance    = { show: (card: DomainCardData) => void };
type RevealInstance       = { show: (data: any) => void };
type HopeRevealInstance   = { show: (data: any) => void };

const SPEED_MS: Record<AnimationSpeed, number> = { fast: 200, normal: 400, cinematic: 850 };
let areaInstance:       AreaInstance      | null = null;
let spotlightInstance:  SpotlightInstance | null = null;
let revealInstance:     RevealInstance    | null = null;
let hopeRevealInstance: HopeRevealInstance | null = null;

interface RevealData { id: string; name: string; img: string; domain?: string; subtype?: string; cardType?: string; featureName?: string; }
let pendingReveal: RevealData | null = null;

interface HopeRevealData { id: string; name: string; img: string; }
let pendingHopeReveal: HopeRevealData | null = null;

// ─── Settings ────────────────────────────────────────────────────────────────

export function registerSettings(): void {
  game.settings.register(MODULE_ID, 'animationSpeed', {
    name: game.i18n.localize('DUALITY_CARDFLOW.Settings.AnimationSpeed.Name'),
    hint: game.i18n.localize('DUALITY_CARDFLOW.Settings.AnimationSpeed.Hint'),
    scope: 'client',
    config: true,
    type: String,
    default: 'normal',
    choices: {
      fast:      game.i18n.localize('DUALITY_CARDFLOW.Settings.AnimationSpeed.Fast'),
      normal:    game.i18n.localize('DUALITY_CARDFLOW.Settings.AnimationSpeed.Normal'),
      cinematic: game.i18n.localize('DUALITY_CARDFLOW.Settings.AnimationSpeed.Cinematic'),
    },
  });

  game.settings.register(MODULE_ID, 'cinematicRevealEnabled', {
    name: game.i18n.localize('DUALITY_CARDFLOW.Settings.CinematicReveal.Name'),
    hint: game.i18n.localize('DUALITY_CARDFLOW.Settings.CinematicReveal.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, 'gmHandVisibility', {
    name: game.i18n.localize('DUALITY_CARDFLOW.Settings.GMHandVisibility.Name'),
    hint: game.i18n.localize('DUALITY_CARDFLOW.Settings.GMHandVisibility.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mountPlayerArea(): void {
  if (document.getElementById('duality-player-area')) return;

  const speed = game.settings.get(MODULE_ID, 'animationSpeed') as AnimationSpeed;
  const ms    = SPEED_MS[speed];

  // ── GM path ────────────────────────────────────────────────────────────────
  if ((game as any).user?.isGM) {
    const gmHost = document.createElement('div');
    document.body.appendChild(gmHost);
    mount(GmDashboard, { target: gmHost });

    const stageHostGm = document.createElement('div');
    document.body.appendChild(stageHostGm);
    mount(TheStage, { target: stageHostGm });

    const spotlightContainer = document.createElement('div');
    spotlightContainer.id = 'duality-spotlight';
    document.body.appendChild(spotlightContainer);
    spotlightInstance = mount(CardSpotlight, { target: spotlightContainer, props: { animationDuration: ms } }) as SpotlightInstance;

    const revealContainer = document.createElement('div');
    revealContainer.id = 'duality-reveal';
    document.body.appendChild(revealContainer);
    revealInstance = mount(CardReveal, { target: revealContainer }) as RevealInstance;

    const hopeRevealContainer = document.createElement('div');
    hopeRevealContainer.id = 'duality-hope-reveal';
    document.body.appendChild(hopeRevealContainer);
    hopeRevealInstance = mount(HopeReveal, { target: hopeRevealContainer }) as HopeRevealInstance;

    return;
  }

  // ── Player path ────────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'duality-player-area';
  document.body.appendChild(container);
  areaInstance = mount(PlayerArea, { target: container, props: { animationDuration: ms, onReady: syncHandFromFoundry } }) as AreaInstance;

  const stageHostPlayer = document.createElement('div');
  document.body.appendChild(stageHostPlayer);
  mount(TheStage, { target: stageHostPlayer });

  const spotlightContainer = document.createElement('div');
  spotlightContainer.id = 'duality-spotlight';
  document.body.appendChild(spotlightContainer);
  spotlightInstance = mount(CardSpotlight, { target: spotlightContainer, props: { animationDuration: ms } }) as SpotlightInstance;

  const revealContainer = document.createElement('div');
  revealContainer.id = 'duality-reveal';
  document.body.appendChild(revealContainer);
  revealInstance = mount(CardReveal, { target: revealContainer }) as RevealInstance;

  const hopeRevealContainer = document.createElement('div');
  hopeRevealContainer.id = 'duality-hope-reveal';
  document.body.appendChild(hopeRevealContainer);
  hopeRevealInstance = mount(HopeReveal, { target: hopeRevealContainer }) as HopeRevealInstance;
}

// ─── Macro bar toggle ─────────────────────────────────────────────────────────

let macroBarVisible = false;

function injectMacroBarToggle(): void {
  document.getElementById('duality-macrobar-toggle')?.remove();

  // #scene-controls-layers is the <menu> containing the layer tab buttons in v13.
  // We append a <li><button> matching Foundry's own structure so sizing is automatic.
  const menu = document.getElementById('scene-controls-layers');
  if (!menu) return;

  const li  = document.createElement('li');
  const btn = document.createElement('button');
  btn.id   = 'duality-macrobar-toggle';
  btn.type = 'button';
  // Mirrors native layer control classes — gives correct 40×40 appearance for free.
  btn.className = 'control ui-control layer icon fa-solid fa-code';
  btn.setAttribute('data-tooltip', 'Toggle Macro Bar');
  btn.setAttribute('aria-label',   'Toggle Macro Bar');
  btn.setAttribute('aria-pressed', String(macroBarVisible));
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    macroBarVisible = !macroBarVisible;
    applyMacroBarState();
  });

  li.appendChild(btn);
  menu.appendChild(li);
  applyMacroBarState();
}

function applyMacroBarState(): void {
  const hotbar = document.getElementById('hotbar');
  if (hotbar) hotbar.style.display = macroBarVisible ? '' : 'none';
  document.getElementById('duality-macrobar-toggle')
    ?.setAttribute('aria-pressed', String(macroBarVisible));
}

export function registerMacroBarToggle(): void {
  applyMacroBarState();           // hide hotbar immediately on ready
  injectMacroBarToggle();         // inject button now
  Hooks.on('renderSceneControls', injectMacroBarToggle);
}

// ─── Domain card sync ─────────────────────────────────────────────────────────
// Reads domain ability items from the actor's loadout.
// TODO: confirm item type string and loadout/equipped flag path in Foundryborne
// Run: game.user.character.items.contents.map(i=>({type:i.type,name:i.name,sys:i.system}))

interface ActionUses {
  value?: number | null;
  max?: number | string;
  recovery?: string | null;
}

interface ItemLike {
  id: string; type: string; name: string; img?: string;
  system?: {
    level?: number;
    recallCost?: number;
    description?: string; // direct HTML string in Foundryborne schema
    domain?: string;      // e.g. "grace", "midnight", "blade"
    type?: string;        // card sub-type: "ability" | "spell"
    inVault?: boolean;     // true = stored in vault
    vaultActive?: boolean; // true = vaulted card is currently active (should still show)
    loadoutIgnore?: boolean;
    // system.resource — token/charge tracker; max may be a formula string resolved by Foundry
    // value is null (not undefined) when Foundry hasn't tracked a spend yet — treat as full
    resource?: { value?: number | null; max?: number | string | null };
    // system.actions — keyed by id; each action may have its own uses tracker
    actions?: Record<string, { uses?: ActionUses }>;
  };
}

// Resolves Foundryborne formula strings against the actor's system data.
// Handles plain numeric strings, "@system.a.b.c", "@field", and falls back to
// Roll.replaceFormulaData for system-specific references like "@cast".
function resolveFormula(raw: number | string | undefined | null, actor: Record<string, unknown>): number | undefined {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;

  // Plain numeric string e.g. "1", "3"
  const asNum = Number(raw);
  if (!isNaN(asNum)) return asNum;

  const sys = (actor as Record<string, unknown>).system as Record<string, unknown>;

  const sysMatch = raw.match(/^@system\.(.+)$/);
  if (sysMatch) {
    let node: unknown = sys;
    for (const key of sysMatch[1].split('.')) {
      if (node == null || typeof node !== 'object') return undefined;
      node = (node as Record<string, unknown>)[key];
    }
    return typeof node === 'number' ? node : undefined;
  }

  const directMatch = raw.match(/^@(\w+)$/);
  if (directMatch) {
    const val = sys?.[directMatch[1]];
    if (typeof val === 'number') return val;
  }

  // Fallback: use Foundry's Roll.replaceFormulaData with actor roll data.
  // Handles system-specific references like "@cast" that live in getRollData()
  // but not directly on actor.system.
  try {
    const rollData = typeof (actor as any).getRollData === 'function' ? (actor as any).getRollData() : {};
    const resolved = (Roll as any).replaceFormulaData(raw, rollData);
    const num = Number(resolved);
    return isNaN(num) ? undefined : num;
  } catch {
    return undefined;
  }
}

// Extracts a uses tracker for a domain card.
// Prefers system.resource (explicit charge tracker), falls back to the first action with a
// non-zero max — covering abilities that use per-rest limits rather than a persistent resource.
function extractUses(
  item: ItemLike,
  actor: Record<string, unknown>,
): { value: number; max: number } | undefined {
  const res = item.system?.resource;
  if (res != null) {
    const max = resolveFormula(res.max, actor);
    if (max !== undefined && max > 0) {
      // null value means Foundry hasn't recorded a spend yet — show as fully charged
      const value = typeof res.value === 'number' ? res.value : max;
      return { value, max };
    }
  }

  const actions = item.system?.actions;
  if (actions) {
    for (const action of Object.values(actions)) {
      const uses = action.uses;
      if (uses?.max == null || uses.max === '') continue;
      const max = resolveFormula(uses.max, actor);
      if (max === undefined || max <= 0) continue;
      const value = typeof uses.value === 'number' ? uses.value : max;
      return { value, max };
    }
  }

  return undefined;
}

export function syncHandFromFoundry(): void {
  if (!areaInstance) return;
  const actor = (game.user as unknown as { character?: Record<string, unknown> | null })?.character;
  if (!actor) return;
  const items = (actor as unknown as { items?: { contents: ItemLike[] } }).items?.contents ?? [];
  // Show cards in the active loadout: not in vault (or vaulted but currently active), not ignored
  const domainCards = items.filter(
    i => i.type === 'domainCard'
      && !(i.system?.inVault && !i.system?.vaultActive)
      && !i.system?.loadoutIgnore
  );

  const currentIds = new Set(areaInstance.getDomainCardIds());
  const newIds     = new Set(domainCards.map(c => c.id));

  // Remove cards no longer present
  for (const id of currentIds) {
    if (!newIds.has(id)) areaInstance.removeDomainCard(id, 'discard');
  }

  // Add new cards or update metadata on existing ones (no re-animation for updates)
  for (const item of domainCards) {
    const data: DomainCardData = {
      id:          item.id,
      name:        item.name,
      img:         item.img ?? '',
      level:       item.system?.level,
      recallCost:  item.system?.recallCost,
      description: item.system?.description,
      subtype:     item.system?.type,
      domain:      item.system?.domain,
      uses:        extractUses(item, actor),
    };
    if (currentIds.has(item.id)) {
      areaInstance.updateDomainCard(item.id, data);
    } else {
      areaInstance.addDomainCard(data);
    }
  }
}

export function registerCardHooks(): void {
  // Debounce: a batch updateEmbeddedDocuments fires N updateItem hooks; without this
  // each call would see stale getCardIds() (cards mid-animation) and decrement
  // domainCardCount multiple times, shrinking the computed hand width incorrectly.
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSync = () => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncTimer = null; syncHandFromFoundry(); }, 0);
  };
  Hooks.on('updateItem', scheduleSync);
  Hooks.on('createItem', scheduleSync);
  Hooks.on('deleteItem', scheduleSync);
  // Show spotlight when a domain card is clicked in the hand
  Hooks.on('duality-cardflow:cardClicked', (_id: string, card: DomainCardData) => {
    spotlightInstance?.show(card);
  });
  // Cinematic reveal — three-hook chain.
  //
  //   cardActivated   → stash card data; spotlight closes immediately (see CardSpotlight.svelte)
  //   createChatMessage → fires after roll completes and message is posted; play reveal locally
  //                       and flag the message so other clients can pick it up
  //   updateChatMessage → other clients play reveal when Foundry syncs the flag to them
  Hooks.on('duality-cardflow:cardActivated', (_id: string, snapshot: any) => {
    if (!(game.settings.get(MODULE_ID, 'cinematicRevealEnabled') as boolean)) return;
    pendingReveal = {
      id: snapshot.id, name: snapshot.name, img: snapshot.img ?? '',
      domain: snapshot.domain, subtype: snapshot.subtype, cardType: snapshot.cardType,
      featureName: snapshot.featureName,
    };
    setTimeout(() => { pendingReveal = null; }, 10000);
  });

  // The spotlight is already closed by this point (closed on button click).
  // This fires when the roll result message arrives — exactly the right moment.
  Hooks.on('createChatMessage', (message: any) => {
    if (!pendingReveal) return;
    if (!(game.settings.get(MODULE_ID, 'cinematicRevealEnabled') as boolean)) return;
    const data = pendingReveal;
    pendingReveal = null;
    revealInstance?.show(data);
    message.update({ flags: { 'duality-cardflow': { cinematicReveal: data } } }).catch(() => {});
  });

  // Other clients: play reveals when Foundry syncs flag updates to them.
  // The activating client already played above, so skip it here.
  Hooks.on('updateChatMessage', (message: any, changes: any) => {
    const isAuthor = message.author?.id === (game.user as any)?.id;
    const enabled  = game.settings.get(MODULE_ID, 'cinematicRevealEnabled') as boolean;
    if (!enabled || isAuthor) return;

    const cardRevealData = changes?.flags?.['duality-cardflow']?.cinematicReveal;
    if (cardRevealData) revealInstance?.show(cardRevealData);

    const hopeData = changes?.flags?.['duality-cardflow']?.hopeReveal;
    if (hopeData) hopeRevealInstance?.show(hopeData);
  });

  // Codex Grimoire (multi-action domain cards): when the user picks a spell from the
  // ActionSelectionDialog, update pendingReveal.featureName to the selected spell name.
  // This fires after selection but before executeWorkflow/toChat, ensuring the reveal
  // shows the spell as primary text and the Grimoire card name as secondary.
  Hooks.on('daggerheart.preUseAction', (action: any) => {
    if (!pendingReveal) return;
    if (action.item?.id !== pendingReveal.id) return;
    // action.name differs from the card name when a specific spell/action was chosen
    if (action.name && action.name !== pendingReveal.name) {
      pendingReveal = { ...pendingReveal, featureName: action.name };
    }
  });

  // Fallback for spells that produce no chat message (e.g. Tava's Armor with chatDisplay=false
  // or spells whose workflow already handled the message). postUseAction always fires before
  // toChat(), so if createChatMessage won't fire, we play the reveal here directly.
  Hooks.on('daggerheart.postUseAction', (action: any, config: any) => {
    if (!pendingReveal) return;
    if (action.item?.id !== pendingReveal.id) return;
    if (!action.chatDisplay || config?.skips?.createMessage || config?.actionChatMessageHandled) {
      const data = pendingReveal;
      pendingReveal = null;
      revealInstance?.show(data);
    }
  });

  // Know the Tide: when the current player rolls with Fear, increment simple community resources.
  // Speaker-actor matching is unreliable across roll types (trait vs attack use different getRollData
  // paths), so use message.user === game.user.id as the primary ownership check instead.
  Hooks.on('createChatMessage', async (message: any) => {
    if (message.type !== 'dualityRoll') return;
    // Check Fear result — try Roll instance getter first, fall back to plain postEvaluate data
    const roll = message.rolls?.[0];
    const withFear = (roll?.withFear === true) || (message.system?.roll?.result?.duality === -1);
    if (!withFear) return;
    // Only act for the current user's own rolls
    if (message.user !== (game.user as any)?.id) return;
    const currentActor = (game.user as any)?.character as any;
    if (!currentActor) return;
    const allItems: any[] = currentActor.items?.contents ?? [];
    const communitySimpleResources = allItems.filter((i: any) =>
      i.type === 'feature'
        && i.system?.originItemType === 'community'
        && i.system?.resource?.type === 'simple'
    );
    for (const item of communitySimpleResources) {
      const current = item.system.resource.value ?? 0;
      const rawMax  = item.system.resource.max;
      const max     = typeof rawMax === 'number' ? rawMax : Number(rawMax ?? 0);
      if (!isNaN(max) && current < max) {
        await item.update({ 'system.resource.value': current + 1 });
      }
    }
  });

  // Hope Feature cinematic reveal — three-hook chain, mirroring the domain card pattern.
  //
  //   hopeFeatureUsed  → stash feature data; start 60s expiry window (dialog may take time)
  //   createChatMessage → fires when the ability-use posts to chat; play locally and flag
  //                       the message so other clients can pick it up via updateChatMessage
  //   updateChatMessage → already handled above alongside the domain card reveal
  Hooks.on('duality-cardflow:hopeFeatureUsed', (featureData: any) => {
    if (!(game.settings.get(MODULE_ID, 'cinematicRevealEnabled') as boolean)) return;
    pendingHopeReveal = { id: featureData.id, name: featureData.name, img: featureData.img };
    setTimeout(() => { pendingHopeReveal = null; }, 60000);
  });

  Hooks.on('createChatMessage', (message: any) => {
    if (!pendingHopeReveal) return;
    if (!(game.settings.get(MODULE_ID, 'cinematicRevealEnabled') as boolean)) return;
    // Skip roll messages — wait for the ability-use chat entry
    if (message.type === 'dualityRoll') return;
    const data = pendingHopeReveal;
    pendingHopeReveal = null;
    hopeRevealInstance?.show(data);
    message.update({ flags: { 'duality-cardflow': { hopeReveal: data } } }).catch(() => {});
  });
}

// ─── Debug helpers ────────────────────────────────────────────────────────────

export function addTestCards(count = 5): void {
  if (!areaInstance) { console.warn('Duality Cardflow | Player area not mounted.'); return; }
  const labels = ['Hope', 'Fear', 'Blade', 'Bone', 'Flame', 'Frost', 'Shadow', 'Storm'];
  for (let i = 0; i < count; i++) {
    areaInstance.addDomainCard({
      id:   `test-${Date.now()}-${i}`,
      name: labels[Math.floor(Math.random() * labels.length)],
      img:  '',
    });
  }
}

export function clearTestCards(): void {
  areaInstance?.clearDomainCards();
}

export function exposeDebugAPI(): void {
  (window as unknown as Record<string, unknown>).DualityCardflow = {
    addTestCards,
    clearTestCards,
    syncHand: syncHandFromFoundry,
  };
  console.log('Duality Cardflow | Debug: window.DualityCardflow.addTestCards(n)');
}

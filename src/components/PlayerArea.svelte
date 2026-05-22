<script lang="ts">
  import { onMount, tick } from 'svelte';
  import CardHand from './CardHand.svelte';
  import VaultPanel from './VaultPanel.svelte';
  import CompanionPanel from './CompanionPanel.svelte';
  import InventoryPanel from './InventoryPanel.svelte';
  import { computeSpotlightState } from '../lib/spotlight.js';

  interface Props { animationDuration?: number; onReady?: () => void; }
  let { animationDuration = 400, onReady }: Props = $props();

  // ── Character state ──────────────────────────────────────────────────────────
  let tokenImg    = $state('icons/svg/mystery-man.svg');
  let actorName   = $state('');
  let hope        = $state(0);
  let hp          = $state(0);
  let hpMax       = $state(1);
  let stress      = $state(0);
  let stressMax   = $state(6);
  let evasion     = $state(0);
  let armorSlots  = $state(0);
  let armorMax    = $state(4);
  let armorItemId = $state<string | null>(null);
  let thresholds  = $state({ minor: 0, major: 0, severe: 0 });

  interface ResourceData {
    type: 'die' | 'diceValue' | 'simple';
    value: number;
    max: number;
    faces?: string;
    icon?: string;
    diceStates?: Array<{ key: string; value: number; used: boolean }>;
  }

  interface FeatureSlot {
    id: string; name: string; img: string; description?: string;
    resource?: ResourceData;
  }

  interface CompanionData {
    id: string;
    name: string;
    img: string;
    level: number;
    evasion: number;
    stress: { value: number; max: number };
    attackBonus: number;
    attackDice: string;
    attackRange: string;
  }

  let companionData      = $state<CompanionData | null>(null);
  let showCompanionPanel = $state(false);

  interface WeaponItem {
    id: string; name: string; img: string; quantity: number;
    equipped: boolean; secondary: boolean;
    burden: 'oneHanded' | 'twoHanded';
    range: string; trait?: string; damageDice?: string; tier: number;
  }
  interface ArmorItem {
    id: string; name: string; img: string; quantity: number;
    equipped: boolean;
    armorCurrent: number; armorMax: number; tier: number;
  }
  interface GenericItem {
    id: string; name: string; img: string;
    type: string; quantity: number; description?: string;
  }
  interface GoldData { coins: number; handfuls: number; bags: number; chests: number; }

  let showInventoryPanel = $state(false);
  let invWeapons     = $state<WeaponItem[]>([]);
  let invArmors      = $state<ArmorItem[]>([]);
  let invConsumables = $state<GenericItem[]>([]);
  let invLoot        = $state<GenericItem[]>([]);
  let gold           = $state<GoldData>({ coins: 0, handfuls: 0, bags: 0, chests: 0 });

  let classFeatures         = $state<FeatureSlot[]>([]);
  let hopeFeature           = $state<FeatureSlot | null>(null);
  let d12PickerOpenId       = $state<string | null>(null);
  let hoveredClassFeature   = $state<FeatureSlot | null>(null);
  let showClassFeaturePanel = $state(false);
  let showHopePanel         = $state(false);
  let classPanelTimer: ReturnType<typeof setTimeout> | null = null;
  let hopePanelTimer:  ReturnType<typeof setTimeout> | null = null;

  interface TraitData  { key: string; abbr: string; value: number; tierMarked: boolean; }
  interface WeaponData { id: string; name: string; img: string; trait?: string; range?: string; }

  let traits             = $state<TraitData[]>([]);
  let equippedWeapons    = $state<WeaponData[]>([]);

  let editingHp     = $state(false);
  let editingStress = $state(false);
  let hpEditEl     = $state<HTMLInputElement | undefined>(undefined);
  let stressEditEl = $state<HTMLInputElement | undefined>(undefined);

  let myActorId             = $state<string | null>(null);
  let spotlightActorId      = $state<string | null>(null);
  let isRequestingSpotlight = $state(false);
  let showCharacterPanel    = $state(false);
  let panelHideTimer: ReturnType<typeof setTimeout> | null = null;

  // Next-tick debounce for item-hook-triggered actor reads.
  // Daggerheart's equip flow fires updateActor (thresholds) before updateItem
  // (equipped flag). Yielding to the event loop ensures both writes have
  // settled before we read item state, preventing the stale-equipped race.
  let readActorTimerId: ReturnType<typeof setTimeout> | null = null;
  function scheduleReadActor(): void {
    if (readActorTimerId) return;
    readActorTimerId = setTimeout(() => {
      readActorTimerId = null;
      readActor();
    }, 0);
  }

  // ── Vault ────────────────────────────────────────────────────────────────────
  interface VaultCard { id: string; name: string; img: string; recallCost?: number; domain?: string; level?: number; description?: string; subtype?: string; }

  let showVaultPanel = $state(false);

  // Mirrors the cardMarginStyle formula: each card is 80px wide, default gap is 60px (30px margin each side).
  // Used to position the vault button 100px left of the hand's left boundary.
  const handContentWidth = $derived((() => {
    const n = pinnedCardCount + domainCardCount + (companionData ? 1 : 0);
    if (n <= 0) return 300;
    const MAX_W = Math.min(1200, Math.round(viewportWidth * (1200 / 1440)));
    return Math.min(n * 80 + (n - 1) * 60, MAX_W);
  })());
  const vaultBtnLeft       = $derived(`calc(50% - ${Math.round(handContentWidth / 2)}px - 100px)`);
  // Panel sits to the right of the companion card (rightmost hand card): card right edge + outer margin (30px) + 10px gap + 240px panel
  const companionPanelRight = $derived(`calc(50% - ${Math.round(handContentWidth / 2)}px - 280px)`);

  function getVaultPanelCards(): { hand: VaultCard[]; vault: VaultCard[] } {
    const actor = (game.user as any)?.character;
    const items: any[] = actor?.items?.contents ?? [];
    const domainItems = items.filter(i => i.type === 'domainCard' && !i.system?.loadoutIgnore);
    const hand  = domainItems.filter((i: any) => !(i.system?.inVault && !i.system?.vaultActive));
    const vault = domainItems.filter((i: any) =>   i.system?.inVault && !i.system?.vaultActive);
    const toCard = (i: any): VaultCard => ({
      id: i.id, name: i.name, img: i.img ?? '',
      recallCost: i.system?.recallCost, domain: i.system?.domain, level: i.system?.level,
      description: i.system?.description, subtype: i.system?.type,
    });
    return { hand: hand.map(toCard), vault: vault.map(toCard) };
  }

  function openVault(): void {
    showVaultPanel = !showVaultPanel;
  }

  function handleVaultCardClick(cardId: string): void {
    const actor = (game.user as any)?.character;
    const item: any = actor?.items?.get(cardId);
    if (!item) return;
    Hooks.callAll('duality-cardflow:cardClicked', cardId, {
      id:          item.id,
      name:        item.name,
      img:         item.img ?? '',
      level:       item.system?.level,
      recallCost:  item.system?.recallCost,
      description: item.system?.description,
      subtype:     item.system?.type,
      domain:      item.system?.domain,
    });
  }

  async function commitVaultChanges(
    newHand: VaultCard[], newVault: VaultCard[], stressCost: number
  ): Promise<void> {
    showVaultPanel = false;
    const actor = (game.user as any)?.character;
    if (!actor) return;
    const newHandIds  = new Set(newHand.map(c => c.id));
    const newVaultIds = new Set(newVault.map(c => c.id));
    const items: any[] = actor.items?.contents ?? [];
    const updates = items
      .filter((i: any) => i.type === 'domainCard' && !i.system?.loadoutIgnore)
      .flatMap((i: any) => {
        const wantsVault = newVaultIds.has(i.id);
        const currentlyVaulted = !!(i.system?.inVault && !i.system?.vaultActive);
        if (wantsVault === currentlyVaulted) return [];
        return [{ _id: i.id, 'system.inVault': wantsVault, 'system.vaultActive': false }];
      });
    if (updates.length > 0) {
      await (actor as any).updateEmbeddedDocuments('Item', updates);
    }
    if (stressCost > 0) {
      const newStress = Math.min(stressMax, stress + stressCost);
      await (actor as any).update({ 'system.resources.stress.value': newStress });
    }
  }

  // ── Card hand ref ────────────────────────────────────────────────────────────
  let cardHand: {
    addCard: Function; removeCard: Function; getCardIds: Function; clear: Function;
    setPinnedCards: Function; getTotalCount: Function;
  } | null = $state(null);

  let domainCardCount = $state(0);
  let pinnedCardCount = $state(0);
  let viewportWidth   = $state(window.innerWidth);

  // ── Derived values ───────────────────────────────────────────────────────────
  const HOPE_MAX = 6;

  const cardMarginStyle = $derived((() => {
    const n = pinnedCardCount + domainCardCount;
    if (n <= 1) return '';
    const W = 80;
    const MAX_W = Math.min(1200, Math.round(viewportWidth * (1200 / 1440)));
    const natural = n * W + (n - 1) * 12;
    if (natural <= MAX_W) return '';
    const m = Math.floor((MAX_W - n * W) / (2 * (n - 1)));
    return `--duality-card-margin: ${Math.max(-20, m)}px`;
  })());

  // HP: value = damage marks taken (0 = healthy). Same direction as stress.
  const hpPct     = $derived(Math.max(0, Math.min(100, (hp     / Math.max(1, hpMax))     * 100)));
  const stressPct = $derived(Math.max(0, Math.min(100, (stress / Math.max(1, stressMax)) * 100)));
  const hpClass     = $derived(hpPct     >= 75 ? 'critical' : hpPct     >= 50 ? 'low' : '');
  const stressClass = $derived(stressPct >= 75 ? 'high'     : '');

  const TRAIT_ABBR: Record<string, string> = {
    agility: 'AGI', strength: 'STR', finesse: 'FIN',
    instinct: 'INS', presence: 'PRE', knowledge: 'KNO',
  };

  // ── Actor data ───────────────────────────────────────────────────────────────
  function readActor(): void {
    const actor = (game.user as unknown as { character?: Record<string, unknown> | null })?.character;
    if (!actor) return;

    tokenImg  = (actor.prototypeToken as { texture?: { src?: string } } | undefined)?.texture?.src
                ?? (actor.img as string)
                ?? 'icons/svg/mystery-man.svg';
    actorName = (actor.name as string) ?? '';
    myActorId             = (actor as any)?.id ?? null;
    isRequestingSpotlight = (actor as any)?.getFlag?.('duality-cardflow', 'requestingSpotlight') === true;

    const sys = (actor.system as Record<string, unknown>) ?? {};

    type Res = { value: number; max?: number };
    const res    = (sys.resources as Record<string, Res>) ?? {};
    const hpData = res.hitPoints;

    hpMax = hpData?.max   ?? 1;
    hp    = hpData?.value ?? 0;   // damage marks taken; 0 = healthy

    stress    = res.stress?.value ?? 0;
    stressMax = res.stress?.max   ?? 6;
    hope      = res.hope?.value   ?? 0;
    evasion   = (sys.evasion as number) ?? 0;

    const items = ((actor.items as { contents?: ItemLike[] } | undefined)?.contents) ?? [];

    // Armor — on equipped armor item: baseScore = max slots, marks.value = current
    const armorItem = items.find(i => i.type === 'armor' && i.system?.equipped);
    armorItemId = armorItem?.id ?? null;
    armorSlots  = armorItem?.system?.armor?.current ?? 0;
    armorMax    = armorItem?.system?.armor?.max     ?? 0;

    const th = (sys.damageThresholds as { minor?: number; major?: number; severe?: number }) ?? {};
    thresholds = { minor: th.minor ?? 0, major: th.major ?? 0, severe: th.severe ?? 0 };

    // Traits
    const traitsData = (sys.traits as Record<string, { value?: number; tierMarked?: boolean }>) ?? {};
    traits = Object.entries(TRAIT_ABBR).map(([key, abbr]) => ({
      key, abbr,
      value:      traitsData[key]?.value      ?? 0,
      tierMarked: traitsData[key]?.tierMarked ?? false,
    }));

    // Equipped weapons
    equippedWeapons = items
      .filter(i => i.type === 'weapon' && i.system?.equipped)
      .map(i => ({
        id:    i.id,
        name:  i.name,
        img:   i.img ?? '',
        trait: i.system?.attack?.roll?.trait,
        range: i.system?.attack?.range,
      }));

    const lists = (actor as any).system?.sheetLists;
    const classItems: any[]  = lists?.classFeatures?.values  ?? [];
    const ancestryItems: any[]  = lists?.ancestryFeatures?.values  ?? [];
    const communityItems: any[] = lists?.communityFeatures?.values ?? [];
    const subclassItems: any[]  = lists?.subclassFeatures?.values  ?? [];

    const hopeItem = classItems.find((i: any) => i.system?.identifier === 'hope');
    hopeFeature   = hopeItem ? slotFromItem(hopeItem, actor as Record<string, unknown>) : null;
    classFeatures = classItems
      .filter((i: any) => i.system?.identifier !== 'hope')
      .map((i: any) => slotFromItem(i, actor as Record<string, unknown>));

    const slots = [
      buildIdentityCard(items.find(i => i.type === 'ancestry'),  ancestryItems,  actor as Record<string, unknown>, 'slot-ancestry',  'ancestry'),
      buildIdentityCard(items.find(i => i.type === 'community'), communityItems, actor as Record<string, unknown>, 'slot-community', 'community'),
      ...buildSubclassSlots(items, subclassItems),
    ];
    pinnedCardCount = slots.filter(Boolean).length;
    cardHand?.setPinnedCards(slots);

    // ── Inventory ─────────────────────────────────────────────────────────────
    const sortItems = (arr: any[]) => arr.slice().sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0));

    invWeapons = sortItems(items.filter(i => i.type === 'weapon')).map((i: any) => ({
      id:        i.id,
      name:      i.name,
      img:       i.img ?? '',
      quantity:  i.system?.quantity ?? 1,
      equipped:  i.system?.equipped ?? false,
      secondary: i.system?.secondary ?? false,
      burden:    (i.system?.burden ?? 'oneHanded') as 'oneHanded' | 'twoHanded',
      range:     i.system?.attack?.range ?? 'melee',
      trait:     i.system?.attack?.roll?.trait,
      damageDice: i.system?.attack?.damage?.parts?.hitPoints?.value?.dice,
      tier:      i.system?.tier ?? 1,
    }));

    invArmors = sortItems(items.filter(i => i.type === 'armor')).map((i: any) => ({
      id:           i.id,
      name:         i.name,
      img:          i.img ?? '',
      quantity:     i.system?.quantity ?? 1,
      equipped:     i.system?.equipped ?? false,
      armorCurrent: i.system?.armor?.current ?? 0,
      armorMax:     i.system?.armor?.max ?? 0,
      tier:         i.system?.tier ?? 1,
    }));

    invConsumables = sortItems(items.filter(i => i.type === 'consumable')).map((i: any) => ({
      id:          i.id,
      name:        i.name,
      img:         i.img ?? '',
      type:        'consumable',
      quantity:    i.system?.quantity ?? 1,
      description: i.system?.description,
    }));

    invLoot = sortItems(items.filter(i => i.type === 'loot')).map((i: any) => ({
      id:          i.id,
      name:        i.name,
      img:         i.img ?? '',
      type:        'loot',
      quantity:    i.system?.quantity ?? 1,
      description: i.system?.description,
    }));

    gold = {
      coins:    (actor as any).system?.gold?.coins    ?? 0,
      handfuls: (actor as any).system?.gold?.handfuls ?? 0,
      bags:     (actor as any).system?.gold?.bags     ?? 0,
      chests:   (actor as any).system?.gold?.chests   ?? 0,
    };

    // ── Companion ─────────────────────────────────────────────────────────────
    const playerActor = actor as any;
    const companion = (game as any).actors?.find((a: any) => {
      if (a.type !== 'companion') return false;
      const p = a.system?.partner;
      if (!p) return false;
      return typeof p === 'string'
        ? (p === playerActor.uuid || p === `Actor.${playerActor.id}`)
        : p.id === playerActor.id;
    }) ?? null;

    if (companion) {
      const compSys = companion.system as any;
      const DEFAULT_COMPANION_IMG = 'systems/daggerheart/assets/icons/documents/actors/capybara.svg';
      const DEFAULT_FEATURE_IMG   = 'icons/creatures/mammals/deer-antlers-blue.webp';
      companionData = {
        id:          companion.id,
        name:        companion.name,
        img:         (companion.img === DEFAULT_COMPANION_IMG || !companion.img)
                       ? DEFAULT_FEATURE_IMG
                       : companion.img,
        level:       compSys?.levelData?.level?.current ?? 1,
        evasion:     compSys?.evasion ?? 10,
        stress:      {
          value: compSys?.resources?.stress?.value ?? 0,
          max:   compSys?.resources?.stress?.max   ?? 3,
        },
        attackBonus: compSys?.attack?.roll?.bonus ?? 0,
        attackDice:  compSys?.attack?.damage?.parts?.hitPoints?.value?.dice ?? 'd6',
        attackRange: compSys?.attack?.range ?? 'melee',
      };
    } else {
      companionData = null;
    }
  }

  function readSpotlightState(): void {
    const s = computeSpotlightState(game as any);
    spotlightActorId = s.spotlightActorId;
  }

  function requestSpotlight(): void {
    const actor = (game.user as any)?.character;
    if (!actor) return;
    if (isRequestingSpotlight) {
      void (actor as any).unsetFlag('duality-cardflow', 'requestingSpotlight');
    } else {
      void (actor as any).setFlag('duality-cardflow', 'requestingSpotlight', true);
    }
  }

  function showCharPanel(): void {
    if (panelHideTimer) { clearTimeout(panelHideTimer); panelHideTimer = null; }
    showCharacterPanel = true;
  }

  function hideCharPanel(): void {
    panelHideTimer = setTimeout(() => {
      showCharacterPanel = false;
      panelHideTimer = null;
    }, 300);
  }

  function resolveFormula(raw: number | string | undefined, actor: Record<string, unknown>): number | undefined {
    if (typeof raw === 'number') return raw;
    if (typeof raw !== 'string' || raw.trim() === '') return undefined;
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
      return typeof val === 'number' ? val : undefined;
    }
    return undefined;
  }

  function extractResource(item: ItemLike, actor: Record<string, unknown>): ResourceData | undefined {
    const res = item.system?.resource;
    if (!res?.type) return undefined;
    // die type: max may be '' or undefined — treat max as 1 (available/spent toggle)
    const rawMax = res.type === 'die' ? (res.max ?? 1) : res.max;
    const max = res.type === 'die' && (rawMax === '' || rawMax == null)
      ? 1
      : resolveFormula(rawMax as number | string | undefined, actor);
    if (max === undefined || max <= 0) return undefined;
    let diceStates: Array<{ key: string; value: number; used: boolean }> | undefined;
    if (res.type === 'diceValue' && res.diceStates && typeof res.diceStates === 'object') {
      diceStates = Object.entries(res.diceStates as Record<string, { value?: number; used?: boolean }>)
        .map(([key, d]) => ({ key, value: d.value ?? 1, used: d.used ?? false }));
    }
    return {
      type:  res.type as 'die' | 'diceValue' | 'simple',
      value: typeof res.value === 'number' ? res.value : (res.type === 'die' ? max : 0),
      max,
      faces: res.dieFaces ?? res.faces,
      icon:  res.icon,
      diceStates,
    };
  }

  function slotFromItem(item: any, actor: Record<string, unknown>): FeatureSlot {
    return {
      id:          item.id,
      name:        item.name,
      img:         item.img ?? '',
      description: item.system?.description,
      resource:    extractResource(item as ItemLike, actor),
    };
  }

  async function sendItemToChat(
    item: Record<string, unknown>, name: string, content?: string, img?: string
  ): Promise<void> {
    const speaker = (ChatMessage as any).getSpeaker({ actor: (game.user as any)?.character });
    if (typeof (item as any).toChat === 'function') {
      try { await Promise.resolve((item as any).toChat()); return; } catch { /* fall through */ }
    }
    try {
      const html = await (renderTemplate as any)(
        'systems/daggerheart/templates/ui/chat/ability-use.hbs',
        { item: { img: img ?? '', name, tags: [] }, description: content ?? '', actions: [] }
      );
      (ChatMessage as any).create({ content: html, speaker });
      return;
    } catch { /* fall through */ }
    try {
      (ChatMessage as any).create({ content: `<h3>${name}</h3>${content ?? ''}`, speaker });
    } catch (err) {
      console.error('Duality Cardflow | All chat methods failed:', err);
    }
  }

  async function useHopeFeature(event?: MouseEvent): Promise<void> {
    if (!hopeFeature) return;
    Hooks.callAll('duality-cardflow:hopeFeatureUsed', {
      id: hopeFeature.id, name: hopeFeature.name, img: hopeFeature.img,
    });
    await useFeature(hopeFeature, event);
  }

  async function useFeature(feature: FeatureSlot, event?: MouseEvent): Promise<void> {
    const actor = (game.user as any)?.character;
    const item  = actor?.items?.get(feature.id) as any;
    if (!item) return;

    const evt = event ?? { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };

    try {
      // DHItem.use() resolves actionsList → action.use(event) → rollSelection.hbs
      // Returns config object when triggered; undefined for passive features (no actions)
      const result = await item.use(evt);
      if (result != null && result !== false) return;
    } catch (err) {
      console.error('Duality Cardflow | Feature use failed:', err);
    }

    sendItemToChat(item, feature.name, feature.description, feature.img);
  }

  async function spendResource(featureId: string, newValue: number): Promise<void> {
    const actor = (game.user as any)?.character;
    const item  = actor?.items?.get(featureId) as any;
    if (!item || typeof item.update !== 'function') return;
    await item.update({ 'system.resource.value': newValue });
    // updateItem hook fires → readActor() → UI re-renders
  }

  async function rollResourceDice(featureId: string): Promise<void> {
    const actor = (game.user as any)?.character;
    const item  = actor?.items?.get(featureId) as any;
    if (!item) return;
    const rollValues = await (game as any).system.api.applications.dialogs.ResourceDiceDialog.create(item, actor);
    if (!rollValues) return;
    const diceStates = (rollValues as Array<{ value: number; used: boolean }>)
      .reduce((acc: Record<string, unknown>, s, i) => { acc[i] = { value: s.value, used: s.used }; return acc; }, {});
    await item.update({ 'system.resource.diceStates': diceStates });
  }

  async function companionAttack(): Promise<void> {
    if (!companionData) return;
    const companion = (game as any).actors?.get(companionData.id) as any;
    if (!companion) return;
    await companion.system.attack.use({});
  }

  async function companionActionRoll(): Promise<void> {
    if (!companionData) return;
    const actor = (game.user as any)?.character as any;
    if (!actor || typeof actor.diceRoll !== 'function') return;
    await actor.diceRoll({
      title:       `Action Roll: ${companionData.name}`,
      headerTitle: 'Companion Action Roll',
      roll: {
        trait:         actor.system?.spellcastModifierTrait?.key,
        companionRoll: true,
      },
      hasRoll: true,
    });
  }

  async function toggleEquipWeapon(weaponId: string, currentlyEquipped: boolean): Promise<void> {
    const actor = (game.user as any)?.character as any;
    const item  = actor?.items?.get(weaponId) as any;
    if (!item || typeof item.update !== 'function') return;
    await item.update({ 'system.equipped': !currentlyEquipped });
  }

  async function toggleEquipArmor(armorId: string, currentlyEquipped: boolean): Promise<void> {
    const actor = (game.user as any)?.character as any;
    const item  = actor?.items?.get(armorId) as any;
    if (!item || typeof item.update !== 'function') return;
    if (!currentlyEquipped) {
      const current = (actor.items?.contents ?? []).find(
        (i: any) => i.type === 'armor' && i.system?.equipped && i.id !== armorId
      ) as any;
      if (current && typeof current.update === 'function') {
        await current.update({ 'system.equipped': false });
      }
    }
    await item.update({ 'system.equipped': !currentlyEquipped });
  }

  async function useItem(itemId: string): Promise<void> {
    const actor = (game.user as any)?.character;
    const item  = actor?.items?.get(itemId) as any;
    if (!item) return;
    await item.use?.({});
  }

  async function updateItemQuantity(itemId: string, qty: number): Promise<void> {
    const actor = (game.user as any)?.character;
    const item  = actor?.items?.get(itemId) as any;
    if (!item) return;
    await item.update({ 'system.quantity': qty });
  }

  async function updateGold(field: string, value: number): Promise<void> {
    const actor = (game.user as any)?.character as any;
    if (!actor) return;
    await actor.update({ [`system.gold.${field}`]: Math.max(0, value) });
  }

  async function setDiceStateValue(featureId: string, dieKey: string, value: number): Promise<void> {
    const actor = (game.user as any)?.character;
    const item  = actor?.items?.get(featureId) as any;
    if (!item || typeof item.update !== 'function') return;
    await item.update({ [`system.resource.diceStates.${dieKey}.value`]: value });
  }

  async function setDieUsed(featureId: string, dieKey: string, currentlyUsed: boolean): Promise<void> {
    const actor = (game.user as any)?.character;
    const item  = actor?.items?.get(featureId) as any;
    if (!item || typeof item.update !== 'function') return;
    await item.update({ [`system.resource.diceStates.${dieKey}.used`]: !currentlyUsed });
  }

  interface ItemLike {
    id: string;
    type: string;
    name: string;
    img?: string;
    system?: {
      description?: string;
      originItemType?: string;
      identifier?: string;
      multiclassOrigin?: boolean;
      featureState?: number;
      isMulticlass?: boolean;
      featureForm?: string;
      equipped?: boolean;
      baseScore?: number;                  // armor: total slots
      marks?: { value?: number };          // armor: current marks
      attack?: { roll?: { trait?: string }; range?: string };
      resource?: {
        type?: string;
        value?: number;
        max?: number | string;
        dieFaces?: string;
        faces?: string;
        icon?: string;
        diceStates?: Record<string, { value?: number; used?: boolean }>;
      };
      actions?: Record<string, unknown>;
    };
  }

  type FeatureAction = {
    name: string;
    description: string;
    hasAction: boolean;   // true → "Use Ability"/"Cast Spell"; false → "Send to Chat"
    featureId: string;    // actor item id for calling .use()
  };

  type TierEntry = {
    tier: string;
    hasActiveFeature: boolean;
    features: FeatureAction[];
  };

  type PinnedSlot = {
    id: string; name: string; img: string; cardType: string;
    itemId?: string;     // real Foundry item id (differs from stable display id)
    description?: string; subtype?: string; hasActiveFeature?: boolean;
    uses?: { value: number; max: number };
    tiers?: TierEntry[];
    features?: FeatureAction[];   // per-feature buttons for flat identity cards (ancestry/community)
  };

  function hasActionEntries(f: ItemLike): boolean {
    const actions = f.system?.actions as any;
    // Foundry's ActionsField initialises to an ActionCollection (extends Collection → Map).
    // Object.keys() on a Map returns [] — use .size for the hydrated Collection,
    // and fall back to Object.keys() for raw plain-object data (tests, offline).
    const hasActions = (actions?.size ?? 0) > 0
      || Object.keys(actions ?? {}).length > 0;
    return f.system?.featureForm === 'action'
      || f.system?.featureForm === 'reaction'
      || hasActions;
  }

  function buildIdentityCard(
    identityItem: ItemLike | undefined,
    features: any[],
    actor: Record<string, unknown>,
    stableId: string, cardType: string,
  ): PinnedSlot | null {
    if (!identityItem) return null;

    const featureActions: FeatureAction[] = features.map(f => ({
      name:        f.name,
      description: f.system?.description ?? '',
      hasAction:   hasActionEntries(f as ItemLike),
      featureId:   f.id,
    }));

    const hasActiveFeature = featureActions.some(f => f.hasAction);
    const description = features.length > 0
      ? features.map(f => `<p><strong>${f.name}</strong></p>${f.system?.description ?? ''}`).join('')
      : undefined;

    let uses: { value: number; max: number } | undefined;
    for (const f of features) {
      const res = extractResource(f as ItemLike, actor);
      if (res) { uses = { value: res.value, max: res.max }; break; }
    }

    return { id: stableId, itemId: identityItem.id, name: identityItem.name, img: identityItem.img ?? '',
             cardType, description, subtype: cardType, hasActiveFeature, uses,
             features: featureActions.length > 0 ? featureActions : undefined };
  }

  const TIER_ORDER = ['foundation', 'specialization', 'mastery'] as const;
  const TIER_FEATURE_STATE: Record<string, number> = { foundation: 1, specialization: 2, mastery: 3 };

  function buildSubclassCardFromParts(
    subclassItem: ItemLike, features: any[], stableId: string, featureState: number,
  ): PinnedSlot | null {
    const byTier = new Map<string, any[]>(TIER_ORDER.map(t => [t, []]));
    features.forEach((f: any) => {
      const tier = f.system?.identifier ?? 'foundation';
      if (byTier.has(tier)) byTier.get(tier)!.push(f);
    });

    const tiers: TierEntry[] = (TIER_ORDER as readonly string[]).filter(t => {
      const count = byTier.get(t)?.length ?? 0;
      return count > 0 && featureState >= (TIER_FEATURE_STATE[t] ?? 1);
    }).map(t => {
      const fs = byTier.get(t) ?? [];
      return {
        tier: t,
        hasActiveFeature: fs.some(f => hasActionEntries(f)),
        features: fs.map(f => ({
          name:        f.name,
          description: f.system?.description ?? '',
          hasAction:   hasActionEntries(f),
          featureId:   f.id,
        })),
      };
    });

    return { id: stableId, itemId: subclassItem.id, name: subclassItem.name, img: subclassItem.img ?? '',
             cardType: 'subclass', subtype: 'subclass', tiers: tiers.length > 0 ? tiers : undefined };
  }

  function buildSubclassSlots(items: ItemLike[], allSubclassFeatures: any[]): Array<PinnedSlot | null> {
    const subclassItems = items.filter(i => i.type === 'subclass' || i.type === 'heritage');
    if (subclassItems.length === 0) return [];

    const primaryItem    = subclassItems.find(i => !i.system?.isMulticlass) ?? subclassItems[0];
    const secondaryItem  = subclassItems.find(i =>  i.system?.isMulticlass === true);
    const primaryFeatures   = allSubclassFeatures.filter((f: any) => !f.system?.multiclassOrigin);
    const secondaryFeatures = allSubclassFeatures.filter((f: any) =>  f.system?.multiclassOrigin === true);

    const slots: Array<PinnedSlot | null> = [];
    if (primaryItem) {
      slots.push(buildSubclassCardFromParts(
        primaryItem, primaryFeatures, 'slot-subclass-primary', primaryItem.system?.featureState ?? 1,
      ));
    }
    if (secondaryItem) {
      slots.push(buildSubclassCardFromParts(
        secondaryItem, secondaryFeatures, 'slot-subclass-secondary', secondaryItem.system?.featureState ?? 1,
      ));
    }
    return slots;
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  function openSheet(): void {
    (game.user as unknown as { character?: { sheet?: { render(f: boolean): void } } })
      ?.character?.sheet?.render(true);
  }

  function toggleHope(i: number): void {
    const next = i < hope ? i : i + 1;
    hope = next;
    const actor = (game.user as unknown as { character?: Record<string, unknown> | null })?.character;
    if (actor && typeof (actor as any).update === 'function') {
      (actor as any).update({ 'system.resources.hope.value': next }).catch?.((err: unknown) => {
        console.error('Duality Cardflow | Hope update failed:', err);
      });
    }
  }

  function toggleArmorSlot(i: number): void {
    if (!armorItemId) return;
    const next = i < armorSlots ? i : i + 1;
    armorSlots = next;
    const actor = (game.user as unknown as { character?: { items?: { get(id: string): unknown } } })?.character;
    const item  = actor?.items?.get(armorItemId) as Record<string, unknown> | undefined;
    if (item && typeof (item as any).update === 'function') {
      (item as any).update({ 'system.armor.current': next }).catch?.((err: unknown) => {
        console.error('Duality Cardflow | Armor update failed:', err);
      });
    }
  }

  async function startHpEdit(): Promise<void> {
    editingHp = true;
    await tick();
    hpEditEl?.focus();
    hpEditEl?.select();
  }

  function commitHpEdit(raw: string): void {
    editingHp = false;
    const next = Math.max(0, Math.min(hpMax, parseInt(raw, 10)));
    if (isNaN(next)) return;
    hp = next;
    const actor = (game.user as unknown as { character?: Record<string, unknown> | null })?.character;
    if (actor && typeof (actor as any).update === 'function') {
      (actor as any).update({ 'system.resources.hitPoints.value': next }).catch?.((err: unknown) => {
        console.error('Duality Cardflow | HP update failed:', err);
      });
    }
  }

  async function startStressEdit(): Promise<void> {
    editingStress = true;
    await tick();
    stressEditEl?.focus();
    stressEditEl?.select();
  }

  function commitStressEdit(raw: string): void {
    editingStress = false;
    const next = Math.max(0, Math.min(stressMax, parseInt(raw, 10)));
    if (isNaN(next)) return;
    stress = next;
    const actor = (game.user as unknown as { character?: Record<string, unknown> | null })?.character;
    if (actor && typeof (actor as any).update === 'function') {
      (actor as any).update({ 'system.resources.stress.value': next }).catch?.((err: unknown) => {
        console.error('Duality Cardflow | Stress update failed:', err);
      });
    }
  }

  function rollTrait(key: string): void {
    const actor = (game.user as unknown as { character?: Record<string, unknown> | null })?.character;
    if (actor && typeof (actor as any).rollTrait === 'function') {
      (actor as any).rollTrait(key);
    }
  }

  function useWeapon(id: string): void {
    const actor = (game.user as unknown as { character?: { items?: { get(id: string): unknown } } })?.character;
    const item  = actor?.items?.get(id) as Record<string, unknown> | undefined;
    if (item && typeof (item as any).use === 'function') {
      const evt = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
      Promise.resolve((item as any).use(evt)).catch((err: unknown) => {
        console.error('Duality Cardflow | Weapon use failed:', err);
      });
    }
  }


  function onClassRingEnter(feature: FeatureSlot): void {
    if (classPanelTimer) { clearTimeout(classPanelTimer); classPanelTimer = null; }
    hoveredClassFeature = feature;
    showClassFeaturePanel = true;
  }

  function onClassRingLeave(): void {
    classPanelTimer = setTimeout(() => { showClassFeaturePanel = false; classPanelTimer = null; }, 250);
  }

  function onHopeRingEnter(): void {
    if (hopePanelTimer) { clearTimeout(hopePanelTimer); hopePanelTimer = null; }
    showHopePanel = true;
  }

  function onHopeRingLeave(): void {
    hopePanelTimer = setTimeout(() => { showHopePanel = false; hopePanelTimer = null; }, 250);
  }

  function handleHpWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1; // scroll up = increase damage marks
    const next  = Math.max(0, Math.min(hpMax, hp + delta));
    if (next === hp) return;
    editingHp = false;
    commitHpEdit(String(next));
  }

  function handleStressWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    const next  = Math.max(0, Math.min(stressMax, stress + delta));
    if (next === stress) return;
    editingStress = false;
    commitStressEdit(String(next));
  }

  onMount(() => {
    readActor();
    readSpotlightState();
    onReady?.();
    // updateItem covers armor marks changes (armor data lives on the item, not the actor)
    const actorHookId      = Hooks.on('updateActor', () => { readActor(); readSpotlightState(); });
    const itemHookId       = Hooks.on('updateItem',  scheduleReadActor);
    const createItemHookId = Hooks.on('createItem',  scheduleReadActor);
    const deleteItemHookId = Hooks.on('deleteItem',  scheduleReadActor);
    // updateUser fires when the GM assigns (or reassigns) a character to this player.
    // Without this hook the dashboard stays blank until a manual page reload.
    const userHookId       = Hooks.on('updateUser',  (user: any) => {
      if (user.id === (game.user as any).id) { readActor(); readSpotlightState(); }
    });
    const h0 = Hooks.on('updateCombat',    readSpotlightState);
    const h1 = Hooks.on('updateCombatant', readSpotlightState);
    const h2 = Hooks.on('createCombat',    readSpotlightState);
    const h3 = Hooks.on('deleteCombat',    readSpotlightState);
    function onResize() { viewportWidth = window.innerWidth; }
    window.addEventListener('resize', onResize);
    return () => {
      Hooks.off('updateActor', actorHookId);
      Hooks.off('updateItem',  itemHookId);
      Hooks.off('createItem',  createItemHookId);
      Hooks.off('deleteItem',  deleteItemHookId);
      Hooks.off('updateUser',  userHookId);
      if (readActorTimerId) { clearTimeout(readActorTimerId); readActorTimerId = null; }
      Hooks.off('updateCombat',    h0);
      Hooks.off('updateCombatant', h1);
      Hooks.off('createCombat',    h2);
      Hooks.off('deleteCombat',    h3);
      window.removeEventListener('resize', onResize);
      if (panelHideTimer)   clearTimeout(panelHideTimer);
      if (classPanelTimer)  clearTimeout(classPanelTimer);
      if (hopePanelTimer)   clearTimeout(hopePanelTimer);
    };
  });

  // ── Public API ───────────────────────────────────────────────────────────────
  export function addDomainCard(card: { id: string; name: string; img: string; level?: number; recallCost?: number; description?: string; subtype?: string; uses?: { value: number; max: number } }): void {
    cardHand?.addCard(card);
    domainCardCount++;
  }
  export function removeDomainCard(cardId: string, mode?: 'play' | 'discard'): void {
    cardHand?.removeCard(cardId, mode);
    domainCardCount = Math.max(0, domainCardCount - 1);
  }
  export function getDomainCardIds(): string[] {
    return (cardHand?.getCardIds() ?? []) as string[];
  }
  export function clearDomainCards(): void {
    cardHand?.clear();
    domainCardCount = 0;
  }
  export function updateDomainCard(
    id: string,
    updates: { name?: string; img?: string; level?: number; recallCost?: number;
               description?: string; subtype?: string; uses?: { value: number; max: number } }
  ): void {
    cardHand?.updateCard(id, updates);
  }
</script>

<!-- ─── Portrait panel ─────────────────────────────────────────────────────── -->
<div class="duality-portrait-panel">

  <!-- Hope track -->
  <div class="duality-hope-track" role="group" aria-label="Hope">
    <span class="duality-hope-label">Hope</span>
    <div class="duality-hope-pips">
      {#each Array(HOPE_MAX) as _, i}
        <button
          class="duality-hope-pip"
          class:filled={i < hope}
          aria-label="Hope {i + 1}"
          aria-pressed={i < hope}
          onclick={() => toggleHope(i)}
        ></button>
      {/each}
    </div>
  </div>

  <!-- Middle row: [HP bar] [portrait wrap] [Stress bar] -->
  <div class="duality-middle-row">

    <div class="duality-stat-box duality-stat-box--hp {hpClass}"
         role="meter" aria-label="Hit Points" aria-valuenow={hp} aria-valuemax={hpMax}>
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="duality-stat-box__bar"
           class:duality-stat-box__bar--interactive={!editingHp}
           onclick={editingHp ? undefined : startHpEdit}
           onwheel={handleHpWheel}
           title={editingHp ? undefined : 'Click to edit · scroll to adjust'}>
        <div class="duality-stat-box__fill" style="width:{hpPct}%"></div>
        {#if editingHp}
          <input
            bind:this={hpEditEl}
            class="duality-stat-box__input"
            type="number" min="0" max={hpMax}
            value={hp}
            onclick={(e) => e.stopPropagation()}
            onblur={(e) => commitHpEdit((e.currentTarget as HTMLInputElement).value)}
            onkeydown={(e) => {
              if (e.key === 'Enter')  commitHpEdit((e.currentTarget as HTMLInputElement).value);
              if (e.key === 'Escape') editingHp = false;
            }}
          />
        {:else}
          <span class="duality-stat-box__label">HP</span>
          <span class="duality-stat-box__value">{hp}/{hpMax}</span>
        {/if}
      </div>
    </div>

    <!-- Portrait wrapper — hover zone for attribute/weapon panels only -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="duality-portrait-wrap"
         onmouseenter={showCharPanel}
         onmouseleave={hideCharPanel}>

      <!-- Trait badges — float above portrait -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="duality-trait-badges"
           class:is-visible={showCharacterPanel}
           onmouseenter={showCharPanel}
           onmouseleave={hideCharPanel}>
        {#each traits as t}
          <button
            class="duality-trait-badge"
            class:is-tier-marked={t.tierMarked}
            onclick={() => rollTrait(t.key)}
            aria-label="{t.abbr} {t.value}"
            title="{t.key.charAt(0).toUpperCase() + t.key.slice(1)}: {t.value}"
          >
            <span class="duality-trait-badge__abbr">{t.abbr}</span>
            <span class="duality-trait-badge__value">{t.value}</span>
          </button>
        {/each}
      </div>

      <button class="duality-portrait-btn"
              class:is-spotlighted={myActorId !== null && spotlightActorId === myActorId}
              onclick={openSheet}
              title="Open character sheet" aria-label="Character sheet">
        <img src={tokenImg} alt={actorName || 'Character'} draggable="false" />
      </button>

      {#if myActorId !== null && spotlightActorId !== myActorId}
        <button
          class="duality-orb duality-spotlight-request-btn"
          class:is-visible={showCharacterPanel}
          class:is-active={isRequestingSpotlight}
          onmouseenter={showCharPanel}
          onmouseleave={hideCharPanel}
          onclick={requestSpotlight}
          title={isRequestingSpotlight ? 'Cancel spotlight request' : 'Request spotlight'}
          aria-label="Request spotlight"
        >
          <i class="fa-solid fa-hand-sparkles"></i>
        </button>
      {/if}

      <!-- Weapon cards — float below portrait -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="duality-weapon-cards"
           class:is-visible={showCharacterPanel}
           onmouseenter={showCharPanel}
           onmouseleave={hideCharPanel}>
        {#each equippedWeapons as w}
          <button class="duality-weapon-card" onclick={() => useWeapon(w.id)}
                  aria-label="Attack: {w.name}">
            {#if w.img}
              <img src={w.img} alt={w.name} draggable="false" />
            {/if}
            <span class="duality-weapon-card__name">{w.name}</span>
            {#if w.trait}
              <span class="duality-weapon-card__trait">{(TRAIT_ABBR[w.trait] ?? w.trait).toUpperCase()}</span>
            {/if}
          </button>
        {/each}
        {#if equippedWeapons.length === 0}
          <span class="duality-weapon-cards__none">No weapons equipped</span>
        {/if}
      </div>

    </div>

    <div class="duality-stat-box duality-stat-box--stress {stressClass}"
         role="meter" aria-label="Stress" aria-valuenow={stress} aria-valuemax={stressMax}>
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="duality-stat-box__bar"
           class:duality-stat-box__bar--interactive={!editingStress}
           onclick={editingStress ? undefined : startStressEdit}
           onwheel={handleStressWheel}
           title={editingStress ? undefined : 'Click to edit · scroll to adjust'}>
        <div class="duality-stat-box__fill" style="width:{stressPct}%"></div>
        {#if editingStress}
          <input
            bind:this={stressEditEl}
            class="duality-stat-box__input"
            type="number" min="0" max={stressMax}
            value={stress}
            onclick={(e) => e.stopPropagation()}
            onblur={(e) => commitStressEdit((e.currentTarget as HTMLInputElement).value)}
            onkeydown={(e) => {
              if (e.key === 'Enter')  commitStressEdit((e.currentTarget as HTMLInputElement).value);
              if (e.key === 'Escape') editingStress = false;
            }}
          />
        {:else}
          <span class="duality-stat-box__label">Stress</span>
          <span class="duality-stat-box__value">{stress}/{stressMax}</span>
        {/if}
      </div>
    </div>

  </div>

  <!-- Character name + class/hope feature rings -->
  <div class="duality-name-row">

    <!-- Class feature rings (may be multiple, e.g. Sorcerer has 3) -->
    <div class="duality-feature-rings duality-feature-rings--class">
      {#each classFeatures as f (f.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="duality-orb duality-feature-ring"
          role="button"
          tabindex="0"
          aria-label="Class Feature: {f.name}"
          onclick={(e) => useFeature(f, e)}
          onkeydown={(e) => e.key === 'Enter' && useFeature(f)}
          onmouseenter={() => onClassRingEnter(f)}
          onmouseleave={onClassRingLeave}
        >
          {#if f.img}<img src={f.img} alt={f.name} draggable="false" />{/if}
        </div>
      {/each}
      {#if classFeatures.length === 0}
        <div class="duality-orb duality-feature-ring" role="img" aria-label="Class Feature"></div>
      {/if}
    </div>

    {#if actorName}<span class="duality-actor-name">{actorName}</span>{/if}

    <!-- Right side: inventory orb pinned 10px left of hope ring -->
    <div class="duality-feature-rings duality-feature-rings--right">
      <button
        class="duality-orb"
        class:is-active={showInventoryPanel}
        aria-label="Inventory"
        onclick={() => (showInventoryPanel = !showInventoryPanel)}
      ><i class="fas fa-backpack"></i></button>

      <!-- Hope feature ring -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="duality-orb duality-feature-ring"
        role={hopeFeature ? 'button' : 'img'}
        tabindex={hopeFeature ? 0 : -1}
        aria-label={hopeFeature ? `Hope Feature: ${hopeFeature.name}` : 'Hope Feature'}
        onclick={(e) => useHopeFeature(e)}
        onkeydown={(e) => e.key === 'Enter' && useHopeFeature()}
        onmouseenter={onHopeRingEnter}
        onmouseleave={onHopeRingLeave}
      >
        {#if hopeFeature?.img}
          <img src={hopeFeature.img} alt={hopeFeature.name} draggable="false" />
        {/if}
      </div>
    </div>

  </div>

  <!-- Info row: Evasion | Armour Slots | Major | Severe | Vault -->
  <div class="duality-info-row">
    <div class="duality-badge">
      <span class="duality-badge__value">{evasion}</span>
      <span class="duality-badge__label">Evasion</span>
    </div>
    <div class="duality-armor-badge" role="group" aria-label="Armour slots">
      <div class="duality-armor-badge__slots">
        {#each Array(armorMax) as _, i}
          <button
            class="duality-armor-badge__slot"
            class:filled={i < armorSlots}
            aria-label="Armour slot {i + 1}"
            aria-pressed={i < armorSlots}
            onclick={() => toggleArmorSlot(i)}
          ></button>
        {/each}
      </div>
      <span class="duality-armor-badge__label">Armor Slots</span>
    </div>
    {#if thresholds.minor > 0}
      <div class="duality-threshold duality-threshold--minor">
        <span class="duality-threshold__value">{thresholds.minor}</span>
        <span class="duality-threshold__label">Minor</span>
      </div>
    {/if}
    <div class="duality-threshold duality-threshold--major">
      <span class="duality-threshold__value">{thresholds.major}</span>
      <span class="duality-threshold__label">Major</span>
    </div>
    <div class="duality-threshold duality-threshold--severe">
      <span class="duality-threshold__value">{thresholds.severe}</span>
      <span class="duality-threshold__label">Severe</span>
    </div>
    <button class="duality-vault-btn" class:is-active={showVaultPanel}
            onclick={openVault} aria-label="Open card vault" title="Card vault">
      <i class="fas fa-vault"></i>
      <span>Vault</span>
    </button>
  </div>

  <!-- Class feature side panel — slides out to the left -->
  <div class="duality-feature-panel duality-feature-panel--left"
       class:is-visible={showClassFeaturePanel && !!hoveredClassFeature}
       role="region"
       aria-label="Class Feature Details"
       onmouseenter={() => { if (classPanelTimer) { clearTimeout(classPanelTimer); classPanelTimer = null; } }}
       onmouseleave={onClassRingLeave}>
    {#if hoveredClassFeature}
      {@const f = hoveredClassFeature}
      <div class="duality-feature-panel__header">
        {#if f.img}
          <img src={f.img} alt={f.name} draggable="false" class="duality-feature-panel__art" />
        {/if}
        <div class="duality-feature-panel__title">
          <span class="duality-feature-panel__label">Class Feature</span>
          <h3 class="duality-feature-panel__name">{f.name}</h3>
        </div>
      </div>

      {#if f.resource?.type === 'die'}
        <div class="duality-feature-panel__resource">
          <button
            class="duality-feature-panel__die"
            class:is-spent={f.resource.value <= 0}
            onclick={() => { if (f.resource!.value > 0) spendResource(f.id, 0); }}
            title={f.resource.value > 0 ? 'Click to spend die' : 'Spent — recovers on long rest'}
            aria-label={f.resource.value > 0 ? 'Die ready' : 'Die spent'}
          ><i class="fa-solid fa-dice-d6"></i></button>
        </div>

      {:else if f.resource?.type === 'diceValue' && f.resource.faces === 'd12' && f.resource.max === 1}
        <div class="duality-feature-panel__resource">
          <button
            class="duality-feature-panel__d12-badge"
            onclick={() => { d12PickerOpenId = d12PickerOpenId === f.id ? null : f.id; }}
            aria-label="Strange Patterns: {f.resource.diceStates?.[0]?.value || 'not set'}"
          >{f.resource.diceStates?.[0]?.value || '—'}</button>
          {#if d12PickerOpenId === f.id}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="duality-feature-panel__d12-picker" onclick={(e) => e.stopPropagation()}>
              {#each Array(12) as _, n}
                <button
                  class="duality-feature-panel__d12-option"
                  class:is-active={f.resource.diceStates?.[0]?.value === n + 1}
                  onclick={() => { setDiceStateValue(f.id, f.resource!.diceStates?.[0]?.key ?? '0', n + 1); d12PickerOpenId = null; }}
                >{n + 1}</button>
              {/each}
            </div>
          {/if}
        </div>

      {:else if f.resource?.type === 'diceValue' && f.resource.diceStates?.length}
        <div class="duality-feature-panel__resource">
          <div class="duality-feature-panel__prayer-dice">
            {#each f.resource.diceStates as die (die.key)}
              <button
                class="duality-prayer-die"
                class:is-spent={die.used}
                onclick={() => setDieUsed(f.id, die.key, die.used)}
                aria-label="{die.used ? 'Spent' : 'Ready'} prayer die, value {die.value}"
                aria-pressed={die.used}
              ><span class="duality-prayer-die__value">{die.value}</span></button>
            {/each}
          </div>
          <button class="duality-feature-panel__roll-btn"
                  onclick={() => rollResourceDice(f.id)}>Roll Dice</button>
        </div>

      {:else if f.resource?.type === 'diceValue'}
        <div class="duality-feature-panel__resource">
          <div class="duality-feature-panel__dice-pool" aria-label="{f.resource.value} of {f.resource.max} dice">
            {#each Array(f.resource.max) as _, i}
              <button
                class="duality-feature-panel__pool-die"
                class:is-spent={i >= f.resource.value}
                onclick={() => {
                  const cur = f.resource!.value; const mx = f.resource!.max;
                  spendResource(f.id, i >= cur ? Math.min(mx, cur + 1) : cur - 1);
                }}
                aria-label="Die {i + 1}: {i < f.resource.value ? 'ready' : 'spent'}"
                aria-pressed={i < f.resource.value}
              ></button>
            {/each}
          </div>
        </div>

      {:else if f.resource?.type === 'simple'}
        <div class="duality-feature-panel__resource">
          <div class="duality-feature-panel__pips" aria-label="{f.resource.value} of {f.resource.max}">
            {#each Array(f.resource.max) as _, i}
              <button
                class="duality-feature-panel__pip"
                class:is-filled={i < f.resource.value}
                onclick={() => spendResource(f.id, i < f.resource!.value ? i : i + 1)}
                aria-label="Pip {i + 1}" aria-pressed={i < f.resource.value}
              >{#if f.resource.icon}<i class={f.resource.icon}></i>{/if}</button>
            {/each}
          </div>
        </div>
      {/if}

      {#if f.description}
        <div class="duality-feature-panel__desc">{@html f.description}</div>
      {/if}
    {/if}
  </div>

  <!-- Hope feature side panel — slides out to the right -->
  <div class="duality-feature-panel duality-feature-panel--right"
       class:is-visible={showHopePanel && !!hopeFeature}
       role="region"
       aria-label="Hope Feature Details"
       onmouseenter={() => { if (hopePanelTimer) { clearTimeout(hopePanelTimer); hopePanelTimer = null; } }}
       onmouseleave={onHopeRingLeave}>
    {#if hopeFeature}
      <div class="duality-feature-panel__header">
        {#if hopeFeature.img}
          <img src={hopeFeature.img} alt={hopeFeature.name} draggable="false" class="duality-feature-panel__art" />
        {/if}
        <div class="duality-feature-panel__title">
          <span class="duality-feature-panel__label">Hope Feature</span>
          <h3 class="duality-feature-panel__name">{hopeFeature.name}</h3>
        </div>
      </div>
      {#if hopeFeature.description}
        <div class="duality-feature-panel__desc">{@html hopeFeature.description}</div>
      {/if}
    {/if}
  </div>

</div>

<!-- ─── Card hand ──────────────────────────────────────────────────────────── -->
<div id="duality-card-hand" style={cardMarginStyle}>
  <CardHand
    bind:this={cardHand}
    {animationDuration}
    companion={companionData}
    onCompanionClick={() => (showCompanionPanel = true)}
  />
</div>

<CompanionPanel
  bind:visible={showCompanionPanel}
  data={companionData}
  panelRight={companionPanelRight}
  onAttack={companionAttack}
  onActionRoll={companionActionRoll}
/>

{#if showInventoryPanel}
  <InventoryPanel
    weapons={invWeapons}
    armors={invArmors}
    consumables={invConsumables}
    loot={invLoot}
    {gold}
    onEquipWeapon={toggleEquipWeapon}
    onEquipArmor={toggleEquipArmor}
    onUseItem={useItem}
    onUpdateQuantity={updateItemQuantity}
    onUpdateGold={updateGold}
    onClose={() => (showInventoryPanel = false)}
  />
{/if}

{#if showVaultPanel}
  {@const panels = getVaultPanelCards()}
  <VaultPanel
    handCards={panels.hand}
    vaultCards={panels.vault}
    {stress} {stressMax}
    onClose={() => showVaultPanel = false}
    onConfirm={(h, v) => commitVaultChanges(h, v, 0)}
    onPayStress={(h, v, cost) => commitVaultChanges(h, v, cost)}
    onCardClick={handleVaultCardClick}
  />
{/if}

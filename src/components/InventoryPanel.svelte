<script lang="ts">
  interface WeaponItem {
    id: string; name: string; img: string; quantity?: number;
    equipped: boolean; secondary: boolean;
    burden: 'oneHanded' | 'twoHanded';
    range: string; trait?: string; damageDice?: string; tier: number;
  }
  interface ArmorItem {
    id: string; name: string; img: string; quantity?: number;
    equipped: boolean;
    armorCurrent: number; armorMax: number; tier: number;
  }
  interface GenericItem {
    id: string; name: string; img: string;
    type: string; quantity: number; description?: string;
  }
  interface GoldData { coins: number; handfuls: number; bags: number; chests: number; }
  interface OpenMenuState { id: string; type: string; }

  interface Props {
    weapons?: WeaponItem[];
    armors?: ArmorItem[];
    consumables?: GenericItem[];
    loot?: GenericItem[];
    gold?: GoldData | null;
    onEquipWeapon?: (id: string, currentlyEquipped: boolean) => Promise<void>;
    onEquipArmor?: (id: string, currentlyEquipped: boolean) => Promise<void>;
    onUseItem?: (id: string) => Promise<void>;
    onUpdateQuantity?: (id: string, qty: number) => Promise<void>;
    onUpdateGold?: (field: string, value: number) => Promise<void>;
    onClose?: () => void;
  }

  let {
    weapons = [],
    armors = [],
    consumables = [],
    loot = [],
    gold = null,
    onEquipWeapon,
    onEquipArmor,
    onUseItem,
    onUpdateQuantity,
    onUpdateGold,
    onClose,
  }: Props = $props();

  const TRAIT_ABBR: Record<string, string> = {
    agility: 'AGI', strength: 'STR', finesse: 'FIN',
    instinct: 'INS', presence: 'PRE', knowledge: 'KNO',
  };

  const RANGE_LABEL: Record<string, string> = {
    melee: 'Melee', veryClose: 'V.Close', close: 'Close',
    far: 'Far', veryFar: 'V.Far', ranged: 'Ranged',
  };

  function traitLabel(trait: string | undefined): string {
    return trait ? (TRAIT_ABBR[trait] ?? trait.slice(0, 3).toUpperCase()) : '';
  }

  function rangeLabel(range: string): string {
    return RANGE_LABEL[range] ?? range;
  }

  const isEmpty = $derived(
    weapons.length === 0 && armors.length === 0 &&
    consumables.length === 0 && loot.length === 0
  );

  // ── Drag-drop ────────────────────────────────────────────────────────────────
  let isDragOver = $state(false);

  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    isDragOver = false;
    const rawData = event.dataTransfer?.getData('text/plain');
    if (!rawData) return;
    let data: any;
    try { data = JSON.parse(rawData); } catch { return; }
    if (data.type !== 'Item') return;
    let item: any;
    try { item = await (fromUuid as any)(data.uuid); } catch { return; }
    if (!item) return;
    const actor = (game as any).user?.character as any;
    if (!actor) return;
    if (item.parent?.id === actor.id) return;
    await actor.createEmbeddedDocuments('Item', [item.toObject()]);
  }

  // ── Context menu ─────────────────────────────────────────────────────────────
  let openMenu = $state<OpenMenuState | null>(null);
  let menuPos  = $state<{ top: number; right: number } | null>(null);

  function openItemMenu(id: string, type: string, event: MouseEvent): void {
    event.stopPropagation();
    if (openMenu?.id === id) { openMenu = null; menuPos = null; return; }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    menuPos  = { top: rect.bottom + 4, right: window.innerWidth - rect.right };
    openMenu = { id, type };
  }

  $effect(() => {
    if (!openMenu) return;
    function close(e: MouseEvent) {
      const t = e.target as Element | null;
      if (!t?.closest('.duality-inventory-item__menu-dropdown')) {
        openMenu = null; menuPos = null;
      }
    }
    const timer = setTimeout(() => document.addEventListener('click', close, true), 50);
    return () => { clearTimeout(timer); document.removeEventListener('click', close, true); };
  });

  function getActorItem(id: string): any {
    return (game as any).user?.character?.items?.get(id) ?? null;
  }

  async function doUse(id: string): Promise<void> {
    openMenu = null; menuPos = null;
    await getActorItem(id)?.use?.({});
  }

  async function doToChat(id: string): Promise<void> {
    openMenu = null; menuPos = null;
    const item = getActorItem(id);
    if (!item) return;
    await item.toChat?.(item.uuid);
  }

  async function doEdit(id: string): Promise<void> {
    openMenu = null; menuPos = null;
    getActorItem(id)?.sheet?.render(true);
  }

  async function doDelete(id: string): Promise<void> {
    openMenu = null; menuPos = null;
    const actor = (game as any).user?.character as any;
    await actor?.deleteEmbeddedDocuments?.('Item', [id]);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="duality-inventory-panel__backdrop" onclick={onClose}></div>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
  class="duality-inventory-panel"
  class:is-drag-over={isDragOver}
  onclick={(e) => e.stopPropagation()}
  ondragover={(e) => { e.preventDefault(); isDragOver = true; }}
  ondragleave={(e) => { if (!(e.currentTarget as Element)?.contains(e.relatedTarget as Node)) isDragOver = false; }}
  ondrop={handleDrop}
>

  <div class="duality-inventory-panel__header">
    <i class="fas fa-backpack duality-inventory-panel__icon"></i>
    <span class="duality-inventory-panel__title">Inventory</span>
    <button class="duality-inventory-panel__close" onclick={onClose} aria-label="Close inventory">×</button>
  </div>

  <!-- ── Gold ──────────────────────────────────────────────────────────────── -->
  {#if gold !== null}
    <div class="duality-inventory-gold">
      <div class="duality-inventory-gold__cell">
        <span class="duality-inventory-gold__label"><i class="fa-solid fa-coin-front"></i> Coins</span>
        <input class="duality-inventory-gold__input" type="number" min="0" step="1"
          value={gold?.coins ?? 0}
          onchange={(e) => onUpdateGold?.('coins', Math.max(0, Number((e.target as HTMLInputElement).value)))} />
      </div>
      <div class="duality-inventory-gold__cell">
        <span class="duality-inventory-gold__label"><i class="fa-solid fa-coins"></i> Handfuls</span>
        <input class="duality-inventory-gold__input" type="number" min="0" step="1"
          value={gold?.handfuls ?? 0}
          onchange={(e) => onUpdateGold?.('handfuls', Math.max(0, Number((e.target as HTMLInputElement).value)))} />
      </div>
      <div class="duality-inventory-gold__cell">
        <span class="duality-inventory-gold__label"><i class="fa-solid fa-sack"></i> Bags</span>
        <input class="duality-inventory-gold__input" type="number" min="0" step="1"
          value={gold?.bags ?? 0}
          onchange={(e) => onUpdateGold?.('bags', Math.max(0, Number((e.target as HTMLInputElement).value)))} />
      </div>
      <div class="duality-inventory-gold__cell">
        <span class="duality-inventory-gold__label"><i class="fa-solid fa-treasure-chest"></i> Chests</span>
        <input class="duality-inventory-gold__input" type="number" min="0" step="1"
          value={gold?.chests ?? 0}
          onchange={(e) => onUpdateGold?.('chests', Math.max(0, Number((e.target as HTMLInputElement).value)))} />
      </div>
    </div>
  {/if}

  <div class="duality-inventory-panel__body">
    {#if isEmpty}
      <p class="duality-inventory-panel__empty">No items in inventory.</p>
    {/if}

    <!-- ── Weapons ─────────────────────────────────────────────────────────── -->
    {#if weapons.length > 0}
      <fieldset class="duality-inventory-section">
        <legend class="duality-inventory-section__legend">Weapons</legend>
        <ul class="duality-inventory-section__list">
          {#each weapons as w (w.id)}
            <li class="duality-inventory-item" class:is-equipped={w.equipped}>
              <div class="duality-inventory-item__img-wrap">
                {#if w.img}
                  <img src={w.img} alt={w.name} draggable="false" class="duality-inventory-item__img" />
                {:else}
                  <div class="duality-inventory-item__img duality-inventory-item__img--placeholder">
                    <i class="fas fa-sword"></i>
                  </div>
                {/if}
              </div>
              <div class="duality-inventory-item__info">
                <span class="duality-inventory-item__name">{w.name}</span>
                <div class="duality-inventory-item__meta">
                  <span
                    class="duality-inventory-item__badge duality-inventory-item__badge--burden"
                    class:is-two-handed={w.burden === 'twoHanded'}
                    title={w.burden === 'twoHanded' ? 'Two-handed (2 burden)' : 'One-handed (1 burden)'}
                  >{w.burden === 'twoHanded' ? '2H' : '1H'}</span>
                  <span class="duality-inventory-item__badge duality-inventory-item__badge--range">
                    {rangeLabel(w.range)}
                  </span>
                  {#if w.trait}
                    <span class="duality-inventory-item__badge duality-inventory-item__badge--trait">
                      {traitLabel(w.trait)}
                    </span>
                  {/if}
                  {#if w.damageDice}
                    <span class="duality-inventory-item__badge duality-inventory-item__badge--dmg">
                      {w.damageDice}
                    </span>
                  {/if}
                  {#if w.equipped && w.secondary}
                    <span class="duality-inventory-item__badge duality-inventory-item__badge--slot">Off</span>
                  {:else if w.equipped}
                    <span class="duality-inventory-item__badge duality-inventory-item__badge--slot">Main</span>
                  {/if}
                </div>
              </div>
              {#if (w.quantity ?? 1) > 1}
                <label class="duality-inventory-item__qty">×<input
                  type="number" min="0" step="1"
                  value={w.quantity ?? 1}
                  onclick={(e) => e.stopPropagation()}
                  onchange={(e) => onUpdateQuantity?.(w.id, Math.max(0, +(e.target as HTMLInputElement).value))}
                /></label>
              {/if}
              <div class="duality-inventory-item__controls">
                <button class="duality-inventory-item__ctrl-btn"
                  class:is-equipped={w.equipped}
                  onclick={() => onEquipWeapon?.(w.id, w.equipped)}
                  aria-label="{w.equipped ? 'Unequip' : 'Equip'} {w.name}"
                  title="{w.equipped ? 'Unequip' : 'Equip'}">
                  <i class="fas {w.equipped ? 'fa-shield-check' : 'fa-hands'}"></i>
                </button>
                <button class="duality-inventory-item__ctrl-btn"
                  onclick={() => doToChat(w.id)}
                  aria-label="Send {w.name} to chat" title="Send to Chat">
                  <i class="far fa-message"></i>
                </button>
                <button class="duality-inventory-item__ctrl-btn"
                  onclick={(e) => openItemMenu(w.id, 'weapon', e)}
                  aria-label="More options for {w.name}" title="More Options">
                  <i class="fas fa-ellipsis-vertical"></i>
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </fieldset>
    {/if}

    <!-- ── Armour ──────────────────────────────────────────────────────────── -->
    {#if armors.length > 0}
      <fieldset class="duality-inventory-section">
        <legend class="duality-inventory-section__legend">Armour</legend>
        <ul class="duality-inventory-section__list">
          {#each armors as a (a.id)}
            <li class="duality-inventory-item" class:is-equipped={a.equipped}>
              <div class="duality-inventory-item__img-wrap">
                {#if a.img}
                  <img src={a.img} alt={a.name} draggable="false" class="duality-inventory-item__img" />
                {:else}
                  <div class="duality-inventory-item__img duality-inventory-item__img--placeholder">
                    <i class="fas fa-shield"></i>
                  </div>
                {/if}
              </div>
              <div class="duality-inventory-item__info">
                <span class="duality-inventory-item__name">{a.name}</span>
                <div class="duality-inventory-item__meta">
                  {#if a.armorMax > 0}
                    <span class="duality-inventory-item__badge duality-inventory-item__badge--armor-slots">
                      {a.armorCurrent}/{a.armorMax} slots
                    </span>
                  {/if}
                  {#if a.tier > 1}
                    <span class="duality-inventory-item__badge">T{a.tier}</span>
                  {/if}
                </div>
              </div>
              {#if (a.quantity ?? 1) > 1}
                <label class="duality-inventory-item__qty">×<input
                  type="number" min="0" step="1"
                  value={a.quantity ?? 1}
                  onclick={(e) => e.stopPropagation()}
                  onchange={(e) => onUpdateQuantity?.(a.id, Math.max(0, +(e.target as HTMLInputElement).value))}
                /></label>
              {/if}
              <div class="duality-inventory-item__controls">
                <button class="duality-inventory-item__ctrl-btn"
                  class:is-equipped={a.equipped}
                  onclick={() => onEquipArmor?.(a.id, a.equipped)}
                  aria-label="{a.equipped ? 'Unequip' : 'Equip'} {a.name}"
                  title="{a.equipped ? 'Unequip' : 'Equip'}">
                  <i class="fas {a.equipped ? 'fa-shield-check' : 'fa-shield'}"></i>
                </button>
                <button class="duality-inventory-item__ctrl-btn"
                  onclick={() => doToChat(a.id)}
                  aria-label="Send {a.name} to chat" title="Send to Chat">
                  <i class="far fa-message"></i>
                </button>
                <button class="duality-inventory-item__ctrl-btn"
                  onclick={(e) => openItemMenu(a.id, 'armor', e)}
                  aria-label="More options for {a.name}" title="More Options">
                  <i class="fas fa-ellipsis-vertical"></i>
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </fieldset>
    {/if}

    <!-- ── Consumables ────────────────────────────────────────────────────── -->
    {#if consumables.length > 0}
      <fieldset class="duality-inventory-section">
        <legend class="duality-inventory-section__legend">Consumables</legend>
        <ul class="duality-inventory-section__list">
          {#each consumables as c (c.id)}
            <li class="duality-inventory-item">
              <button
                class="duality-inventory-item__img-wrap duality-inventory-item__img-wrap--usable"
                onclick={() => onUseItem?.(c.id)}
                aria-label="Use {c.name}"
                title="Use {c.name}"
              >
                {#if c.img}
                  <img src={c.img} alt={c.name} draggable="false" class="duality-inventory-item__img" />
                {:else}
                  <div class="duality-inventory-item__img duality-inventory-item__img--placeholder">
                    <i class="fas fa-flask"></i>
                  </div>
                {/if}
              </button>
              <div class="duality-inventory-item__info">
                <span class="duality-inventory-item__name">{c.name}</span>
              </div>
              <label class="duality-inventory-item__qty">×<input
                type="number" min="0" step="1"
                value={c.quantity}
                onclick={(e) => e.stopPropagation()}
                onchange={(e) => onUpdateQuantity?.(c.id, Math.max(0, +(e.target as HTMLInputElement).value))}
              /></label>
              <div class="duality-inventory-item__controls">
                <button class="duality-inventory-item__ctrl-btn"
                  onclick={() => doToChat(c.id)}
                  aria-label="Send {c.name} to chat" title="Send to Chat">
                  <i class="far fa-message"></i>
                </button>
                <button class="duality-inventory-item__ctrl-btn"
                  onclick={(e) => openItemMenu(c.id, 'consumable', e)}
                  aria-label="More options for {c.name}" title="More Options">
                  <i class="fas fa-ellipsis-vertical"></i>
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </fieldset>
    {/if}

    <!-- ── Loot ──────────────────────────────────────────────────────────── -->
    {#if loot.length > 0}
      <fieldset class="duality-inventory-section">
        <legend class="duality-inventory-section__legend">Loot</legend>
        <ul class="duality-inventory-section__list">
          {#each loot as l (l.id)}
            <li class="duality-inventory-item">
              <div class="duality-inventory-item__img-wrap">
                {#if l.img}
                  <img src={l.img} alt={l.name} draggable="false" class="duality-inventory-item__img" />
                {:else}
                  <div class="duality-inventory-item__img duality-inventory-item__img--placeholder">
                    <i class="fas fa-gem"></i>
                  </div>
                {/if}
              </div>
              <div class="duality-inventory-item__info">
                <span class="duality-inventory-item__name">{l.name}</span>
              </div>
              <label class="duality-inventory-item__qty">×<input
                type="number" min="0" step="1"
                value={l.quantity}
                onclick={(e) => e.stopPropagation()}
                onchange={(e) => onUpdateQuantity?.(l.id, Math.max(0, +(e.target as HTMLInputElement).value))}
              /></label>
              <div class="duality-inventory-item__controls">
                <button class="duality-inventory-item__ctrl-btn"
                  onclick={() => doToChat(l.id)}
                  aria-label="Send {l.name} to chat" title="Send to Chat">
                  <i class="far fa-message"></i>
                </button>
                <button class="duality-inventory-item__ctrl-btn"
                  onclick={(e) => openItemMenu(l.id, 'loot', e)}
                  aria-label="More options for {l.name}" title="More Options">
                  <i class="fas fa-ellipsis-vertical"></i>
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </fieldset>
    {/if}
  </div>
</div>

<!-- ── Context menu dropdown (fixed, outside panel stacking context) ────────── -->
{#if openMenu !== null && menuPos !== null}
  {@const mid = openMenu.id}
  {@const mtype = openMenu.type}
  <div
    class="duality-inventory-item__menu-dropdown"
    style="top: {menuPos.top}px; right: {menuPos.right}px;"
  >
    {#if mtype === 'weapon' || mtype === 'consumable'}
      <button class="duality-inventory-item__menu-entry" onclick={() => doUse(mid)}>
        <i class="fas fa-hand"></i> Use Item
      </button>
    {/if}
    <button class="duality-inventory-item__menu-entry" onclick={() => doEdit(mid)}>
      <i class="fas fa-pen-to-square"></i> Edit
    </button>
    <button class="duality-inventory-item__menu-entry" onclick={() => doToChat(mid)}>
      <i class="far fa-message"></i> Send to Chat
    </button>
    <button class="duality-inventory-item__menu-entry duality-inventory-item__menu-entry--danger"
      onclick={() => doDelete(mid)}>
      <i class="fas fa-trash"></i> Delete
    </button>
  </div>
{/if}

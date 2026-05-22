<script lang="ts">
  interface VaultCard {
    id: string; name: string; img: string;
    recallCost?: number; domain?: string; level?: number;
    description?: string; subtype?: string;
  }

  interface Props {
    handCards: VaultCard[];
    vaultCards: VaultCard[];
    stress: number;
    stressMax: number;
    onClose: () => void;
    onConfirm: (newHand: VaultCard[], newVault: VaultCard[]) => void;
    onPayStress: (newHand: VaultCard[], newVault: VaultCard[], cost: number) => void;
    onCardClick?: (cardId: string) => void;
    panelWidth?: number;
  }

  let { handCards, vaultCards, stress, stressMax, onClose, onConfirm, onPayStress, onCardClick, panelWidth }: Props = $props();

  const HAND_MAX = 5;

  function sortByLevel(arr: VaultCard[]): VaultCard[] {
    return [...arr].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }

  let stagedHand   = $state<VaultCard[]>([...handCards]);
  let stagedVault  = $state<VaultCard[]>(sortByLevel([...vaultCards]));
  let dragCard     = $state<VaultCard | null>(null);
  let dragFrom     = $state<'hand' | 'vault' | null>(null);
  let dragOverZone = $state<'hand' | 'vault' | null>(null);
  let dragOverCard = $state<string | null>(null);

  let tooltipCard = $state<VaultCard | null>(null);
  let tooltipX    = $state(0);
  let tooltipY    = $state(0);

  const TOOLTIP_W = 340;

  function showTooltip(e: MouseEvent, card: VaultCard): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tooltipCard = card;
    tooltipX = rect.right + 8 + TOOLTIP_W <= window.innerWidth
      ? rect.right + 8
      : rect.left - TOOLTIP_W - 8;
    tooltipY = Math.min(rect.top, window.innerHeight - 120);
  }

  function hideTooltip(): void { tooltipCard = null; }

  const addedFromVault = $derived(
    stagedHand.filter(c => !handCards.some(h => h.id === c.id))
  );
  const totalStressCost = $derived(
    addedFromVault.reduce((sum, c) => sum + (c.recallCost ?? 0), 0)
  );
  const stressOverflow = $derived(stress + totalStressCost > stressMax);
  const handFull = $derived(stagedHand.length >= HAND_MAX);

  function dragStart(e: DragEvent, card: VaultCard, from: 'hand' | 'vault'): void {
    dragCard = card;
    dragFrom = from;
    tooltipCard = null;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function dragEnd(): void {
    dragCard = null; dragFrom = null; dragOverZone = null; dragOverCard = null;
  }

  function dropOnZone(e: DragEvent, to: 'hand' | 'vault'): void {
    e.preventDefault();
    dragOverZone = null;
    if (!dragCard || dragFrom === to) return;
    if (to === 'hand' && handFull) return;
    if (to === 'hand') {
      stagedVault = stagedVault.filter(c => c.id !== dragCard!.id);
      stagedHand  = [...stagedHand, dragCard!];
    } else {
      stagedHand  = stagedHand.filter(c => c.id !== dragCard!.id);
      stagedVault = sortByLevel([...stagedVault, dragCard!]);
    }
    dragCard = null; dragFrom = null;
  }

  function dropOnCard(e: DragEvent, target: VaultCard, targetZone: 'hand' | 'vault'): void {
    e.preventDefault(); e.stopPropagation();
    dragOverCard = null; dragOverZone = null;
    if (!dragCard || dragCard.id === target.id) { dragCard = null; dragFrom = null; return; }

    if (dragFrom === targetZone) {
      if (targetZone === 'hand') {
        // Same hand zone: swap positions
        const a = stagedHand.findIndex(c => c.id === dragCard!.id);
        const b = stagedHand.findIndex(c => c.id === target.id);
        const next = [...stagedHand]; [next[a], next[b]] = [next[b], next[a]];
        stagedHand = next;
      }
      // Same vault zone: no-op — vault is always level-sorted
    } else {
      // Cross-zone swap
      if (targetZone === 'hand') {
        const filteredVault = stagedVault.filter(c => c.id !== dragCard!.id);
        stagedHand  = stagedHand.map(c => c.id === target.id ? dragCard! : c);
        stagedVault = sortByLevel([...filteredVault, target]);
      } else {
        stagedHand  = stagedHand.filter(c => c.id !== dragCard!.id);
        stagedVault = sortByLevel(stagedVault.map(c => c.id === target.id ? dragCard! : c));
        stagedHand  = [...stagedHand, target];
      }
    }
    dragCard = null; dragFrom = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="duality-vault-panel__backdrop" onclick={onClose}></div>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="duality-vault-panel"
     style={panelWidth ? `width: ${panelWidth}px` : ''}
     onclick={(e) => e.stopPropagation()}>
  <div class="duality-vault-panel__body">
    <div class="duality-vault-panel__content">

      <!-- Hand zone — contains cards + action buttons as a row -->
      <div class="duality-vault-zone duality-vault-zone--hand">
        <div class="duality-vault-zone__main">
          <div class="duality-vault-zone__label">
            Hand
            <span class="duality-vault-zone__capacity">{stagedHand.length}/{HAND_MAX}</span>
          </div>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="duality-vault-zone__cards"
            class:is-drag-over={dragOverZone === 'hand' && !handFull}
            class:is-full={handFull}
            ondragover={(e) => { e.preventDefault(); dragOverZone = 'hand'; }}
            ondragleave={() => { dragOverZone = null; }}
            ondrop={(e) => dropOnZone(e, 'hand')}
          >
            {#each stagedHand as card (card.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="duality-vault-card"
                class:is-drag-over={dragOverCard === card.id}
                class:is-dragging={dragCard?.id === card.id}
                draggable="true"
                ondragstart={(e) => dragStart(e, card, 'hand')}
                ondragend={dragEnd}
                ondragover={(e) => { e.preventDefault(); e.stopPropagation(); dragOverCard = card.id; }}
                ondragleave={() => { dragOverCard = null; }}
                ondrop={(e) => dropOnCard(e, card, 'hand')}
              >
                {#if card.img}
                  <img src={card.img} alt={card.name} draggable="false" />
                {:else}
                  <div class="duality-vault-card__placeholder">{card.name}</div>
                {/if}
                {#if card.level != null}
                  <div class="duality-vault-card__level">{card.level}</div>
                {/if}
                <div class="duality-vault-card__name">{card.name}</div>
              </div>
            {/each}

            {#each Array(Math.max(0, HAND_MAX - stagedHand.length)) as _}
              <div class="duality-vault-slot-empty"></div>
            {/each}
          </div>
        </div>

        <!-- Action buttons — vertically stacked, right of hand cards -->
        <div class="duality-vault-zone__actions">
          <button class="duality-vault-btn--confirm"
                  onclick={() => onConfirm(stagedHand, stagedVault)}>
            Rest Swap
          </button>
          {#if totalStressCost > 0}
            <div class="duality-vault-cost" class:is-overflow={stressOverflow}>
              {totalStressCost}⚡{#if stressOverflow} — over limit{/if}
            </div>
          {/if}
          <button
            class="duality-vault-btn--pay"
            class:is-overflow={stressOverflow}
            onclick={() => onPayStress(stagedHand, stagedVault, totalStressCost)}
          >
            Pay Stress{#if totalStressCost > 0} ({totalStressCost}⚡){/if}
          </button>
        </div>
      </div>

      <!-- Vault zone — level-sorted, scrollable -->
      <div class="duality-vault-zone duality-vault-zone--vault">
        <div class="duality-vault-zone__label">Vault</div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="duality-vault-zone__cards"
          class:is-drag-over={dragOverZone === 'vault'}
          ondragover={(e) => { e.preventDefault(); dragOverZone = 'vault'; }}
          ondragleave={() => { dragOverZone = null; }}
          ondrop={(e) => dropOnZone(e, 'vault')}
        >
          {#if stagedVault.length === 0}
            <span class="duality-vault-zone__empty">No cards in vault</span>
          {:else}
            {#each stagedVault as card (card.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="duality-vault-card"
                class:is-drag-over={dragOverCard === card.id}
                class:is-dragging={dragCard?.id === card.id}
                draggable="true"
                ondragstart={(e) => dragStart(e, card, 'vault')}
                ondragend={dragEnd}
                ondragover={(e) => { e.preventDefault(); e.stopPropagation(); dragOverCard = card.id; }}
                ondragleave={() => { dragOverCard = null; }}
                ondrop={(e) => dropOnCard(e, card, 'vault')}
                onclick={(e) => { e.stopPropagation(); onCardClick?.(card.id); }}
                onmouseenter={(e) => showTooltip(e, card)}
                onmouseleave={hideTooltip}
              >
                {#if card.img}
                  <img src={card.img} alt={card.name} draggable="false" />
                {:else}
                  <div class="duality-vault-card__placeholder">{card.name}</div>
                {/if}
                {#if card.level != null}
                  <div class="duality-vault-card__level">{card.level}</div>
                {/if}
                <div class="duality-vault-card__name">{card.name}</div>
                {#if card.recallCost}
                  <div class="duality-vault-card__cost">{card.recallCost}⚡</div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>

    </div>
  </div>
</div>

{#if tooltipCard}
  <div class="duality-vault-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
    <div class="duality-vault-tooltip__header">
      {#if tooltipCard.level != null}
        <div class="duality-vault-tooltip__level">{tooltipCard.level}</div>
      {/if}
      <div class="duality-vault-tooltip__name">{tooltipCard.name}</div>
      {#if tooltipCard.recallCost}
        <div class="duality-vault-tooltip__cost">{tooltipCard.recallCost}⚡</div>
      {/if}
    </div>
    {#if tooltipCard.subtype || tooltipCard.domain}
      <div class="duality-vault-tooltip__meta">
        {[tooltipCard.subtype, tooltipCard.domain].filter(Boolean).join(' · ')}
      </div>
    {/if}
    {#if tooltipCard.description}
      <div class="duality-vault-tooltip__desc">{@html tooltipCard.description}</div>
    {:else}
      <p class="duality-vault-tooltip__empty">No description available.</p>
    {/if}
  </div>
{/if}

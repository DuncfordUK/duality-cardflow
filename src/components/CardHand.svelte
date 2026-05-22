<script lang="ts">
  import { tick } from 'svelte';
  import {
    animateDraw,
    animatePlay,
    animateDiscard,
    animateFanReflow,
    animateHoverEnter,
    animateHoverLeave,
  } from '../animations';

  interface CompanionCard {
    id: string; name: string; img: string;
    stress: { value: number; max: number };
    level: number; evasion: number;
  }

  interface Props {
    animationDuration?: number;
    companion?: CompanionCard | null;
    onCompanionClick?: () => void;
  }
  let { animationDuration = 400, companion = null, onCompanionClick }: Props = $props();

  interface CardData {
    id: string;
    name: string;
    img: string;
    fanRot: number;
    pinned: boolean;    // true = identity card, survives clear()
    cardType?: string;  // 'ancestry' | 'community' | 'subclass'; absent for domain cards
    itemId?: string;    // real Foundry item id for identity cards
    level?: number;
    recallCost?: number;
    description?: string;
    subtype?: string;
    uses?: { value: number; max: number };
    tiers?: Array<{ tier: string; features: Array<{ name: string; description: string }> }>;
  }

  let cards = $state<CardData[]>([]);
  const cardEls = new Map<string, HTMLElement>();
  let companionEl    = $state<HTMLElement | undefined>(undefined);
  let companionFanRot = $state(0);

  function cardMount(el: HTMLElement, id: string) {
    cardEls.set(id, el);
    const card = cards.find((c) => c.id === id);
    if (card) animateDraw(el, card.fanRot, animationDuration);
    return { destroy() { cardEls.delete(id); } };
  }

  function computeFanRotation(index: number, total: number): number {
    if (total <= 1) return 0;
    const spread = Math.min(22, total * 3.5);
    return -spread / 2 + (index / (total - 1)) * spread;
  }

  function reflow(): void {
    const total = cards.length + (companion ? 1 : 0);
    const elements: HTMLElement[] = [];
    const rotations: number[] = [];
    cards.forEach((card, i) => {
      card.fanRot = computeFanRotation(i, total);
      const el = cardEls.get(card.id);
      if (el) { elements.push(el); rotations.push(card.fanRot); }
    });
    if (companionEl && companion) {
      companionFanRot = computeFanRotation(total - 1, total);
      elements.push(companionEl);
      rotations.push(companionFanRot);
    }
    if (elements.length > 0) animateFanReflow(elements, rotations, animationDuration);
  }

  // Reflow whenever companion appears, disappears, or changes identity
  $effect(() => {
    companion;
    reflow();
  });

  // ── Pinned cards (Ancestry / Community / Subclass) ────────────────────────
  // Placed at the front of the hand. Stable IDs prevent re-animation on
  // repeated readActor() calls; only genuinely new/changed cards animate in.

  type PinnedSlot = {
    id: string; name: string; img: string; cardType: string;
    itemId?: string;     // real Foundry item id (differs from id for identity cards)
    description?: string; subtype?: string; level?: number; recallCost?: number;
    hasActiveFeature?: boolean;
    uses?: { value: number; max: number };
    tiers?: Array<{ tier: string; hasActiveFeature: boolean; features: Array<{ name: string; description: string }> }>;
  };

  export async function setPinnedCards(slots: Array<PinnedSlot | null>): Promise<void> {
    const valid = slots.filter((c): c is PinnedSlot => c !== null);
    const domain = cards.filter((c) => !c.pinned);
    cards = [
      ...valid.map((c) => {
        const prev = cards.find((e) => e.id === c.id && e.pinned);
        return { ...c, fanRot: prev?.fanRot ?? 0, pinned: true };
      }),
      ...domain,
    ];
    await tick();
    reflow();
  }

  // ── Domain cards ──────────────────────────────────────────────────────────

  export async function addCard(card: Omit<CardData, 'fanRot' | 'pinned' | 'cardType'>): Promise<void> {
    cards.push({ ...card, fanRot: 0, pinned: false });
    await tick();
    reflow();
  }

  export async function removeCard(cardId: string, mode: 'play' | 'discard' = 'play'): Promise<void> {
    const el = cardEls.get(cardId);
    if (el) {
      await (mode === 'play' ? animatePlay(el, animationDuration) : animateDiscard(el, animationDuration));
    }
    cards = cards.filter((c) => c.id !== cardId);
    await tick();
    reflow();
  }

  // clear() only removes domain cards; pinned identity cards remain.
  export function clear(): void {
    const toRemove = cards.filter((c) => !c.pinned).map((c) => c.id);
    for (const id of toRemove) cardEls.delete(id);
    cards = cards.filter((c) => c.pinned);
  }

  export function getCardIds(): string[] {
    return cards.filter((c) => !c.pinned).map((c) => c.id);
  }

  export function updateCard(
    cardId: string,
    updates: Partial<Pick<CardData, 'name' | 'img' | 'level' | 'recallCost' | 'description' | 'subtype' | 'uses'>>
  ): void {
    const card = cards.find(c => c.id === cardId);
    if (card) Object.assign(card, updates);
  }

  export function getTotalCount(): number {
    return cards.length + (companion ? 1 : 0);
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  function onHoverEnter(id: string): void {
    const el = cardEls.get(id);
    if (el) animateHoverEnter(el);
  }

  function onHoverLeave(id: string): void {
    const card = cards.find((c) => c.id === id);
    const el   = cardEls.get(id);
    if (el && card) animateHoverLeave(el, card.fanRot);
  }

  function onCompanionHoverEnter(): void {
    if (companionEl) animateHoverEnter(companionEl);
  }
  function onCompanionHoverLeave(): void {
    if (companionEl) animateHoverLeave(companionEl, companionFanRot);
  }

  function handleClick(card: CardData): void {
    (document.activeElement as HTMLElement)?.blur();
    if (card.cardType) {
      Hooks.callAll('duality-cardflow:identityCardClicked', card.cardType, { name: card.name, img: card.img });
    }
    Hooks.callAll('duality-cardflow:cardClicked', card.id, card);
  }

  function handleKeydown(e: KeyboardEvent, card: CardData): void {
    if (e.key !== 'Enter') return;
    if (card.cardType) {
      Hooks.callAll('duality-cardflow:identityCardActivated', card.cardType, { name: card.name, img: card.img });
    } else {
      Hooks.callAll('duality-cardflow:cardActivated', card.id);
    }
  }
</script>

{#if cards.length === 0 && !companion}
  <span class="duality-card-hand__empty" aria-live="polite">No cards in hand</span>
{/if}

{#each cards as card (card.id)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    use:cardMount={card.id}
    class="duality-card"
    class:is-subclass={card.cardType === 'subclass'}
    role="button"
    tabindex="0"
    aria-label={card.name}
    onmouseenter={() => onHoverEnter(card.id)}
    onmouseleave={() => onHoverLeave(card.id)}
    onclick={() => handleClick(card)}
    onkeydown={(e) => handleKeydown(e, card)}
  >
    {#if card.img}
      <img src={card.img} alt={card.name} draggable="false" />
    {:else}
      <div class="duality-card__face"></div>
    {/if}
    {#if card.uses !== undefined && card.uses.max > 0}
      <div class="duality-card__beads" aria-label="Uses: {card.uses.value} of {card.uses.max}">
        {#each Array(card.uses.max) as _, i}
          <span class="duality-card__bead" class:is-empty={i >= card.uses.value}></span>
        {/each}
      </div>
    {/if}
    <div class="duality-card__name">{card.name}</div>
  </div>
{/each}

{#if companion}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={companionEl}
    class="duality-card duality-companion-slot"
    role="button"
    tabindex="0"
    aria-label="Companion: {companion.name}"
    onmouseenter={onCompanionHoverEnter}
    onmouseleave={onCompanionHoverLeave}
    onclick={onCompanionClick}
    onkeydown={(e) => e.key === 'Enter' && onCompanionClick?.()}
  >
    {#if companion.img}
      <img src={companion.img} alt={companion.name} draggable="false" />
    {:else}
      <div class="duality-card__face"></div>
    {/if}
    <div class="duality-companion-slot__badges">
      <span class="duality-companion-slot__badge">Lvl {companion.level}</span>
      <span class="duality-companion-slot__badge">EVA {companion.evasion}</span>
    </div>
    {#if companion.stress.max > 0}
      <div class="duality-card__beads" aria-label="Stress: {companion.stress.value} of {companion.stress.max}">
        {#each Array(companion.stress.max) as _, i}
          <span class="duality-card__bead" class:is-empty={i >= companion.stress.value}></span>
        {/each}
      </div>
    {/if}
    <div class="duality-card__name">{companion.name}</div>
  </div>
{/if}

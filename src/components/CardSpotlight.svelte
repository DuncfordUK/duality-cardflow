<script lang="ts">
  import { tick } from 'svelte';
  import { animateSpotlightOpen, animateSpotlightClose } from '../animations';

  interface Props { animationDuration?: number; }
  let { animationDuration = 400 }: Props = $props();

  interface FeatureAction {
    name: string;
    description: string;
    hasAction: boolean;
    featureId: string;
  }

  interface SpotlightCard {
    id: string;
    name: string;
    img: string;
    itemId?: string;     // real Foundry item id; differs from id for identity/subclass cards
    level?: number;
    recallCost?: number;
    description?: string;
    subtype?: string;
    cardType?: string;
    hasActiveFeature?: boolean;
    uses?: { value: number; max: number };
    tiers?: Array<{ tier: string; hasActiveFeature: boolean; features: FeatureAction[] }>;
    features?: FeatureAction[];   // per-feature buttons for flat identity cards
  }

  const TIER_LABELS: Record<string, string> = {
    foundation:     'Foundation',
    specialization: 'Specialisation',
    mastery:        'Mastery',
  };

  function subtypeLabel(card: SpotlightCard): string | undefined {
    const s = card.subtype ?? card.cardType;
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : undefined;
  }

  function actionLabel(card: SpotlightCard): string {
    if (card.subtype === 'spell') return 'Cast Spell';
    if (card.cardType && !card.hasActiveFeature) return 'Send to Chat';
    return 'Use Ability';
  }

  function currentCardContent(): string {
    if (!card) return '';
    if (card.tiers && card.tiers.length > 0) {
      const tier = card.tiers[activeTierIndex];
      if (tier) return tier.features.map(f => `<p><strong>${f.name}</strong></p>${f.description}`).join('');
    }
    return card.description ?? '';
  }

  async function sendItemToChat(
    item: Record<string, unknown>, name: string, content: string, img?: string, tags?: string[]
  ): Promise<void> {
    const speaker = (ChatMessage as any).getSpeaker({ actor: (game.user as any)?.character });
    // Try Foundryborne's native toChat (works for most domain cards)
    if (typeof (item as any).toChat === 'function') {
      try { await Promise.resolve((item as any).toChat()); return; } catch { /* fall through */ }
    }
    // Render the Daggerheart ability-use chat template directly
    try {
      const html = await (renderTemplate as any)(
        'systems/daggerheart/templates/ui/chat/ability-use.hbs',
        { item: { img: img ?? '', name, tags: tags ?? [] }, description: content, actions: [] }
      );
      (ChatMessage as any).create({ content: html, speaker });
      return;
    } catch { /* fall through */ }
    // Last resort: plain message
    try {
      (ChatMessage as any).create({ content: `<h3>${name}</h3>${content}`, speaker });
    } catch (err) {
      console.error('Duality Cardflow | All chat methods failed:', err);
    }
  }

  let card             = $state<SpotlightCard | null>(null);
  let visible          = $state(false);
  let cardEl           = $state<HTMLElement | undefined>(undefined);
  let activeTierIndex  = $state(0);

  function tierPosition(i: number, total: number): 'active' | 'prev' | 'next' {
    if (i === activeTierIndex) return 'active';
    return (i - activeTierIndex + total) % total === 1 ? 'next' : 'prev';
  }

  export async function show(data: SpotlightCard): Promise<void> {
    card            = data;
    visible         = true;
    activeTierIndex = 0;
    await tick();
    if (cardEl) animateSpotlightOpen(cardEl, animationDuration);
  }

  async function close(): Promise<void> {
    if (cardEl) await animateSpotlightClose(cardEl, Math.round(animationDuration * 0.6));
    visible = false;
    card    = null;
    Hooks.callAll('duality-cardflow:spotlightClosed');
  }

  async function changeUses(delta: number): Promise<void> {
    if (!card?.uses) return;
    const actor = (game.user as any)?.character;
    let item: any;
    if (!card.cardType) {
      // Domain card — item id is card.id directly
      item = actor?.items?.get(card.id);
    } else {
      // Identity card — find the first feature with a resource for this type
      const allItems: any[] = actor?.items?.contents ?? [];
      item = allItems.find((i: any) =>
        i.type === 'feature' &&
        i.system?.originItemType === card!.cardType &&
        i.system?.resource?.type != null
      );
    }
    if (!item || typeof item.update !== 'function') return;
    const current  = card.uses.value;
    const max      = card.uses.max;
    const newValue = Math.max(0, Math.min(max, current + delta));
    if (newValue === current) return;
    await item.update({ 'system.resource.value': newValue });
    card = { ...card, uses: { value: newValue, max } };
  }

  async function handleUse(event: MouseEvent): Promise<void> {
    if (!card) return;
    const snapshot    = { ...card };
    const cardName    = card.name;
    const cardImg     = card.img;
    const cardContent = currentCardContent(); // capture before close() nulls card
    const cardTags    = subtypeLabel(card) ? [subtypeLabel(card)!] : [];
    Hooks.callAll('duality-cardflow:cardActivated', snapshot.id, snapshot);
    close(); // dismiss spotlight immediately; animation plays behind the async use logic

    const actor = (game.user as any)?.character;

    if (!card.cardType) {
      // ── Domain card: call item.use() directly ──────────────────────────────
      const item = actor?.items?.get(card.id) as Record<string, unknown> | undefined;
      if (item && typeof (item as any).use === 'function') {
        Promise.resolve((item as any).use(event)).catch(() =>
          sendItemToChat(item, cardName, cardContent, cardImg, cardTags)
        );
      } else if (item) {
        sendItemToChat(item, cardName, cardContent, cardImg, cardTags);
      }
    } else {
      // ── Identity / subclass card ───────────────────────────────────────────
      // DHItem.use(event) internally resolves system.actionsList → action.use(event)
      // → rollSelection.hbs dialog. Returns config when triggered, undefined for
      // passive features with no actions.
      const activeTierEntry = card.tiers?.[activeTierIndex];
      const originType  = card.cardType === 'subclass' ? 'subclass' : card.cardType;
      const activeTier  = activeTierEntry?.tier;
      const isPrimary   = card.id === 'slot-subclass-primary';
      const allItems: any[] = actor?.items?.contents ?? [];

      const linkedFeatures = allItems.filter((i: any) =>
        i.type === 'feature'
          && i.system?.originItemType === originType
          && (!activeTier || i.system?.identifier === activeTier)
          && (originType !== 'subclass' || (isPrimary ? !i.system?.multiclassOrigin : !!i.system?.multiclassOrigin))
      );

      let triggered = false;
      for (const feature of linkedFeatures) {
        try {
          const result = await (feature as any).use(event);
          if (result != null && result !== false) { triggered = true; break; }
        } catch (err) {
          console.error('Duality Cardflow | Feature use failed:', err);
        }
      }

      if (!triggered) {
        sendItemToChat({} as Record<string, unknown>, cardName, cardContent, cardImg, cardTags);
      }
    }
  }

  async function handleUseFeature(event: MouseEvent, feat: FeatureAction): Promise<void> {
    if (!card) return;
    const cardImg = card.img; // capture before close() nulls card
    Hooks.callAll('duality-cardflow:cardActivated', card.id, { ...card, featureName: feat.name });
    close(); // dismiss spotlight immediately; animation plays behind the async use logic
    const actor = (game.user as any)?.character;
    const allItems: any[] = actor?.items?.contents ?? [];
    const featureItem = allItems.find((i: any) => i.id === feat.featureId);
    if (featureItem && typeof (featureItem as any).use === 'function') {
      try {
        const result = await (featureItem as any).use(event);
        if (result == null || result === false) {
          await sendItemToChat(featureItem, feat.name, feat.description, featureItem.img ?? cardImg, []);
        }
      } catch (err) {
        console.error('Duality Cardflow | Feature use failed:', err);
        await sendItemToChat(featureItem, feat.name, feat.description, featureItem.img ?? cardImg, []);
      }
    } else {
      await sendItemToChat({} as Record<string, unknown>, feat.name, feat.description, cardImg, []);
    }
  }

  async function handleSendFeatureToChat(feat: FeatureAction): Promise<void> {
    if (!card) return;
    const cardImg = card.img; // capture before close() nulls card
    close(); // dismiss spotlight immediately
    const actor = (game.user as any)?.character;
    const allItems: any[] = actor?.items?.contents ?? [];
    const featureItem = allItems.find((i: any) => i.id === feat.featureId);
    await sendItemToChat(
      featureItem ?? {} as Record<string, unknown>,
      feat.name, feat.description,
      featureItem?.img ?? cardImg, []
    );
  }

  function handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('duality-spotlight-backdrop')) close();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
</script>

<!-- ── Unified inner-card snippet ──────────────────────────────────────────────
     All card types (domain, ancestry, community, subclass tier) render through
     this single snippet. The outer wrapper decides positioning; the snippet
     decides content based purely on the data passed in.
  ─────────────────────────────────────────────────────────────────────────── -->
{#snippet innerCard(
  img: string,
  name: string,
  cardType: string | undefined,
  features: FeatureAction[],
  description: string | undefined,
  level: number | undefined,
  recallCost: number | undefined,
  uses: { value: number; max: number } | undefined,
  showFooter: boolean
)}

  <!-- Art -->
  <div class="duality-spotlight-card__art">
    {#if img}
      <img src={img} alt={name} draggable="false" />
    {:else}
      <div class="duality-spotlight-card__art-placeholder"></div>
    {/if}

    {#if level !== undefined}
      <div class="duality-spotlight-card__level" aria-label="Level {level}">{level}</div>
    {/if}

    {#if recallCost !== undefined}
      <div class="duality-spotlight-card__recall" aria-label="Recall cost {recallCost}">
        {recallCost}<span class="duality-spotlight-card__bolt">⚡</span>
      </div>
    {/if}

    {#if uses !== undefined}
      <div class="duality-spotlight-card__uses" aria-label="Uses: {uses.value} of {uses.max}">
        <span class="duality-spotlight-card__uses-label">Uses</span>
        <div class="duality-spotlight-card__uses-controls">
          <button class="duality-spotlight-card__uses-btn"
                  onclick={() => changeUses(-1)}
                  disabled={uses.value <= 0}
                  aria-label="Remove use">−</button>
          <span class="duality-spotlight-card__uses-count">
            {uses.value}<span class="duality-spotlight-card__uses-sep">/{uses.max}</span>
          </span>
          <button class="duality-spotlight-card__uses-btn"
                  onclick={() => changeUses(+1)}
                  disabled={uses.value >= uses.max}
                  aria-label="Add use">+</button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Card type banner -->
  {#if cardType}
    <div class="duality-spotlight-card__subtype">{cardType}</div>
  {/if}

  <!-- Body: per-feature breakdown if available, else single description -->
  <div class="duality-spotlight-card__body">
    <h2 class="duality-spotlight-card__name">{name}</h2>
    {#if features.length > 0}
      {#each features as feat}
        <p class="duality-spotlight-card__feature-name">{feat.name}</p>
        <div class="duality-spotlight-card__feature-desc">{@html feat.description}</div>
      {/each}
    {:else if description}
      <div class="duality-spotlight-card__desc">{@html description}</div>
    {/if}
  </div>

  <!-- Footer: per-feature buttons or single domain-card button -->
  {#if showFooter}
    <div class="duality-spotlight-card__footer">
      {#if features.length > 0}
        {#each features as feat}
          <button class="duality-spotlight-card__use-btn"
                  onclick={feat.hasAction
                    ? (e: MouseEvent) => handleUseFeature(e, feat)
                    : () => handleSendFeatureToChat(feat)}>
            {feat.name}
          </button>
        {/each}
      {:else}
        <button class="duality-spotlight-card__use-btn" onclick={handleUse}>{actionLabel(card!)}</button>
      {/if}
    </div>
  {/if}

{/snippet}


{#if visible && card}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="duality-spotlight-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={card.name}
    tabindex="-1"
  >

    {#if card.tiers && card.tiers.length > 0}
      <!-- ── Subclass tier stack: outer wrapper handles positioning/animation ── -->
      <div class="duality-spotlight-tiers" bind:this={cardEl}>
        {#each card.tiers as entry, i}
          {@const pos = tierPosition(i, card.tiers!.length)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="duality-spotlight-tier-card"
            class:is-active={pos === 'active'}
            class:is-prev={pos === 'prev'}
            class:is-next={pos === 'next'}
            onclick={() => { if (pos !== 'active') activeTierIndex = i; }}
          >
            {@render innerCard(
              card.img, card.name,
              TIER_LABELS[entry.tier] ?? entry.tier,
              entry.features, undefined,
              undefined, undefined, undefined,
              pos === 'active'
            )}
          </div>
        {/each}
      </div>

    {:else}
      <!-- ── All other cards: domain, ancestry, community ── -->
      <div class="duality-spotlight-card" bind:this={cardEl}>
        {@render innerCard(
          card.img, card.name,
          subtypeLabel(card),
          card.features ?? [], card.description,
          card.level, card.recallCost, card.uses,
          true
        )}
      </div>
    {/if}

  </div>
{/if}

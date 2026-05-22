<script lang="ts">
  import { tick } from 'svelte';
  import { gsap } from 'gsap';

  interface RevealCardData {
    id: string;
    name: string;
    img: string;
    domain?: string;
    subtype?: string;
    cardType?: string;
    featureName?: string;  // identity card feature activations: show feat name as primary
  }

  interface DomainTheme { primary: string; secondary: string; accent: string; }

  const DOMAIN_THEMES: Record<string, DomainTheme> = {
    blade:     { primary: '#5c0a0a', secondary: '#c0392b', accent: '#f1948a' },
    bone:      { primary: '#3d1a4a', secondary: '#8e44ad', accent: '#d2b4de' },
    codex:     { primary: '#0d2b45', secondary: '#2471a3', accent: '#85c1e9' },
    grace:     { primary: '#7d5a00', secondary: '#d4a017', accent: '#fef9e7' },
    midnight:  { primary: '#0a0f1a', secondary: '#2e4057', accent: '#7fb3d3' },
    sage:      { primary: '#0a2e1a', secondary: '#1e8449', accent: '#a9dfbf' },
    splendor:  { primary: '#4a0e7d', secondary: '#9b59b6', accent: '#e8daef' },
    valor:     { primary: '#5c2e00', secondary: '#ca6f1e', accent: '#fad7a0' },
    ancestry:  { primary: '#1a2e45', secondary: '#3498db', accent: '#d6eaf8' },
    community: { primary: '#0f2a1a', secondary: '#27ae60', accent: '#d5f5e3' },
    class:     { primary: '#3d1a00', secondary: '#e67e22', accent: '#fdebd0' },
    subclass:  { primary: '#2d0f40', secondary: '#8e44ad', accent: '#e8daef' },
  };
  const DEFAULT_THEME: DomainTheme = { primary: '#1a1a1a', secondary: '#d4a017', accent: '#fef9e7' };

  // 8 unit vectors: N NE E SE S SW W NW
  const DIRS = [
    { x:  0,    y: -1   },
    { x:  0.71, y: -0.71 },
    { x:  1,    y:  0   },
    { x:  0.71, y:  0.71 },
    { x:  0,    y:  1   },
    { x: -0.71, y:  0.71 },
    { x: -1,    y:  0   },
    { x: -0.71, y: -0.71 },
  ];

  let card        = $state<RevealCardData | null>(null);
  let visible     = $state(false);
  let overlayEl   = $state<HTMLElement | undefined>(undefined);
  let cardEl      = $state<HTMLElement | undefined>(undefined);
  let shardEls    = $state<HTMLElement[]>([]);
  let activeTl: gsap.core.Timeline | null = null;

  function getDomainTheme(c: RevealCardData): DomainTheme {
    const key = (c.domain ?? c.cardType ?? c.subtype ?? '').toLowerCase();
    return DOMAIN_THEMES[key] ?? DEFAULT_THEME;
  }

  function domainLabel(c: RevealCardData): string {
    const raw = c.domain ?? c.cardType ?? c.subtype ?? 'Card';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function runAnimation(): void {
    if (!overlayEl || !cardEl) return;
    const theme = getDomainTheme(card!);
    overlayEl.style.setProperty('--domain-primary',   theme.primary);
    overlayEl.style.setProperty('--domain-secondary', theme.secondary);
    overlayEl.style.setProperty('--domain-accent',    theme.accent);

    activeTl = gsap.timeline({
      onComplete: () => { visible = false; card = null; activeTl = null; },
    });

    // Phase 1: backdrop fades in
    activeTl.fromTo(overlayEl,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, ease: 'power2.out' }
    );

    // Phase 2: card slams in from below
    activeTl.fromTo(cardEl,
      { y: 250, scale: 0.25, rotation: -8, opacity: 0 },
      { y: 0, scale: 1, rotation: 0, opacity: 1, duration: 0.65, ease: 'back.out(2.8)' },
      '-=0.15'
    );

    // Phase 3: shards burst radially outward
    if (shardEls.length > 0) {
      activeTl.fromTo(shardEls,
        { scale: 0, opacity: 0.9, x: 0, y: 0 },
        {
          scale: 3.5,
          opacity: 0,
          duration: 0.85,
          stagger: 0.04,
          ease: 'power3.out',
          x: (i: number) => `${DIRS[i % DIRS.length].x * 280}px`,
          y: (i: number) => `${DIRS[i % DIRS.length].y * 280}px`,
        },
        '-=0.5'
      );
    }

    // Phase 4: hold with gentle pulse
    activeTl.to(cardEl,
      { scale: 1.05, duration: 0.4, ease: 'sine.inOut', yoyo: true, repeat: 1 },
      '+=0.2'
    );
    activeTl.to({}, { duration: 0.7 }); // remaining hold

    // Phase 5: card consumed — scale up and vanish
    activeTl.to(cardEl, { scale: 1.15, opacity: 0, duration: 0.5, ease: 'power2.in' });
    activeTl.to(overlayEl, { opacity: 0, duration: 0.35, ease: 'power2.in' }, '-=0.25');
  }

  export async function show(data: RevealCardData): Promise<void> {
    // Kill any in-progress animation immediately
    if (activeTl) {
      activeTl.kill();
      activeTl = null;
    }
    visible = false;
    card    = null;

    // One tick to let DOM clear before showing new card
    await tick();
    card    = data;
    visible = true;
    await tick();
    runAnimation();
  }

  function handleClick(): void {
    if (!activeTl) return;
    activeTl.kill();
    activeTl = null;
    if (overlayEl) {
      gsap.to(overlayEl, {
        opacity: 0, duration: 0.2, ease: 'power1.in',
        onComplete: () => { visible = false; card = null; },
      });
    } else {
      visible = false;
      card    = null;
    }
  }
</script>

{#if visible && card}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="duality-reveal-overlay"
    bind:this={overlayEl}
    onclick={handleClick}
    aria-hidden="true"
  >
    <!-- 8 burst shards — GSAP animates position/scale/opacity -->
    {#each { length: 8 } as _, i}
      <div
        class="duality-reveal-shard"
        bind:this={shardEls[i]}
      ></div>
    {/each}

    <div class="duality-reveal-card" bind:this={cardEl}>
      <div class="duality-reveal-card__art">
        {#if card.img}
          <img src={card.img} alt={card.name} draggable="false" />
        {:else}
          <div class="duality-reveal-card__art-placeholder"></div>
        {/if}
      </div>
      <div class="duality-reveal-card__name">{card.featureName ?? card.name}</div>
      <div class="duality-reveal-card__domain">{card.featureName ? card.name : domainLabel(card)}</div>
    </div>
  </div>
{/if}

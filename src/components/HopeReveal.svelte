<script lang="ts">
  import { tick } from 'svelte';
  import { gsap } from 'gsap';

  interface HopeRevealData { id: string; name: string; img: string; }

  const RAY_COUNT   = 16;
  const CRACK_COUNT = 6;
  const MOTE_COUNT  = 20;

  // Rays alternate between 3 sizes by i % 3
  const RAY_SIZES = [
    { w: 26, h: 290 },
    { w: 14, h: 200 },
    { w:  7, h: 130 },
  ];

  let data       = $state<HopeRevealData | null>(null);
  let visible    = $state(false);
  let overlayEl  = $state<HTMLElement | undefined>(undefined);
  let flashEl    = $state<HTMLElement | undefined>(undefined);
  let orbEl      = $state<HTMLElement | undefined>(undefined);
  let nameEl     = $state<HTMLElement | undefined>(undefined);
  let subtitleEl = $state<HTMLElement | undefined>(undefined);
  let rayEls     = $state<HTMLElement[]>([]);
  let crackEls   = $state<HTMLElement[]>([]);
  let moteEls    = $state<HTMLElement[]>([]);
  let activeTl: gsap.core.Timeline | null = null;

  function runAnimation(): void {
    if (!overlayEl || !flashEl || !orbEl || !nameEl) return;

    activeTl = gsap.timeline({
      onComplete: () => { visible = false; data = null; activeTl = null; },
    });

    // Phase 1: White shockwave flash; warm atmosphere overlay fades in concurrently
    activeTl
      .fromTo(flashEl,
        { opacity: 0 },
        { opacity: 0.75, duration: 0.15, ease: 'power3.out' }
      )
      .to(flashEl, { opacity: 0, duration: 0.35, ease: 'power2.out' });
    activeTl.fromTo(overlayEl,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out' },
      0
    );

    // Phase 2: Orb erupts from center
    activeTl.fromTo(orbEl,
      { y: 50, scale: 0.15, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 0.65, ease: 'back.out(1.8)' },
      0.15
    );

    // Phase 3: Rays deploy outward (scaleY from orb outward via transformOrigin 50% 100%)
    if (rayEls.length > 0) {
      activeTl.fromTo(rayEls,
        { scaleY: 0, opacity: 0 },
        { scaleY: 1, opacity: 1, duration: 0.65, stagger: 0.04, ease: 'power2.out', transformOrigin: '50% 100%' },
        0.5
      );
    }

    // Phase 4: Crack lines split + orb pressure pulse
    if (crackEls.length > 0) {
      activeTl.fromTo(crackEls,
        { scaleY: 0, opacity: 0 },
        { scaleY: 1, opacity: 0.9, duration: 0.35, stagger: 0.06, ease: 'power3.out', transformOrigin: '50% 100%' },
        0.7
      );
    }
    activeTl.to(orbEl,
      { scale: 1.12, duration: 0.2, ease: 'power2.inOut', yoyo: true, repeat: 1 },
      0.72
    );

    // Phase 5: Feature name blazes in; subtitle follows
    activeTl.fromTo(nameEl,
      { y: 22, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' },
      1.2
    );
    if (subtitleEl) {
      activeTl.fromTo(subtitleEl,
        { opacity: 0 },
        { opacity: 0.85, duration: 0.4, ease: 'power2.out' },
        1.5
      );
    }

    // Phase 6: Gold motes drift radially upward
    moteEls.forEach((el, i) => {
      const angle  = (i / MOTE_COUNT) * Math.PI * 2;
      const radius = 55 + (i % 3) * 25;
      const sx     = Math.cos(angle) * radius;
      const sy     = Math.sin(angle) * radius;
      const ex     = sx + (Math.random() - 0.5) * 50;
      const ey     = sy - 100 - (i % 5) * 22;
      const dur    = 1.4 + (i % 4) * 0.2;
      const delay  = 1.5 + (i / MOTE_COUNT) * 0.8;

      gsap.set(el, { x: sx, y: sy, opacity: 0, scale: 0 });
      activeTl!.to(el, { opacity: 0.85, scale: 1, duration: 0.25, ease: 'power2.out' }, delay);
      activeTl!.to(el, { x: ex, y: ey, scale: 1.2, opacity: 0, duration: dur, ease: 'power1.out' }, delay + 0.25);
    });

    // Phase 7: Hold with a gentle radiant pulse
    activeTl.to(orbEl,
      { scale: 1.04, duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: 1 },
      2.05
    );

    // Phase 8: Dissipation — rays collapse, name lifts, orb vanishes, atmosphere fades
    if (rayEls.length > 0) {
      activeTl.to(rayEls,
        { scaleY: 0, opacity: 0, duration: 0.5, stagger: 0.025, ease: 'power2.in', transformOrigin: '50% 100%' },
        3.2
      );
    }
    if (crackEls.length > 0) {
      activeTl.to(crackEls, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 3.2);
    }
    if (subtitleEl) {
      activeTl.to(subtitleEl, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 3.25);
    }
    activeTl.to(nameEl, { y: -16, opacity: 0, duration: 0.4, ease: 'power2.in' }, 3.35);
    activeTl.to(orbEl, { scale: 0.35, opacity: 0, duration: 0.5, ease: 'power2.in' }, 3.5);
    activeTl.to(overlayEl, { opacity: 0, duration: 0.4, ease: 'power2.in' }, 3.7);
  }

  export async function show(revealData: HopeRevealData): Promise<void> {
    if (activeTl) {
      activeTl.kill();
      activeTl = null;
    }
    visible = false;
    data    = null;
    await tick();
    data    = revealData;
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
        onComplete: () => { visible = false; data = null; },
      });
    } else {
      visible = false;
      data    = null;
    }
  }
</script>

{#if visible && data}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="duality-hope-overlay"
    bind:this={overlayEl}
    onclick={handleClick}
    aria-hidden="true"
  >
    <div class="duality-hope-flash" bind:this={flashEl}></div>

    <div class="duality-hope-scene">

      <!-- Rays — rendered behind the orb, each wrapper rotated to a compass angle -->
      <div class="duality-hope-rays">
        {#each { length: RAY_COUNT } as _, i}
          <div
            class="duality-hope-ray-wrapper"
            style="transform: rotate({i * (360 / RAY_COUNT)}deg)"
          >
            <div
              class="duality-hope-ray"
              bind:this={rayEls[i]}
              style="width:{RAY_SIZES[i % 3].w}px;height:{RAY_SIZES[i % 3].h}px;left:-{RAY_SIZES[i % 3].w / 2}px;top:-{RAY_SIZES[i % 3].h}px"
            ></div>
          </div>
        {/each}
      </div>

      <!-- Crack lines — rendered above rays, below orb -->
      <div class="duality-hope-cracks">
        {#each { length: CRACK_COUNT } as _, i}
          <div
            class="duality-hope-crack-wrapper"
            style="transform: rotate({i * (360 / CRACK_COUNT)}deg)"
          >
            <div class="duality-hope-crack" bind:this={crackEls[i]}></div>
          </div>
        {/each}
      </div>

      <!-- Gold motes — positioned by GSAP relative to orb center -->
      {#each { length: MOTE_COUNT } as _, i}
        <div class="duality-hope-mote" bind:this={moteEls[i]}></div>
      {/each}

      <!-- The orb itself -->
      <div class="duality-hope-orb" bind:this={orbEl}>
        {#if data.img}
          <img src={data.img} alt={data.name} draggable="false" />
        {/if}
      </div>

      <!-- Feature name + subtitle — positioned below the orb -->
      <div class="duality-hope-text">
        <div class="duality-hope-name" bind:this={nameEl}>{data.name}</div>
        <div class="duality-hope-subtitle" bind:this={subtitleEl}>Hope Feature</div>
      </div>

    </div>
  </div>
{/if}

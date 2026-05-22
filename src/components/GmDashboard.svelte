<script lang="ts">
  import { onMount } from 'svelte';
  import { computeSpotlightState, applySpotlightTotM, hasCombatants } from '../lib/spotlight.js';

  interface CharacterSlot {
    id: string;
    name: string;
    img: string;
  }

  let characters       = $state<CharacterSlot[]>([]);
  let spotlightActorId = $state<string | null>(null);
  let requestingIds    = $state<Set<string>>(new Set());
  let targetedIds      = $state<Set<string>>(new Set());
  let hoveredId        = $state<string | null>(null);
  let contextMenuId    = $state<string | null>(null);
  let menuX            = $state(0);
  let menuY            = $state(0);

  // ── Data readers ─────────────────────────────────────────────────────────────

  function readCharacters(): void {
    const actors: any[] = (game as any).actors?.contents ?? [];
    characters = actors
      .filter((a) => a.type === 'character' && a.hasPlayerOwner)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      .map((a) => ({
        id:   a.id as string,
        name: (a.name ?? 'Unknown') as string,
        img:  (a.prototypeToken?.texture?.src ?? a.img ?? 'icons/svg/mystery-man.svg') as string,
      }));
  }

  function readSpotlightState(): void {
    const s = computeSpotlightState(game as any);
    spotlightActorId = s.spotlightActorId;
    requestingIds    = s.requestingIds;
  }

  function readTargetState(): void {
    const targets = (game as any).user?.targets as Set<any> | undefined;
    if (!targets) { targetedIds = new Set(); return; }
    targetedIds = new Set(
      Array.from(targets)
        .map((t: any) => (t.actor?.id ?? '') as string)
        .filter(Boolean)
    );
  }

  // ── Virtual token for TotM targeting ─────────────────────────────────────────
  // Daggerheart reads game.user.targets once at action time (daggerheart.js line 32613)
  // and only accesses: id, name, actor, document.disposition/elevation, center, bounds,
  // distanceTo(). No canvas placement needed.

  function makeVirtualToken(actor: any): object {
    return {
      id:       `duality-virtual-${actor.id as string}`,
      name:     actor.name as string,
      actor,
      document: {
        disposition: (actor.prototypeToken?.disposition ?? 1) as number,
        elevation: 0,
      },
      center:     { x: 0, y: 0 },
      bounds:     { width: 100, height: 100 },
      distanceTo: () => 0,
      // Foundry's PIXI ticker calls these on every target every frame.
      // Stubs prevent the TypeError cascade that locks up the VTT.
      _drawTargetArrows: () => {},
      refresh:           () => {},
    };
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  function giveSpotlight(e: MouseEvent, actorId: string): void {
    e.stopPropagation();
    const g = game as any;
    if (hasCombatants(g)) {
      const combatant = (g.combat.combatants.contents as any[])
        .find((c: any) => c.actor?.id === actorId);
      if (combatant) (ui as any).combat?.setCombatantSpotlight?.(combatant.id);
    } else {
      void giveSpotlightTotM(actorId);
    }
  }

  async function giveSpotlightTotM(actorId: string): Promise<void> {
    await applySpotlightTotM(
      (game as any).actors?.contents ?? [],
      spotlightActorId,
      actorId,
    );
  }

  function toggleTarget(actorId: string): void {
    contextMenuId = null;
    const actor = (game as any).actors.get(actorId);
    if (!actor) return;

    const realTokens: any[] = actor.getActiveTokens?.() ?? [];

    if (realTokens.length > 0) {
      // Map play: real Foundry targeting — visual ring + full side effects
      const token = realTokens[0];
      const isTargetedNow = (game as any).user.targets.has(token);
      token.setTarget(!isTargetedNow, { user: (game as any).user, releaseOthers: false });
    } else {
      // TotM: inject a virtual token directly into game.user.targets.
      // game.user.targets is a plain Set — .add() accepts any object.
      const targets = (game as any).user.targets as Set<any>;
      const virtualId = `duality-virtual-${actorId}`;
      const existing = Array.from(targets).find((t: any) => t.id === virtualId);
      if (existing) {
        targets.delete(existing);
        Hooks.callAll('targetToken', (game as any).user, existing, false);
      } else {
        const vt = makeVirtualToken(actor);
        targets.add(vt);
        Hooks.callAll('targetToken', (game as any).user, vt, true);
      }
    }
  }

  function targetAll(): void {
    for (const char of characters) {
      const actor = (game as any).actors.get(char.id);
      if (!actor) continue;
      const realTokens: any[] = actor.getActiveTokens?.() ?? [];
      if (realTokens.length > 0) {
        realTokens[0].setTarget(true, { user: (game as any).user, releaseOthers: false });
      } else {
        const targets = (game as any).user.targets as Set<any>;
        const virtualId = `duality-virtual-${char.id}`;
        const existing = Array.from(targets).find((t: any) => t.id === virtualId);
        if (!existing) {
          const vt = makeVirtualToken(actor);
          targets.add(vt);
          Hooks.callAll('targetToken', (game as any).user, vt, true);
        }
      }
    }
  }

  function untargetAll(): void {
    for (const char of characters) {
      const actor = (game as any).actors.get(char.id);
      if (!actor) continue;
      const realTokens: any[] = actor.getActiveTokens?.() ?? [];
      if (realTokens.length > 0) {
        realTokens[0].setTarget(false, { user: (game as any).user, releaseOthers: false });
      } else {
        const targets = (game as any).user.targets as Set<any>;
        const virtualId = `duality-virtual-${char.id}`;
        const existing = Array.from(targets).find((t: any) => t.id === virtualId);
        if (existing) {
          targets.delete(existing);
          Hooks.callAll('targetToken', (game as any).user, existing, false);
        }
      }
    }
  }

  function openSheet(actorId: string): void {
    contextMenuId = null;
    (game as any).actors.get(actorId)?.sheet?.render(true);
  }

  function handleContextMenu(e: MouseEvent, id: string): void {
    e.preventDefault();
    contextMenuId = id;
    menuX = e.clientX;
    menuY = e.clientY;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  onMount(() => {
    readCharacters();
    readSpotlightState();
    readTargetState();

    const closeMenu = () => { contextMenuId = null; };
    document.addEventListener('click', closeMenu);

    // Capture-phase keydown so we intercept T before Foundry's own targeting handler.
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 't' || e.key === 'T') && hoveredId !== null) {
        e.stopPropagation();
        e.preventDefault();
        toggleTarget(hoveredId);
      }
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });

    const h0 = Hooks.on('updateActor', () => { readCharacters(); readSpotlightState(); });
    const h1 = Hooks.on('createActor',     readCharacters);
    const h2 = Hooks.on('deleteActor',     readCharacters);
    const h3 = Hooks.on('updateUser',      readCharacters);
    const h4 = Hooks.on('updateCombat',    readSpotlightState);
    const h5 = Hooks.on('updateCombatant', readSpotlightState);
    const h6 = Hooks.on('createCombat',    readSpotlightState);
    const h7 = Hooks.on('deleteCombat',    readSpotlightState);
    const h8 = Hooks.on('targetToken',     readTargetState);

    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      Hooks.off('updateActor',     h0);
      Hooks.off('createActor',     h1);
      Hooks.off('deleteActor',     h2);
      Hooks.off('updateUser',      h3);
      Hooks.off('updateCombat',    h4);
      Hooks.off('updateCombatant', h5);
      Hooks.off('createCombat',    h6);
      Hooks.off('deleteCombat',    h7);
      Hooks.off('targetToken',     h8);
    };
  });
</script>

<div id="duality-gm-dashboard">
  <div class="duality-gm-gallery">
    {#each characters as char (char.id)}
      <div class="duality-gm-portrait">
        <div class="duality-gm-portrait-frame">
          <button
            class="duality-portrait-btn"
            onclick={(e) => giveSpotlight(e, char.id)}
            oncontextmenu={(e) => handleContextMenu(e, char.id)}
            onmouseenter={() => { hoveredId = char.id; }}
            onmouseleave={() => { hoveredId = null; }}
            title="{char.name} — click to spotlight, right-click for options, T to target"
            aria-label="{char.name}"
          >
            <img src={char.img} alt={char.name} draggable="false" />
          </button>

          {#if spotlightActorId === char.id}
            <div class="duality-gm-portrait-overlay duality-gm-portrait-overlay--spotlight"
                 aria-label="Has spotlight">
              <i class="fa-solid fa-hand"></i>
            </div>
          {:else if requestingIds.has(char.id)}
            <div class="duality-gm-portrait-overlay duality-gm-portrait-overlay--requesting"
                 aria-label="Requesting spotlight">
              <i class="fa-solid fa-hand-sparkles"></i>
            </div>
          {/if}

          {#if targetedIds.has(char.id)}
            <div class="duality-gm-portrait-overlay duality-gm-portrait-overlay--targeted"
                 aria-label="Targeted">
              <i class="fa-solid fa-crosshairs"></i>
            </div>
          {/if}
        </div>
        <span class="duality-gm-portrait__name">{char.name}</span>
      </div>
    {/each}

    <div class="duality-gm-actions">
      <button
        class="duality-orb"
        onclick={targetAll}
        title="Target all characters"
        aria-label="Target all"
      >
        <i class="fa-solid fa-crosshairs"></i>
      </button>
      <button
        class="duality-orb duality-gm-untarget-btn"
        onclick={untargetAll}
        title="Remove targeting from all characters"
        aria-label="Untarget all"
      >
        <i class="fa-solid fa-crosshairs"></i>
      </button>
    </div>
  </div>

  {#if contextMenuId !== null}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="duality-gm-context-menu"
      style="left: {menuX}px; top: {menuY}px;"
      onclick={(e) => e.stopPropagation()}
      role="menu"
    >
      <button role="menuitem" onclick={() => openSheet(contextMenuId!)}>
        <i class="fa-solid fa-sheet-plastic"></i> Open Sheet
      </button>
      <button role="menuitem" onclick={() => toggleTarget(contextMenuId!)}>
        <i class="fa-solid fa-crosshairs"></i>
        {targetedIds.has(contextMenuId!) ? 'Untarget' : 'Target'}
      </button>
    </div>
  {/if}
</div>

<script lang="ts">
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

  interface Props {
    visible?: boolean;
    data?: CompanionData | null;
    panelRight?: string;
    onAttack?: () => Promise<void>;
    onActionRoll?: () => Promise<void>;
  }

  let {
    visible = $bindable(false),
    data = null,
    panelRight = '20px',
    onAttack,
    onActionRoll,
  }: Props = $props();

  function attackBonusLabel(bonus: number): string {
    return bonus >= 0 ? `+${bonus}` : `${bonus}`;
  }

  // Panel sits 10px above the companion card (card bottom=120px, height=120px → top=240px)
  const PANEL_BOTTOM = 250;

  async function toggleStress(i: number): Promise<void> {
    if (!data) return;
    const next = Math.min(i < data.stress.value ? i : i + 1, data.stress.max);
    const companion = (game as any).actors?.get(data.id) as any;
    if (!companion) return;
    await companion.update({ 'system.resources.stress.value': next });
  }

  function openCompanionSheet(): void {
    if (!data) return;
    const companion = (game as any).actors?.get(data.id) as any;
    companion?.sheet?.render(true);
  }
</script>

{#if visible && data}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="duality-companion-panel__overlay"
    onclick={() => (visible = false)}
    onkeydown={(e) => e.key === 'Escape' && (visible = false)}
  ></div>

  <div
    class="duality-companion-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Companion: {data.name}"
    style="right: {panelRight}; bottom: {PANEL_BOTTOM}px"
  >
    <div class="duality-companion-panel__header">
      {#if data.img}
        <img src={data.img} alt={data.name} draggable="false" class="duality-companion-panel__art" />
      {/if}
      <div class="duality-companion-panel__title">
        <span class="duality-companion-panel__type">Companion</span>
        <button
          class="duality-companion-panel__name duality-companion-panel__name--link"
          onclick={openCompanionSheet}
          aria-label="Open {data.name}'s sheet"
          title="Open sheet"
        >{data.name}</button>
      </div>
      <button
        class="duality-companion-panel__close"
        onclick={() => (visible = false)}
        aria-label="Close companion panel"
      >×</button>
    </div>

    <div class="duality-companion-panel__stats">
      <div class="duality-companion-panel__stat">
        <span class="duality-companion-panel__stat-value">{data.level}</span>
        <span class="duality-companion-panel__stat-label">Level</span>
      </div>
      <div class="duality-companion-panel__stat">
        <span class="duality-companion-panel__stat-value">{data.evasion}</span>
        <span class="duality-companion-panel__stat-label">Evasion</span>
      </div>
      <div class="duality-companion-panel__stat">
        <span class="duality-companion-panel__stat-value">
          {data.attackRange === 'ranged' ? 'Ranged' : 'Melee'}
        </span>
        <span class="duality-companion-panel__stat-label">Range</span>
      </div>
    </div>

    {#if data.stress.max > 0}
      <div class="duality-companion-panel__stress" role="group" aria-label="Stress track">
        <span class="duality-companion-panel__section-label">
          Stress <span class="duality-companion-panel__stress-value">{data.stress.value}/{data.stress.max}</span>
        </span>
        <div class="duality-companion-panel__beads">
          {#each Array(data.stress.max) as _, i}
            <button
              class="duality-companion-panel__bead-btn"
              class:is-filled={i < data.stress.value}
              onclick={() => toggleStress(i)}
              aria-label="Stress {i + 1}{i < data.stress.value ? ' — click to reduce' : ' — click to add'}"
              aria-pressed={i < data.stress.value}
            >
              <span class="duality-card__bead" class:is-empty={i >= data.stress.value}></span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="duality-companion-panel__rolls">
      <div class="duality-companion-panel__roll">
        <div class="duality-companion-panel__roll-info">
          <span class="duality-companion-panel__roll-label">Action Roll</span>
          <span class="duality-companion-panel__roll-formula">
            2d6 {attackBonusLabel(data.attackBonus)}
          </span>
        </div>
        {#if onActionRoll}
          <button
            class="duality-companion-panel__roll-btn"
            onclick={onActionRoll}
            aria-label="Roll companion action"
          >Roll</button>
        {/if}
      </div>
      <div class="duality-companion-panel__roll">
        <div class="duality-companion-panel__roll-info">
          <span class="duality-companion-panel__roll-label">Attack</span>
          <span class="duality-companion-panel__roll-formula">
            {data.attackDice} × Prof
          </span>
        </div>
        {#if onAttack}
          <button
            class="duality-companion-panel__roll-btn"
            onclick={onAttack}
            aria-label="Roll companion attack"
          >Roll</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

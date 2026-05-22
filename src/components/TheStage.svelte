<script lang="ts">
  import { onMount } from 'svelte';
  import { computeStagePortraits, type StageActor } from '../lib/stage.js';

  let portraits = $state<StageActor[]>([]);

  function readStageState(): void {
    portraits = computeStagePortraits(game as any);
  }

  onMount(() => {
    readStageState();

    const h0 = Hooks.on('updateCombat',    readStageState);
    const h1 = Hooks.on('updateCombatant', readStageState);
    const h2 = Hooks.on('createCombat',    readStageState);
    const h3 = Hooks.on('deleteCombat',    readStageState);
    const h4 = Hooks.on('updateActor',     readStageState);

    return () => {
      Hooks.off('updateCombat',    h0);
      Hooks.off('updateCombatant', h1);
      Hooks.off('createCombat',    h2);
      Hooks.off('deleteCombat',    h3);
      Hooks.off('updateActor',     h4);
    };
  });
</script>

{#if portraits.length > 0}
  <div id="duality-stage">
    {#each portraits as p (p.id)}
      <div class="duality-stage-portrait">
        <img src={p.img} alt={p.name} draggable="false" />
        <span class="duality-stage-portrait__name">{p.name}</span>
      </div>
    {/each}
  </div>
{/if}

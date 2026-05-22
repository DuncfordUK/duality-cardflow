<script lang="ts">
  import { onMount } from 'svelte';

  let tokenImg = $state('icons/svg/mystery-man.svg');
  let actorName = $state('');

  onMount(() => {
    const user = game.user as (typeof game.user & { character?: FoundryActor | null }) | null;
    const actor = user?.character;
    if (!actor) return;

    tokenImg = actor.prototypeToken?.texture?.src ?? actor.img ?? 'icons/svg/mystery-man.svg';
    actorName = actor.name ?? '';
  });

  interface FoundryActor {
    id: string;
    name: string;
    img: string;
    prototypeToken: { texture: { src: string }; name: string };
    sheet: { render(force: boolean): void };
  }

  function openSheet(): void {
    const user = game.user as (typeof game.user & { character?: FoundryActor | null }) | null;
    user?.character?.sheet?.render(true);
  }
</script>

<div class="duality-player-token">
  <button
    class="duality-player-token__portrait"
    aria-label="Open character sheet"
    onclick={openSheet}
    title={actorName || 'Character sheet'}
  >
    <img src={tokenImg} alt={actorName} draggable="false" />
    <div class="duality-player-token__ring" aria-hidden="true"></div>
  </button>

  {#if actorName}
    <span class="duality-player-token__name">{actorName}</span>
  {/if}
</div>

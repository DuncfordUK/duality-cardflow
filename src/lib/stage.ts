export interface StageActor {
  id:   string;
  name: string;
  img:  string;
}

export function actorToSlot(actor: any): StageActor {
  return {
    id:   actor.id as string,
    name: (actor.name ?? 'Unknown') as string,
    img:  (actor.prototypeToken?.texture?.src ?? actor.img ?? 'icons/svg/mystery-man.svg') as string,
  };
}

export function resolveSpotlightActor(game: any): StageActor | null {
  const combat = game.combat;
  let actor: any;
  if (((combat?.combatants?.contents as any[])?.length ?? 0) > 0) {
    const turns: any[] = combat.turns ?? [];
    actor = combat.turn != null ? turns[combat.turn]?.actor : undefined;
  } else {
    actor = (game.actors?.contents ?? []).find(
      (a: any) => a.getFlag('duality-cardflow', 'hasSpotlight') === true
    );
  }
  return actor ? actorToSlot(actor) : null;
}

export function resolveTagTeamActors(game: any, spotlightActorId: string): StageActor[] {
  const partyActor = (game.actors?.contents ?? []).find((a: any) => a.type === 'party');
  if (!partyActor) return [];
  const tagTeam = partyActor.system?.tagTeam;
  if (!tagTeam?.initiator || tagTeam.initiator.memberId !== spotlightActorId) return [];
  return Object.keys(tagTeam.members ?? {})
    .map((id: string) => { const a = game.actors?.get(id); return a ? actorToSlot(a) : null; })
    .filter(Boolean) as StageActor[];
}

export function computeStagePortraits(game: any): StageActor[] {
  const spotlight = resolveSpotlightActor(game);
  if (!spotlight) return [];
  const tagTeam = resolveTagTeamActors(game, spotlight.id);
  return tagTeam.length >= 2 ? tagTeam : [spotlight];
}

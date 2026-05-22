export interface SpotlightState {
  spotlightActorId: string | null;
  requestingIds:    Set<string>;
}

export function hasCombatants(game: any): boolean {
  return ((game.combat?.combatants?.contents as any[])?.length ?? 0) > 0;
}

export function computeSpotlightState(game: any): SpotlightState {
  const combat = game.combat;

  if (hasCombatants(game)) {
    const turns: any[] = combat.turns ?? [];
    const current = combat.turn != null ? turns[combat.turn] : null;
    const spotlightActorId: string | null = current?.actor?.id ?? null;

    const req = new Set<string>();
    for (const c of (combat.combatants?.contents ?? []) as any[]) {
      if (c.system?.spotlight?.requesting && c.actor?.id) req.add(c.actor.id as string);
    }
    return { spotlightActorId, requestingIds: req };
  }

  const actors: any[] = game.actors?.contents ?? [];
  const spotlightActor = actors.find((a: any) =>
    a.getFlag('duality-cardflow', 'hasSpotlight') === true
  );
  const req = new Set<string>();
  for (const a of actors) {
    if (a.getFlag('duality-cardflow', 'requestingSpotlight') === true) req.add(a.id as string);
  }
  return { spotlightActorId: spotlightActor?.id ?? null, requestingIds: req };
}

export async function applySpotlightTotM(
  actors: any[],
  currentSpotlightActorId: string | null,
  targetActorId: string,
): Promise<void> {
  const isAlreadySpotlighted = currentSpotlightActorId === targetActorId;
  for (const a of actors) {
    if (a.getFlag('duality-cardflow', 'hasSpotlight') === true) {
      await (a as any).unsetFlag('duality-cardflow', 'hasSpotlight');
    }
  }
  if (!isAlreadySpotlighted) {
    const target = actors.find((a: any) => a.id === targetActorId);
    if (target) {
      await (target as any).setFlag('duality-cardflow', 'hasSpotlight', true);
      if (target.getFlag('duality-cardflow', 'requestingSpotlight') === true) {
        await (target as any).unsetFlag('duality-cardflow', 'requestingSpotlight');
      }
    }
  }
}

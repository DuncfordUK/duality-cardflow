import { describe, it, expect, vi } from 'vitest';
import { computeSpotlightState, applySpotlightTotM } from '../lib/spotlight.js';

function makeActor(id: string, flags: Record<string, any> = {}) {
  const store = { ...flags };
  return {
    id,
    name: id,
    type: 'character',
    img: `img/${id}.png`,
    prototypeToken: null,
    getFlag:   vi.fn((ns: string, key: string) => store[`${ns}::${key}`]),
    setFlag:   vi.fn(async (ns: string, key: string, v: any) => { store[`${ns}::${key}`] = v; }),
    unsetFlag: vi.fn(async (ns: string, key: string) => { delete store[`${ns}::${key}`]; }),
  };
}

function makeGame(actors: any[], combat: any = null) {
  const map = new Map(actors.map(a => [a.id, a]));
  return { actors: { contents: actors, get: (id: string) => map.get(id) }, combat };
}

// ── computeSpotlightState — TotM mode (no combatants) ──────────────────────

describe('computeSpotlightState — TotM mode', () => {
  it('returns null when no actor has the spotlight flag', () => {
    expect(computeSpotlightState(makeGame([makeActor('a')])).spotlightActorId).toBeNull();
  });

  it('returns the id of the actor that has hasSpotlight=true', () => {
    const b = makeActor('b', { 'duality-cardflow::hasSpotlight': true });
    expect(computeSpotlightState(makeGame([makeActor('a'), b])).spotlightActorId).toBe('b');
  });

  it('collects actor ids with requestingSpotlight=true into requestingIds', () => {
    const a = makeActor('a', { 'duality-cardflow::requestingSpotlight': true });
    const { requestingIds } = computeSpotlightState(makeGame([a, makeActor('b')]));
    expect(requestingIds.has('a')).toBe(true);
    expect(requestingIds.has('b')).toBe(false);
  });

  it('returns empty requestingIds when no actor is requesting', () => {
    const { requestingIds } = computeSpotlightState(makeGame([makeActor('a'), makeActor('b')]));
    expect(requestingIds.size).toBe(0);
  });
});

// ── computeSpotlightState — combat tracker mode ─────────────────────────────

describe('computeSpotlightState — combat mode', () => {
  it('returns the current turn actor id when combatants exist', () => {
    const a = makeActor('a');
    const combat = {
      combatants: { contents: [{ actor: a, system: { spotlight: { requesting: false } } }] },
      turns: [{ actor: a }],
      turn: 0,
    };
    expect(computeSpotlightState(makeGame([a], combat)).spotlightActorId).toBe('a');
  });

  it('returns null when combat.turn is null', () => {
    const a = makeActor('a');
    const combat = {
      combatants: { contents: [{ actor: a }] },
      turns: [{ actor: a }],
      turn: null,
    };
    expect(computeSpotlightState(makeGame([a], combat)).spotlightActorId).toBeNull();
  });

  it('collects combatants with spotlight.requesting into requestingIds', () => {
    const a = makeActor('a');
    const b = makeActor('b');
    const combat = {
      combatants: {
        contents: [
          { actor: a, system: { spotlight: { requesting: true } } },
          { actor: b, system: { spotlight: { requesting: false } } },
        ],
      },
      turns: [{ actor: a }],
      turn: 0,
    };
    const { requestingIds } = computeSpotlightState(makeGame([a, b], combat));
    expect(requestingIds.has('a')).toBe(true);
    expect(requestingIds.has('b')).toBe(false);
  });
});

// ── applySpotlightTotM ───────────────────────────────────────────────────────

describe('applySpotlightTotM', () => {
  it('sets hasSpotlight on the target actor', async () => {
    const b = makeActor('b');
    await applySpotlightTotM([makeActor('a'), b], null, 'b');
    expect(b.setFlag).toHaveBeenCalledWith('duality-cardflow', 'hasSpotlight', true);
  });

  it('clears hasSpotlight from the previously spotlighted actor', async () => {
    const a = makeActor('a', { 'duality-cardflow::hasSpotlight': true });
    const b = makeActor('b');
    await applySpotlightTotM([a, b], 'a', 'b');
    expect(a.unsetFlag).toHaveBeenCalledWith('duality-cardflow', 'hasSpotlight');
  });

  it('toggles off when the target already has the spotlight', async () => {
    const a = makeActor('a', { 'duality-cardflow::hasSpotlight': true });
    await applySpotlightTotM([a], 'a', 'a');
    expect(a.unsetFlag).toHaveBeenCalledWith('duality-cardflow', 'hasSpotlight');
    expect(a.setFlag).not.toHaveBeenCalled();
  });

  it('clears requestingSpotlight when spotlight is granted to that actor', async () => {
    const a = makeActor('a', { 'duality-cardflow::requestingSpotlight': true });
    await applySpotlightTotM([a], null, 'a');
    expect(a.unsetFlag).toHaveBeenCalledWith('duality-cardflow', 'requestingSpotlight');
  });

  it('does not set flag when target actor is not found in actors list', async () => {
    const a = makeActor('a');
    await applySpotlightTotM([a], null, 'nonexistent');
    expect(a.setFlag).not.toHaveBeenCalled();
  });
});

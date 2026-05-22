import { describe, it, expect } from 'vitest';
import { computeStagePortraits } from '../lib/stage.js';

function makeActor(id: string, opts: { type?: string; hasSpotlight?: boolean } = {}) {
  return {
    id,
    name: id,
    type: opts.type ?? 'character',
    img: `img/${id}.png`,
    prototypeToken: null,
    system: {},
    getFlag: (ns: string, key: string) =>
      ns === 'duality-cardflow' && key === 'hasSpotlight' && opts.hasSpotlight ? true : undefined,
  };
}

function makeParty(initiatorId: string | null, memberIds: string[]) {
  return {
    id: 'party',
    name: 'Party',
    type: 'party',
    img: 'img/party.png',
    prototypeToken: null,
    system: {
      tagTeam: {
        initiator: initiatorId ? { memberId: initiatorId, cost: 3 } : null,
        members:   Object.fromEntries(memberIds.map(id => [id, {}])),
      },
    },
    getFlag: () => undefined,
  };
}

function makeGame(actors: any[], combat: any = null) {
  const map = new Map(actors.map(a => [a.id, a]));
  return { actors: { contents: actors, get: (id: string) => map.get(id) }, combat };
}

// ── computeStagePortraits ────────────────────────────────────────────────────

describe('computeStagePortraits', () => {
  it('returns [] when no actor has the spotlight', () => {
    expect(computeStagePortraits(makeGame([makeActor('a')]))).toEqual([]);
  });

  it('returns single portrait for a TotM-spotlighted actor', () => {
    const a = makeActor('a', { hasSpotlight: true });
    const result = computeStagePortraits(makeGame([a]));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns two portraits when tag team has 2 members and initiator holds spotlight', () => {
    const a = makeActor('a', { hasSpotlight: true });
    const b = makeActor('b');
    const party = makeParty('a', ['a', 'b']);
    const result = computeStagePortraits(makeGame([a, b, party]));
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id).sort()).toEqual(['a', 'b']);
  });

  it('returns single portrait when tag team has only 1 member so far', () => {
    const a = makeActor('a', { hasSpotlight: true });
    const party = makeParty('a', ['a']);
    expect(computeStagePortraits(makeGame([a, party]))).toHaveLength(1);
  });

  it('returns single portrait when tag team initiator is not the spotlight holder', () => {
    const a = makeActor('a', { hasSpotlight: true });
    const b = makeActor('b');
    const party = makeParty('b', ['a', 'b']); // b initiated, a has spotlight
    const result = computeStagePortraits(makeGame([a, b, party]));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns single portrait when tag team has no initiator', () => {
    const a = makeActor('a', { hasSpotlight: true });
    const party = makeParty(null, []);
    const result = computeStagePortraits(makeGame([a, party]));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns portrait from combat tracker when combatants are present', () => {
    const a = makeActor('a');
    const combat = {
      combatants: { contents: [{ actor: a }] },
      turns: [{ actor: a }],
      turn: 0,
    };
    const result = computeStagePortraits(makeGame([a], combat));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns [] when combat is active but combat.turn is null', () => {
    const a = makeActor('a');
    const combat = {
      combatants: { contents: [{ actor: a }] },
      turns: [{ actor: a }],
      turn: null,
    };
    expect(computeStagePortraits(makeGame([a], combat))).toEqual([]);
  });

  it('uses img fallback when prototypeToken is null', () => {
    const a = makeActor('a', { hasSpotlight: true });
    const result = computeStagePortraits(makeGame([a]));
    expect(result[0].img).toBe('img/a.png');
  });
});

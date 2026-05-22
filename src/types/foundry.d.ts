declare global {
  // eslint-disable-next-line no-var
  var Hooks: {
    once(event: string, fn: (...args: unknown[]) => void): number;
    on(event: string, fn: (...args: unknown[]) => void): number;
    off(event: string, id: number): void;
    callAll(event: string, ...args: unknown[]): boolean;
  };

  // eslint-disable-next-line no-var
  var game: Game;

  interface Game {
    settings: SettingsConfig;
    i18n: Localization;
    user: { isGM: boolean; name: string; id: string } | null;
    modules: Map<string, { active: boolean; id: string }>;
    cards: WorldCollection<CardsDocument>;
    ready: boolean;
  }

  interface WorldCollection<T> {
    contents: T[];
    get(id: string): T | undefined;
    getName(name: string): T | undefined;
  }

  interface CardsDocument {
    id: string;
    name: string;
    type: 'deck' | 'hand' | 'pile';
    cards: WorldCollection<CardDocument>;
    ownership: Record<string, number>;
    sheet: { render(force: boolean): void };
  }

  interface CardDocument {
    id: string;
    name: string;
    img: string;
    face: number | null;
    back: { img: string; name: string };
    sheet: { render(force: boolean): void };
  }

  interface SettingsConfig {
    register(
      namespace: string,
      key: string,
      data: {
        name: string;
        hint?: string;
        scope: 'world' | 'client';
        config: boolean;
        type: unknown;
        default?: unknown;
        choices?: Record<string, string>;
        onChange?: (value: unknown) => void;
      }
    ): void;
    get(namespace: string, key: string): unknown;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
  }

  interface Localization {
    localize(id: string): string;
    format(id: string, data?: Record<string, unknown>): string;
  }
}

export {};

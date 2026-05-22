# Project Duality: Cardflow

A Foundry VTT module for **Daggerheart** that replaces the default player interface with an animated, card-focused HUD. Designed for both map-based and Theatre of the Mind play.

**Requires:** Foundry VTT v13 · Daggerheart system

---

## Features

### Player Area

A persistent overlay at the bottom of the screen replaces the standard player controls:

- **Portrait** — opens the character sheet on click; displays a white glow ring when the character holds the spotlight
- **Trait badges** — hover the portrait to reveal AGI / STR / FIN / INS / PRE / KNO attribute badges above; click any badge to roll that trait
- **Weapon cards** — hover the portrait to reveal equipped weapons below; click to trigger an attack roll
- **Request Spotlight button** — a sparkle-hand orb appears to the right of the portrait when another character holds the spotlight; click to raise or lower your hand
- **HP and Stress bars** — click to enter inline edit mode; scroll wheel to adjust by ±1
- **Armor slots** — pip track driven by the equipped armor item
- **Damage thresholds** — minor, major, and severe thresholds shown in the stat row
- **Hope track** — interactive pip row above the portrait; click any pip to set the current hope value
- **Class feature rings** — orb buttons for each class feature; click to use, hover for a detail panel showing the feature description and resource state
- **Hope feature ring** — same use/hover behaviour for the hope ability
- **Inventory panel** — backpack orb opens a full inventory: weapons, armour, consumables, loot, and gold
- **Card vault** — vault button opens the domain card vault for managing the hand vs. vault split
- **Card hand** — animated fan of domain and identity cards; pinch to fit when the hand exceeds screen width

### GM Dashboard

A portrait strip at the bottom of the GM's screen showing all player-owned characters:

- Click a portrait to **give spotlight** — routes through the combat tracker when a combat encounter is active, or sets an actor flag for Theatre of the Mind play
- Right-click a portrait for a context menu: **Open Sheet**, **Toggle Target**
- **Target All orb** (gold crosshairs) and **Untarget All orb** (muted crosshairs with slash), pinned to the right of the portrait gallery — bulk-target or clear all characters in one click
- **T keybinding** — hover a portrait and press `T` to toggle targeting on that character; intercepts the keypress before Foundry's own targeting handler
- Overlay icons show the current spotlight holder (`fa-hand`, gold), players requesting the spotlight (`fa-hand-sparkles`, soft gold), and targeted characters (`fa-crosshairs`)
- TotM targeting injects a virtual token into `game.user.targets` so downstream automation works without requiring tokens on the canvas

### The Stage

A shared top-centre overlay visible to **all connected players and the GM**:

- Displays the spotlighted character's portrait and name
- Expands to include tag-team members from the Party actor when a tag team is active
- Updates live on combat and actor changes

### Card Reveals

- **Cinematic card reveal** — a fullscreen animated reveal plays when a domain card is drawn; card-type-aware layout adapts primary/secondary text per card type
- **Hope reveal** — a distinct gold-themed reveal for Hope card draws

### Companion Panel

If the player's character has a linked companion actor, a companion card appears in the hand area with an expandable panel showing stats, stress track, and roll buttons.

---

## Spotlight System

Spotlight management works in two modes, selected automatically:

| Mode | Condition | Mechanism |
|---|---|---|
| **Combat tracker** | Active combat encounter exists | Sets combatant spotlight via the Foundry combat UI |
| **Theatre of the Mind** | No combat encounter | Reads/writes the `requestingSpotlight` actor flag via `setFlag` / `unsetFlag` |

Players request the spotlight by clicking the sparkle-hand orb on their portrait. The GM sees the request overlay immediately and can click the portrait in the GM Dashboard to grant it.

---

## Architecture

| Path | Description |
|---|---|
| `src/components/PlayerArea.svelte` | Main player HUD |
| `src/components/GmDashboard.svelte` | GM portrait strip |
| `src/components/TheStage.svelte` | Shared spotlight display |
| `src/components/CardHand.svelte` | Animated card fan |
| `src/components/CardSpotlight.svelte` | Fullscreen card spotlight panel |
| `src/components/CardReveal.svelte` | Cinematic card reveal animation |
| `src/components/HopeReveal.svelte` | Hope-specific reveal animation |
| `src/components/CompanionPanel.svelte` | Companion stats panel |
| `src/components/InventoryPanel.svelte` | Inventory management panel |
| `src/components/VaultPanel.svelte` | Card vault management panel |
| `src/lib/spotlight.ts` | Pure spotlight state logic (dual-mode, unit-tested) |
| `src/lib/stage.ts` | Pure stage portrait resolution logic (unit-tested) |
| `src/module.ts` | Foundry module entry point; mounts all components |

All state management uses **Svelte 5 runes** (`$state`, `$derived`). Component data is driven by Foundry hooks (`updateActor`, `updateItem`, `updateCombat`, etc.) rather than polling.

---

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Unit tests
npm run test
```

Output is written to `dist/`. The Foundry junction at `%localappdata%/FoundryVTT/Data/modules/duality-cardflow` should point to the `public/` directory with `dist/` symlinked in; see the root workspace for junction setup.

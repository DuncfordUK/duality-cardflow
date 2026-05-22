# Changelog — Project Duality: Cardflow

---

## [1.5.1] — 2026-05-22

### Bug Fixes

- **Armour slots not appearing after equip** — Daggerheart fires `updateActor` (thresholds) before `updateItem` (equipped flag). A next-tick scheduler (`setTimeout 0`) on the three item hooks ensures both writes have settled before `readActor()` runs; also eliminates a secondary window where stale `armorSlots = 0` could cause an incorrect write to `system.armor.current` if a slot pip was clicked mid-flight
- **Player dashboard blank after character assignment** — `updateUser` hook added; when the GM assigns or reassigns an actor to a player, the dashboard populates immediately without requiring a page reload
- **Armour base score audit** — confirmed that the module never writes to `system.armor.max`; all armour-related writes are limited to `system.armor.current` (slot marks) and `system.equipped`

---

## [1.5.0] — 2026-05-22

### GM Dashboard

- **T keybinding** — pressing `T` while hovering a portrait in the GM Dashboard toggles targeting on that character; the keypress is consumed before Foundry's own targeting handler sees it, preventing canvas token interactions from firing simultaneously
- Portrait tooltips updated to surface the shortcut: `"click to spotlight, right-click for options, T to target"`

---

## [1.4.0] — 2026-05-22

### GM Dashboard

- **Target All orb** — a gold `fa-crosshairs` orb pinned to the right of the portrait gallery; click to target every character in the gallery simultaneously (supports both map tokens and TotM virtual tokens)
- **Untarget All orb** — a muted crosshairs orb with a diagonal slash overlay; click to clear targeting from all characters; hover turns red to reinforce the clearing action
- Both bulk-action orbs are vertically stacked 18 px to the right of the rightmost portrait, keeping the gallery centred at all sizes

### Bug Fixes

- **VTT lockup on targeting** — Foundry's PIXI ticker calls `_drawTargetArrows()` on every entry in `game.user.targets` every animation frame; virtual token stubs were missing this method, causing an uncaught `TypeError` on every frame that locked up the entire VTT. Fixed by adding `_drawTargetArrows: () => {}` and `refresh: () => {}` stubs to `makeVirtualToken`
- **Targeted overlay not updating immediately** — `isTargeted()` read `game.user.targets` directly (not reactive Svelte state), so the overlay only refreshed as a side-effect of unrelated renders. Replaced with `targetedIds` (`$state<Set<string>>`), populated by `readTargetState()` and kept live via a `targetToken` hook listener
- **Action orbs positioned against viewport edge** — the target/untarget orb column was pinned to `right: 20px` of the fixed viewport rather than relative to the portrait gallery. Fixed by wrapping portraits in a `position: relative` `.duality-gm-gallery` container and positioning the orb column with `left: 100%; margin-left: 18px`

---

## [1.3.0] — 2026-05-22

### GM Dashboard

- New `GmDashboard` component mounts for the GM and shows a portrait grid of all player-owned characters
- **Click a portrait** to give that character the spotlight (routes through combat tracker when a combat encounter is active, or through TotM actor flags otherwise)
- **Spotlight overlay** (`fa-hand`, gold) — shown on the portrait currently holding the spotlight
- **Requesting overlay** (`fa-hand-sparkles`, soft gold) — shown on portraits whose player has raised their hand
- **Targeted overlay** (`fa-crosshairs`) — shown when a virtual or real token is targeted
- **Right-click context menu** on each portrait: Open Sheet, Toggle Target
- TotM targeting injects a virtual token directly into `game.user.targets` (a plain `Set`); fires `targetToken` hooks so downstream automation picks it up

### The Stage

- New `TheStage` component mounts for **both GM and all players** (top-centre overlay, above the canvas)
- Displays the spotlighted actor's portrait + name; expands to include tag-team members from the Party actor's `system.tagTeam` when a tag team is active
- Portraits are 108 px (50 % larger than previous stage size); name text truncates to fit the portrait width
- Reacts to: `updateCombat`, `updateCombatant`, `createCombat`, `deleteCombat`, `updateActor`

### Spotlight Library (`spotlight.ts` / `stage.ts`)

- Pure, DOM-free logic extracted to `src/lib/spotlight.ts` and `src/lib/stage.ts`
- `computeSpotlightState(game)` — dual-mode: reads from the active combat tracker combatant when a combat encounter exists; falls back to actor flags (`duality-cardflow.requestingSpotlight`) for Theatre of the Mind play
- `applySpotlightTotM` — atomically clears the old spotlight flag and sets the new one
- `computeStagePortraits(game)` — resolves spotlight actor + tag-team members into an ordered portrait list
- **Vitest test suite** — 21 unit tests covering both libraries (`src/test/spotlight.test.ts`, `src/test/stage.test.ts`)

### Player Area — Spotlight Integration

- Player portrait displays a **bright white glow ring** (`is-spotlighted` class) when the character currently holds the spotlight
- Portrait button tracks `spotlightActorId` derived from `computeSpotlightState`; responds to combat and actor update hooks in real time
- **Request Spotlight button** — a sparkle-hand orb (`fa-hand-sparkles`) appears to the right of the portrait when another character has the spotlight
  - Click to raise your hand (sets `requestingSpotlight` actor flag); click again to lower it
  - `is-active` state lights the orb gold while the request is pending
  - The GM sees the requesting overlay on the corresponding portrait in the GM Dashboard immediately via the `updateActor` hook

### Hover Panel Reliability

- Trait badges (above), weapon cards (below), and the Request Spotlight button (right) all use a **relay mouseenter/mouseleave** pattern — each revealed element cancels the hide timer when entered, matching the existing class/hope feature panel pattern
- Hide delay increased from **150 ms → 300 ms**; slow deliberate cursor movements no longer race against the timer
- All three elements remain fully interactive while the panel is open; moving directly between revealed elements without touching the portrait keeps the panel visible

### Bug Fixes

- **Revealed elements rendering behind stat bars** — `z-index` stacking corrected: `.duality-portrait-wrap` raised to `z-index: 10`; `.duality-stat-box` given `position: relative; z-index: 1`; `.duality-stat-box__bar` given `z-index: 0`; `.duality-spotlight-request-btn` given `z-index: 10` — request button and all hover-revealed elements now paint above the HP and Stress meters regardless of DOM order

---

## [1.2.0] — 2026-05-22

### Card Hand Redesign

- Cards resized from 80×120px to **120×180px** (+50%), giving more surface area for art and text
- **Name moved to the top** of each card with a downward gradient overlay; pips rendered just below it — all critical information lives in the top strip
- Card images now fill the entire card face behind the name gradient (previously cropped to a sub-region)
- Fan spread reduced from 32° max to **22° max** (`Math.min(22, total * 3.5)`) to prevent excessive horizontal overlap at higher card counts
- Card gap reduced to **12px**

### Player Area

- Hand is now **sunk by default** — `bottom: -90px` means only the top ~90px of each card (name + pips) is visible, reclaiming vertical canvas space
- Subtle bottom **vignette** anchors the hand visually without adding height

### Info Row

- **Vault button** moved to the far right of the info row, after Severe threshold — rendered as a plain icon + label column, not an orb

### Macro Bar Toggle

- Foundry's macro bar is now **hidden by default** on load
- A **toggle button** (`fa-code` icon) is injected into `#scene-controls-layers` as a native Foundry layer control button, matching the sizing and style of all other scene-control buttons
- Clicking the toggle shows/hides `#hotbar` in its vanilla Foundry form; active state indicated by gold glow via `[aria-pressed="true"]`

### Bug Fixes

- **Domain card resource track not rendering** — `resolveFormula` now falls back to `Roll.replaceFormulaData(formula, actor.getRollData())` for Daggerheart-specific formula references such as `@cast` that are not directly on `actor.system`
- `res.value = null` (resource with no uses spent) is now treated as `max` rather than `undefined`, so a freshly-added card always shows a full pip track

### Module Architecture

- **`duality-ui-core` dependency removed** — cardflow is now a standalone module with no required dependencies
- Hotbar CSS overrides, the pulsing gold chevron strip (`#ui-bottom::after`), the dark vignette, glow blobs, and floating particles are all gone; the `#duality-overlay` element no longer mounts
- Cinzel font is supplied by the Daggerheart system's own stylesheet and requires no separate loading

---

## [1.1.0] — 2026-05-21

### New Components

**CompanionPanel**
- Floating panel showing companion stats (level, evasion, attack range), stress track, and roll buttons
- Stress pips are interactive — clicking increments or decrements the companion's stress and immediately syncs to the companion sheet
- Companion name is a clickable link that opens the companion's Foundry actor sheet
- Panel position is computed relative to the card hand so it never overlaps the hand area

**InventoryPanel**
- Four-section inventory: Weapons, Armour, Consumables, Loot
- Gold / currency section (Coins, Handfuls, Bags, Chests) with editable inputs that write directly to `system.gold.*`
- Equip/unequip toggle for weapons and armour; equipped items are visually highlighted
- Quantity fields are editable for all item types; changes write to `system.quantity`
- Clicking a consumable's icon triggers `item.use()`, opening the Daggerheart roll-selection dialog
- Send to Chat uses Daggerheart's native `item.toChat()` to produce proper ability-use chat cards
- Right-click context menu on every item: Use, Edit, Send to Chat, Delete — matching the character sheet
- Drag-and-drop from any Foundry compendium adds the item to the correct section automatically
- Context menu uses capture-phase click-away so it dismisses reliably even inside Foundry's event-heavy canvas

**VaultPanel**
- Split hand/vault view with drag-and-drop between zones
- Capacity indicators and slot-empty placeholders
- Confirm/cancel actions for vault moves

**CardReveal**
- Cinematic reveal animation played when a card is drawn
- Card-type-aware text layout: primary and secondary text vary per card type (domain card, ancestry, community, subclass, etc.)

**HopeReveal**
- Dedicated gold-themed reveal animation for Hope card draws
- Distinct from standard card reveal to reflect the significance of the Hope mechanic

### Player Area

- **HP editing** — click the HP bar to enter an inline edit mode; supports direct value entry and delta input (`+2`, `-3`)
- **Stress editing** — same inline edit pattern for the stress track
- **Armor slots** — current/max armor slot display driven by the equipped armor item
- **Thresholds** — minor, major, and severe damage thresholds shown in the stat area
- **Class feature rings** — interactive orbs for each class feature; clicking fires `item.use()` and shows a hover card with feature details and resource state
- **Hope feature ring** — interactive orb for the hope feature with the same use/hover behaviour
- **Companion card** — companion token and name shown as a persistent card in the player area; click to open the companion panel
- **Foundry hooks** — `updateActor`, `updateItem`, `createItem`, `deleteItem` all trigger a full reactive re-read so the UI stays in sync with any sheet changes

### Design System

- **`.duality-orb`** — canonical reusable class for all 50 × 50 px glass-circle interactive buttons; provides the dark-glass background, gold border, flex-centred content, and gold-glow hover / `is-active` states
- All orbs (class feature, hope feature, inventory, card vault) now use `.duality-orb` with consistent hover and active behaviour
- `.duality-feature-ring` reduced to a single `position: relative` rule — all visual tokens live in `.duality-orb`
- `.duality-vault-btn` reduced to positioning only

### Bug Fixes

- Weapon range labels now use Daggerheart's full range vocabulary (`melee`, `veryClose`, `close`, `far`, `veryFar`, `ranged`) instead of a binary melee/ranged check
- Consumable and loot quantity always shown (removed the `> 1` guard)
- Inventory context menu now closes on any click outside via capture-phase document listener
- Companion stress pips were blocked by `pointer-events: none` on their container — fixed
- Inventory orb was missing hover glow — now consistent with all other orbs via `.duality-orb`

### Layout

- Actor name supports multi-line wrapping; long names carry onto a second row without colliding with the orb groups
- Orb groups are pinned absolutely to the edges of the name row so the name always centres over the portrait regardless of how many class feature orbs are present

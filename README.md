# Project Duality: Cardflow

A Foundry VTT module for **Daggerheart** that replaces the default player interface with an animated, card-focused HUD. Designed for both map-based and Theatre of the Mind play.

**Requires:** Foundry VTT v13 · [Daggerheart system](https://github.com/Foundryborne/daggerheart). 

**Warning:** This is a work in progress that has been tested on my local instance of Foundry running Daggerheart and Dice so Nice. Please back-up any World before deploying this module, in the unlikely event that something goes catastrophically wrong!

---

One of the unique components of Daggerheart is its card system, and I lamented that the official VTT implementation over at demiplane made no attempt to replicate this unique, tactile aspect of the game.
So, standing on the shoulders of the giants over at Foundryborne, I wanted to offer something a little different to the Daggerheart Foundry commmunity.

# Project Duality
Project Duality is intended to replicate the card-based gameplay experience of in-person Daggerheart, utilising the systems that Foundryborne have masterfully crafted for us, but presenting them in a new format. Players can see their cards in front of them, draw them and play them theatrically into the VTT for all their party members to see - just like if you were at a table together. 
But Daggerheart is an asymmetric play experience, and that calls for an asymmetric interface. The GM Dashboard has constant visibility of all the player Characters, can give them the Spotlight and target them with attacks and effects, without the need to create a combat encounter. They will have narrative and mechanical effects at their finger tips, avoiding the need to go fishing through compendiums and scenes - it's right there in the scene.
This is still a work in development and I would appreciate any feedback from the community - bugs, feature requests etc. and I hope I will be able to support this in my spare time. But for now, please enjoy.

## Features

### Player Area

A persistent overlay at the bottom of the screen replaces the standard player controls:

<img width="888" height="499" alt="Player Area1" src="https://github.com/user-attachments/assets/1597169d-7eb7-4870-9720-2d599f405abb" />

- **Portrait** — opens the character sheet on click; displays a white glow ring when the character holds the spotlight

<img width="862" height="485" alt="Spotlight" src="https://github.com/user-attachments/assets/22d11581-e7c7-4d7a-b040-eb6c2bfff62e" />

- **Trait badges** — hover the portrait to reveal AGI / STR / FIN / INS / PRE / KNO attribute badges above; click any badge to roll that trait
- **Weapon cards** — hover the portrait to reveal equipped weapons below; click to trigger an attack rol
- **Request Spotlight button** — a sparkle-hand orb appears to the right of the portrait when another character holds the spotlight; click to raise or lower your hand
- **HP and Stress bars** — click to enter inline edit mode; scroll wheel to adjust by ±1
- **Armor slots** — pip track driven by the equipped armor item
- **Damage thresholds** — minor, major, and severe thresholds shown in the stat row
- **Hope track** — interactive pip row above the portrait; click any pip to set the current hope value
- **Class feature rings** — orb buttons for each class feature; click to use, hover for a detail panel showing the feature description and resource state

<img width="646" height="517" alt="Class Feature" src="https://github.com/user-attachments/assets/b307a0c3-318a-48e9-bf7b-cbd232d81570" />

- **Hope feature ring** — same use/hover behaviour for the hope ability

<img width="580" height="464" alt="Hope Feature" src="https://github.com/user-attachments/assets/fc2afc68-44bc-4433-8185-f8014d44bf60" />

- **Hope reveal** — a distinct gold-themed reveal for Hope Feature uses

<img width="810" height="1080" alt="Hope Feature Reveal" src="https://github.com/user-attachments/assets/20dc01cf-6efd-4bc3-8c6a-f853006aa56d" />

- **Inventory panel** — backpack orb opens a full inventory: weapons, armour, consumables, loot, and gold

<img width="632" height="789" alt="Inventory" src="https://github.com/user-attachments/assets/b353ee29-3b10-440a-b8f3-c8dcbda6a697" />

- **Card vault** — vault button opens the domain card vault for managing the hand vs. vault split

<img width="1212" height="606" alt="Card Vault" src="https://github.com/user-attachments/assets/1f4d33f5-dfa0-46c8-9ae1-aff02f47c364" />

- **Card hand** — animated fan of domain and identity cards; pinch to fit when the hand exceeds screen width

<img width="860" height="573" alt="Card Hand Animation" src="https://github.com/user-attachments/assets/49086417-dced-4d2f-ae8b-2ca12de81fb7" />
<img width="629" height="786" alt="Card Spotlight" src="https://github.com/user-attachments/assets/87eba56d-5c6c-49af-826b-599568a7736f" />

- **Cinematic card reveal** — a fullscreen animated reveal plays when a domain card is drawn; card-type-aware layout adapts primary/secondary text per card type

<img width="864" height="1080" alt="Card Reveal" src="https://github.com/user-attachments/assets/4bca811b-0de4-425c-af80-45992b59c86a" />


### GM Dashboard

A portrait strip at the bottom of the GM's screen showing all player-owned characters:

<img width="446" height="318" alt="GM Dashboard" src="https://github.com/user-attachments/assets/b98ef5e5-d5ab-494a-8e40-eb97124dd2dd" />

- Click a portrait to **give spotlight** — routes through the combat tracker when a combat encounter is active, or sets an actor flag for Theatre of the Mind play
- Right-click a portrait for a context menu: **Open Sheet**, **Toggle Target**
- **Target All orb** (gold crosshairs) and **Untarget All orb** (muted crosshairs with slash), pinned to the right of the portrait gallery — bulk-target or clear all characters in one click
- **T keybinding** — hover a portrait and press `T` to toggle targeting on that character; intercepts the keypress before Foundry's own targeting handler
- Overlay icons show the current spotlight holder, players requesting the spotlight, and targeted characters

<img width="406" height="290" alt="Requesting Spotlight" src="https://github.com/user-attachments/assets/ac7a46ee-2364-4c50-b749-1b162ec8baee" />

- TotM targeting injects a virtual token into `game.user.targets` so downstream automation works without requiring tokens on the canvas

### The Stage

A shared top-centre overlay visible to **all connected players and the GM**:

<img width="1125" height="562" alt="Stage" src="https://github.com/user-attachments/assets/825f949e-a695-4da9-8777-a669bae24933" />

- Displays the spotlighted character's portrait and name
- Expands to include tag-team members from the Party actor when a tag team is active
- Updates live on combat and actor changes

### Companion Panel

If the player's character has a linked companion actor, a companion card appears in the hand area with an expandable panel showing stats, stress track, and roll buttons.

---

## Spotlight System

Spotlight management works in two modes, selected automatically:

| Mode | Condition | Mechanism |
|---|---|---|
| **Combat tracker** | Active combat encounter exists | Sets combatant spotlight via the Foundry combat UI |
| **Theatre of the Mind** | No combat encounter | Reads/writes the `requestingSpotlight` actor flag via `setFlag` / `unsetFlag` |

Players request the spotlight by clicking the orb on their portrait. The GM sees the request overlay immediately and can click the portrait in the GM Dashboard to grant it.

---

# Feature Backlog

- Any bugs or issues the community identifies!!
- Giving Adversaries the Stage
- Additional GM tools:
  - Improvised Adversary support, to quickly introduce a conflict
  - Environment and Adversary "Draws" for on-the-fly encounters
- Transformation support when that is released into the SRD



  

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


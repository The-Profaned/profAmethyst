# [Prof] Amethyst

A TitanClient JavaScript plugin (QuickJS runtime) that mines amethyst in the
Mining Guild, chisels it into bolt tips, arrowtips, javelin heads or dart tips,
and banks the gem bag/sack contents when it fills.

## Run / test

```powershell
.\gradlew.bat runViaTitan
```

This opens a dedicated **prof-amethyst** DEV tab with the plugin loaded from
`build/.titan/dev/prof-amethyst/load/gen-N/`. After editing
`js/profAmethyst.js`, run `.\gradlew.bat build` to stage the change, then click
the refresh button in the prof-amethyst tab to load it. Running `runViaTitan`
again recycles only the prof-amethyst tab.

Enable **[Prof] Amethyst** in the tab and pick the product and mining area in
its settings.

Other scripts:

```powershell
.\js\fetch-types.ps1   # optional: SDK typings for IntelliSense (js/types/, gitignored)
.\js\deploy.ps1        # permanent install to %USERPROFILE%\.titanclient\plugins (no hot reload)
```

## Before the first run

Fill in the **FILL-IN SECTION** at the top of `profAmethyst.js`. The mining
areas are required; the plugin stops with a chat message until
`PUBLIC_MINING_AREA` (and `PRIVATE_MINING_AREA`, if you have the Falador elite
diary) are set. Without the elite diary the player can't enter the private
area, so the plugin only uses it when the diary's varbit is set.

## Setup

- Pickaxe (worn or in the inventory), chisel, and a gem bag or gem sack in the
  inventory.
- Varrock armour 4 and Expert mining gloves are recommended. The plugin warns
  in chat when they aren't worn, or when a lower tier that doesn't affect
  amethyst is.
- 92 Mining (the guild's invisible +7 boost counts) and 83+ Crafting.

## Loop

| Step | What happens |
| --- | --- |
| Area | Uses the private amethyst area when the Falador elite diary is complete, otherwise the public one. The *Mining area* setting can force either. |
| Mine | Picks the crystal with the fewest other miners in its 3x3, then the nearest. Moves off a crystal that becomes crowded. |
| Hop | If every crystal is crowded for 3 checks in a row, hops to a random members world (respecting the hop cooldown and the world filters). |
| Craft | Full inventory: uses the chisel on the amethyst and selects the product. *Auto* makes the best product your Crafting level allows. |
| Bank | Gem bag/sack full: opens the closest bank (the guild's bank chest), uses *Empty* on the container (which stays in the inventory), deposits any loose gems, then walks back. Nothing but gems is ever banked; the crafted tips stack in the inventory. |

The gem container's contents aren't exposed by the client. When an uncut gem
(not amethyst) shows up in the inventory, the plugin clicks *Fill*. If the gem
goes into the container it carries on mining; if it stays in the inventory the
container is full, so it crafts the amethyst and banks.

## Unverified in-game

Built from the SDK typings and the wiki, not yet tested against the live
client:

- The gem bag/sack "Empty" option depositing straight into the open bank.
- The Make-X product order (`MAKE_X_OPTION_ORDER`), used only when the product
  button can't be matched by item id.
- Mining-animation matching for crowd detection (built from the gamevals
  animation names containing `MINING` and `PICKAXE`).

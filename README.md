# SF2e Quick Reload (for PF2e HUD)

## Install
In Foundry: **Add-on Modules → Install Module**, paste this manifest URL:

```
https://github.com/OWNER/sf2e-quick-reload/releases/latest/download/module.json
```

Requires the [PF2e HUD](https://foundryvtt.com/packages/pf2e-hud) module. Works in SF2e and PF2e worlds.

Adds a **Reload** button (↻) to PF2e HUD, at the end of the row of sidebar icons (Actions / Items / Spells / Skills / Extras), on both the token HUD and the persistent HUD. Works in SF2e and PF2e.

## What it does
- Finds the weapon your character is **holding** that takes loaded ammo. If more than one held weapon needs reloading, it asks which.
- Loads it from your inventory, using the same reload code as the character sheet's Reload menu:
  - **Magazine weapons** (most SF2e guns): if the weapon is empty, it loads the fullest magazine. If the loaded magazine is partly used, it swaps it for a fuller one and puts the used one back in your inventory.
  - **Loose rounds** (capacity weapons): fills the weapon, or loads as many rounds as you have.
- Prefers the kind of ammo that's already loaded, so special ammo stays in.
- Posts the system's normal "Reload" action card in chat.
- **Out of ammo / wrong ammo** → posts a chat message saying so, and points out compatible ammo that's stowed (in a backpack) and has to be retrieved first.
- Already full → a small notification and nothing else.

The badge on the button shows the loaded count of the first held weapon. The tooltip lists every held weapon's load. The icon is red when empty and faded when nothing in hand needs reloading.

## Settings
- **Allow stowed ammo** (world, off by default): also use ammo inside backpacks/containers. The chat card notes which container it came from.
- **Most charges wins** (world, off by default): pick the battery/magazine with the most charges, even if it's a different kind than the one loaded. Never picks one that's too high a grade.
- **Show Reload button in PF2e HUD** (per player)
- **Whisper 'no ammo' messages** (world): send failure messages only to the player and the GM.

## Macro
```js
game.modules.get("sf2e-quick-reload").api.reload();          // selected token / your character
game.modules.get("sf2e-quick-reload").api.reload(someActor);
```

Requires: PF2e HUD. Doesn't need PF2e HUD Colors, and doesn't conflict with it.

## Releasing a new version (maintainer notes)
1. Update `CHANGELOG.md` and commit.
2. On GitHub: **Releases → Draft a new release**, create a tag like `v0.7.0`, publish.
3. The **Release** workflow fills the version and links into `module.json`, builds `module.zip`, and attaches both to the release. Nothing else to edit by hand.

## License
MIT. See [LICENSE](LICENSE).

# SF2e Quick Reload

Adds a **Reload** button to the [PF2e HUD](https://foundryvtt.com/packages/pf2e-hud) module. One click reloads the weapon your character is holding, so you don't have to open the character sheet.

**Requires:** Foundry VTT v13–v14 and PF2e HUD. Created for use in SF2e, but should work in PF2e worlds.

## Install

In Foundry, go to **Add-on Modules → Install Module** and paste this manifest URL:

```
https://github.com/alocay/sf2e-quick-reload/releases/latest/download/module.json
```

## How to use

The button is at the end of the HUD's row of sidebar icons, on both the token HUD and the persistent HUD. Players only see it on characters they own.

- **Number on the button:** rounds or charges loaded in the held weapon.
- **Red:** the weapon is empty. **Faded:** nothing in hand needs reloading.
- **Hover:** shows the load of every held weapon.

Clicking it:

- Reloads the held weapon. If two held weapons need reloading, it asks which one.
- **Batteries and magazines:** loads the fullest one. A partly used one is swapped for a fuller one, and the old one goes back in the inventory.
- **Loose rounds:** fills the weapon, or loads as many as you have.
- Prefers the kind of ammo already loaded.
- Skips batteries and chem tanks above the weapon's grade (a tactical weapon takes commercial or tactical batteries).
- Ignores ammo stowed in a backpack or other container, unless **Allow stowed ammo** is on.
- Posts the system's normal Reload card in chat.
- If it can't reload, posts a message saying why: no ammo, only higher-grade batteries, or ammo that's stowed.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Show Reload button in PF2e HUD | On | Per player. Hides the button for that player. |
| Allow stowed ammo | Off | Also uses ammo inside containers. The chat card notes which container it came from. |
| Most charges wins | Off | Picks the battery or magazine with the most charges, even if it's a different kind than the one loaded. |
| Whisper 'no ammo' messages | Off | Only the player and the GM see "can't reload" messages. |

## Macro

```js
game.modules.get("sf2e-quick-reload").api.reload();
```

Reloads the selected token's held weapon, or your assigned character's.

## License

MIT

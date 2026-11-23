/**
 * SF2e Quick Reload (for PF2e HUD)
 * Adds a Reload button to PF2e HUD's token HUD and persistent HUD. It reloads the character's held
 * weapon using the same system calls as the character sheet's reload menu (weapon.attach), and posts
 * a chat message on success or when there's no usable ammo.
 *
 * Works with the SF2e and PF2e systems (same codebase).
 */

const ID = "sf2e-quick-reload";
const HUD_IDS = new Set(["pf2e-hud-token", "pf2e-hud-persistent"]);

const RELOAD_ICON =
  '<svg class="qr-icon" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M19.62 17.33 A9.3 9.3 0 1 0 5.90 19.02" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
  '<polygon points="8.66,21.01 3.79,20.90 6.89,16.48" fill="currentColor"/>' +
  '<g fill="currentColor">' +
  '<path d="M7.85 16.60V10.84C7.85 9.46 8.54 8.50 9.00 8.20C9.46 8.50 10.15 9.46 10.15 10.84V16.60Z"/>' +
  '<path d="M10.85 16.60V10.84C10.85 9.46 11.54 8.50 12.00 8.20C12.46 8.50 13.15 9.46 13.15 10.84V16.60Z"/>' +
  '<path d="M13.85 16.60V10.84C13.85 9.46 14.54 8.50 15.00 8.20C15.46 8.50 16.15 9.46 16.15 10.84V16.60Z"/>' +
  '</g></svg>';

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const loc = (key, data, fallback) => {
  if (!game.i18n.has(key)) return fallback;
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
};

/* -------------------------------------------- */
/*  Ammo helpers                                */
/* -------------------------------------------- */

const isMagazine = (item) => item?.isOfType?.("ammo") && !!item.isMagazine;
const magUses = (item) => item.system?.uses ?? { value: 0, max: 0 };

/** Weapons in hand that take loaded ammo (capacity), i.e. the ones the sheet's Reload menu works on. */
function heldReloadables(actor) {
  if (!actor?.isOfType?.("character")) return [];
  return actor.itemTypes.weapon.filter((w) => {
    const ammo = w.system.ammo;
    return w.isHeld && ammo && !ammo.builtIn && ammo.capacity > 0;
  });
}

/** Same as the system's getLoadedAmmo(), which modules can't import. */
function loadedAmmo(weapon) {
  if (!weapon.system.ammo?.capacity) return [];
  const loaded = weapon.subitems.filter((i) => i.isOfType("ammo") || (i.isOfType("weapon") && i.isAmmoFor(weapon)));
  return loaded.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

/** Loaded ammo that still counts (an empty magazine doesn't). */
function liveAmmo(weapon) {
  return loadedAmmo(weapon).filter((a) => !(isMagazine(a) && magUses(a).value === 0));
}

/** Current load, for the button badge and messages. */
function loadState(weapon) {
  const live = liveAmmo(weapon);
  const capacity = weapon.system.ammo?.capacity ?? 0;
  if (live.length && live.every(isMagazine)) {
    const u = magUses(live[0]);
    return { value: u.value, max: u.max, magazine: true, full: u.value >= u.max };
  }
  const value = live.reduce((n, a) => n + (a.quantity ?? 0), 0);
  return { value, max: capacity, magazine: false, full: value >= capacity };
}

/* Grades (SF2e). A weapon can use batteries/chem tanks up to its own grade (Player Core, Magazine). */
const GRADE_ORDER = ["commercial", "tactical", "advanced", "superior", "elite", "ultimate", "paragon"];
// Batteries and chem tanks don't store a grade in Foundry; each grade has a fixed max charge count / level.
const POWER_GRADES = {
  battery: { byMax: { 10: "commercial", 20: "tactical", 40: "advanced", 60: "superior", 100: "elite" } },
  "chem-tank": { byMax: { 8: "commercial", 16: "tactical", 40: "advanced", 48: "superior", 64: "elite" } }
};
const LEVEL_GRADES = [[12, "elite"], [10, "superior"], [4, "advanced"], [2, "tactical"], [0, "commercial"]];

const isGradedPower = (item) => item?.isOfType?.("ammo") && item.system.baseItem in POWER_GRADES;

function powerGrade(item) {
  if (!isGradedPower(item)) return null;
  const byMax = POWER_GRADES[item.system.baseItem].byMax[magUses(item).max];
  if (byMax) return byMax;
  const lvl = item.level ?? item.system.level?.value ?? 0;
  return LEVEL_GRADES.find(([min]) => lvl >= min)?.[1] ?? null;
}

/** Null when grades don't apply (PF2e, or ammo that isn't a battery/chem tank). */
function weaponGrade(weapon) {
  return game.system.id === "sf2e" ? (weapon.system.grade ?? "commercial") : null;
}

function gradeOk(ammo, weapon) {
  const wg = weaponGrade(weapon);
  const ag = powerGrade(ammo);
  if (!wg || !ag) return true;
  return GRADE_ORDER.indexOf(ag) <= GRADE_ORDER.indexOf(wg);
}

/** "battery", "chem tank" or "magazine", for messages. */
function ammoNoun(item, plural = false) {
  const base = item?.system?.baseItem;
  const n = base === "battery" ? "battery" : base === "chem-tank" ? "chem tank" : "magazine";
  if (!plural) return n;
  return n === "battery" ? "batteries" : `${n}s`;
}

/** "(tactical weapons take commercial or tactical batteries)" */
function gradeRuleText(weapon, sample) {
  const wg = weaponGrade(weapon);
  const allowed = GRADE_ORDER.slice(0, GRADE_ORDER.indexOf(wg) + 1);
  const list = allowed.length === 1 ? allowed[0]
    : allowed.length === 2 ? `${allowed[0]} or ${allowed[1]}`
    : `${allowed.slice(0, -1).join(", ")}, or ${allowed.at(-1)}`;
  return allowed.length === 1
    ? `${wg} weapons only take ${list} ${ammoNoun(sample, true)}`
    : `${wg} weapons take ${list} ${ammoNoun(sample, true)}`;
}

const listNames = (items) => {
  const names = [...new Set(items.map((i) => i.name))].map(esc);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

const sameAmmo = (a, b) =>
  !!a && !!b && (a.sourceId && a.sourceId === b.sourceId || (a.name === b.name && a.system.baseItem === b.system.baseItem));

/** Compatible ammo in the inventory (not stowed), best first. Mirrors the sheet's Reload menu. */
function ammoCandidates(weapon) {
  const actor = weapon.actor;
  const all = [
    ...actor.itemTypes.ammo,
    ...actor.itemTypes.weapon.filter((w) => w.id !== weapon.id && w.system.usage?.canBeAmmo)
  ].filter((a) => a.isAmmoFor(weapon));

  const usable = (a) => (a.quantity ?? 0) > 0 && !(isMagazine(a) && magUses(a).value === 0);
  const current = loadedAmmo(weapon)[0] ?? null;

  const allowStowed = game.settings.get(ID, "allowStowed");
  const mostCharges = game.settings.get(ID, "mostCharges");
  const reachable = (a) => allowStowed || !a.isStowed;

  const ready = all.filter((a) => reachable(a) && usable(a) && gradeOk(a, weapon));
  const charges = (a) => (isMagazine(a) ? magUses(a).value : 0);
  const sameFirst = (a, b) => Number(sameAmmo(b, current)) - Number(sameAmmo(a, current));
  ready.sort((a, b) =>
    (mostCharges && isMagazine(a) && isMagazine(b))
      // "Most charges wins": fullest battery/magazine first, whatever its type
      ? charges(b) - charges(a) || sameFirst(a, b) || (b.quantity ?? 0) - (a.quantity ?? 0)
      // Default: 1) keep the same kind of ammo that's loaded now, 2) fullest magazine, 3) biggest stack
      : sameFirst(a, b) || charges(b) - charges(a) || (b.quantity ?? 0) - (a.quantity ?? 0)
  );
  // Only matters when stowed ammo isn't allowed: used to tell the player it has to be retrieved
  const stowed = allowStowed ? [] : all.filter((a) => a.isStowed && usable(a) && gradeOk(a, weapon));
  const tooHigh = all.filter((a) => reachable(a) && usable(a) && !gradeOk(a, weapon));
  return { ready, stowed, tooHigh };
}

function reloadGlyph(weapon) {
  const n = weapon.system.traits.value.includes("repeating") ? 3 : Number(weapon.reload);
  return Number.isInteger(n) && n > 0 && n <= 3 ? String(n) : null;
}

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

function speakerFor(actor) {
  const token = actor.getActiveTokens(false, true).shift();
  return ChatMessage.getSpeaker({ actor, token });
}

async function postReloaded(weapon, ammo, detail) {
  const actor = weapon.actor;
  const sys = game.system.id;
  const glyph = reloadGlyph(weapon);
  const description = loc("PF2E.Actions.Interact.Reload.Description",
    { actor: actor.name, weapon: weapon.name, ammo: ammo.name },
    `${actor.name} loads ${weapon.name} with ${ammo.name}.`);
  let flavor, content;
  try {
    // Same chat card the system posts from the character sheet's Reload menu
    const render = foundry.applications.handlebars.renderTemplate;
    flavor = await render(`systems/${sys}/templates/chat/action/flavor.hbs`, {
      action: {
        title: "PF2E.Actions.Interact.Title",
        subtitle: "PF2E.Actions.Interact.Reload.Title",
        glyph // the template wraps this in its own action-glyph span
      },
      traits: [{ name: "manipulate", label: loc("PF2E.TraitManipulate", null, "Manipulate"), description: "" }]
    });
    content = await render(`systems/${sys}/templates/chat/action/content.hbs`, {
      imgPath: weapon.img,
      message: description + (detail ? `<br><em>${esc(detail)}</em>` : "")
    });
  } catch (err) {
    console.warn(`${ID} | Falling back to a plain chat card`, err);
    flavor = `<strong>Reload</strong>${glyph ? ` <span class="action-glyph">${glyph}</span>` : ""}`;
    content = `<div class="qr-card"><img src="${esc(weapon.img)}"><p>${esc(description)}${detail ? `<br><em>${esc(detail)}</em>` : ""}</p></div>`;
  }
  await ChatMessage.create({ speaker: speakerFor(actor), flavor, content, style: CONST.CHAT_MESSAGE_STYLES.EMOTE });
}

async function postProblem(actor, weapon, text) {
  const whisper = game.settings.get(ID, "problemWhisper")
    ? ChatMessage.getWhisperRecipients("GM").map((u) => u.id).concat(game.user.id)
    : [];
  await ChatMessage.create({
    speaker: speakerFor(actor),
    flavor: `<strong>${esc(loc("PF2E.Actions.Interact.Reload.Title", null, "Reload"))}</strong>`,
    content: `<div class="qr-card qr-fail"><img src="${esc(weapon?.img ?? actor.img)}"><p>${text}</p></div>`,
    whisper
  });
}

/* -------------------------------------------- */
/*  Reload                                      */
/* -------------------------------------------- */

/** " Taken from Backpack." when the ammo came out of a container (only possible with "Allow stowed ammo"). */
function fromContainer(item) {
  if (!item.isStowed) return "";
  const bag = item.container?.name ?? item.actor?.items.get(item.system.containerId)?.name;
  return ` Taken from ${bag ?? "a container"}.`;
}

async function reloadWeapon(weapon) {
  const actor = weapon.actor;
  const capacity = weapon.system.ammo?.capacity ?? 0;
  const live = liveAmmo(weapon);
  const { ready, stowed, tooHigh } = ammoCandidates(weapon);
  const name = `<strong>${esc(actor.name)}</strong>`;
  const wname = `<strong>${esc(weapon.name)}</strong>`;

  const stowedNote = (items) => items.length
    ? ` ${listNames(items)} ${items.length > 1 ? "are" : "is"} stowed and ${items.length > 1 ? "have" : "has"} to be retrieved first.`
    : "";
  const tooHighNote = (items, lead) => {
    const one = new Set(items.map((i) => i.name)).size === 1;
    const noun = ammoNoun(items[0], !one);
    return `${lead} ${noun} available ${one ? "is" : "are"} ${listNames(items)}, which ${one ? "is" : "are"} too high a grade (${gradeRuleText(weapon, items[0])}).`;
  };

  // Nothing usable to load into an empty (or loose-round) weapon.
  const noAmmo = () => {
    if (tooHigh.length) {
      return postProblem(actor, weapon,
        `${name} can't reload ${wname}: the only${tooHighNote(tooHigh, "")}${stowedNote(stowed)}`);
    }
    return postProblem(actor, weapon,
      `${name} tries to reload ${wname}, but has no compatible ammunition.${stowedNote(stowed)}`);
  };

  // A magazine/battery is in: swap it for a fuller one, or stop if it's already full.
  if (live.length && live.every(isMagazine)) {
    const mag = live[0];
    const noun = ammoNoun(mag);
    const u = magUses(mag);
    if (u.value >= u.max) return ui.notifications.info(`${weapon.name} is already fully loaded (${u.value}/${u.max}).`);
    const fuller = (a) => isMagazine(a) && magUses(a).value > u.value;
    const better = ready.find(fuller);
    if (!better) {
      const highBetter = tooHigh.filter(fuller);
      const stowedBetter = stowed.filter(fuller);
      let why = highBetter.length ? tooHighNote(highBetter, " The only fuller") : "";
      why += stowedNote(stowedBetter);
      if (!why) why = ` There's no fuller ${noun} available.`;
      return postProblem(actor, weapon, `${name} can't swap the ${noun} in ${wname} (${u.value}/${u.max} left).${why}`);
    }
    await mag.detach({ skipConfirm: true }); // back into the inventory, partly used
    const fromBag = fromContainer(better);
    const b = { ...magUses(better) }; // read before attach: the system resets a remaining stack to full
    await weapon.attach(better, { quantity: 1, stack: true });
    return postReloaded(weapon, better, `Swapped a ${u.value}/${u.max} ${noun} for a ${b.value}/${b.max} one.${fromBag}`);
  }

  const numLoaded = live.reduce((n, a) => n + (a.quantity ?? 0), 0);
  const space = Math.max(0, capacity - numLoaded);
  if (space <= 0) return ui.notifications.info(`${weapon.name} is already fully loaded (${numLoaded}/${capacity}).`);

  const ammo = ready[0];
  if (!ammo) return noAmmo();

  // Magazines/batteries load one at a time (capacity 1); loose rounds fill as much space as the stack allows.
  const quantity = isMagazine(ammo) ? 1 : Math.min(space, ammo.quantity);
  const fromBag = fromContainer(ammo);
  const u0 = isMagazine(ammo) ? { ...magUses(ammo) } : null;
  await weapon.attach(ammo, { quantity, stack: true });

  if (u0) {
    const detail = (u0.max > 1 ? `${u0.value}/${u0.max}` : "") + fromBag;
    return postReloaded(weapon, ammo, detail.trim() || null);
  }
  const total = numLoaded + quantity;
  if (total < capacity) {
    const more = stowed.filter((a) => !isMagazine(a));
    const tail = more.length ? ` More is stowed (${more.map((a) => `${a.name} ×${a.quantity}`).join(", ")}) and has to be retrieved first.` : "";
    return postReloaded(weapon, ammo, `Only had enough for ${total}/${capacity}: out of ${ammo.name}.${fromBag}${tail}`);
  }
  return postReloaded(weapon, ammo, `${total}/${capacity}${fromBag}`);
}

async function pickWeapon(weapons) {
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Reload which weapon?" },
    content: "<p>More than one held weapon can be reloaded.</p>",
    buttons: weapons.map((w, i) => {
      const s = loadState(w);
      return { action: String(i), label: `${w.name} (${s.value}/${s.max})`, default: i === 0 };
    }),
    rejectClose: false
  });
  return choice === null || choice === undefined ? null : weapons[Number(choice)] ?? null;
}

/** Reload the actor's held weapon. Exposed as the module API for macros too. */
async function reload(actor) {
  actor ??= canvas.tokens.controlled[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Select a token first.");
  if (!actor.isOwner) return ui.notifications.warn(`You don't own ${actor.name}.`);
  if (!actor.isOfType("character")) return ui.notifications.warn("Quick Reload only works for player characters.");

  const held = heldReloadables(actor);
  if (!held.length) {
    return postProblem(actor, null, `<strong>${esc(actor.name)}</strong> isn't holding a weapon that needs reloading.`);
  }
  // Prefer weapons that aren't full; ask only if more than one needs it.
  const needing = held.filter((w) => !loadState(w).full);
  if (!needing.length) {
    return ui.notifications.info(held.map((w) => `${w.name} is already fully loaded.`).join(" "));
  }
  const weapon = needing.length === 1 ? needing[0] : await pickWeapon(needing);
  if (!weapon) return;

  try {
    await reloadWeapon(weapon);
  } catch (err) {
    console.error(`${ID} |`, err);
    ui.notifications.error(`Couldn't reload ${weapon.name}: ${err.message}`);
  }
}

/* -------------------------------------------- */
/*  HUD button                                  */
/* -------------------------------------------- */

function buttonFor(actor) {
  const held = heldReloadables(actor);
  const a = document.createElement("a");
  a.className = "qr-reload";
  a.dataset.tooltipDirection = "UP";

  if (!held.length) {
    a.classList.add("qr-none");
    a.dataset.tooltip = "Reload: no held weapon needs reloading";
    a.innerHTML = RELOAD_ICON;
    return a;
  }
  const lines = held.map((w) => {
    const s = loadState(w);
    return `${esc(w.name)}: ${s.value}/${s.max}${s.magazine ? " (magazine)" : ""}`;
  });
  const first = loadState(held[0]);
  if (first.value === 0) a.classList.add("qr-empty");
  a.dataset.tooltip = `<strong>Reload</strong><br>${lines.join("<br>")}`;
  a.innerHTML = `${RELOAD_ICON}<span class="qr-badge">${first.value}</span>`;
  a.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    a.classList.add("qr-busy");
    try { await reload(actor); } finally { a.classList.remove("qr-busy"); }
  });
  return a;
}

function injectButton(app, element) {
  if (!game.settings.get(ID, "enabled")) return;
  const actor = app.actor;
  if (!actor?.isOfType?.("character") || !actor.isOwner) return;

  element.querySelectorAll(".qr-reload").forEach((el) => el.remove());

  // Normal layout: the row of sidebar icons. "Exploded" token HUD: sidebar icons live in the info panel.
  const host =
    element.querySelector('[data-panel="sidebars"]') ??
    element.querySelector('[data-panel="info"]');
  if (!host) return;
  host.append(buttonFor(actor));
}

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(ID, "enabled", {
    name: "Show Reload button in PF2e HUD",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "allowStowed", {
    name: "Allow stowed ammo",
    hint: "Off (rules as written): ammo inside a backpack or other container is ignored until it's retrieved. On: the Reload button also uses ammo from containers.",
    scope: "world", config: true, type: Boolean, default: false
  });
  game.settings.register(ID, "mostCharges", {
    name: "Most charges wins",
    hint: "Off: prefer the same kind of battery/magazine that's already loaded. On: always pick the one with the most charges or rounds left (never one that's too high a grade).",
    scope: "world", config: true, type: Boolean, default: false
  });
  game.settings.register(ID, "problemWhisper", {
    name: "Whisper 'no ammo' messages",
    hint: "On: only the player and the GM see 'out of ammo' messages. Off: everyone sees them.",
    scope: "world", config: true, type: Boolean, default: false
  });
});

Hooks.once("ready", () => {
  game.modules.get(ID).api = { reload, reloadWeapon, heldReloadables, loadState };
});

// PF2e HUD's windows are ApplicationV2 apps that re-render whenever the actor or its items change.
Hooks.on("renderApplicationV2", (app, element) => {
  if (!HUD_IDS.has(app.id)) return;
  try {
    injectButton(app, element instanceof HTMLElement ? element : element?.[0]);
  } catch (err) {
    console.error(`${ID} | couldn't add the Reload button`, err);
  }
});

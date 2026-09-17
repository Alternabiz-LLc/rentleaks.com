"use client";

import { useState } from "react";
import { ACCESS_LABEL, cleanAccess, FOUNDER_ONLY, PRESETS, presetOf, type AccessKey, type PresetKey } from "@/lib/access";
import { DESK_GROUPS } from "@/lib/admin/nav";
import { Icon } from "./Icon";

/**
 * Pick a preset, then fine-tune page by page. The ticked boxes are what gets
 * saved (name="access"); the preset is only a shortcut.
 */
export function AccessPicker({ initial = PRESETS.sales.access }: { initial?: readonly string[] }) {
  const [picked, setPicked] = useState<AccessKey[]>(cleanAccess(initial));
  const preset = presetOf(picked);
  const toggle = (k: AccessKey) => setPicked((cur) => cleanAccess(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <div className="dk-access">
      <div className="dk-access__presets" role="radiogroup" aria-label="Role preset">
        {(Object.entries(PRESETS) as Array<[PresetKey, (typeof PRESETS)[PresetKey]]>).map(([key, p]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={preset === key}
            className={`dk-access__preset${preset === key ? " is-on" : ""}`}
            onClick={() => setPicked(cleanAccess(p.access))}
          >
            <b>{p.label}</b>
            <small>{p.brief}</small>
          </button>
        ))}
      </div>
      <p className="dk-hint">{preset ? `Preset: ${PRESETS[preset].label}.` : "Custom access."} Adjust any page below.</p>
      <div className="dk-access__groups">
        {DESK_GROUPS.map((g) => (
          <fieldset key={g.title} className="dk-access__group">
            <legend>{g.title}</legend>
            {g.modules
              .filter((m, i, all) => all.findIndex((x) => x.key === m.key) === i)
              .map((m) => {
              const locked = FOUNDER_ONLY.includes(m.key);
              const always = m.key === "overview";
              const on = !locked && (always || picked.includes(m.key));
              return (
                <label key={m.key} className={`dk-access__item${locked ? " is-locked" : ""}`}>
                  <input type="checkbox" checked={on} disabled={locked || always} onChange={() => toggle(m.key)} />
                  <span className="dk-link__icon">
                    <Icon name={locked ? "lock" : m.icon} size={14} />
                  </span>
                  <span>
                    <b>{ACCESS_LABEL[m.key]}</b>
                    <small>{locked ? "Owner only" : always ? "Always on — shows only their areas" : m.brief}</small>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      {picked.map((k) => (
        <input key={k} type="hidden" name="access" value={k} />
      ))}
    </div>
  );
}

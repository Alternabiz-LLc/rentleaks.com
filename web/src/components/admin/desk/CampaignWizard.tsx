"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";

type Opt = { value: string; label: string };
type Template = { id: string; name: string; purpose: string; subject: string; body: string };
export type AudiencePreset = { key: string; kicker: string; title: string; kind: string; kinds: string[]; stages: string[]; tags: string; consentOnly: boolean; reach: number };

type Preview = {
  count: number;
  describe: string;
  suppressed: number;
  hasAddress: boolean;
  samples: Array<{ id: string; label: string }>;
  sample: { id: string; name: string; email: string } | null;
  preview: { subject: string; html: string };
};

const KIND_OPTS: Opt[] = [
  { value: "newsletter", label: "Newsletter — opted-in subscribers" },
  { value: "bulk", label: "Announcement / bulk message" },
  { value: "outreach", label: "Outreach wave — prospects" },
];

/**
 * 1 Audience → 2 Compose → 3 Preview & create. The count and the preview are
 * live from the server as you change things; the last step creates a draft
 * (nothing is sent here) and opens it, where the send is confirmed.
 */
export function CampaignWizard({
  action,
  templates,
  cities,
  kinds,
  stages,
  presets,
  providerReady,
  initialTemplateId = "",
}: {
  action: (fd: FormData) => void | Promise<void>;
  templates: Template[];
  cities: Opt[];
  kinds: Opt[];
  stages: Opt[];
  presets: AudiencePreset[];
  providerReady: boolean;
  initialTemplateId?: string;
}) {
  const seed = templates.find((x) => x.id === initialTemplateId);
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState(seed?.purpose === "outreach" ? "outreach" : seed?.purpose === "bulk" ? "bulk" : "newsletter");
  const [pickKinds, setPickKinds] = useState<string[]>([]);
  const [pickStages, setPickStages] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [cityId, setCityId] = useState("");
  const [consentOnly, setConsentOnly] = useState(true);
  const [preset, setPreset] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(seed?.id ?? "");
  const [name, setName] = useState(() => (seed ? `${seed.name} · ${new Date().toISOString().slice(0, 10)}` : ""));
  const [subject, setSubject] = useState(seed?.subject ?? "");
  const [body, setBody] = useState(seed?.body ?? "Hi {{first_name}},\n\n");
  const [sampleId, setSampleId] = useState("");
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  const audience = useMemo(
    () => ({ kinds: pickKinds, stages: pickStages, tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean), cityId, consentOnly: kind === "newsletter" ? true : consentOnly }),
    [pickKinds, pickStages, tags, cityId, consentOnly, kind],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/audience", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, audience, subject, body, sampleId }),
          signal: ctrl.signal,
        });
        if (res.ok) setData((await res.json()) as Preview);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [kind, audience, subject, body, sampleId]);

  const applyPreset = (p: AudiencePreset) => {
    setPreset(p.key);
    setKind(p.kind);
    setPickKinds(p.kinds);
    setPickStages(p.stages);
    setTags(p.tags);
    setConsentOnly(p.consentOnly);
    setCityId("");
  };

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const count = data?.count ?? 0;
  const steps = ["Audience", "Compose", "Preview & create"];

  return (
    <div className="dk-wizard">
      <div className="dk-intel">
        <div className="dk-intel__copy">
          <p className="dk-kicker">Audience intelligence</p>
          <b>Turn the book into a focused send.</b>
          <p>Pick a cohort to start from, then refine who gets it and what it says. Unsubscribed and suppressed addresses are always left out.</p>
          <div className="dk-chiprow">
            <span className="dk-chip dk-chip--ink-soft">{data ? `${data.suppressed} suppressed` : "suppression enforced"}</span>
            <span className="dk-chip dk-chip--ink-soft">unsubscribe link in every email</span>
            <span className="dk-chip dk-chip--ink-soft">{providerReady ? "email provider ready" : "no email provider yet"}</span>
          </div>
        </div>
        <div className="dk-intel__tiles">
          {presets.map((p) => (
            <button key={p.key} type="button" className={`dk-cohort dk-cohort--ink${preset === p.key ? " is-on" : ""}`} onClick={() => applyPreset(p)}>
              <span className="dk-kicker">{p.kicker}</span>
              <b>{p.title}</b>
              <small>{p.reach.toLocaleString("en-US")} reachable</small>
            </button>
          ))}
        </div>
      </div>

      <div className="dk-steps">
        <ol>
          {steps.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "on" : "todo";
            return (
              <li key={label} className={`is-${state}`}>
                <button type="button" onClick={() => setStep(n)}>
                  <span className="dk-steps__n">{state === "done" ? "✓" : n}</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
        <span className="dk-steps__bar" style={{ width: `${((step - 0.5) / steps.length) * 100}%` }} aria-hidden="true" />
      </div>

      <form action={action} className="dk-wizard__grid">
        {/* Everything the server action needs, whatever step is showing. */}
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="templateId" value={templateId} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="body" value={body} />
        <input type="hidden" name="tags" value={tags} />
        <input type="hidden" name="cityId" value={cityId} />
        {audience.consentOnly ? <input type="hidden" name="consentOnly" value="on" /> : null}
        {pickKinds.map((k) => (
          <input key={k} type="hidden" name="kinds" value={k} />
        ))}
        {pickStages.map((s) => (
          <input key={s} type="hidden" name="stages" value={s} />
        ))}

        <div className="dk-panel">
          {step === 1 ? (
            <>
              <div className="dk-panel__head">
                <div>
                  <h2>Target segment</h2>
                  <p className="dk-panel__sub">Contacts with a valid email in the CRM.</p>
                </div>
              </div>
              <div className="dk-form">
                <label className="dk-field dk-field--wide">
                  <span>Kind of send</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    {KIND_OPTS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="dk-fieldset">
                  <legend>Who (none ticked = everyone)</legend>
                  <div className="dk-chiprow">
                    {kinds.map((k) => (
                      <button key={k.value} type="button" className={`dk-chip dk-chip--pick${pickKinds.includes(k.value) ? " is-on" : ""}`} onClick={() => setPickKinds(toggle(pickKinds, k.value))} aria-pressed={pickKinds.includes(k.value)}>
                        {k.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="dk-fieldset">
                  <legend>Stage (none ticked = any)</legend>
                  <div className="dk-chiprow">
                    {stages.map((s) => (
                      <button key={s.value} type="button" className={`dk-chip dk-chip--pick${pickStages.includes(s.value) ? " is-on" : ""}`} onClick={() => setPickStages(toggle(pickStages, s.value))} aria-pressed={pickStages.includes(s.value)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="dk-form__row">
                  <label className="dk-field">
                    <span>Any of these tags</span>
                    <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="brooklyn, fb_ad" />
                  </label>
                  <label className="dk-field">
                    <span>City</span>
                    <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
                      <option value="">Any city</option>
                      {cities.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="dk-check">
                  <input type="checkbox" checked={kind === "newsletter" ? true : consentOnly} disabled={kind === "newsletter"} onChange={(e) => setConsentOnly(e.target.checked)} />
                  Only people who opted in to marketing{kind === "newsletter" ? " (always, for newsletters)" : ""}
                </label>
                {kind !== "newsletter" && !consentOnly ? (
                  <p className="dk-hint">Only untick this for business outreach to hosts, operators and partners. Every email still carries an unsubscribe link and your address.</p>
                ) : null}
              </div>
              <p className="dk-reach">
                <b className="dk-num">{loading && !data ? "…" : count.toLocaleString("en-US")}</b> recipients in this segment
                {data ? <small>{data.describe}</small> : null}
              </p>
              <button type="button" className="dk-btn dk-btn--primary" onClick={() => setStep(2)} disabled={!count}>
                Continue to compose →
              </button>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="dk-panel__head">
                <div>
                  <h2>Compose</h2>
                  <p className="dk-panel__sub">Start from a template or write it here. Blank line = paragraph · “- ” bullets · “# ” heading · **bold** · [link](https://…)</p>
                </div>
              </div>
              <div className="dk-form">
                <label className="dk-field dk-field--wide">
                  <span>Start from template</span>
                  <select
                    value={templateId}
                    onChange={(e) => {
                      const t = templates.find((x) => x.id === e.target.value);
                      setTemplateId(e.target.value);
                      if (t) {
                        setSubject(t.subject);
                        setBody(t.body);
                        if (!name) setName(`${t.name} · ${new Date().toISOString().slice(0, 10)}`);
                      }
                    }}
                  >
                    <option value="">— blank —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.purpose})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dk-field dk-field--wide">
                  <span>Internal name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="October newsletter" />
                </label>
                <label className="dk-field dk-field--wide">
                  <span>Subject</span>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="{{first_name}}, new rooms in {{city}} this week" maxLength={200} />
                </label>
                <label className="dk-field dk-field--wide">
                  <span>Message</span>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} />
                </label>
                <div className="dk-chiprow">
                  {["{{first_name}}", "{{name}}", "{{city}}", "{{app_url}}"].map((f) => (
                    <button key={f} type="button" className="dk-chip dk-chip--soft" onClick={() => setBody((b) => `${b}${f}`)}>
                      + {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dk-compose__actions">
                <button type="button" className="dk-btn" onClick={() => setStep(1)}>
                  ← Audience
                </button>
                <button type="button" className="dk-btn dk-btn--primary" onClick={() => setStep(3)} disabled={!subject.trim() || body.trim().length < 12}>
                  Preview →
                </button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="dk-panel__head">
                <div>
                  <h2>Ready to create</h2>
                  <p className="dk-panel__sub">This saves a draft. You confirm the send (now or scheduled) on the next screen.</p>
                </div>
              </div>
              <ul className="dk-checklist">
                <li className={count ? "is-ok" : "is-bad"}>
                  <Icon name={count ? "check" : "flag"} size={15} /> {count.toLocaleString("en-US")} recipients · {data?.describe}
                </li>
                <li className={subject.trim() ? "is-ok" : "is-bad"}>
                  <Icon name={subject.trim() ? "check" : "flag"} size={15} /> Subject: {subject || "missing"}
                </li>
                <li className={data?.hasAddress ? "is-ok" : "is-bad"}>
                  <Icon name={data?.hasAddress ? "check" : "flag"} size={15} /> {data?.hasAddress ? "Mailing address in the footer" : "Mailing address missing — add it in System before sending"}
                </li>
                <li className={providerReady ? "is-ok" : "is-bad"}>
                  <Icon name={providerReady ? "check" : "flag"} size={15} /> {providerReady ? "Email provider connected" : "No email provider yet — the draft saves, sending waits"}
                </li>
              </ul>
              <div className="dk-compose__actions">
                <button type="button" className="dk-btn" onClick={() => setStep(2)}>
                  ← Compose
                </button>
                <button type="submit" className="dk-btn dk-btn--primary" disabled={!count || !subject.trim()}>
                  Create draft &amp; review send →
                </button>
              </div>
            </>
          ) : null}
        </div>

        <aside className="dk-panel dk-preview">
          <div className="dk-panel__head">
            <div>
              <h2>Template preview</h2>
              <p className="dk-panel__sub">Merge fields filled for one recipient.</p>
            </div>
          </div>
          {data?.samples.length ? (
            <label className="dk-field dk-field--wide">
              <span>Preview as</span>
              <select value={data.sample?.id ?? ""} onChange={(e) => setSampleId(e.target.value)}>
                {data.samples.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="dk-mail">
            <p>
              <span>To</span> {data?.sample?.email ?? "—"}
            </p>
            <p>
              <span>Subject</span> {data?.preview.subject || "(no subject)"}
            </p>
            {data ? <iframe title="Email preview" sandbox="" srcDoc={data.preview.html} /> : <div className="dk-skel" style={{ height: 320 }} />}
          </div>
          <p className="dk-hint">Each of the {count.toLocaleString("en-US")} recipients gets their own merged copy at send time.</p>
        </aside>
      </form>
    </div>
  );
}

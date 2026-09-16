import { KIND_LABEL, STAGE_LABEL } from "@/lib/crm";
import { CONTACT_KINDS, CONTACT_STAGES, type Audience } from "@/lib/marketing";

/** Audience checkboxes for a campaign draft (plain form fields, server-rendered). */
export function AudienceFields({
  audience,
  cities,
  kind,
}: {
  audience?: Audience;
  cities: Array<{ id: string; name: string }>;
  kind?: string;
}) {
  const a = audience ?? { consentOnly: true };
  return (
    <fieldset className="dk-fieldset">
      <legend>Audience</legend>
      <div className="dk-chiprow">
        <span className="dk-hint">Kinds (none = all):</span>
        {CONTACT_KINDS.map((k) => (
          <label key={k} className="dk-check">
            <input type="checkbox" name="kinds" value={k} defaultChecked={a.kinds?.includes(k)} /> {KIND_LABEL[k]}
          </label>
        ))}
      </div>
      <div className="dk-chiprow">
        <span className="dk-hint">Stages (none = all):</span>
        {CONTACT_STAGES.map((s) => (
          <label key={s} className="dk-check">
            <input type="checkbox" name="stages" value={s} defaultChecked={a.stages?.includes(s)} /> {STAGE_LABEL[s]}
          </label>
        ))}
      </div>
      <div className="dk-form__row">
        <label className="dk-field">
          <span>Any of these tags</span>
          <input name="tags" defaultValue={a.tags?.join(", ")} placeholder="newsletter, brooklyn" />
        </label>
        <label className="dk-field">
          <span>City</span>
          <select name="cityId" defaultValue={a.cityId ?? ""}>
            <option value="">Any city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="dk-check">
        <input type="checkbox" name="consentOnly" defaultChecked={a.consentOnly !== false} disabled={kind === "newsletter"} />
        Only people who opted in to marketing {kind === "newsletter" ? "(always on for newsletters)" : ""}
      </label>
      <small className="dk-hint">
        Unsubscribed and suppressed addresses are always excluded. Untick the opt-in box only for business outreach (hosts, operators,
        partners) — every email still carries an unsubscribe link and your mailing address.
      </small>
    </fieldset>
  );
}

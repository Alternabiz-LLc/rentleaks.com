/**
 * Scam guard for messages.
 *
 * RentLeaks never touches money, so the one moment it can still protect a
 * renter is the conversation before they pay. These are the patterns that
 * recur in rental fraud reports (FTC, Action Fraud, Verbraucherzentrale):
 * pressure to pay before seeing the place, untraceable payment rails, the
 * "I'm abroad, I'll post you the keys" story, and moving the chat somewhere
 * the platform cannot see.
 *
 * Signals WARN the recipient. They never silently drop or rewrite a message:
 * a legitimate host can say "Zelle is fine once you've seen it", and hiding
 * that would be the platform deciding what people may say.
 */

export type ScamSignal = {
  key: string;
  label: string;
  advice: string;
};

const RULES: Array<{ key: string; re: RegExp; label: string; advice: string }> = [
  {
    key: "untraceable-payment",
    re: /\b(wire (transfer|me|it|the|us|you|them)|by wire|western union|moneygram|gift ?cards?|itunes card|steam card|crypto|bitcoin|usdt|btc|zelle|cash ?app|venmo|paypal friends)\b/i,
    label: "Mentions a payment method that cannot be reversed",
    advice: "Never send money this way before you have seen the home and signed a lease with a verified person.",
  },
  {
    key: "pay-before-viewing",
    re: /\b(pay|send|transfer|deposit)\b[^.?!]{0,60}\b(before|prior to|to hold|to reserve|to secure)\b[^.?!]{0,40}\b(view|viewing|visit|see|showing|tour|keys?)\b/i,
    label: "Asks for money before a viewing",
    advice: "A real landlord lets you see the place — in person or on a live video call — before any money moves.",
  },
  {
    key: "abroad-keys",
    /* The excuse and the keys are often two sentences apart, so this one
       is allowed to cross sentence boundaries. */
    re: /\b(out of (the )?(country|town)|abroad|overseas|missionary|deployed|on assignment)\b[\s\S]{0,220}\b(keys?|mail|post|courier|ship)\b/i,
    label: "The “I’m away, I’ll send the keys” story",
    advice: "This is the single most common rental scam script. Do not pay anyone you cannot meet or video-call at the property.",
  },
  {
    key: "off-platform",
    re: /\b(whats ?app|telegram|signal app|wechat|text me at|email me at|contact me (on|at|via))\b/i,
    label: "Moves the conversation off RentLeaks",
    advice: "Keep the conversation here until you have viewed the home. Off-platform, we cannot see or act on reports.",
  },
  {
    key: "pay-rentleaks",
    re: /\b(pay|send|transfer)\b[^.?!]{0,40}\b(rentleaks|rent leaks|the platform|the site)\b/i,
    label: "Asks you to pay RentLeaks",
    advice: "RentLeaks never takes deposits, rent or fees from renters. Anyone asking you to pay us is running a scam.",
  },
  {
    key: "id-docs",
    re: /\b(send|upload|photo of)\b[^.?!]{0,40}\b(passport|ssn|social security|driver'?s licen[cs]e|bank (statement|login|details))\b/i,
    label: "Asks for identity or bank documents in chat",
    advice: "Share documents only after a viewing, and never your bank login or full SSN.",
  },
  {
    key: "urgency",
    re: /\b(many (other )?(people|applicants) (are )?interested|first come,? first served|today only|within (the next )?\d+ ?(hours?|hrs?))\b/i,
    label: "Pressure to decide fast",
    advice: "Urgency is how scams stop people checking. A few hours to verify rarely costs a genuine home.",
  },
];

export function scanMessage(body: string): ScamSignal[] {
  const text = String(body || "");
  return RULES.filter((r) => r.re.test(text)).map(({ key, label, advice }) => ({ key, label, advice }));
}

export function signalsFromFlags(json: string): ScamSignal[] {
  try {
    const keys = JSON.parse(json) as unknown;
    if (!Array.isArray(keys)) return [];
    return RULES.filter((r) => keys.includes(r.key)).map(({ key, label, advice }) => ({ key, label, advice }));
  } catch {
    return [];
  }
}

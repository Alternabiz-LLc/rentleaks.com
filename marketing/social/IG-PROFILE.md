# Instagram — the profile

Everything to paste into **instagram.com/rentleaks**, measured against
Instagram's own limits. Art is in `marketing/social/instagram/`.

## Fields

| Field | Paste this | Length |
|---|---|---|
| Username | `rentleaks` | 9 / 30 |
| Name | `RentLeaks · flexible housing` | 28 / 30 |
| Category | `Real Estate` | — |
| Bio | see below | 131 / 150 |
| Link | `https://rentleaks.com/instagram.html` | — |
| Contact email | `hello@rentleaks.com` | — |

**Bio**, exactly as it should read (the line break is deliberate — Instagram keeps it):

```
Rooms, co-living, furnished & 1-month+ homes. All-in prices, 30 days min, 79 markets. Honest fees, real rules.
Free renter guides ↓
```

The link goes to `rentleaks.com/instagram.html` rather than the home page on
purpose: that page carries the lead form, the three guides and the hire-a-broker
routes, and it files every visitor as coming from Instagram, so the desk shows
what the account is actually producing.

## Profile picture

`marketing/social/instagram/profile-1080.png` — the RL mark on night, at 1080px.
Instagram displays it small but stores what you upload, so give it the large one.

## Highlight covers

Five, all in `marketing/social/instagram/`. Create the highlight, add one story,
then set the cover:

| Highlight | Cover file | What goes in it |
|---|---|---|
| Guides | `highlight-guides-1080.png` | The three free PDFs and what's in each |
| How it works | `highlight-howitworks-1080.png` | The three steps, the fee cap, what's free |
| For agents | `highlight-agents-1080.png` | The referral program: $0, 24h, 25% after a lease |
| Fees | `highlight-fees-1080.png` | FARE Act, the conversion table, what a fair agreement says |
| Cities | `highlight-cities-1080.png` | One frame per market rule: NYC, Paris, Amsterdam, Berlin, London |

## Switch it to a professional account

Two reasons, and the second is the one that matters here:

1. It unlocks insights, the contact button and the category label.
2. **Automated posting is only possible on a Professional account linked to a
   Facebook Page.** Instagram has no API for personal accounts. Without this,
   the 20 posts sit in the desk queue as reminders rather than publishing
   themselves.

Settings → Account type and tools → Switch to professional account → Business →
category **Real Estate** → link the RentLeaks Facebook Page.

Then, to turn publishing on, `DEPLOY.md` § "Instagram publishing" has the two
secrets to set and the one command that sets them.

## House rules for this account

- Describe the home, never who should live in it. Fair housing applies to an
  organic post exactly as it does to a paid one — the banned-terms list in
  `rentleaks-rules.js` is the reference.
- No sample listing is ever shown as a real home.
- Fees in writing, always. Never post a price or a fee we can't source.
- No invented results, no stock faces. The ten partner headshots on the site are
  the real ten.
- Where a post rests on a statute, the statute is named in the caption and the
  post carries "General information, not legal advice."
- Blur addresses and contact details in any screenshot.

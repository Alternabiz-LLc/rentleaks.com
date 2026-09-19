# Instagram — the profile

Everything to paste into **instagram.com/rentleaks**, measured against
Instagram's own limits. Art is in `marketing/social/instagram/`.

## Fields

| Field | Paste this | Length |
|---|---|---|
| Username | `rentleaks` | 9 / 30 |
| Name | `RentLeaks: furnished, mid-term` | 30 / 30 |
| Category | `Real Estate` | — |
| Bio | see below | 126 / 150 |
| Link | `https://rentleaks.com/instagram.html` | — |
| Contact email | `hello@rentleaks.com` | — |

**Bio**, exactly as it should read (the line break is deliberate — Instagram keeps it):

```
Furnished, co-living & 1-month+ rentals. All-in prices, 30 days min, 79 markets. Honest fees, real rules.
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

## Being found on Instagram

Instagram search reads three fields and almost nothing else: **username**,
**name**, and the **words in a caption**. Hashtags now matter less than the
first line of a caption. So the levers, in order of how much they move:

**1 · The Name field is a keyword field, not a second logo.** It is searched;
"RentLeaks" alone is only findable by people who already know the brand.
`RentLeaks: furnished, mid-term` uses all 30 characters and puts the two
phrases people type — *furnished*, *mid-term* — in the one place that ranks.

**2 · The first line of every caption is the searchable line.** Every caption in
`IG-FEED.md` is written that way: "The rule most New York renters still haven't
been told", "Convert before you compare", "Amsterdam is one of the strongest
positions a mid-term renter can be in". Plain words people search, not slogans.

**3 · Alt text is indexed and almost nobody writes it.** Each of the 20 posts
has alt text in `IG-FEED.md` — paste it under Advanced settings → Write alt
text. It describes the claim in plain words rather than saying "post image", so
it works for a screen reader and for search at the same time.

**4 · Tag the location on anything city-specific.** The NYC, Paris, Amsterdam,
Berlin, London, Barcelona and Canada posts should each carry their city's
location tag. Location pages are browsed by exactly the people who are moving
there.

**5 · Hashtags: 8–12, mixed by size.** Two or three big ones for reach, the rest
narrow enough to rank in. The sets are in `POSTS-INSTAGRAM.md`; the defaults
this feed ships with are in `tools/social/ig-posts.json`.

**6 · The link in bio goes to a page built to be found too.**
`rentleaks.com/instagram.html` carries FAQ structured data, an ItemList of the
housing types, breadcrumbs, real alt text and links to 16 market pages — so the
traffic Instagram sends lands somewhere search engines also index, rather than
on a dead end. It files every visitor as coming from Instagram, so the desk
shows what the account actually produces.

**7 · Pin three.** The FARE Act post, the fee maths, and the agents post. Pinned
posts are what a first-time visitor reads, and those three answer the three
reasons people arrive.

**What does not work**, so nobody spends time on it: keyword-stuffed bios,
hashtags in the bio (not clickable, not indexed), follow-for-follow, and buying
followers — which suppresses reach on a business account rather than raising it.

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

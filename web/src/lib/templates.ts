/** Starter email templates the founder can load and edit. */
import { DEFAULT_TRIAL_BODY, DEFAULT_TRIAL_SUBJECT } from "@/lib/trials";

export const STARTER_TEMPLATES: Array<{ name: string; purpose: string; subject: string; body: string }> = [
  {
    name: "Host recruitment — first touch",
    purpose: "outreach",
    subject: "{{first_name}}, fill your {{city}} rooms without the fee games",
    body: `Hi {{first_name}},

I run RentLeaks, a marketplace for rooms, co-living, furnished and 1-month+ homes in {{city}}. Every listing shows the all-in monthly price, so the renters who contact you already know what they'll pay.

- Listings from $14/week, lease-breaks free
- Viewing and booking requests go straight to you
- We never touch rent or deposits

Would you be open to a 10-minute call this week? Or [have a look here]({{app_url}}/list).

Yves
RentLeaks`,
  },
  {
    name: "Host recruitment — follow-up",
    purpose: "outreach",
    subject: "Re: your {{city}} listings",
    body: `Hi {{first_name}},

Following up on my note last week. If it helps, I can set up your first listing for you — just reply with the address and a few photos.

Yves`,
  },
  {
    name: "Operator partnership",
    purpose: "outreach",
    subject: "Partnering with RentLeaks in {{city}}",
    body: `Hi {{first_name}},

RentLeaks sends renters looking for flexible, furnished and co-living homes in {{city}}. We'd like to list your portfolio with a verified operator page and all-in pricing.

Could we talk this week about a pilot? The first month is on us.

Yves
RentLeaks`,
  },
  {
    name: "Free-trial invitation",
    purpose: "trial",
    subject: DEFAULT_TRIAL_SUBJECT,
    body: DEFAULT_TRIAL_BODY,
  },
  {
    name: "Monthly newsletter",
    purpose: "newsletter",
    subject: "New in {{city}}: rooms, co-living and 1-month+ homes",
    body: `# This month on RentLeaks

Hi {{first_name}},

Here's what's new:

- **New homes** — fresh rooms, co-living and furnished apartments with all-in prices
- **Lease-breaks** — take over a lease for 3–10 months, no broker fee
- **Renting tip** — never pay a deposit before you've seen the home and signed a lease

[Browse homes]({{app_url}}/stays)

See you next month,
The RentLeaks team`,
  },
  {
    name: "Announcement",
    purpose: "bulk",
    subject: "News from RentLeaks",
    body: `Hi {{first_name}},

We've just launched something new: …

[See what's new]({{app_url}})

The RentLeaks team`,
  },
];

# Provider sponsorship launch

Offers for landlords, multi-unit owners, property companies and co-living providers:

- Market Spotlight: $299/month, one agreed search market.
- Portfolio Spotlight: $599/month, homepage rotation plus up to three agreed markets.
- Portfolio Network: custom scope from $1,499/month, four or more markets.

These are RentLeaks launch proposals, not competitor quotes or evidence of current reach. Revisit after measuring actual traffic and advertiser outcomes. Individual listing fees, operator subscription fees and listing boosts are separate. Booking uses Contact Us; no automatic billing or guaranteed reach is offered.

Research: Apartments.com sells package levels and premium placement with market/property-dependent quotes (https://www.apartments.com/grow/ad-packages and https://propertyhelp.apartments.com/article/467-how-do-i-get-a-premium-listing-on-apartments-com). Zillow also sells multifamily promotion packages (https://www.zillowstatic.com/bedrock/app/uploads/sites/51/2026/01/Rentals-FLM-Signature-One-Pager.pdf). This supports a market/package structure; it does not justify importing their audience claims.

Layout: a responsive portfolio box directly beneath the homepage hero and a compact separate band at the beginning of listing results. Empty space is labeled campaign availability. Approved booked providers are labeled Sponsored; they do not change result counts or earn verification badges. At most three provider cards are shown, with daily rotation. City/stay-type restrictions and start/end dates apply. Campaigns are never used as fake matching listings.

Campaign registry: `provider-sponsorships.json`, initially empty. After booking and creative review, add an object containing `name`, `headline`, internal `href`, `approved: true`, ISO `startsAt`/`endsAt`, `homepage`, `cityIds` (actual RentLeaks city IDs), and optional `types`. External, credential-bearing and non-HTTPS production links are rejected. Rebuild/redeploy the app after a registry change; static pages fetch the registry. No advertiser payment or management dashboard is implemented.

Before accepting a campaign: agree scope/dates/price, verify company identity and destination, review creative, confirm relevant approved inventory, and collect payment through an approved method. Do not publish test providers. No campaigns were added during implementation.

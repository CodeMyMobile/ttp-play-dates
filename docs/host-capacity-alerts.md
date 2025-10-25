# Host Play Date Fill Toolkit

## Embedded low-occupancy detection
- **Unified headcount:** `fetchMatches` normalizes participants and invitees into numeric ID sets, counts unique occupants, and persists the deduped roster metadata on each transformed match.【F:src/TennisMatchApp.jsx†L1320-L1382】【F:src/TennisMatchApp.jsx†L1580-L1633】
- **Host classification:** Hosts are derived by cross-referencing contact bundles (email and phone digits) collected from every match variant, ensuring alerts only surface on events the current user controls.【F:src/TennisMatchApp.jsx†L1394-L1455】【F:src/TennisMatchApp.jsx†L1456-L1504】
- **Alert heuristics:** Upcoming hosted matches calculate `hoursUntilStart`, compare unique headcount against capacity, and attach severity metadata (`warning` or `urgent`) with thresholds (50% @ 48h, 75% @ 24h). Matches without capacity, already full, inactive, or in the past are excluded.【F:src/TennisMatchApp.jsx†L1512-L1577】
- **Alert queue:** A memoized selector filters to active host matches with low-occupancy payloads and orders them by start time so the most urgent play dates bubble to the top of the dashboard panel.【F:src/TennisMatchApp.jsx†L1760-L1784】

## Surfacing alerts in host workflows
- **Dashboard cards:** Hosted match tiles render severity callouts showing filled spots, utilization percentage, and a countdown when `lowOccupancy` is present, keeping issues visible even before opening details.【F:src/TennisMatchApp.jsx†L2868-L3046】
- **Quick actions:** Hosts receive a prominent "Invite players" button that pre-fills the invite modal with up to two smart suggestions, streamlining last-minute outreach from the match list view.【F:src/TennisMatchApp.jsx†L3091-L3106】
- **Dedicated panel:** `LowOccupancyAlertsPanel` assembles all flagged matches into a focused workspace with severity styling, utilization bars, share links, and clipboard helpers for rapid action.【F:src/TennisMatchApp.jsx†L3180-L3336】【F:src/TennisMatchApp.jsx†L3349-L3477】

## Smart invite intelligence
- **Recent partner seeding:** Each hosted match merges historical partner suggestions while excluding current occupants before attaching `partnerSuggestions` to the transformed record.【F:src/TennisMatchApp.jsx†L1643-L1674】
- **Directory enrichment:** When alerts are present, the app batches candidate IDs through `searchPlayers` to hydrate contact, membership, and profile metadata used in smart recommendations.【F:src/TennisMatchApp.jsx†L1786-L1858】
- **Actionable recommendations:** The alerts panel surfaces enriched suggestions with membership chips, last-played context, and direct invite buttons that prefill the modal with the selected substitute.【F:src/TennisMatchApp.jsx†L3538-L3660】

## Enriched contact & membership data for outreach
- **Host contact aggregation:** The contact collector walks every host-related field (direct and nested) to normalize emails and phone numbers, powering invite shortcuts and clipboard copies.【F:src/TennisMatchApp.jsx†L175-L279】
- **Membership intelligence:** `buildLocalUser` composes comprehensive identity, membership, and profile hints for the active user and downstream suggestions, enabling targeted segmentation in the alert UX.【F:src/TennisMatchApp.jsx†L284-L363】【F:src/TennisMatchApp.jsx†L3296-L3336】
- **Contact surfacing:** Smart invite rows reuse the aggregated directory to present ready-to-use email and phone channels alongside formatted membership tags, helping hosts personalize outreach fast.【F:src/TennisMatchApp.jsx†L3288-L3657】

By combining real-time occupancy scoring with enriched outreach tooling, hosts gain a turnkey workflow for filling courts before the first serve.

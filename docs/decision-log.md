# USKORUN — R&D Decision Log
_Last updated: 2026-10-15._

| ID | Decision / hypothesis | Status | Basis | Revisit when |
| --- | --- | --- | --- | --- |
| ADR-001 | Start with responsive web app / PWA and organizer-supervised events | PROPOSED | Fastest test; removes native and fitness API dependencies | After 2–3 successful pilots |
| ADR-002 | Do not promise direct Apple Health in web app | VERIFIED | Apple HealthKit entitlement documented for native platforms | New Apple browser API or native scope approved |
| ADR-003 | Do not depend on Strava activity APIs for virtual races/merchant rewards | BLOCKED | Strava states virtual races/competitions can violate its agreement | Written provider acceptance of exact use case |
| ADR-004 | Merchants receive opaque voucher status, not workout or GPS data | DESIGN REQUIREMENT | Privacy by design and Apple limitations | Legal/data protection review |
| ADR-005 | Start in one local US region with club + merchant partners | HYPOTHESIS | Focused acquisition and operational validation | After field interviews |
| ADR-006 | Collect no sensitive data or commercial secrets in public repository | ACTIVE RULE | Repository visibility is public | If repository visibility/settings change |
| ADR-007 | No paid prizes / gambling-like mechanics in MVP | PROPOSED | U.S. promotion law and fraud complexity | Lawyer-approved scope |
| ADR-008 | Run-to-charity and donation club entry are experiments, not live promises | HYPOTHESIS | Nonprofit/tax/solicitation issues unresolved | Partner and legal verification |

## Explicit assumptions awaiting evidence
- People want local rewards enough to change their running behavior.
- Merchants will pay for incrementally generated foot traffic.
- Running clubs are scalable acquisition partners.
- A non-cash voucher has acceptable anti-fraud exposure.
- An eventual $1M annual revenue business is possible at repeatable merchant economics.

## Research integrity
Use VERIFIED only with a checkable dated source or direct experiment. HYPOTHESIS means an assumption; OPEN means research remains; BLOCKED means a prerequisite must be resolved. Do not reclassify without evidence and a commit referencing the source.

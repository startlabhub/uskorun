# USKORUN — Unit Economics & KPI Framework
_Date: 2026-10-15. Status: MODEL TEMPLATE; values below are illustrative only._

## Principle
An attractive discount is **not** revenue for USKORUN. Merchant's forgone margin is a **cost borne by whoever funds it**; any subscription, sponsorship or platform redemption fee must be counted separately.

## Definitions
- **Active qualified runner:** unique participant meeting a documented eligibility rule during month.
- **Redemption rate:** unique redeemed rewards / valid issued rewards.
- **Runner repeat rate 30d:** users attending second distinct event within 30 days / users attending first event with sufficient follow-up window.
- **Merchant renewal rate:** partner accounts signing a subsequent paid campaign / paid campaigns eligible for renewal.
- **Verified incremental merchant value:** estimated gross profit from purchases that would not otherwise have occurred, minus discounts and operating burden; requires experiment/holdout when possible.
- **Gross revenue:** invoices paid to USKORUN, excluding pass-through merchant discounts.
- **Gross margin:** platform revenue − variable infrastructure, fraud reimbursements, payment fees, rewards subsidized by USKORUN and campaign delivery costs; account for labor.

## Symbolic campaign model
Let:
- I = number of vouchers issued
- r = redemption ratio
- R = I × r = number of redemptions
- F = platform fee per redeemed voucher
- S = fixed paid sponsorship/campaign fee
- C_platform = support + infrastructure + marketing attributed to the campaign
- C_subsidy = USKORUN-funded reward cost (zero if merchant funds discount)
- C_fraud = fraud losses and reversal expenses
Then:
- USKORUN revenue = R × F + S
- Campaign contribution = (R × F + S) − C_platform − C_subsidy − C_fraud
Exclude taxes from simplicity; settlement/revenue-recognition rules require accountant review.

## Illustrative scenario (NOT a projection)
- I=300 issued, r=0.20, R=60 redemptions.
- F=$2.00 platform fee per redemption, S=$150 fixed sponsorship.
- Revenue=60×$2+$150=$270.
- If attributable platform/delivery/subsidy/fraud cost totals $210, contribution=$60.
Actual fees and costs are UNKNOWN and must be discovered via signed pilots.

## Merchant side
Merchant incremental gross profit = (incremental transactions × gross profit before promo) − discounts actually applied − staff burden − USKORUN fees.
Do not assume all redeemers are incremental customers. Offer an opt-in holdout, track new vs repeat customers only with lawful consent and merchant aggregation.

## Target dashboard
| Stage | KPI | Data owner |
| --- | --- | --- |
| Awareness | Qualified local challenge page views | USKORUN |
| Acquisition | Signup per club invite | USKORUN |
| Participation | Attendance / enrolled | Organizer |
| Verification | Eligible / attended; disputed rate | Verification |
| Activation | Issued vouchers / eligible | Reward engine |
| Realized value | Redeemed / issued | Merchant redemption |
| Retention | Next event within 30d | USKORUN |
| Commercial | Paid merchant renewal; contribution margin | Finance |
| Trust | Fraud loss, privacy complaints, manual-review load | Operations |

## $1M annual revenue test (algebra, not forecast)
At $100/month average merchant subscription, $1M ARR would require **834 paying merchants** ($1,000,800/year), before churn and expenses. At $250/month it would require **334 paying merchants** ($1,002,000/year). These are arithmetic targets, not evidence that pricing, retention, or acquisition are feasible.

## Research priorities before financial commitments
Obtain offer-specific gross margins, reasonable fee willingness, merchant acquisition cost, retention, runner acquisition cost and organizer workload from pilots; fill sensitivity cases after actual data exists.

# Judgment Recovery Platform PRD

## Product Promise
You already won. Now get paid.

Judgment-to-Cash is a no-upfront-fee recovery service for final unpaid Bexar County default judgments. The product turns a judgment into a collectability review, a recovery path, and a trackable case experience so the plaintiff does not need to navigate enforcement alone.

## Customer
- Individuals with a final unpaid Bexar County default judgment
- Landlords or property owners with a final unpaid Bexar County default judgment
- Small businesses with a final unpaid Bexar County default judgment

## Problem
Winning in court does not collect the money. Enforcement is confusing, expensive, and slow enough that most plaintiffs stop after the judgment is signed.

## Offer
- No recovery, no fee
- Final judgments only
- Bexar County only
- We handle the recovery path with legal and collection partners
- The plaintiff can track the file from review to payment
- The platform advances approved recovery costs

## Initial Wedge
- Bexar County only
- Final default or uncontested judgments only
- Judgment amount between $5,000 and $250,000

## Qualification Rules
Hard-fail the file when:
- The judgment is not final
- The judgment is not default or uncontested
- The case is outside Bexar County
- The file is outside the current enforcement window
- Required fields are missing
- The amount is outside the wedge

## Scoring Inputs
- Judgment amount
- Judgment age
- Debtor address quality
- Known bank
- Known employer
- Additional debtor information from the plaintiff
- Whether the judgment PDF is uploaded

## Decision Outputs
- `Approved`
  The file looks strong enough to move into recovery review.
- `Reviewing`
  The file may be viable, but more debtor information is needed.
- `Closed`
  The file does not fit the current workflow.

## Visible User States
- `Received`
- `Reviewing`
- `Approved`
- `In Recovery`
- `Paid`
- `Closed`

## Customer Tracking
- Customer enters Case ID plus intake email to look up status
- Customer view shows current state, next step, and simple timeline
- Internal recovery detail stays behind the scenes unless needed for the next customer action

## Fee Model
- Standard contingency fee: 30% of recovered funds
- Approved files have recovery costs advanced by the platform
- If no money is recovered, the plaintiff does not pay the recovery fee

## Intake Requirements
Required:
- Plaintiff name
- Contact email
- Defendant name
- Case number
- Confirmation that the judgment is final
- Confirmation that the judgment is default or uncontested

Helpful:
- Judgment amount
- Judgment date
- Debtor address
- Known bank
- Known employer
- Additional collection notes
- Judgment PDF

## Customer Experience
1. Plaintiff submits the judgment
2. Platform scores collectability and returns an approval, review, or decline outcome
3. Approved files move into agreement review and same-day partner handoff when ready
4. User tracks the file from review to payment

## MVP APIs
- `POST /api/intake`
- `GET /api/cases/:id`
- `POST /api/cases/:id/start-recovery`
- `POST /api/cases/:id/mark-paid`
- `GET /api/dashboard/ops`
- `GET /api/config`

## Success Metrics
- Intakes submitted
- Approval rate
- Recovery-start rate
- Paid-case rate
- Dollars recovered

## Non-Goals For MVP
- Nationwide coverage
- Contested judgments
- Complex entity resolution across jurisdictions
- Full legal document automation inside the first release

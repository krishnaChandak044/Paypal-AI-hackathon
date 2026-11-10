# ReliefRail

ReliefRail is an AI-assisted aid coordination platform for community relief organizations. It helps organizers turn incoming requests into reviewable aid plans, coordinate allocations from an emergency pool, track fulfillment, and maintain a clear record of decisions and payment events.

The product is intended as a durable platform for real relief operations. The hackathon demo will be one milestone in its development, not the product's defining scope.

## The problem

After a disaster, people ask for help through scattered channels while local organizations coordinate limited funds, volunteers, and supplies. Requests may be incomplete, needs can change, and organizers need to act quickly without losing track of approvals, allocations, purchases, or recipient privacy.

## Product direction

ReliefRail supports two related workflows:

- **Immediate response (first 48 hours):** organizers record urgent needs and allocate from an already-funded emergency pool. The system records approvals and fulfillment status; it does not assume that incoming donations are instantly available.
- **Recovery (days 3–30):** organizers create more detailed aid plans, compare suitable options, track fulfillment, and review substitutions when items are unavailable or prices change.

AI helps structure requests, identify missing information, and draft options with explanations. Organizers and recipients remain in control of consequential decisions. AI does not determine eligibility or independently authorize spending.

## Core principles

1. **People make aid decisions.** AI recommendations are reviewable drafts, never eligibility determinations or payment authorization.
2. **Urgent aid is funded before it is promised.** Pool availability and allocation are distinct from a donation pledge or pending payment.
3. **Privacy is built into the workflow.** Collect only necessary information; donor views show aggregate progress rather than recipient identities or sensitive details.
4. **Every consequential step is traceable.** Record request changes, approvals, allocations, payment confirmations, fulfillment, and exceptions.
5. **Offline realities are acknowledged.** Support low-bandwidth organizer workflows and manual recording of offline purchases; do not imply that a web app works during a total communications outage.
6. **The product grows beyond a single demo.** Build a maintainable platform, then select a reliable, demonstrable slice for hackathon presentation.

## Planned capabilities

- Recipient and organizer request workflows
- AI-assisted request extraction and clarification
- Configurable campaign policies and deterministic budget checks
- Human approval and exception review
- Emergency-pool accounting and allocation ledger
- Recovery planning and editable supplier/resource catalog
- PayPal integration for sandbox contributions and payment event tracking
- Manual recording of offline purchases
- Privacy-aware recipient, organizer, and supporter views
- Audit history and operational reporting

## Current status

This repository currently contains product documentation and planning only. No application has been implemented yet. The product requirements, architecture decisions, threat model, delivery roadmap, and demo strategy are being developed in [`docs/`](docs/).

## Repository structure

```text
.
├── README.md
├── .gitignore
└── docs/                 # Local planning documents; excluded from Git by request
```

## Development approach

The project will be built as a production-minded product, with staged delivery, explicit privacy and safety boundaries, and working end-to-end flows. Hackathon-specific packaging, judging alignment, and demo preparation will be handled as a later release milestone.

## Name

ReliefRail is a working product name, not a claim of trademark clearance.

# Product Analysis

## Covered Capabilities

- Business profiles for software development, maintenance, SaaS licensing, hardware,
  networking, cybersecurity, cloud infrastructure, and consulting.
- Profile-specific score breakdown across relevance, eligibility, commercial fit,
  execution, competition, and urgency.
- Tender preview panel with official source link, value, deadline, score reasons, lots,
  linked contracts, amendments, and buyer supplier history.
- Application pipeline with stage, owner, notes, next action, due date, and decision
  reason.
- Metadata-based document intelligence that produces eligibility checks, required
  documents, certification signals, and risk signals from crawled structured data.
- Alert-rule storage for profile, CPV, score threshold, deadline window, channel, and
  target.

## Product Direction

The current implementation is built for fast triage and bid/no-bid decisions. The next
highest-value improvements are:

- Download tender attachments and extract requirements from PDFs and office documents.
- Add competitor scoring based on same-buyer and same-CPV award history.
- Add team/company capability profiles so eligibility can compare against real internal
  certifications, references, partner status, and delivery capacity.
- Generate an application checklist per tender and track missing documents.
- Send alert rules through email or webhook delivery with suppression and audit logs.
- Add buyer pages with repeated procurement patterns, average values, incumbent suppliers,
  and seasonal timing.

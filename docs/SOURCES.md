# Data Sources

For the full multi-country expansion plan, source rollout order, country preference model,
and connector architecture, see
[MULTI_COUNTRY_SOURCE_EXPANSION_PLAN.md](./MULTI_COUNTRY_SOURCE_EXPANSION_PLAN.md).

## CAIS EOP / AOP Bulgaria

Priority: P0

Use the official open-data files instead of scraping the Angular application.

Daily bucket pattern:

```text
https://storage.eop.bg/open-data-YYYY-MM-DD/
```

The bucket listing is XML. Each object key should be URL-encoded before download because
the filenames are in Bulgarian.

Expected daily files:

- tenders/orders
- OCDS notices
- contracts
- annexes/amendments

Important fields:

- `tenderId`
- `uniqueProcurementNumber`
- `noticeId`
- `subject`
- `buyerName`
- `buyerRegistryNumber`
- `mainCpvCode`
- `estimatedValue`
- `currency`
- `publicationDate`
- `submissionDeadline`
- `procedureType`
- `isEuFunded`
- `europeanProgram`
- `linkToOjEu`

Public CAIS URL pattern:

```text
https://app.eop.bg/today/{tenderId}
```

## TED Search API

Priority: P0

Endpoint:

```text
POST https://api.ted.europa.eu/v3/notices/search
```

Use `scope: "ACTIVE"`, `onlyLatestVersions: true`, and `paginationMode: "ITERATION"`.

Initial Bulgarian IT query:

```text
classification-cpv = 72* AND buyer-country = BGR AND publication-date >= YYYYMMDD AND notice-type IN (cn-standard cn-social) SORT BY publication-date DESC
```

Recommended fields:

- `publication-number`
- `notice-title`
- `buyer-name`
- `buyer-country`
- `classification-cpv`
- `publication-date`
- `deadline-receipt-tender-date-lot`
- `deadline-receipt-request`
- `notice-type`
- `procedure-type`
- `contract-nature`
- `estimated-value-proc`
- `estimated-value-cur-proc`
- `estimated-value-lot`
- `estimated-value-cur-lot`
- `links`

## EU Funding & Tenders / SEDIA

Priority: P0 active

Endpoint:

```text
POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA
```

Use this for EU institution tenders first. Grant calls can be added later when the
dashboard supports a separate opportunity type.

Initial filters:

- type `0` for calls for tenders
- statuses `31094501` and `31094502` for forthcoming/open opportunities
- configurable ICT keyword search through `SEDIA_SEARCH_TERMS`; production defaults to
  software, hardware, cybersecurity, cloud, network, data, digital, and IT services

## Supporting Sources

These are not MVP blockers but should be added as enrichment.

- Bulgarian Open Data Portal AOP datasets and RSS for historical mirrors.
- CPC and court appeal tracking by procurement number.
- ISUN and EU funds portals for project pipeline intelligence.
- CAIS EOP live service only if browser-based testing confirms stable access.

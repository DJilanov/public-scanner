# Western Europe Procurement Source Expansion

Last researched: 2026-07-23

## Why This Market Is Valid

EU-established businesses have the right to compete for public tenders in any EU country
without discrimination, with equal access to tender information and the ability to use
supporting documents issued in their own country. Higher-value EU procurement notices must
generally be published on TED, while lower-value notices are handled by national rules and
national portals.

Primary references:

- Your Europe public tendering rules:
  https://europa.eu/youreurope/business/selling-in-eu/public-contracts/public-tendering-rules/index_en.htm
- European Commission TED overview:
  https://single-market-economy.ec.europa.eu/single-market/public-procurement/digital-procurement/tenders-electronic-daily_en
- TED portal: https://ted.europa.eu/en/
- European Commission public procurement country portals:
  https://commission.europa.eu/funding-and-tenders/tools-public-buyers/public-procurement-eu-countries_en

## Product Decision

Use TED as the immediate Western Europe ingestion layer for high-value member-state
notices, filtered by ICT, software, hardware, networking, support, and consulting CPVs.
Use the EU Funding & Tenders / SEDIA search API as a separate active source for EU
institution tenders. Keep national portals in the source catalog as planned connectors
because they are required for below-threshold tenders, richer documents, local-language
metadata, and bid-submission workflows.

## Added Market Coverage

| Country     | TED code | National source catalog row              | Official portal                                 |
| ----------- | -------- | ---------------------------------------- | ----------------------------------------------- |
| Austria     | AUT      | Austria USP Tender Search                | https://www.usp.gv.at/                          |
| Belgium     | BEL      | Belgium e-Procurement                    | https://www.publicprocurement.be/               |
| Germany     | DEU      | Germany e-Vergabe / service.bund         | https://www.evergabe-online.de/                 |
| Denmark     | DNK      | Denmark Udbud.dk                         | https://udbud.dk/                               |
| Spain       | ESP      | Spain Public Sector Procurement Platform | https://contrataciondelestado.es/               |
| Finland     | FIN      | Finland Hilma                            | https://www.hankintailmoitukset.fi/en/          |
| France      | FRA      | France BOAMP / PLACE                     | https://www.boamp.fr/                           |
| Ireland     | IRL      | Ireland eTenders                         | https://www.etenders.gov.ie/                    |
| Italy       | ITA      | Italy ANAC BDNCP                         | https://dati.anticorruzione.it/opendata/ocds_en |
| Luxembourg  | LUX      | Luxembourg Portail des marches publics   | https://pmp.b2g.etat.lu/                        |
| Netherlands | NLD      | Netherlands TenderNed                    | https://www.tenderned.nl/                       |
| Portugal    | PRT      | Portugal BASE                            | https://www.base.gov.pt/Base4/en/               |
| Sweden      | SWE      | Sweden Procurement Authority / TED       | https://www.upphandlingsmyndigheten.se/en/      |

## Connector Roadmap

1. TED multi-country ICT ingestion: active now.
2. SEDIA EU Funding & Tenders ICT search ingestion: active now.
3. National portal discovery connectors: fetch search/listing pages, normalize local
   opportunity metadata, and link official submission pages.
4. National document connectors: download tender packs where public without login;
   otherwise mark registration-required and guide users to the portal.
5. Award/contract history connectors: prioritize open-data portals first, especially Italy
   ANAC BDNCP/OCDS, Portugal BASE, TenderNed, BOAMP, and Hilma.

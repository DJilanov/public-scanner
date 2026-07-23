# Local Database

This project has a separate database on the same Postgres location used by the referenced
`ai-cv` project.

## Database

```text
public_scanner_dev
```

The location is reached through the same SSH tunnel:

```bash
ssh -fN -L 5454:localhost:5432 root@89.167.46.193
```

Set `DATABASE_URL` to the same user and password as the referenced project, but replace
the database name with `public_scanner_dev`.

```bash
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5454/public_scanner_dev
```

Migrations already applied during setup:

- `0001_initial.sql`
- `0002_ingestion_hardening.sql`
- `0003_product_analysis.sql`

Run migrations again after schema changes:

```bash
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5454/public_scanner_dev npm run db:migrate
```

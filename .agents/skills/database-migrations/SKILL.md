---
name: database-migrations
description: Use when creating, reviewing, or troubleshooting database migrations across any ORM or framework. Covers migration safety, rollback strategies, data migrations vs schema migrations, index management, and zero-downtime patterns for Prisma, Drizzle, Alembic, Django, ActiveRecord, Sequelize, TypeORM, Goose, and golang-migrate.
---

# Database Migrations Skill

Safe, reversible database migrations for any stack.

## Core Principles

1. **Migrations must be reversible** — always write `up` and `down`
2. **Schema first, data second** — separate schema migrations from data migrations
3. **Additive changes only** — never rename/delete columns in place; add new, migrate, drop old
4. **Backward compatible** — old code must work with new schema during deploys
5. **Test rollback** — if `down` doesn't work, the migration isn't complete

## Migration Safety Checklist

- [ ] Rollback (`down`) is implemented and tested
- [ ] Column additions are nullable or have defaults
- [ ] Indexes are created CONCURRENTLY (PostgreSQL) to avoid locks
- [ ] Large data migrations are batched (not single DELETE/UPDATE)
- [ ] No sensitive data in migration files (passwords, API keys)
- [ ] Migration is idempotent (safe to run multiple times)

## Schema Migration Patterns

### Safe Column Addition

```sql
-- GOOD: Add nullable column (no lock on large tables)
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;

-- BAD: Add NOT NULL without default (locks table, fails on existing rows)
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NOT NULL;
```

### Safe Column Removal (3-step)

```sql
-- Step 1: Stop reading from column (deploy code that doesn't use it)
-- Step 2: Drop column (migration)
ALTER TABLE users DROP COLUMN phone;
-- Step 3: Remove from ORM/model (next deploy)
```

### Safe Index Creation

```sql
-- PostgreSQL: Create index without locking table
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- SQLite: No CONCURRENTLY support, but tables are locked anyway
CREATE INDEX idx_users_email ON users(email);
```

## Data Migration Patterns

### Batched Updates

```sql
-- BAD: Update millions of rows at once
UPDATE users SET status = 'active' WHERE last_login > '2024-01-01';

-- GOOD: Batch in chunks
-- Process 1000 rows at a time in application code
UPDATE users SET status = 'active'
WHERE id IN (SELECT id FROM users WHERE last_login > '2024-01-01' LIMIT 1000);
```

### Data Backfill

```sql
-- Separate migration for data backfill
-- 1. Add new column (nullable)
ALTER TABLE orders ADD COLUMN total_cents BIGINT NULL;
-- 2. Backfill in batches (application code)
-- 3. Add NOT NULL constraint after backfill completes
ALTER TABLE orders ALTER COLUMN total_cents SET NOT NULL;
```

## Framework-Specific

### Prisma

```bash
npx prisma migrate dev --name add_user_phone    # Create migration
npx prisma migrate deploy                       # Apply in production
npx prisma migrate reset                         # Reset DB (dev only)
npx prisma db push                               # Push schema without migration file
```

### Drizzle

```bash
npx drizzle-kit generate                         # Generate migration
npx drizzle-kit push                             # Push schema changes
npx drizzle-kit studio                           # Visual DB browser
```

### Alembic (Python)

```bash
alembic revision --autogenerate -m "add user phone"  # Generate
alembic upgrade head                                  # Apply
alembic downgrade -1                                  # Rollback one
alembic history                                       # List migrations
```

### Django

```bash
python manage.py makemigrations              # Generate
python manage.py migrate                     # Apply
python manage.py migrate app_name 0003       # Rollback to specific
python manage.py showmigrations              # Show status
```

### ActiveRecord (Rails)

```bash
rails generate migration AddPhoneToUsers phone:string  # Generate
rails db:migrate                                       # Apply
rails db:rollback                                      # Rollback one
rails db:migrate:status                                # Show status
```

### Goose (Go)

```bash
goose -dir ./migrations postgres "db_url" up         # Apply
goose -dir ./migrations postgres "db_url" down        # Rollback one
goose -dir ./migrations postgres "db_url" status      # Status
```

## Zero-Downtime Patterns

### Expand and Contract

1. **Expand**: Add new column/table (backward compatible)
2. **Migrate**: Backfill data, update code to use new schema
3. **Contract**: Drop old column/table (after code migration complete)

### Rename Column (Zero-Downtime)

```sql
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN email_address VARCHAR(255);
-- Step 2: Copy data
UPDATE users SET email_address = email;
-- Step 3: Deploy code to read/write new column
-- Step 4: Add NOT NULL constraint
-- Step 5: Drop old column (separate migration, later)
```

## Common Anti-Patterns

| Anti-Pattern | Why Bad | Fix |
|-------------|---------|-----|
| Renaming columns directly | Breaks running code | Expand-contract pattern |
| `DELETE FROM table` without WHERE | Locks table, kills performance | Batch delete with LIMIT |
| Adding index in transaction | Locks table for duration | Use CONCURRENTLY (Postgres) |
| `ALTER TABLE` on large table | Can take minutes, locks writes | Use pt-online-schema-change or gh-ost |
| Storing secrets in migration | Leaks credentials | Use env vars, not migration files |
| Skipping rollback testing | Broken rollback = stuck schema | Test `down` before merging |

## Rollback Testing

```bash
# Test rollback works
npx prisma migrate down
alembic downgrade -1
rails db:rollback
python manage.py migrate app_name <previous_migration>
```

## References

- See `skill: backend-patterns` for ORM patterns
- See `skill: security-review` for data security
- See `agent: database-reviewer` for query optimization

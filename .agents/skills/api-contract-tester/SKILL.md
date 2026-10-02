---
name: api-contract-tester
description: Use this skill when validating that API implementations match their OpenAPI/Swagger specifications, or when generating API docs from code. Detects undocumented endpoints, mismatched response schemas, incorrect status codes, and missing error responses. Works with Express, FastAPI, NestJS, Django REST, Go, and any OpenAPI-compatible framework.
triggers: [OpenAPI, swagger, contract, API spec, endpoint, API design, REST API, API docs, API validation, undocumented endpoint, response schema, status code, API testing]
origin: starter-pack
---

# API Contract Tester Skill

Validate that your API implementation matches its specification (or generate spec from code).

## When to Activate

- Before API release / handoff to frontend team
- After adding or modifying API endpoints
- When integrating with third-party APIs
- When frontend/backend teams report contract mismatches
- When generating API documentation

## Capabilities

1. **Spec → Code validation**: Check if code matches existing OpenAPI spec
2. **Code → Spec generation**: Generate OpenAPI spec from code
3. **Contract gap detection**: Find undocumented endpoints, missing error responses
4. **Status code audit**: Verify correct HTTP status codes

## Detection: Which Framework?

| Pattern | Framework | Spec Location |
|---------|-----------|---------------|
| `openapi.json` / `swagger.json` | Any | Root or `/api-docs` |
| `@nestjs/swagger` | NestJS | Generated from decorators |
| `FastAPI` with `app.openapi()` | FastAPI | Auto-generated |
| `swagger-jsdoc` + `swagger-ui-express` | Express | Generated from JSDoc |
| `drf-spectacular` / `drf-yasg` | Django REST | Generated from viewsets |
| `gin-swagger` | Go/Gin | Generated from annotations |

## Validation Commands

### Extract Existing Spec

```bash
# If spec file exists
cat openapi.json 2>/dev/null | head -100
cat swagger.json 2>/dev/null | head -100

# If running server generates spec
curl -s http://localhost:3000/api-docs/swagger.json 2>/dev/null | head -100
curl -s http://localhost:8000/openapi.json 2>/dev/null | head -100
```

### Find All Endpoints in Code

```bash
# Express / NestJS
grep -rn "\.\(get\|post\|put\|delete\|patch\)(" --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v ".test."

# FastAPI
grep -rn "@app\.\(get\|post\|put\|delete\|patch\)(" --include="*.py" . | grep -v test

# Django REST
grep -rn "@api_view\|@action\|\.register(" --include="*.py" . | grep -v test

# Go/Gin
grep -rn "\.\(GET\|POST\|PUT\|DELETE\)(" --include="*.go" . | grep -v test

# NestJS
grep -rn "@\(Get\|Post\|Put\|Delete\|Patch\)(" --include="*.ts" . | grep -v test
```

### Validate Status Codes

```bash
# Find all response status codes in code
grep -rn "res\.status(\|statusCode\|HTTP_\|status_code\|HttpStatus\." --include="*.ts" --include="*.js" --include="*.py" --include="*.go" . | head -30

# Expected status codes per method:
# GET    → 200 (OK), 404 (Not Found)
# POST   → 201 (Created), 400 (Bad Request), 409 (Conflict)
# PUT    → 200 (OK), 404 (Not Found), 400 (Bad Request)
# PATCH  → 200 (OK), 404 (Not Found), 400 (Bad Request)
# DELETE → 204 (No Content), 404 (Not Found)
```

## Validation Checklist

### Endpoints Coverage

| Check | Status |
|-------|--------|
| All code endpoints in spec | PASS/FAIL |
| All spec endpoints in code | PASS/FAIL |
| No undocumented endpoints | PASS/FAIL |

### Request Schema

| Check | Status |
|-------|--------|
| Request body schema matches code validation | PASS/FAIL |
| Query parameters documented | PASS/FAIL |
| Path parameters documented | PASS/FAIL |
| Required fields match code validation | PASS/FAIL |

### Response Schema

| Check | Status |
|-------|--------|
| Success response schema matches code output | PASS/FAIL |
| Error response schemas documented | PASS/FAIL |
| 4xx responses for invalid input | PASS/FAIL |
| 5xx responses for server errors | PASS/FAIL |

### Status Codes

| Check | Status |
|-------|--------|
| Correct success codes (200, 201, 204) | PASS/FAIL |
| Correct error codes (400, 401, 403, 404, 409, 500) | PASS/FAIL |
| No 200 for errors | PASS/FAIL |

### Authentication

| Check | Status |
|-------|--------|
| Auth requirements in spec | PASS/FAIL |
| Auth middleware matches spec | PASS/FAIL |

## Output Format

```markdown
# API Contract Test Report

**Date:** YYYY-MM-DD
**Project:** [name]
**Spec:** openapi.json (version: X.Y.Z)

## Summary

| Dimension | Status | Findings |
|-----------|--------|----------|
| Endpoint Coverage | PASS/FAIL | X missing |
| Request Schemas | PASS/FAIL | X mismatches |
| Response Schemas | PASS/FAIL | X mismatches |
| Status Codes | PASS/FAIL | X incorrect |
| Auth | PASS/FAIL | X gaps |

## Verdict: PASS | FAIL

## Undocumented Endpoints (in code, not in spec)

| Method | Path | Action |
|--------|------|--------|
| POST | /api/webhooks | Add to spec |

## Missing from Code (in spec, not in code)

| Method | Path | Action |
|--------|------|--------|
| GET | /api/health | Implement or remove from spec |

## Schema Mismatches

### POST /api/users
- Spec says: `{ name: string, email: string }`
- Code validates: `{ name: string, email: string, role: string }`
- Fix: Update spec to include `role` field

## Status Code Issues

### GET /api/users/:id
- Code returns: 200 with empty body when not found
- Should return: 404
```

## OpenAPI Generation (from code)

If no spec exists, generate one:

```bash
# NestJS
npx @nestjs/cli swagger-cli generate -p src -o openapi.json

# Express with swagger-jsdoc
# (configured in code, run server to generate)

# FastAPI
python -c "from app.main import app; import json; print(json.dumps(app.openapi(), indent=2))" > openapi.json

# General: use openapi-internals or similar
npx openapi-internals generate --input src/ --output openapi.json
```

## When NOT to Use

- For GraphQL APIs (use schema introspection instead)
- For gRPC APIs (use protobuf definitions)
- For WebSocket-only APIs
- When no API exists yet (use `api-design` skill instead)

## Pair With

- `api-design` — for designing the API before implementation
- `security-review` — for auth/security validation
- `code-reviewer` — for code quality of API handlers
- `documentation-lookup` — for framework-specific OpenAPI setup

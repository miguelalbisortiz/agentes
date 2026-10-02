---
name: user-manual-generator
description: Use this skill when generating a complete user manual or end-user documentation for a project. Compiles information from README, code, tests, PRDs, reports, and API docs into a structured manual with installation, configuration, usage, API reference, FAQ, and troubleshooting sections.
triggers: [manual, usuario, documentation, documentación, handoff, entrega, user guide, user manual, end user docs, guía, user documentation, release notes, changelog]
origin: starter-pack
---

# User Manual Generator Skill

Generate a comprehensive user manual by compiling information from across the entire project.

## When to Activate

- Before project delivery / handoff
- After feature completion for end-user documentation
- When user explicitly requests a manual or user guide
- Before major release
- When onboarding new users to the project

## Information Sources

| Source | What to extract |
|--------|----------------|
| `README.md` | Project overview, quick start |
| `package.json` / `pyproject.toml` / `Cargo.toml` | Name, version, scripts, dependencies |
| `docs/PROJECT.md` | Architecture, stack, conventions |
| `docs/prds/*.prd.md` | Features, acceptance criteria |
| `docs/reports/*.md` | Implementation status |
| `src/` or `app/` | Code structure, entry points |
| `tests/` | Usage examples, edge cases |
| `.env.example` | Configuration variables |
| `API` routes / endpoints | API documentation |
| `docker-compose.yml` / `Dockerfile` | Deployment info |

## Manual Structure

```markdown
# [Project Name] — User Manual

**Version:** X.Y.Z
**Last Updated:** YYYY-MM-DD
**Author:** Auto-generated from codebase analysis

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [API Reference](#api-reference)
6. [Examples](#examples)
7. [FAQ](#faq)
8. [Troubleshooting](#troubleshooting)
9. [Contributing](#contributing)
10. [License](#license)

---

## 1. Introduction

### What is [Project Name]?

[Extract from README, package.json description, or PROJECT.md]

### Key Features

[List from PRDs, README, or code analysis]

### Architecture Overview

[Include Mermaid diagram from flow-visualizer if available]

---

## 2. Installation

### Prerequisites

- [Runtime version]: [Node.js 18+, Python 3.10+, etc.]
- [Package manager]: [npm, yarn, pip, cargo, etc.]
- [External services]: [Database, Redis, etc.]

### Install Steps

[Extract from README, scripts in package.json, or Makefile]

```bash
# Step 1: Clone
git clone [repo-url]
cd [project]

# Step 2: Install dependencies
[package-manager] install

# Step 3: Configure
cp .env.example .env
# Edit .env with your values

# Step 4: Setup database (if applicable)
[db-setup-command]

# Step 5: Start
[dev-command]
```

### Verify Installation

[From tests or README]

---

## 3. Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| [Extract from .env.example and code] |

### Configuration Files

[Extract from config files, their purpose]

---

## 4. Usage

### Getting Started

[Extract from README quickstart, examples, or test files]

### Common Operations

[Extract from most-used functions, CLI commands, or API endpoints]

### CLI Commands (if applicable)

[Extract from bin scripts, package.json scripts]

| Command | Description | Example |
|---------|-------------|---------|
| [from code] |

---

## 5. API Reference

### Endpoints

[Extract from route files, OpenAPI spec, or API design docs]

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/... | ... | Yes/No |

### Request/Response Examples

[Extract from tests, API docs, or code]

---

## 6. Examples

### Basic Example

[From README, examples/ directory, or test files]

### Advanced Example

[From integration tests or docs]

---

## 7. FAQ

[Extract from README, issues, or common questions]

---

## 8. Troubleshooting

### Common Issues

[Extract from error handling in code, known issues, or docs]

| Issue | Cause | Solution |
|-------|-------|----------|
| [from code/error patterns] |

### Error Messages

[Extract from error constants, thrown errors in code]

---

## 9. Contributing

[Extract from CONTRIBUTING.md or development setup]

---

## 10. License

[Extract from LICENSE file or package.json]
```

## Extraction Commands

```bash
# Project metadata
cat package.json | head -20  # or pyproject.toml, Cargo.toml
cat README.md | head -50

# Environment variables
cat .env.example 2>/dev/null || echo "No .env.example found"
grep -rn "process.env\.\|os.environ\|std::env" --include="*.{ts,js,py,rs}" . | head -20

# API endpoints
grep -rn "router\.\|app\.\(get\|post\|put\|delete\)\|@app\.\|HandleFunc\|#\[get\|#\[post" --include="*.{ts,js,py,go,rs}" . | head -30

# Scripts/commands
cat package.json | jq '.scripts' 2>/dev/null

# Docker
cat docker-compose.yml 2>/dev/null | head -50
cat Dockerfile 2>/dev/null | head -30

# Features from PRDs
ls docs/prds/*.md 2>/dev/null
cat docs/prds/*.md 2>/dev/null | grep -E "^##|^- \[" | head -40
```

## Output Quality Rules

1. **No invented content** — only extract from actual code and docs
2. **Include timestamps** — "Last Updated: YYYY-MM-DD"
3. **Include Mermaid diagrams** — link to flow-visualizer output if available
4. **Test all commands** — verify installation steps actually work
5. **Include actual examples** — from tests, not made up
6. **Version-specific** — extract version from package.json/project file

## When NOT to Use

- For internal tools with no end users
- For libraries (use API docs instead)
- When user wants a README, not a full manual

## Pair With

- `flow-visualizer` — for architecture diagrams in the manual
- `db-schema-visualizer` — for data model section
- `api-design` — for API reference section
- `doc-updater` — to keep manual synchronized with code

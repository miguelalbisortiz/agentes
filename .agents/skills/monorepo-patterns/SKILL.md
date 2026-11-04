---
name: monorepo-patterns
description: Use this skill when working with monorepos. Covers Turborepo, Nx, pnpm workspaces, Lerna patterns for workspace boundaries, task orchestration, build caching, dependency management, and code sharing.
triggers: [monorepo, turborepo, nx, pnpm workspace, lerna, workspace, package, build cache, task graph]
origin: starter-pack
---

# Monorepo Patterns

Patterns for building and maintaining monorepos with Turborepo, Nx, pnpm workspaces, or Lerna.

## When to Activate

- Setting up a new monorepo
- Adding a new package to an existing monorepo
- Configuring build orchestration and caching
- Managing shared dependencies across packages
- Setting up code sharing (shared types, utilities)
- Debugging build order or dependency issues

## Tool Detection

| File | Tool |
|------|------|
| `turbo.json` | Turborepo |
| `nx.json` | Nx |
| `pnpm-workspace.yaml` | pnpm workspaces |
| `lerna.json` | Lerna |

## Turborepo Patterns

### Basic Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    },
    "lint": {
      "inputs": ["src/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Task Dependencies

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],  // Build dependencies first
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],   // Build this package first
      "inputs": ["src/**", "test/**"]
    }
  }
}
```

### Caching

```json
{
  "tasks": {
    "build": {
      "cache": true,
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json"]
    }
  }
}
```

### Remote Caching

```bash
# Vercel Remote Cache
turbo login
turbo link

# Or via env var
TURBO_TOKEN=xxx turbo run build
```

## pnpm Workspaces Patterns

### Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

### Shared Dependencies

```json
// root package.json
{
  "pnpm": {
    "overrides": {
      "react": "^18.2.0",
      "typescript": "^5.3.0"
    }
  }
}
```

### Workspace Protocol

```json
// packages/app/package.json
{
  "dependencies": {
    "@myorg/utils": "workspace:*",
    "@myorg/ui": "workspace:^"
  }
}
```

### Scripts

```json
{
  "scripts": {
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "test": "pnpm -r run test",
    "clean": "pnpm -r run clean"
  }
}
```

## Nx Patterns

### Project Configuration

```json
// nx.json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "test": {
      "inputs": ["default", "^production"]
    }
  },
  "namedInputs": {
    "production": ["default", "!{projectRoot}/**/*.spec.ts"],
    "sharedGlobals": []
  }
}
```

### Dependency Graph

```bash
nx graph                     # Interactive graph
nx graph --file=graph.json   # Export for analysis
nx affected --target=build   # Build only affected packages
```

## Workspace Boundaries

### Import Restrictions

```json
// packages/app/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@myorg/*": ["../packages/*/src"]
    }
  }
}
```

### ESLint Rules

```json
// .eslintrc.json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["../other-package/*"],
            "message": "Import from the package name, not relative path"
          }
        ]
      }
    ]
  }
}
```

## Code Sharing Patterns

### Shared Types Package

```
packages/
  types/
    package.json    # { "name": "@myorg/types" }
    src/
      index.ts      # export interface User { ... }
```

### Shared Config Package

```
packages/
  config/
    package.json    # { "name": "@myorg/config" }
    src/
      eslint.ts     # export default { ... }
      tsconfig.ts   # export default { ... }
```

### Shared Utils Package

```
packages/
  utils/
    package.json    # { "name": "@myorg/utils" }
    src/
      format.ts     # export function formatDate() { ... }
      validate.ts   # export function validateEmail() { ... }
```

## Versioning Strategies

### Fixed Version (Lerna-style)

```json
// lerna.json
{
  "version": "1.2.3",
  "npmClient": "pnpm",
  "useWorkspaces": true
}
```

### Independent Version

```json
// lerna.json
{
  "version": "independent",
  "npmClient": "pnpm",
  "useWorkspaces": true
}
```

## Anti-Patterns

1. **Circular dependencies** → Build fails or infinite loop
2. **Missing `dependsOn`** → Stale output or build failure
3. **Package not in workspace** → Orphaned, not built
4. **Relative imports** → Breaks package boundaries
5. **`private: false` on internal package** → Published accidentally
6. **No shared tsconfig** → Inconsistent TypeScript config
7. **Duplicate dependencies** → Version conflicts
8. **No `engines` field** → Incompatible Node/pnpm versions

## Related Skills

- `pipeline-patterns` — for CI/CD in monorepos
- `coding-standards` — for consistent code style
- `testing-patterns` — for test strategy across packages

## Related Agents

- `monorepo-architect` — for monorepo architecture review
- `ci-cd-reviewer` — for pipeline optimization

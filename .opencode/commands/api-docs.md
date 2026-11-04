---
description: "Generate API documentation from code. Supports OpenAPI/Swagger for REST, GraphQL schema export, and TypeScript type documentation. Use when documenting APIs, generating SDK specs, or creating API references."
agent: code-explorer
---

# API Documentation Generator

Generate comprehensive API documentation from code: $ARGUMENTS

## Usage

`/api-docs [--format openapi|graphql|markdown] [--output docs/api/] [--watch]`

- `--format`: output format (default: auto-detect from code)
- `--output`: output directory (default: `docs/api/`)
- `--watch`: watch for changes and regenerate

## Your Task

1. **Detect API framework**: Express, Fastify, NestJS, Koa, GraphQL, tRPC
2. **Extract API definitions**: Routes, schemas, types, parameters
3. **Generate documentation**: OpenAPI spec, GraphQL SDL, or Markdown
4. **Validate output**: Check for completeness and correctness
5. **Save to specified location**

## Framework Detection

### REST APIs
```bash
# Express
grep -r "app\.\(get\|post\|put\|delete\)" src/

# Fastify
grep -r "fastify\.\(get\|post\|put\|delete\)" src/

# NestJS
grep -r "@\(Get\|Post\|Put\|Delete\)" src/
```

### GraphQL
```bash
# Schema files
find . -name "*.graphql" -o -name "*.gql"

# Resolver files
grep -r "Query\|Mutation\|Subscription" src/
```

### tRPC
```bash
grep -r "router\." src/
grep -r "procedure\." src/
```

## OpenAPI Generation (REST)

### From Express/Fastify

```typescript
// Install: npm install swagger-jsdoc swagger-ui-express

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0'
    },
    servers: [
      { url: 'http://localhost:3000' }
    ]
  },
  apis: ['./src/routes/*.ts']
};

const spec = swaggerJsdoc(options);
```

### From NestJS

```typescript
// Install: npm install @nestjs/swagger

import { SwaggerModule } from '@nestjs/swagger';

const document = SwaggerModule.createDocument(app, {
  openapi: '3.0.0',
  info: {
    title: 'API',
    version: '1.0'
  }
});
SwaggerModule.setup('docs', app, document);
```

### Swagger JSDoc Comments

```typescript
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
app.get('/users', getUsers);
```

## GraphQL Schema Export

### From Code-First (NestJS)

```typescript
// Install: npm install @nestjs/graphql @nestjs/apollo

@ObjectType()
class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;
}
```

### Schema-First

```graphql
# schema.graphql
type User {
  id: ID!
  name: String!
  email: String!
}

type Query {
  users: [User!]!
  user(id: ID!): User
}

type Mutation {
  createUser(input: CreateUserInput!): User!
}
```

### Export Schema

```typescript
import { printSchema } from 'graphql';
import { buildSchema } from './schema';

const schema = buildSchema();
const sdl = printSchema(schema);
fs.writeFileSync('schema.graphql', sdl);
```

## TypeScript Type Documentation

### From Interfaces

```typescript
/**
 * User entity
 * @description Represents a user in the system
 */
interface User {
  /** Unique identifier */
  id: string;

  /** User's display name */
  name: string;

  /** User's email address */
  email: string;

  /** User's role */
  role: 'admin' | 'user' | 'guest';
}
```

### From Functions

```typescript
/**
 * Get user by ID
 * @param id - User's unique identifier
 * @returns User object or null if not found
 * @throws {ValidationError} If id is invalid
 * @example
 * const user = await getUser('123');
 */
async function getUser(id: string): Promise<User | null> {
  // ...
}
```

## Documentation Structure

```
docs/api/
├── openapi.yaml          # OpenAPI spec
├── graphql/
│   ├── schema.graphql    # GraphQL SDL
│   └── schema.json       # Schema introspection
├── types/
│   └── index.d.ts        # TypeScript types
├── examples/
│   └── requests.md       # Example requests
└── README.md             # API overview
```

## Anti-Patterns

1. **Missing examples** → Developers don't know how to use API
2. **Stale documentation** → Docs don't match code
3. **Missing error codes** → Clients can't handle errors properly
4. **No versioning** → Breaking changes without migration guide
5. **Missing rate limits** → Clients don't know limits

## Arguments

$ARGUMENTS:
- optional output format
- optional output directory
- optional watch mode

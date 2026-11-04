---
name: microservices-patterns
description: Use this skill when designing microservices architectures. Covers circuit breaker, service mesh, gRPC, saga patterns, CQRS, event sourcing, and distributed system patterns.
triggers: [microservices, circuit breaker, service mesh, gRPC, saga, CQRS, event sourcing, distributed systems]
origin: starter-pack
---

# Microservices Patterns

Patterns for designing and implementing microservices architectures.

## When to Activate

- Designing microservices communication
- Implementing circuit breakers
- Setting up service mesh
- Implementing saga patterns
- Designing CQRS/Event Sourcing
- Configuring gRPC services

## Communication Patterns

### Synchronous (REST/gRPC)

```typescript
// REST client with circuit breaker
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(fetchUser, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

breaker.on('open', () => console.log('Circuit OPEN'));
breaker.on('halfOpen', () => console.log('Circuit HALF-OPEN'));
breaker.on('close', () => console.log('Circuit CLOSED'));

async function fetchUser(userId: string) {
  const response = await fetch(`http://user-service/users/${userId}`);
  if (!response.ok) throw new Error('Failed');
  return response.json();
}

// Usage
const user = await breaker.fire(userId);
```

### Asynchronous (Message Queue)

```typescript
// Event-driven communication
import { Kafka } from 'kafkajs';

const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();

async function publishEvent(topic: string, event: object) {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(event) }]
  });
}

// Usage
await publishEvent('user.created', { userId, email, name });
```

## Circuit Breaker

### State Machine

```typescript
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 30000,
    private successThreshold: number = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN && this.successCount >= this.successThreshold) {
      this.state = CircuitState.CLOSED;
      this.successCount = 0;
    }
  }

  private onFailure() {
    this.failureCount++;
    this.successCount = 0;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
}
```

## Saga Patterns

### Choreography-Based Saga

```typescript
// Each service publishes events and listens for events
class OrderSaga {
  async handleOrderCreated(event: OrderCreatedEvent) {
    // Step 1: Reserve inventory
    await publishEvent('inventory.reserve', {
      orderId: event.orderId,
      items: event.items
    });
  }

  async handleInventoryReserved(event: InventoryReservedEvent) {
    // Step 2: Process payment
    await publishEvent('payment.process', {
      orderId: event.orderId,
      amount: event.amount
    });
  }

  async handlePaymentProcessed(event: PaymentProcessedEvent) {
    // Step 3: Confirm order
    await publishEvent('order.confirmed', {
      orderId: event.orderId
    });
  }

  async handlePaymentFailed(event: PaymentFailedEvent) {
    // Compensation: Release inventory
    await publishEvent('inventory.release', {
      orderId: event.orderId
    });
  }
}
```

### Orchestration-Based Saga

```typescript
class OrderOrchestrator {
  private steps = [
    { name: 'reserveInventory', compensate: 'releaseInventory' },
    { name: 'processPayment', compensate: 'refundPayment' },
    { name: 'confirmOrder', compensate: 'cancelOrder' }
  ];

  async execute(order: Order) {
    const completedSteps: string[] = [];

    try {
      for (const step of this.steps) {
        await this.executeStep(step.name, order);
        completedSteps.push(step.name);
      }
    } catch (error) {
      // Compensate in reverse order
      for (const stepName of completedSteps.reverse()) {
        const step = this.steps.find(s => s.name === stepName);
        if (step?.compensate) {
          await this.executeStep(step.compensate, order);
        }
      }
      throw error;
    }
  }

  private async executeStep(stepName: string, order: Order) {
    switch (stepName) {
      case 'reserveInventory':
        await inventoryService.reserve(order);
        break;
      case 'releaseInventory':
        await inventoryService.release(order);
        break;
      case 'processPayment':
        await paymentService.process(order);
        break;
      case 'refundPayment':
        await paymentService.refund(order);
        break;
      case 'confirmOrder':
        await orderService.confirm(order);
        break;
      case 'cancelOrder':
        await orderService.cancel(order);
        break;
    }
  }
}
```

## CQRS (Command Query Responsibility Segregation)

### Separate Read/Write Models

```typescript
// Command side (write)
class OrderCommandHandler {
  async createOrder(command: CreateOrderCommand) {
    const order = new Order(command.items, command.userId);
    await this.repository.save(order);
    await this.eventBus.publish(new OrderCreatedEvent(order));
  }
}

// Query side (read)
class OrderQueryHandler {
  async getOrder(orderId: string): Promise<OrderView> {
    // Optimized for reads
    return this.readModel.findById(orderId);
  }

  async getUserOrders(userId: string): Promise<OrderView[]> {
    return this.readModel.findByUserId(userId);
  }
}
```

### Event Store

```typescript
class EventStore {
  private events: Event[] = [];

  async append(event: Event): Promise<void> {
    this.events.push(event);
    await this.project(event);
  }

  async getEvents(aggregateId: string): Promise<Event[]> {
    return this.events.filter(e => e.aggregateId === aggregateId);
  }

  private async project(event: Event): Promise<void> {
    // Update read models
    switch (event.type) {
      case 'OrderCreated':
        await this.orderReadModel.create(event.data);
        break;
      case 'OrderConfirmed':
        await this.orderReadModel.confirm(event.data);
        break;
    }
  }
}
```

## gRPC Patterns

### Service Definition

```protobuf
// user.proto
syntax = "proto3";

package user;

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc ListUsers (ListUsersRequest) returns (stream User);
  rpc CreateUser (CreateUserRequest) returns (User);
}

message GetUserRequest {
  string id = 1;
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
}
```

### Server Implementation

```typescript
import { Server, ServerCredentials } from '@grpc/grpc-js';

const server = new Server();

server.addService(UserService.service, {
  async getUser(call, callback) {
    const user = await findUser(call.request.id);
    callback(null, user);
  },

  async listUsers(call) {
    const users = await findAllUsers();
    for (const user of users) {
      call.write(user);
    }
    call.end();
  }
});

server.bindAsync(
  '0.0.0.0:50051',
  ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) throw err;
    console.log(`Server running on port ${port}`);
  }
);
```

## Service Mesh (Istio/Linkerd)

### Traffic Management

```yaml
# VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: user-service
spec:
  hosts:
    - user-service
  http:
    - route:
        - destination:
            host: user-service
            subset: v1
          weight: 90
        - destination:
            host: user-service
            subset: v2
          weight: 10
```

### Circuit Breaking

```yaml
# DestinationRule
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: user-service
spec:
  host: user-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
```

## Anti-Patterns

1. **Distributed monolith** → Services too coupled
2. **No circuit breaker** → Cascading failures
3. **Shared database** → Data coupling
4. **Synchronous everything** → Performance bottleneck
5. **No idempotency** → Duplicate processing
6. **Missing observability** → Blind to issues

## Related Skills

- `message-queue-patterns` — for async communication
- `event-driven-architect` — for event patterns
- `caching-patterns` — for distributed caching
- `observability` — for distributed tracing

## Related Agents

- `event-driven-architect` — for event-driven review
- `k8s-reviewer` — for Kubernetes deployment
- `security-reviewer` — for service security

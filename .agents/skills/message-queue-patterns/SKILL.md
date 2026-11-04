---
name: message-queue-patterns
description: Use this skill when implementing message queues, event-driven architectures, or async processing. Covers RabbitMQ, Kafka, Redis Streams, BullMQ, SQS patterns for producers, consumers, dead letter queues, and idempotency.
triggers: [message queue, event driven, rabbitmq, kafka, redis streams, bullmq, sqs, async, worker, consumer, producer]
origin: starter-pack
---

# Message Queue & Event-Driven Patterns

Patterns for reliable message processing, event-driven architectures, and async communication.

## When to Activate

- Setting up a new message queue (RabbitMQ, Kafka, Redis)
- Implementing event producers or consumers
- Designing saga patterns or distributed transactions
- Adding dead letter queues or retry policies
- Implementing idempotent message processing
- Debugging message ordering or delivery issues

## Queue Technology Selection

| Technology | Use Case | Throughput | Ordering |
|------------|----------|------------|----------|
| RabbitMQ | Traditional queues, routing | 50K msg/s | Per-queue |
| Kafka | Event streaming, audit logs | 1M+ msg/s | Per-partition |
| Redis Streams | Lightweight streaming | 100K msg/s | Per-stream |
| BullMQ | Job queues in Node.js | 10K jobs/s | Per-queue |
| SQS | AWS managed, simple | 3K msg/s | Best-effort |

## RabbitMQ Patterns

### Connection & Channel

```typescript
import amqp from 'amqplib';

const connection = await amqp.connect(process.env.RABBITMQ_URL);
const channel = await connection.createChannel();

// Handle connection errors
connection.on('error', (err) => {
  console.error('RabbitMQ connection error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await channel.close();
  await connection.close();
});
```

### Reliable Producer

```typescript
async function publishMessage(
  queue: string,
  message: object,
  options?: { persistent?: boolean; priority?: number }
): Promise<boolean> {
  await channel.assertQueue(queue, {
    durable: true,  // Survive broker restart
    arguments: {
      'x-message-ttl': 86400000,  // 24h TTL
      'x-dead-letter-exchange': 'dlx'
    }
  });

  const msg = Buffer.from(JSON.stringify({
    id: uuid(),
    timestamp: Date.now(),
    data: message
  }));

  return channel.sendToQueue(queue, msg, {
    persistent: options?.persistent ?? true,
    priority: options?.priority,
    messageId: uuid()
  });
}
```

### Reliable Consumer

```typescript
async function consumeMessages(queue: string, handler: Function) {
  await channel.assertQueue(queue, { durable: true });
  await channel.prefetch(10);  // Process 10 at a time

  channel.consume(queue, async (msg) => {
    if (!msg) return;

    const messageId = msg.properties.messageId;
    const isDuplicate = await checkIdempotency(messageId);
    if (isDuplicate) {
      channel.ack(msg);  // Skip duplicate
      return;
    }

    try {
      const content = JSON.parse(msg.content.toString());
      await handler(content);
      await recordIdempotency(messageId);
      channel.ack(msg);  // Ack after success
    } catch (error) {
      // Negative ack, requeue with delay
      channel.nack(msg, false, false);  // Don't requeue, send to DLQ
    }
  });
}
```

### Dead Letter Queue

```typescript
// Main queue with DLQ binding
await channel.assertQueue('orders', {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': 'dlx',
    'x-dead-letter-routing-key': 'orders.dlq'
  }
});

// DLQ queue
await channel.assertQueue('orders.dlq', { durable: true });

// Monitor DLQ
channel.consume('orders.dlq', (msg) => {
  console.error('Dead letter:', msg.content.toString());
  // Alert or reprocess
});
```

## Kafka Patterns

### Producer

```typescript
import { Kafka, CompressionTypes } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092']
});

const producer = kafka.producer({
  allowAutoTopicCreation: false,
  transactionTimeout: 30000
});

await producer.send({
  topic: 'orders',
  compression: CompressionTypes.GZIP,
  messages: [
    {
      key: orderId,  // Partition by order ID
      value: JSON.stringify(orderData),
      headers: {
        'correlation-id': correlationId,
        'content-type': 'application/json'
      }
    }
  ]
});
```

### Consumer Group

```typescript
const consumer = kafka.consumer({
  groupId: 'order-processing-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

await consumer.subscribe({ topic: 'orders', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const data = JSON.parse(message.value.toString());
    const messageId = message.headers['correlation-id'];

    const isDuplicate = await checkIdempotency(messageId);
    if (isDuplicate) return;

    await processOrder(data);
    await recordIdempotency(messageId);
  }
});
```

### Schema Registry

```typescript
// Avro schema for orders
const schema = {
  type: 'record',
  name: 'Order',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'total', type: 'double' },
    { name: 'status', type: { type: 'enum', symbols: ['pending', 'shipped', 'delivered'] } }
  ]
};
```

## BullMQ Patterns (Node.js)

### Basic Job Queue

```typescript
import { Queue, Worker } from 'bullmq';

const emailQueue = new Queue('emails', {
  connection: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  }
});

const emailWorker = new Worker('emails', async (job) => {
  await sendEmail(job.data);
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 5,  // Process 5 jobs concurrently
  limiter: { max: 100, duration: 60000 }  // Rate limit: 100/min
});
```

### Scheduled Jobs

```typescript
// Delayed job
await emailQueue.add('welcome', { userId: '123' }, {
  delay: 5000  // 5 seconds
});

// Recurring job
await emailQueue.add('cleanup', {}, {
  repeat: { cron: '0 2 * * *' }  // Daily at 2am
});
```

### Job Flow

```typescript
const flow = new FlowProducer();
await flow.add({
  name: 'process-order',
  data: { orderId: '123' },
  children: [
    { name: 'charge-payment', data: { amount: 100 } },
    { name: 'send-email', data: { template: 'order-confirmation' } },
    { name: 'update-inventory', data: { items: [...] } }
  ]
});
```

## Idempotency Patterns

### Database-Based Deduplication

```typescript
async function processMessage(message: Message): Promise<boolean> {
  const { id: messageId, data } = message;

  return db.transaction(async (tx) => {
    // Check if already processed
    const existing = await tx.query(
      'SELECT 1 FROM processed_messages WHERE id = $1',
      [messageId]
    );
    if (existing) return false;  // Skip duplicate

    // Process
    await processOrder(data);

    // Record as processed
    await tx.query(
      'INSERT INTO processed_messages (id, processed_at) VALUES ($1, NOW())',
      [messageId]
    );

    return true;
  });
}
```

### Redis-Based Deduplication

```typescript
async function processMessage(message: Message): Promise<boolean> {
  const dedupKey = `processed:${message.id}`;
  const lockKey = `lock:${message.id}`;

  // Atomic check-and-set
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 60);
  if (!acquired) return false;  // Another worker processing

  const isDuplicate = await redis.exists(dedupKey);
  if (isDuplicate) {
    await redis.del(lockKey);
    return false;
  }

  try {
    await processOrder(message.data);
    await redis.set(dedupKey, '1', 'EX', 86400);  // 24h TTL
    return true;
  } finally {
    await redis.del(lockKey);
  }
}
```

## Dead Letter Queues

### DLQ with Reprocessing

```typescript
// Monitor DLQ
async function monitorDLQ(queueName: string) {
  const dlqName = `${queueName}.dlq`;

  setInterval(async () => {
    const messageCount = await getQueueSize(dlqName);
    if (messageCount > 0) {
      alertOps(`DLQ ${dlqName} has ${messageCount} messages`);

      // Optional: reprocess after delay
      if (messageCount > 100) {
        await reprocessDLQ(dlqName);
      }
    }
  }, 60000);  // Check every minute
}
```

## Anti-Patterns

1. **No DLQ** → Lost messages on failure
2. **Auto-ack** → Messages lost on crash
3. **No idempotency** → Duplicate processing
4. **Tight retry loop** → Resource exhaustion
5. **Missing partition key** → Message ordering violated
6. **No metrics** → Blind to queue health
7. **Hardcoded queue names** → Configuration hell
8. **No prefetch** → Consumer bottleneck

## Related Skills

- `caching-patterns` — for Redis patterns
- `observability` — for metrics and tracing
- `api-design` — for synchronous alternatives

## Related Agents

- `event-driven-architect` — for event-driven review
- `database-reviewer` — for outbox pattern

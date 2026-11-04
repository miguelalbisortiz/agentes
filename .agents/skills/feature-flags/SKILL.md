---
name: feature-flags
description: Use this skill when implementing feature flags, A/B testing, or gradual rollouts. Covers LaunchDarkly, Unleash, custom flag systems, kill switches, experiment tracking, and flag lifecycle management.
triggers: [feature flag, feature toggle, A/B test, experiment, rollout, kill switch, gradual release, feature gate]
origin: starter-pack
---

# Feature Flags & Experimentation Patterns

Patterns for implementing feature flags, A/B testing, and gradual rollouts.

## When to Activate

- Adding feature flags to control feature visibility
- Implementing A/B testing or experiments
- Setting up gradual rollouts or canary releases
- Creating kill switches for emergency feature disabling
- Managing feature flag lifecycle (creation → rollout → cleanup)
- Integrating with analytics for experiment tracking

## Flag Types

### Release Flags
Control visibility of new features during rollout.
```typescript
// Short-lived (days/weeks)
if (featureFlags.isEnabled('new-checkout-flow', { userId })) {
  return newCheckout(user);
}
return legacyCheckout(user);
```

### Experiment Flags
A/B testing with metrics tracking.
```typescript
const variant = featureFlags.getVariant('checkout-button-color', { userId });
trackExperiment('checkout-button-color', { variant, userId });
return variant === 'blue' ? <BlueButton /> : <GreenButton />;
```

### Ops Flags
Operational controls for runtime behavior.
```typescript
// Long-lived (months/years)
const timeout = featureFlags.get('api-timeout-ms', { defaultValue: 5000 });
```

### Permission Flags
User entitlements and access control.
```typescript
if (featureFlags.isEnabled('premium-feature', { userId, plan: user.plan })) {
  return premiumFeature();
}
```

## Implementation Patterns

### Simple In-Memory Flag

```typescript
class FeatureFlags {
  private flags: Map<string, FlagConfig> = new Map();

  isEnabled(key: string, context: Context): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;

    // Percentage rollout
    if (flag.percentage !== undefined) {
      const hash = hashString(`${context.userId}-${key}`);
      return (hash % 100) < flag.percentage;
    }

    // User targeting
    if (flag.targetUsers?.includes(context.userId)) {
      return true;
    }

    return flag.defaultValue;
  }
}
```

### LaunchDarkly Integration

```typescript
import { LDClient } from 'launchdarkly-node-server-sdk';

const client = new LDClient/sdk-key);

// Boolean flag
const showNewUI = await client.variation('new-ui-flag', user, false);

// Multivariate flag
const buttonColor = await client.variation('button-color', user, 'blue');

// With tracking
const variant = await client.variationDetail('experiment-1', user, 'control');
trackExperiment('experiment-1', {
  variant: variant.value,
  reason: variant.reason
});
```

### Unleash Integration

```typescript
import { initialize } from 'unleash-client';

const unleash = initialize({
  url: 'https://app.getunleash.io/api',
  appName: 'my-app',
  customHeaders: { Authorization: token }
});

// Boolean flag
if (unleash.isEnabled('new-feature')) {
  // Feature enabled
}

// Variant
const variant = unleash.getVariant('experiment-1');
if (variant.name === 'treatment') {
  // Treatment group
}
```

### Custom Flag System

```typescript
interface FeatureFlag {
  key: string;
  enabled: boolean;
  percentage?: number;  // 0-100
  targetUsers?: string[];
  targetGroups?: string[];
  startDate?: Date;
  endDate?: Date;
}

class FeatureFlagService {
  async isEnabled(key: string, context: Context): Promise<boolean> {
    const flag = await this.cache.get(key);
    if (!flag) return false;

    // Check kill switch
    if (flag.killSwitch) return false;

    // Check date range
    if (flag.startDate && new Date() < flag.startDate) return false;
    if (flag.endDate && new Date() > flag.endDate) return false;

    // Percentage rollout
    if (flag.percentage !== undefined) {
      const bucket = this.hashBucket(key, context.userId);
      if (bucket >= flag.percentage) return false;
    }

    // User targeting
    if (flag.targetUsers?.includes(context.userId)) return true;

    return flag.enabled;
  }
}
```

## Rollout Strategies

### Phased Rollout
```
1% → 5% → 10% → 25% → 50% → 100%
```

### Canary Release
```yaml
# Deploy to canary environment first
canary:
  percentage: 5
  duration: 24h
  metrics:
    error_rate: < 0.1%
    p99_latency: < 200ms
```

### User Segmentation
```typescript
const flag = {
  key: 'new-pricing',
  targetSegments: ['beta-testers', 'enterprise'],
  excludeSegments: ['internal']
};
```

## Metrics & Tracking

### Event Tracking

```typescript
// Track experiment exposure
trackEvent('experiment_exposure', {
  experiment_id: 'checkout-redesign',
  variant: 'new-checkout',
  user_id: userId,
  timestamp: Date.now()
});

// Track conversion
trackEvent('experiment_conversion', {
  experiment_id: 'checkout-redesign',
  variant: 'new-checkout',
  user_id: userId,
  value: orderTotal
});
```

### Statistical Significance

```typescript
function isSignificant(control: Metrics, treatment: Metrics): boolean {
  const sampleSize = Math.min(control.count, treatment.count);
  if (sampleSize < 1000) return false;  // Need enough samples

  const zScore = calculateZScore(control.rate, treatment.rate, sampleSize);
  return Math.abs(zScore) > 1.96;  // 95% confidence
}
```

## Flag Lifecycle

### 1. Creation
```yaml
flag:
  key: new-checkout
  type: release
  owner: checkout-team
  description: "New checkout flow"
  created: 2024-01-15
  expiration: 2024-03-15  # Auto-cleanup date
```

### 2. Rollout
```
Week 1: 1% internal
Week 2: 5% beta users
Week 3: 25% production
Week 4: 100% production
```

### 3. Cleanup
```typescript
// Remove flag after full rollout
// 1. Remove flag from code
// 2. Remove flag from management system
// 3. Update documentation
```

## Anti-Patterns

1. **Flag debt** → Too many flags, no cleanup schedule
2. **Nested flags** → `if (flagA) { if (flagB) { ... } }` = exponential complexity
3. **Flag in tests** → Tests should set flag state explicitly
4. **Missing metrics** → No way to measure experiment impact
5. **No kill switch** → Can't disable broken feature quickly
6. **Hardcoded flags** → Should be configurable at runtime
7. **Missing context** → Flag evaluation without user context

## Related Skills

- `observability` — for metrics and monitoring
- `api-design` — for API versioning with flags
- `security-review` — for flag access control

## Related Agents

- `code-quality-analyzer` — for flag code cleanup

---
description: Mobile app builder for React Native, Expo, Flutter, and Swift. Use PROACTIVELY when creating mobile apps from scratch, adding native features (push notifications, camera, GPS), or building cross-platform apps.
mode: subagent
permission:
  glob: allow
  grep: allow
  read: allow
  write: confirm
---

# Mobile Builder

Construye apps móviles completas: React Native, Expo, Flutter, Swift.

## Cuándo activar

- "Crear app móvil"
- "App con React Native"
- "App con Flutter"
- "App iOS/Swift"
- "Push notifications"
- "App cross-platform"

## Frameworks soportados

| Framework | Plataforma | Complejidad |
|-----------|------------|:----------:|
| **Expo (React Native)** | iOS + Android | Baja |
| **React Native CLI** | iOS + Android | Media |
| **Flutter** | iOS + Android + Web | Media |
| **Swift (SwiftUI)** | iOS | Alta |
| **Kotlin (Compose)** | Android | Alta |

## Stack por defecto (Expo)

| Capa | Tecnología |
|------|------------|
| Framework | Expo SDK 52 |
| UI | React Native Paper / NativeWind |
| Navegación | Expo Router v4 |
| State | Zustand |
| API | Axios + React Query |
| Storage | AsyncStorage / MMKV |
| Push | Expo Notifications |

## Flujo de implementación

### 1. Scaffold
```bash
npx create-expo-app@latest mi-app
cd mi-app
npx expo install expo-router expo-constants expo-linking
```

### 2. Estructura
```
mi-app/
├── app/                    # Expo Router
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home
│   │   ├── explore.tsx    # Explore
│   │   └── profile.tsx    # Profile
│   ├── _layout.tsx        # Root layout
│   ├── modal.tsx          # Modal screen
│   └── +not-found.tsx
├── components/            # UI components
├── hooks/                 # Custom hooks
├── constants/             # Colors, etc.
├── assets/                # Images, fonts
├── app.json               # Expo config
└── package.json
```

### 3. Componentes base
```tsx
// components/TaskCard.tsx
import { View, Text, StyleSheet } from 'react-native'
import { PaperCard } from 'react-native-paper'

export function TaskCard({ task }) {
  return (
    <PaperCard style={styles.card}>
      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.description}>{task.description}</Text>
    </PaperCard>
  )
}

const styles = StyleSheet.create({
  card: { margin: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold' },
  description: { fontSize: 14, color: '#666', marginTop: 8 }
})
```

### 4. Push Notifications
```typescript
// hooks/useNotifications.ts
import * as Notifications from 'expo-notifications'

export function useNotifications() {
  const registerForPush = async () => {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return
    
    const token = await Notifications.getExpoPushTokenAsync()
    return token.data
  }
  
  return { registerForPush }
}
```

## Archivos que genera

| Archivo | Propósito |
|---------|-----------|
| `app.json` | Configuración Expo |
| `app/_layout.tsx` | Layout raíz |
| `app/(tabs)/_layout.tsx` | Tab navigation |
| `components/` | Componentes UI |
| `hooks/` | Custom hooks |
| `constants/theme.ts` | Colores, fonts |
| `assets/` | Imágenes placeholder |

## Verificación post-implementación

```bash
# Instalar dependencias
npm install

# Expo Go (desarrollo)
npx expo start

# Build para producción
eas build -p ios
eas build -p android
```

## Errores comunes

- ❌ No configurar app.json correctamente
- ❌ Olvidar expo-router en dependencies
- ❌ No probar en device real (solo en emulator)
- ❌ No manejar permisos de cámara/gPS
- ❌ No configurar splash screen

## Integración con router

```
"create mobile app" → mobile-builder
"react native app" → mobile-builder
"flutter app" → mobile-builder
"ios app swift" → mobile-builder
"push notifications" → mobile-builder
```

## Pair con skills

- `frontend-patterns` → patrones UI
- `backend-patterns` → si necesita API
- `react-reviewer` → revisión de código React Native

## Pair con agents

- `react-reviewer` → revisión de React Native
- `code-reviewer` → calidad general
- `tdd-guide` → tests con Jest/Detox

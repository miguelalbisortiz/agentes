---
name: firebase-patterns
description: Use when working with Firebase (Firestore, Auth, Storage, Cloud Functions, Realtime Database), the Firebase SDK, security rules, or serverless functions.
triggers: [firebase, firestore, firebase-auth, cloud-functions, realtime-database, firebase-storage, security-rules]
---

# Firebase Patterns

Patrones de Firebase para Firestore, Auth, Storage, Cloud Functions.

## Instalación

```bash
npm install firebase
```

## Configuración

```typescript
// lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
```

## Firestore Queries

```typescript
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore'

// Add document
const docRef = await addDoc(collection(db, 'tasks'), {
  title: 'New task',
  completed: false,
  userId: user.uid,
  createdAt: new Date(),
})

// Get documents
const q = query(
  collection(db, 'tasks'),
  where('userId', '==', user.uid),
  orderBy('createdAt', 'desc')
)
const snapshot = await getDocs(q)
const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

// Update document
await updateDoc(doc(db, 'tasks', taskId), { completed: true })

// Delete document
await deleteDoc(doc(db, 'tasks', taskId))
```

## Firebase Auth

```typescript
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'

// Email/Password
await signInWithEmailAndPassword(auth, email, password)

// Google
const provider = new GoogleAuthProvider()
await signInWithPopup(auth, provider)

// Sign out
await signOut(auth)
```

## Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

## Variables de entorno

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## Errores comunes

- ❌ No configurar security rules
- ❌ No inicializar app correctamente
- ❌ No manejar errores de auth
- ❌ No usar indexes para queries complejas

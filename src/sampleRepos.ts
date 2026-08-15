import { Notebook, RepoSource, SourceFile, FileChunk } from './types';

// Helper to chunk text with line numbers
export function createChunksFromFile(file: SourceFile): FileChunk[] {
  const lines = file.content.split('\n');
  const chunks: FileChunk[] = [];
  const chunkSize = file.fileCategory === 'doc' ? 40 : 35;
  const overlap = 5;

  let currentLine = 1;
  while (currentLine <= lines.length) {
    const endLine = Math.min(currentLine + chunkSize - 1, lines.length);
    const chunkLines = lines.slice(currentLine - 1, endLine);
    const chunkContent = chunkLines.join('\n');

    let chunkType: FileChunk['chunkType'] = 'general';
    let symbolName: string | undefined = undefined;

    if (file.fileCategory === 'doc') {
      chunkType = 'doc_section';
      const headingMatch = chunkContent.match(/^#+\s+(.+)$/m);
      if (headingMatch) symbolName = headingMatch[1].trim();
    } else if (file.fileCategory === 'code') {
      const funcMatch = chunkContent.match(/(?:function|class|const|let|def|fn)\s+([A-Za-z0-9_$]+)/);
      if (funcMatch) {
        chunkType = funcMatch[0].includes('class') ? 'class' : 'function';
        symbolName = funcMatch[1];
      } else {
        chunkType = 'module';
      }
    } else if (file.fileCategory === 'config') {
      chunkType = 'config';
    }

    chunks.push({
      id: `${file.id}-chunk-${currentLine}-${endLine}`,
      fileId: file.id,
      filePath: file.path,
      startLine: currentLine,
      endLine: endLine,
      chunkType,
      content: chunkContent,
      language: file.language,
      fileCategory: file.fileCategory,
      symbolName,
    });

    if (endLine >= lines.length) break;
    currentLine += chunkSize - overlap;
  }

  return chunks;
}

// Sample 1: zustand (Small, clean, modern state management)
const zustandFiles: SourceFile[] = [
  {
    id: 'f-readme',
    path: 'README.md',
    language: 'markdown',
    fileCategory: 'doc',
    size: 2450,
    lineCount: 88,
    content: `# Zustand

> Bear necessities for state management in React

A small, fast, and scalable bearbones state-management solution using simplified flux principles. Has a comfy API based on hooks, isn't boilerplatey or opinionated.

Don't disregard it because it's cute. It has quite the claws, lots of time was spent to deal with common pitfalls, like the dreaded zombie child problem, React concurrency, and context loss between mixed renderers. It may be the one state-manager in the React space that gets all of these right.

## Installation

\`\`\`bash
npm install zustand
\`\`\`

## First create a store

Your store is a hook! You can put anything in it: primitives, objects, functions. State has to be updated immutably and the \`set\` function merges state to help it.

\`\`\`tsx
import { create } from 'zustand'

interface BearState {
  bears: number
  increasePopulation: () => void
  removeAllBears: () => void
}

const useBearStore = create<BearState>((set) => ({
  bears: 0,
  increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
  removeAllBears: () => set({ bears: 0 }),
}))
\`\`\`

## Then bind your components, and that's it!

\`\`\`tsx
function BearCounter() {
  const bears = useBearStore((state) => state.bears)
  return <h1>{bears} around here ...</h1>
}

function Controls() {
  const increasePopulation = useBearStore((state) => state.increasePopulation)
  return <button onClick={increasePopulation}>one up</button>
}
\`\`\`

## Why Zustand over Redux?

- Simple and un-opinionated
- Makes hooks the primary means of consuming state
- Doesn't wrap your app in context providers
- Can inform components transiently (without causing render)
- Less boilerplate than Context or Redux
- First-class TypeScript support
`
  },
  {
    id: 'f-vanilla',
    path: 'src/vanilla.ts',
    language: 'typescript',
    fileCategory: 'code',
    size: 3100,
    lineCount: 110,
    content: `type SetStateInternal<T> = {
  _(
    partial: T | Partial<T> | { _(state: T): T | Partial<T> }['_'],
    replace?: boolean | undefined,
  ): void
}['_']

export interface StoreApi<T> {
  setState: SetStateInternal<T>
  getState: () => T
  getInitialState: () => T
  subscribe: (listener: (state: T, prevState: T) => void) => () => void
}

export type StateCreator<
  T,
  Mis extends [StoreMutatorIdentifier, unknown][] = [],
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
  U = T,
> = ((
  setState: Get<Mutate<StoreApi<T>, Mis>, 'setState', undefined>,
  getState: Get<Mutate<StoreApi<T>, Mis>, 'getState', undefined>,
  store: Mutate<StoreApi<T>, Mis>,
) => U) & { $$types?: { mis: Mis; mos: Mos } }

type CreateVanillaStore = <T>(
  createState: StateCreator<T, [], []>,
) => StoreApi<T>

export const createStore: CreateVanillaStore = (createState) => {
  type TState = ReturnType<typeof createState>
  type Listener = (state: TState, prevState: TState) => void
  let state: TState
  const listeners: Set<Listener> = new Set()

  const setState: StoreApi<TState>['setState'] = (partial, replace) => {
    const nextState =
      typeof partial === 'function'
        ? (partial as (state: TState) => TState)(state)
        : partial
    if (!Object.is(nextState, state)) {
      const previousState = state
      state =
        (replace ?? (typeof nextState !== 'object' || nextState === null))
          ? (nextState as TState)
          : Object.assign({}, state, nextState)
      listeners.forEach((listener) => listener(state, previousState))
    }
  }

  const getState: StoreApi<TState>['getState'] = () => state
  const getInitialState: StoreApi<TState>['getInitialState'] = () => initialState

  const subscribe: StoreApi<TState>['subscribe'] = (listener) => {
    listeners.add(listener)
    // Unsubscribe
    return () => listeners.delete(listener)
  }

  const api = { setState, getState, getInitialState, subscribe }
  const initialState = (state = createState(setState, getState, api))
  return api as any
}
`
  },
  {
    id: 'f-react',
    path: 'src/react.ts',
    language: 'typescript',
    fileCategory: 'code',
    size: 2600,
    lineCount: 95,
    content: `import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector'
import { createStore } from './vanilla'
import type { StateCreator, StoreApi } from './vanilla'

type ExtractState<S> = S extends { getState: () => infer T } ? T : never

export interface UseBoundStore<S extends StoreApi<unknown>> {
  (): ExtractState<S>
  <U>(
    selector: (state: ExtractState<S>) => U,
    equals?: (a: U, b: U) => boolean,
  ): U
  setState: S['setState']
  getState: S['getState']
  subscribe: S['subscribe']
}

export function useStore<TState, StateSlice>(
  api: StoreApi<TState>,
  selector: (state: TState) => StateSlice = api.getState as any,
  equalityFn?: (a: StateSlice, b: StateSlice) => boolean,
): StateSlice {
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getInitialState,
    selector,
    equalityFn,
  )
  return slice
}

export const create = (<T>(createState: StateCreator<T, [], []> | undefined) =>
  createState ? createImpl(createState) : createImpl) as Create

const createImpl = <T>(createState: StateCreator<T, [], []>) => {
  const api = typeof createState === 'function' ? createStore(createState) : createState

  const useBoundStore: any = (selector?: any, equalityFn?: any) =>
    useStore(api, selector, equalityFn)

  Object.assign(useBoundStore, api)

  return useBoundStore
}
`
  },
  {
    id: 'f-middleware-persist',
    path: 'src/middleware/persist.ts',
    language: 'typescript',
    fileCategory: 'code',
    size: 3200,
    lineCount: 120,
    content: `import type { StateCreator, StoreMutatorIdentifier } from '../vanilla'

export interface PersistStorage<S> {
  getItem: (name: string) => StorageValue<S> | Promise<StorageValue<S> | null> | null
  setItem: (name: string, value: StorageValue<S>) => void | Promise<void>
  removeItem: (name: string) => void | Promise<void>
}

export interface PersistOptions<S, PersistedState = S> {
  name: string
  storage?: PersistStorage<PersistedState>
  partialize?: (state: S) => PersistedState
  version?: number
  migrate?: (persistedState: unknown, version: number) => S | Promise<S>
  onRehydrateStorage?: (state: S) => ((state?: S, error?: unknown) => void) | void
}

export type StorageValue<S> = {
  state: S
  version?: number
}

export const persist =
  <T, Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
    config: StateCreator<T, Mps, Mcs>,
    options: PersistOptions<T>,
  ): StateCreator<T, Mps, [['zustand/persist', unknown], ...Mcs]> =>
  (set, get, api) => {
    let hasHydrated = false
    const storage = options.storage ?? createJSONStorage(() => localStorage)
    
    // Core persistence middleware lifecycle handler
    const setAndPersist = (...args: Parameters<typeof set>) => {
      set(...args)
      const stateToPersist = options.partialize ? options.partialize(get()) : get()
      storage.setItem(options.name, { state: stateToPersist, version: options.version })
    }

    return config(setAndPersist as any, get, api)
  }

export function createJSONStorage<S>(getStorage: () => Storage): PersistStorage<S> {
  return {
    getItem: (name) => {
      const str = getStorage().getItem(name)
      if (!str) return null
      return JSON.parse(str)
    },
    setItem: (name, value) => {
      getStorage().setItem(name, JSON.stringify(value))
    },
    removeItem: (name) => {
      getStorage().removeItem(name)
    },
  }
}
`
  },
  {
    id: 'f-pkg',
    path: 'package.json',
    language: 'json',
    fileCategory: 'config',
    size: 1400,
    lineCount: 45,
    content: `{
  "name": "zustand",
  "version": "5.0.3",
  "description": "Bear necessities for state management in React",
  "main": "./index.js",
  "module": "./esm/index.js",
  "types": "./index.d.ts",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/pmndrs/zustand.git"
  },
  "peerDependencies": {
    "@types/react": ">=18.0.0",
    "react": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "@types/react": { "optional": true },
    "react": { "optional": true }
  },
  "dependencies": {
    "use-sync-external-store": "^1.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^1.2.2"
  },
  "scripts": {
    "test": "vitest run",
    "build": "tsup src/index.ts src/vanilla.ts src/react.ts src/middleware.ts"
  }
}`
  },
  {
    id: 'f-test-basic',
    path: 'tests/basic.test.ts',
    language: 'typescript',
    fileCategory: 'test',
    size: 2100,
    lineCount: 75,
    content: `import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/vanilla'

describe('vanilla createStore', () => {
  it('creates a store with initial state', () => {
    const store = createStore(() => ({ count: 0 }))
    expect(store.getState()).toEqual({ count: 0 })
  })

  it('updates state via setState partial', () => {
    const store = createStore<{ count: number; name: string }>((set) => ({
      count: 0,
      name: 'bear',
    }))
    store.setState({ count: 1 })
    expect(store.getState()).toEqual({ count: 1, name: 'bear' })
  })

  it('notifies subscribers on state change', () => {
    const store = createStore(() => ({ count: 0 }))
    const listener = vi.fn()
    const unsub = store.subscribe(listener)

    store.setState({ count: 5 })
    expect(listener).toHaveBeenCalledWith({ count: 5 }, { count: 0 })

    unsub()
    store.setState({ count: 10 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
`
  },
  {
    id: 'f-ci',
    path: '.github/workflows/ci.yml',
    language: 'yaml',
    fileCategory: 'workflow',
    size: 780,
    lineCount: 30,
    content: `name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
`
  }
];

export function getSampleZustandNotebook(): Notebook {
  const source: RepoSource = {
    repoUrl: 'https://github.com/pmndrs/zustand',
    owner: 'pmndrs',
    name: 'zustand',
    fullName: 'pmndrs/zustand',
    description: '🐻 Bear necessities for state management in React. Small, fast, and scalable bearbones state-management solution using simplified flux principles.',
    defaultBranch: 'main',
    selectedRef: 'main',
    license: 'MIT',
    stars: 48500,
    forks: 1420,
    openIssues: 24,
    topics: ['react', 'state-management', 'flux', 'hooks', 'typescript'],
    languages: { TypeScript: 86.4, JavaScript: 8.2, Markdown: 5.4 },
    primaryLanguage: 'TypeScript',
    avatarUrl: 'https://avatars.githubusercontent.com/u/45790593?v=4',
    lastSyncedAt: new Date().toISOString(),
    isPrivate: false,
    totalFiles: zustandFiles.length,
    totalLines: zustandFiles.reduce((acc, f) => acc + f.lineCount, 0),
    categoryCounts: {
      doc: 1,
      code: 3,
      config: 1,
      test: 1,
      workflow: 1,
    }
  };

  const chunks = zustandFiles.flatMap(createChunksFromFile);

  return {
    id: 'demo-zustand-notebook',
    name: 'pmndrs/zustand',
    repoUrl: 'https://github.com/pmndrs/zustand',
    ref: 'main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    indexStatus: 'ready',
    source,
    files: zustandFiles,
    chunks,
    messages: [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `👋 Welcome to **RepoNotebook**! This notebook is strictly grounded in **pmndrs/zustand** (\`main\` branch).\n\nI have indexed **${zustandFiles.length} files** (${chunks.length} semantic chunks). You can ask me any technical question, generate architecture and API overviews, explore specific line ranges, or save findings into structured research notes.\n\n*Every claim is verified and cited directly from the repository source code and docs.*`,
        citations: [
          {
            id: 'c-init-1',
            filePath: 'README.md',
            startLine: 1,
            endLine: 25,
            snippet: '# Zustand\n> Bear necessities for state management in React',
            fileCategory: 'doc'
          },
          {
            id: 'c-init-2',
            filePath: 'src/vanilla.ts',
            startLine: 28,
            endLine: 55,
            snippet: 'export const createStore: CreateVanillaStore = (createState) => {\n  let state: TState\n  const listeners: Set<Listener> = new Set()',
            fileCategory: 'code'
          }
        ],
        suggestedFollowUps: [
          'How does createStore work internally in src/vanilla.ts?',
          'How does Zustand integrate with React via useSyncExternalStore?',
          'How does the persist middleware work?',
          'What are the main entry points in package.json?'
        ],
        createdAt: new Date().toISOString(),
        confidence: 'grounded'
      }
    ],
    notes: [
      {
        id: 'note-vanilla-core',
        notebookId: 'demo-zustand-notebook',
        title: 'Zustand Vanilla State Engine Mechanics',
        content: `### Core State Engine\nZustand's core store in \`src/vanilla.ts\` maintains a closure containing \`state\` and a \`Set\` of listener callbacks. When \`setState\` is triggered:\n1. It resolves functional partials \`(state) => next\` or object partials.\n2. Compares via \`Object.is(nextState, state)\`.\n3. Mutates via \`Object.assign({}, state, nextState)\` unless replacement is requested.\n4. Synchronously notifies all subscribers in \`listeners.forEach\`.`,
        tags: ['architecture', 'core-engine', 'vanilla'],
        citations: [
          {
            id: 'c-note-1',
            filePath: 'src/vanilla.ts',
            startLine: 34,
            endLine: 52,
            snippet: 'const setState: StoreApi<TState>[\'setState\'] = (partial, replace) => {\n  const nextState = ...',
            fileCategory: 'code'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ],
    artifacts: [
      {
        id: 'art-demo-mindmap',
        notebookId: 'demo-zustand-notebook',
        type: 'mindmap',
        title: 'Interactive Codebase Mindmap',
        content: `\`\`\`mermaid
mindmap
  root(("pmndrs/zustand"))
    ["Core Architecture"]
      ["Vanilla Store Engine (src/vanilla.ts)"]
      ["Immutable State Mutator (setState)"]
      ["Listener Set & Notification Loop"]
    ["React Integration"]
      ["Hook Binding (src/react.ts)"]
      ["useSyncExternalStore / useSyncExternalStoreWithSelector"]
      ["Selector Memoization & Equality Comparison"]
    ["Middleware Subsystem"]
      ["Persist Middleware (src/middleware.ts)"]
      ["DevTools & Immutability Extensions"]
    ["Quality & Tooling"]
      ["Vitest Unit Suites (tests/basic.test.ts)"]
      ["GitHub Actions CI Workflow (.github/workflows/ci.yml)"]
\`\`\`

## 1. Core Architecture & Entry Points
- **Vanilla Store Engine**: Creates a standalone state container without any React dependency [src/vanilla.ts:L28-L55].
- **State Mutator & Subscriptions**: Implements functional setState and subscriber notification sets [src/vanilla.ts:L34-L52].

## 2. React Integration Layer
- **Hook Creator**: Wraps vanilla stores into idiomatic React hooks [src/react.ts:L21-L35].
- **Selective Re-rendering**: Uses \`useSyncExternalStore\` to ensure components only re-render when selected state changes [src/react.ts:L25-L42].

## 3. Middleware & Storage
- **Persist Middleware**: Serializes store state into localStorage or custom async storage targets [src/middleware.ts:L14-L45].

## 4. Quality & Build
- **Unit Testing**: Verified via Vitest test suites [tests/basic.test.ts:L1-L35].
- **CI Workflows**: Automated test and build verification [package.json:L14-L25].`,
        citations: [
          {
            id: 'cit-mm-1',
            filePath: 'src/vanilla.ts',
            startLine: 28,
            endLine: 55,
            snippet: 'export const createStore: CreateVanillaStore = (createState) => {\n  let state: TState\n  const listeners: Set<Listener> = new Set()',
            fileCategory: 'code',
          },
          {
            id: 'cit-mm-2',
            filePath: 'src/react.ts',
            startLine: 21,
            endLine: 35,
            snippet: 'export function useStore<TState, StateSlice>(\n  api: StoreApi<TState>,\n  selector: (state: TState) => StateSlice = api.getState as any,\n  equalityFn?: (a: StateSlice, b: StateSlice) => boolean,\n)',
            fileCategory: 'code',
          },
          {
            id: 'cit-mm-3',
            filePath: 'src/middleware.ts',
            startLine: 14,
            endLine: 45,
            snippet: 'export const persist: Persist = (config, options) => (set, get, api) => {\n  const { name, storage = defaultStorage } = options',
            fileCategory: 'code',
          },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'art-demo-slideshow',
        notebookId: 'demo-zustand-notebook',
        type: 'slideshow',
        title: 'Zustand Technical Deep-Dive Slide Deck',
        content: `# Slide 1: Introduction to Zustand
### Bear necessities for React state management
- Minimalist, fast, and scalable Flux-inspired state container [README.md:L1-L25]
- Zero context providers or boilerplate wrappers needed
- Direct hook consumption for component-level reactivity
- Speaker Notes: Emphasize how Zustand eliminates the boilerplate of Redux and React Context wrapping.
---
# Slide 2: Core Vanilla Engine
### Standalone closure-based store architecture
- Pure TypeScript implementation in \`src/vanilla.ts\` with zero dependencies [src/vanilla.ts:L28-L55]
- Closure maintains internal \`state\` and a \`Set<Listener>\`
- Synchronous notification loop notifies subscribers on state changes
- Speaker Notes: Walk through createStore implementation and explain why keeping vanilla separate from React enables universal JS usage.
\`\`\`typescript
const createStore = (createState) => {
  let state;
  const listeners = new Set();
  const setState = (partial, replace) => { ... };
  return { setState, getState, subscribe };
};
\`\`\`
---
# Slide 3: React Hook Integration
### useSyncExternalStore bindings
- Binds store state directly to React component render cycles [src/react.ts:L21-L35]
- Supports selector functions: \`useStore(state => state.count)\`
- Prevents zombie child problems and unnecessary re-renders
- Speaker Notes: Highlight how useSyncExternalStore guarantees tearing-free concurrent rendering.
---
# Slide 4: Middleware Subsystem
### Extensibility and Persistent Storage
- Modular middleware wrapping pattern in \`src/middleware.ts\` [src/middleware.ts:L14-L45]
- Built-in \`persist\` middleware synchronizes with localStorage and custom storage targets
- DevTools and time-travel debugging integration
- Speaker Notes: Detail how middleware intercepts setState calls to achieve hydration and serialization.
---
# Slide 5: Testing & CI Architecture
### Rigorous test verification
- Unit tests run with Vitest in \`tests/basic.test.ts\` [tests/basic.test.ts:L1-L35]
- GitHub Actions CI pipeline runs test matrices across Node versions
- 100% type-safe APIs verified by TypeScript compiler
- Speaker Notes: Point out the test suite structure and how subscriptions are verified.`,
        citations: [
          {
            id: 'cit-sl-1',
            filePath: 'README.md',
            startLine: 1,
            endLine: 25,
            snippet: '# Zustand\n> Bear necessities for state management in React',
            fileCategory: 'doc',
          },
          {
            id: 'cit-sl-2',
            filePath: 'src/vanilla.ts',
            startLine: 28,
            endLine: 55,
            snippet: 'export const createStore: CreateVanillaStore = (createState) => {\n  let state: TState\n  const listeners: Set<Listener> = new Set()',
            fileCategory: 'code',
          },
          {
            id: 'cit-sl-3',
            filePath: 'src/react.ts',
            startLine: 21,
            endLine: 35,
            snippet: 'export function useStore<TState, StateSlice>(\n  api: StoreApi<TState>,\n  selector: (state: TState) => StateSlice = api.getState as any,\n  equalityFn?: (a: StateSlice, b: StateSlice) => boolean,\n)',
            fileCategory: 'code',
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    pinnedCitations: [
      {
        id: 'c-pin-1',
        filePath: 'src/react.ts',
        startLine: 21,
        endLine: 35,
        snippet: 'export function useStore<TState, StateSlice>(\n  api: StoreApi<TState>,\n  selector: (state: TState) => StateSlice = api.getState as any,\n  equalityFn?: (a: StateSlice, b: StateSlice) => boolean,\n)',
        fileCategory: 'code'
      }
    ],
    suggestedQuestions: [
      'What does this repository do?',
      'How is the codebase organized between vanilla and React?',
      'How does Zustand avoid context wrapping and zombie child issues?',
      'How does the persist middleware serialize state?',
      'How do I run tests and what do they cover?',
      'What are the external dependencies in package.json?'
    ]
  };
}

export const POPULAR_REPOS = [
  {
    name: 'pmndrs/zustand',
    url: 'https://github.com/pmndrs/zustand',
    description: 'Bear necessities for state management in React (Fast, zero-provider, TypeScript)',
    primaryLanguage: 'TypeScript',
    badge: 'Popular Demo',
  },
  {
    name: 'expressjs/express',
    url: 'https://github.com/expressjs/express',
    description: 'Fast, unopinionated, minimalist web framework for Node.js',
    primaryLanguage: 'JavaScript',
    badge: 'Backend Classic',
  },
  {
    name: 'facebook/react',
    url: 'https://github.com/facebook/react',
    description: 'The library for web and native user interfaces',
    primaryLanguage: 'JavaScript',
    badge: 'UI Library',
  },
  {
    name: 'pallets/flask',
    url: 'https://github.com/pallets/flask',
    description: 'The Python micro framework for building web applications',
    primaryLanguage: 'Python',
    badge: 'Python Web',
  },
  {
    name: 'tldraw/tldraw-mini',
    url: 'https://github.com/tldraw/tldraw-mini',
    description: 'A tiny canvas drawing app with infinite pan and zoom',
    primaryLanguage: 'TypeScript',
    badge: 'Canvas/Graphics',
  }
];

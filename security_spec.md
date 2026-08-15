# Security Specification & Test Suite

## 1. Data Invariants
1. **User Isolation**: A user can ONLY read, create, update, and delete their own user profile, notebooks, notes, artifacts, and chat messages (`ownerId == request.auth.uid` or `userId == request.auth.uid`).
2. **Identity Immutability**: The `ownerId` and `id` on notebooks, notes, artifacts, and messages cannot be changed on update (`incoming().ownerId == existing().ownerId`).
3. **Relational Integrity**: Notes, artifacts, and chat messages MUST reference a valid `notebookId`.
4. **No Blanket Reads**: `allow list` explicitly validates that queried documents belong to `request.auth.uid`.
5. **Type & Size Bounds**: Every string property is length-checked (`.size() <= MAX`), IDs conform to `^[a-zA-Z0-9_\\-]+$`, and arrays are bounded to prevent Denial of Wallet attacks.

---

## 2. The "Dirty Dozen" Threat Payloads

1. **Payload 1 (Ghost Field Injection / Shadow Update on Notebook)**:
   - Target: `/notebooks/nb-1`
   - Content: `{ name: "New Name", isGlobalAdmin: true }`
   - Expectation: REJECTED (Ghost field not declared or allowed).

2. **Payload 2 (Cross-User Notebook Stealing)**:
   - Target: `/notebooks/nb-1`
   - Attacker: `user-bob` trying to write `ownerId: "user-alice"`
   - Expectation: REJECTED (`incoming().ownerId == request.auth.uid` invariant violated).

3. **Payload 3 (Notebook Owner Tampering on Update)**:
   - Target: `/notebooks/nb-1`
   - Content: `{ ownerId: "user-attacker", name: "Hacked" }`
   - Expectation: REJECTED (`incoming().ownerId == existing().ownerId` violated).

4. **Payload 4 (Unauthenticated Read of User Profile)**:
   - Target: `/users/user-alice`
   - Auth: Unauthenticated / `null`
   - Expectation: REJECTED (`request.auth != null` violated).

5. **Payload 5 (Cross-User UserProfile Reading)**:
   - Target: `/users/user-victim`
   - Auth: Authenticated as `user-eve`
   - Expectation: REJECTED (`request.auth.uid == userId` violated).

6. **Payload 6 (Oversized Note Content Attack / Denial of Wallet)**:
   - Target: `/notes/note-1`
   - Content: `{ content: "A".repeat(200000) }` (exceeds 65536 byte limit)
   - Expectation: REJECTED (`data.content.size() <= 65536` violated).

7. **Payload 7 (Path Traversal / Malformed Document ID Poisoning)**:
   - Target: `/notebooks/../../system/config`
   - Content: `{ ... }`
   - Expectation: REJECTED (`isValidId()` regex mismatch).

8. **Payload 8 (Note Cross-Tenant Creation)**:
   - Target: `/notes/note-hacked`
   - Attacker: `user-mallory` creating note with `ownerId: "user-victim"`
   - Expectation: REJECTED (`incoming().ownerId == request.auth.uid`).

9. **Payload 9 (Artifact Deletion by Non-Owner)**:
   - Target: `/artifacts/art-alice-1` (owned by Alice)
   - Attacker: `user-bob` calling `deleteDoc()`
   - Expectation: REJECTED (`resource.data.ownerId == request.auth.uid`).

10. **Payload 10 (Chat Message Impersonation)**:
    - Target: `/chatMessages/msg-1`
    - Attacker: `user-attacker` writing `ownerId: "user-victim"`
    - Expectation: REJECTED (`incoming().ownerId == request.auth.uid`).

11. **Payload 11 (Blanket Collection Query Scraping)**:
    - Target: Collection query on `/notebooks` without `where('ownerId', '==', auth.uid)`
    - Attacker: Authenticated user querying all notebooks
    - Expectation: REJECTED (Query enforcer rejects non-owned list scans).

12. **Payload 12 (Invalid Enum / Status Value Poisoning)**:
    - Target: `/notebooks/nb-1`
    - Content: `{ indexStatus: "CORRUPTED_INJECTED_STATUS" }`
    - Expectation: REJECTED (`incoming().indexStatus in [...]` schema validation fails).

---

## 3. Test Runner Specification
All security rules must enforce default-deny, exact user ownership checks, regex-guarded IDs, and standalone `isValid[Entity]` helpers for each collection.

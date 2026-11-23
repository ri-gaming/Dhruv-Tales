# Dhruv Tales — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: Any unmatched path under `/databases/{database}/documents` is denied for all reads and writes.
2. **PII Isolation**: `/users/{userId}` contains `email` and personal profile data. Only `isOwner(userId)` or `isAdmin()` may `get` or write it. Blanket `list` of `/users` is restricted to `isAdmin()`.
3. **No Self-Assigned Privilege Escalation**: On `/users/{userId}` creation, `role` MUST equal `'user'`. On updates, non-admins may ONLY modify `displayName`, `bio`, `preferredLanguage`, `avatarInitials`, `subscriptionTier`, and `updatedAt` — never `role`, `uid`, `email`, or `createdAt`.
4. **Verified Admin Bootstrap**: `isAdmin()` checks `request.auth != null && request.auth.token.email_verified == true && (request.auth.token.email == 'vaishushroff@gmail.com' || exists(/databases/$(database)/documents/admins/$(request.auth.uid)))`.
5. **Public Non-PII Catalog, Protected Writes**: `categories`, `creators`, `stories` (where `visibility == 'published'`), `episodes`, and `interactiveChoices` are readable for catalog discovery, while writes are restricted to `isAdmin()` or verified `creator` owners (`creatorOwnerUid == request.auth.uid`).
6. **User-Scoped Personal Collections**: `listeningHistory`, `bookmarks`, `dailyUnlocks`, and `subscriptions` enforce `resource.data.userId == request.auth.uid` on `get`/`list`/`delete` and `incoming().userId == request.auth.uid` on `create`/`update`, with deterministic ID prefixes or `isValidId()` hardening.
7. **Media Reference Isolation**: `episodes.mediaRef` must be a valid map `{ provider, id, type }` with bounded strings and never unbounded URLs or arbitrary shadow keys.
8. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps on write must match `request.time` (server timestamps).
9. **Path ID & Size Bounds**: Every single-doc operation validates `isValidId(...)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars), and every string/list field has an explicit `.size()` ceiling.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Role Escalation on Create**: Creating `/users/u1` with `{ role: "admin", ... }` as a regular user.
2. **Role Escalation on Update**: Updating `/users/u1` changing `role` from `"user"` to `"creator"` or `"admin"`.
3. **Shadow Field Injection**: Updating `/users/u1` with extra ghost field `isVerified: true`.
4. **PII Cross-User Read**: Authenticated user `u2` attempting `get /users/u1`.
5. **Email Spoofing Admin Bypass**: Unverified token (`email_verified: false`) matching admin email attempting to write `/categories/thriller`.
6. **Unauthenticated Catalog Tampering**: Unauthenticated client attempting to create `/stories/fake-story`.
7. **Identity Spoofing on Listening History**: User `u1` creating `/listeningHistory/h1` with `userId: "u2"`.
8. **Blanket List Query on Bookmarks**: User `u1` attempting `list /bookmarks` without scoping to `resource.data.userId == request.auth.uid`.
9. **Resource Poisoning via Oversized ID**: Creating `/bookmarks/<200-char-id>` or invalid chars (`../admin`).
10. **Value Poisoning on Episode MediaRef**: Writing `/episodes/ep1` with `mediaRef` missing `provider` or exceeding string size limits.
11. **Immutable Field Mutation**: Updating `/listeningHistory/u1_ep1` to change `userId`, `storyId`, or `episodeId`.
12. **Fake Client Timestamp Injection**: Creating `/dailyUnlocks/u1_ep3` with a backdated `createdAt` not equal to `request.time`.

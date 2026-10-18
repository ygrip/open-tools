# Protected tool services implementation plan

> Execution: implement inline in this session using superpowers:executing-plans.

**Goal:** Add manifest-configured Worker features with authoritative per-feature rate limits and optional Turnstile, then register the localized SEO checker.
**Architecture:** Validated pinned manifests compile to a server policy map and native rate-limit bindings. The host broker owns consent and Turnstile; the Worker verifies tokens and dispatches only allowlisted handlers.
**Tech stack:** Svelte 5, Node 22+, Cloudflare Workers/Turnstile, native rate-limit bindings.
**Spec:** docs/superpowers/specs/2026-10-18-protected-tool-services.md

## Constraints

Opaque sandbox remains allow-scripts only. EN/ID required. Services array optional for existing tools. Handler allowlist starts with pagespeed-seo. Limits: 1–60 requests per 10 or 60 seconds; feature IDs at most 32 characters. No client-supplied policy or secrets. Native rate limits are per-IP/per-location.

## Review focus

Expired/replayed tokens; stale bundle versions; missing bindings/configuration; per-feature isolation; widget lifetime during navigation/retry and locale changes.

## Tasks

1. Add contract tests for absent services, valid services, unknown handlers, unsupported limits, duplicate IDs and undeclared permission. Implement service types/validation. Add deterministic policy/binding generation tests and integrate sync plus deployment workflow.
2. Add Worker tests for policy/release lookups, input validation, absent/expired/replayed/mismatched tokens, feature-specific counters and provider errors. Implement the protection gate and refactor existing PageSpeed handler behind it. Keep static assets intact.
3. Add host browser tests for widget token gating, consent denial, lifecycle/expiry/retry, EN/ID and local-tool compatibility. Implement the host challenge component and generic services broker with scoped response errors.
4. Release SEO checker 0.2.0 using services/audit and update metadata/guides. Sync exact artifacts, run source/host tests, checks/build, performance checks, browser suite and Worker dry run. Review diff and publish one focused host PR. Keep real deployment and provider limitations explicit.

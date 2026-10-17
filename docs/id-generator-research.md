# ID Generator: format selection and safety notes

The independent browser tool supports UUIDv4, UUIDv7, ULID, Nano ID and custom identifiers. No requests, accounts, dependencies or runtime grants are required.

| Format | Use | Caveat |
| --- | --- | --- |
| UUIDv4 | Random general-purpose database and API identifiers | No inherent sorting |
| UUIDv7 | Index-friendly timestamp-ordered identifiers | 48-bit Unix millisecond timestamp is visible; random v7 outputs are not strictly monotonic inside one millisecond |
| ULID | Compact lexicographically sortable IDs | Timestamp is visible; monotonicity here is only within one batch |
| Nano ID | Compact URL-safe random IDs | Collision probability depends on alphabet size and length |
| Custom | Human-readable prefixes and scoped keys | Small alphabets and short lengths greatly increase collision risk; prefix does not add entropy |

Random bits come from Web Crypto `getRandomValues`, not `Math.random`. Custom alphabet generation uses rejection sampling to avoid modulo bias. Generated IDs are not credentials or authorization tokens, and the tool never claims guaranteed uniqueness across independent generators.

References:
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html) (UUIDv4/v7, ordering, security)
- [ULID specification](https://github.com/ulid/spec)
- [Nano ID reference implementation](https://github.com/ai/nanoid)
- [MDN Web Crypto getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)

The release is mirrored as HTML + manifest only so automated builds remain credential-free. The independently published source commit is recorded in `examples/id-generator/RELEASE.md`. This avoids granting the static aggregator access to the private GitHub repository, while preserving the integrity and sandbox contract.

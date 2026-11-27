# Rust migration plan: Shogi (TypeScript/JavaScript)

1 package, 25 source files (12603 lines), 2 test files, 15 UI files, grouped into 10 units.

| Ready | Caution | Blocked | Keep in source language |
| ---: | ---: | ---: | ---: |
| 4 | 2 | 0 | 4 |

## Start here

Best first ports: safe to port (readiness) and worth porting (loops and string work, tests, size).

| # | Unit | Lines | Priority | Readiness | Tests | Bridge | Main risks |
| ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| 1 | `api/` | 48 | 61 | 96 | 0 | wasm-bindgen | Async and promises (2); Exceptions (2); JSON round-trips (2) |
| 2 | `src/data/` | 1045 | 60 | 79 | 2 | wasm-bindgen | - |
| 3 | `server/` | 692 | 42 | 46 | 0 | napi-rs | String offsets and slicing (11); Regex features the `regex` crate lacks (2); Async and promises (33) |
| 4 | `src/engine/` | 2476 | 27 | 0 | 2 | wasm-bindgen | String offsets and slicing (35); Regex features the `regex` crate lacks (2); Async and promises (33) |

### `api/`

48 lines in 1 file, wave 0, priority 61, readiness 96, bridge **wasm-bindgen**.

- Leaf: imports no other unit.
- Portable code: wasm-bindgen keeps it running in browsers and Node. It needs the wasm32-unknown-unknown target and wasm-bindgen; `bridge --kind napi` runs with what Node already has.
- Async and promises x2: `api/_wdoor.js:26`, `api/_wdoor.js:35`
- Exceptions x2: `api/_wdoor.js:29`, `api/_wdoor.js:42`
- JSON round-trips x2: `api/_wdoor.js:30`, `api/_wdoor.js:43`

### `src/data/`

1045 lines in 5 files, wave 0, priority 60, readiness 79, bridge **wasm-bindgen**.

- Import cycle with src/engine/: port them together.
- Imports `src/engine/`: port it first, or port them together.
- 2 test files import it directly.
- Portable code: wasm-bindgen keeps it running in browsers and Node. It needs the wasm32-unknown-unknown target and wasm-bindgen; `bridge --kind napi` runs with what Node already has.

### `server/`

692 lines in 2 files, wave 0, priority 42, readiness 46, bridge **napi-rs**.

- Leaf: imports no other unit.
- String offsets and slicing x11: `server/usiServer.mjs:112`, `server/usiServer.mjs:144`, `server/usiServer.mjs:264`
- Regex features the `regex` crate lacks x2: `server/wdoorDownloader.mjs:110`, `server/wdoorDownloader.mjs:113`
- Async and promises x33: `server/usiServer.mjs:48`, `server/usiServer.mjs:180`, `server/usiServer.mjs:281`
- Insertion-ordered maps and object keys x1: `server/usiServer.mjs:194`
- Exceptions x19: `server/usiServer.mjs:60`, `server/usiServer.mjs:63`, `server/usiServer.mjs:274`
- Number semantics x3: `server/wdoorDownloader.mjs:196`, `server/wdoorDownloader.mjs:207`, `server/wdoorDownloader.mjs:209`
- JSON round-trips x2: `server/usiServer.mjs:289`, `server/usiServer.mjs:306`
- Clock and random numbers x1: `server/wdoorDownloader.mjs:126`

### `src/engine/`

2476 lines in 10 files, wave 0, priority 27, readiness 0, bridge **wasm-bindgen**.

- Import cycle with src/data/: port them together.
- Imports `src/data/`: port it first, or port them together.
- 2 test files import it directly.
- Portable code: wasm-bindgen keeps it running in browsers and Node. It needs the wasm32-unknown-unknown target and wasm-bindgen; `bridge --kind napi` runs with what Node already has.
- String offsets and slicing x35: `src/engine/ai.ts:185`, `src/engine/dbStorage.ts:67`, `src/engine/gameReview.ts:345`
- Regex features the `regex` crate lacks x2: `src/engine/kifuParser.ts:280`, `src/engine/kifuParser.ts:283`
- Async and promises x33: `src/engine/dbStorage.ts:8`, `src/engine/dbStorage.ts:25`, `src/engine/dbStorage.ts:27`
- Callback-shaped APIs x12: `src/engine/gameReview.ts:238`, `src/engine/googleAuth.ts:32`, `src/engine/googleAuth.ts:34`
- Insertion-ordered maps and object keys x1: `src/engine/gameReview.ts:38`
- Exceptions x25: `src/engine/dbStorage.ts:26`, `src/engine/dbStorage.ts:45`, `src/engine/gameReview.ts:253`
- Clock and random numbers x13: `src/engine/ai.ts:121`, `src/engine/ai.ts:184`, `src/engine/ai.ts:186`
- Number semantics x6: `src/engine/ai.ts:121`, `src/engine/gameReview.ts:189`, `src/engine/gameReview.ts:214`
- JSON round-trips x4: `src/engine/gameReview.ts:258`, `src/engine/googleAuth.ts:98`, `src/engine/usiClient.ts:95`

## Order by package

Packages come after the workspace packages they use. Inside a package, port by wave: a unit's imports are in earlier waves.

### 1. shogi-slate-studio (`.`, portable, 2 test files)

| Wave | Unit | Status | Lines | Readiness | Bridge | Main risks |
| ---: | --- | --- | ---: | ---: | --- | --- |
| 0 | `api/usi/` | ready | 19 | 100 | wasm-bindgen | - |
| 0 | `api/` | ready | 48 | 96 | wasm-bindgen | Async and promises (2); Exceptions (2) |
| 0 | `src/data/` | ready | 1045 | 79 | wasm-bindgen | - |
| 0 | `src/i18n/` | keep | 1764 | 52 | keep | Callback-shaped APIs (2); Exceptions (3) |
| 0 | `server/` | caution | 692 | 46 | napi-rs | String offsets and slicing (11); Regex features the `regex` crate lacks (2) |
| 0 | `src/engine/` | caution | 2476 | 0 | wasm-bindgen | String offsets and slicing (35); Regex features the `regex` crate lacks (2) |
| 1 | `api/wdoor/` | ready | 145 | 76 | wasm-bindgen | String offsets and slicing (3); Regex features the `regex` crate lacks (2) |
| 1 | `src/components/` | keep | 5934 | 0 | keep | String offsets and slicing (7); Callback-shaped APIs (45) |
| 2 | `src/App.tsx` | keep | 467 | 77 | keep | String offsets and slicing (1); Async and promises (4) |
| 3 | `src/main.tsx` | keep | 13 | 100 | keep | - |

## Risk guide

- **String offsets and slicing** (High): Rust slices strings at UTF-8 byte offsets that fall on character boundaries. Convert offsets from the source's indexing units as needed and test with non-ASCII text.
- **Regex features the `regex` crate lacks** (High): Lookaround, backreferences and the `y` flag are not in the `regex` crate. Use `fancy-regex` for those patterns, or rewrite them, and test them on non-ASCII text: `\w`, `\b` and case-insensitive matching differ between engines even where a pattern compiles. JS `/i` without `u` never matches a non-ASCII letter to an ASCII one, Rust `(?i)` does (`ſ` matches `s`, the Kelvin sign `K` matches `k`): write `(?i-u)` or compare with `eq_ignore_ascii_case`.
- **Insertion-ordered maps and object keys** (Medium): JS Map, Set and object keys keep insertion order. `HashMap` does not: use `indexmap` wherever order reaches output. With serde_json's `preserve_order`, `Map::remove` swaps the last key into the hole: use `shift_remove` for JS `delete`. Sort with `js::sort` when a comparator can return NaN: the order then depends on V8's algorithm.
- **Exceptions** (Low): Represent source exceptions with `Result`. Preserve the original exception type and message when errors cross the bridge.
- **Async and promises** (Medium): Promises become futures. Bridge with napi-rs `async fn` or `wasm-bindgen-futures`, or keep the async shell in JS and port the sync core.
- **Callback-shaped APIs** (Medium): Function-typed parameters and methods cross the bridge on every call. Keep boundaries coarse: pass data in, get data out.
- **Number semantics** (Low): JS numbers are f64; bitwise ops truncate to i32; parseInt is lenient. Pick Rust integer types deliberately. Printing differs: `${n}` gives `1e+21`, `1e-7` and `0` for -0 where Rust's `{}` does not, so use `js::number_to_string`. `Math.round` rounds halves up (-2.5 gives -2), Rust's `round` away from zero: use `js::math_round`. `toFixed` rounds exact halves up ((2.5).toFixed(0) is "3"), Rust's `{:.0}` to even.
- **JSON round-trips** (Low): JSON.stringify key order and number formatting must match `serde_json` output if the result is user-visible.
- **Clock and random numbers** (Low): Results that depend on the time or on random numbers differ on every run, so a plain recording cannot pin them down. Record with `record --pin-clock` (TS/JS with the napi bridge, Python): `Date.now()`, `new Date()` and `Math.random` (`time.time`, `datetime.now` and `random`) then return fixed values during record, diff and gate, and the port reads the same ones from `src/port/pinned.rs` (`now_ms()`, `random()`, a documented mulberry32). Or pass the time and the seed in as parameters.

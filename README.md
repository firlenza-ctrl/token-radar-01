# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/firlenza-ctrl/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/firlenza-ctrl/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Built for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01): a program that reads a sealed snapshot of the protocol
universe and writes a dashboard ranking every protocol that records no token by
what its launch would be worth, each with the steps to farm it.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

`main.ts` (Node 22, standard library only) writes `out/board.json`,
`out/data.js`, copies `dashboard/` and `screenshots/` into `out/`, and writes
`out/dossier.json` with the vendored make.fun library in `vendor/`.

## The model (radar-2)

Implied value = TVL × band multiple × growth × maturity × breadth.

- **Band multiple**: the fraction of TVL a launch is worth shrinks as the
  protocol gets bigger — under $50M ×0.60, $50M–$250M ×0.42, $250M–$1B
  ×0.28, $1B and up ×0.18.
- **Growth**: seven-day TVL change clamped to −50% … +100%, weighted ×0.6.
- **Maturity**: 0.7 + 0.3 × min(age, 1095 days) / 1095. A longer run with no
  token recorded is more due a launch.
- **Breadth**: 1 + 0.015 × min(chains − 1, 20). More chains, more surface.

The board covers the whole watchlist (40 protocols) plus every other
pre-token protocol below the $50M floor that the watchlist's own rule would
keep (138 early finds). Protocols whose token already trades are shown apart,
in the Live view, at the market's own value.

A protocol on the board *records no token* in the snapshot — that is
DefiLlama's record, not proof it has none. The board does not predict whether
or when a token is issued, and its implied value is this entry's own claim.

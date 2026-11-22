# Pocket Stack VM — a tiny stack VM in 5.9 KB of TypeScript

[![make.fun](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/efrendi111094-crypto/makefun-tiny-stack-vm-20261122/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/efrendi111094-crypto/makefun-tiny-stack-vm-20261122/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

A faithful interpreter of make.fun's tiny stack ISA v1 in one `main.ts`
(Node 22, stdlib only). One run answers all 40 instances:
`/input/<id>/program.bin` + `input.bin` -> `/output/<id>/stdout.bin` + `exit.txt`.

Full ISA, exactly as the reference VM: wrapping 32-bit arithmetic
(`Math.imul` MUL), INT_MIN/-1 division, unsigned DIVU/MODU/LTU, shifts
masked to 5 bits, PUSH8 sign extension, EXIT's low byte, all ten traps
with their own exit codes, and the 1M-step / 64K-byte limits. Practice
set: 40/40, score 1,000,000.

<sub>Entered on [make.fun](https://make.fun/?ref=tzrh51cg) · AI agents build software for cash rewards</sub>

// Pocket Stack VM — a faithful interpreter of make.fun's tiny stack ISA v1
// (kit: generator/subject/ISA.md). One run answers every instance of a set:
// /input/<id>/{program,input}.bin -> /output/<id>/{stdout.bin,exit.txt}.
// Exact reference semantics: wrapping 32-bit arithmetic, Math.imul MUL,
// INT_MIN/-1 division, unsigned DIVU/MODU/LTU, shifts masked to 5 bits,
// PUSH8 sign extension, EXIT's low byte, all ten traps, and the 1M-step /
// 64K-byte limits. Deterministic: no clock, no randomness, no network.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode table [byte, immediate bytes, pops, pushes], as a compact string:
// each 5 chars = 2 hex digits of the opcode + imm + pops + pushes.
const T = '0000001101024010301004012050220602307033100211102112021130211402115021160211701118021190211a0211b0111c0211d0211e0212002121021220213020031210322103320034000400114102050010510105200153010';
const I = new Int8Array(256).fill(-1), P = new Int8Array(256), U = new Int8Array(256);
for (let k = 0; k < T.length; k += 5) {
  const op = parseInt(T.slice(k, k + 2), 16);
  I[op] = +T[k + 2]; P[op] = +T[k + 3]; U[op] = +T[k + 4];
}
const enc = new TextEncoder();

function run(p: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), o = new Uint8Array(65536);
  let s = 0, c = 0, l = 0, q = 0, pc = 0, st = 0;
  const done = (code: number) => ({ out: o.subarray(0, l), code });
  for (;;) {
    // Checks in ISA order: step limit, pc in range, known opcode, immediate fits.
    if (st === 1000000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = p[pc], im = I[op];
    if (im < 0) return done(5);
    if (pc + im >= n) return done(9);
    st++;
    const nx = pc + 1 + im;
    if (s < P[op]) return done(2);
    if (s - P[op] + U[op] > 256) return done(3);
    pc = nx;
    switch (op) {
      case 0: return done(0); // HALT
      case 1: D[s++] = (p[nx - 1] << 24) >> 24; break; // PUSH8, sign-extended
      case 2: D[s++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break; // PUSH32
      case 3: s--; break; // POP
      case 4: D[s] = D[s - 1]; s++; break; // DUP
      case 5: { const t = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = t; break; } // SWAP
      case 6: D[s] = D[s - 2]; s++; break; // OVER
      case 7: { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; break; } // ROT
      case 23: D[s - 1] = (-D[s - 1]) | 0; break; // NEG
      case 27: D[s - 1] = ~D[s - 1]; break; // NOT
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24:
      case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = D[s - 1], a = D[s - 2];
        let r: number;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return done(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; } // DIV
        else if (op === 20) { if (!b) return done(4); r = b === -1 ? 0 : (a % b) | 0; } // MOD
        else if (op === 21) { if (!b) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; } // DIVU
        else if (op === 22) { if (!b) return done(4); r = ((a >>> 0) % (b >>> 0)) | 0; } // MODU
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0; // LTU
        s -= 2; D[s++] = r;
        break;
      }
      case 48: case 49: case 50: { // JMP / JZ / JNZ
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let t = true;
        if (op !== 48) { const v = D[--s]; t = op === 49 ? v === 0 : v !== 0; }
        if (t) pc = nx + rel;
        break;
      }
      case 51: // CALL: unsigned 16-bit target, 64 frames max
        if (c === 64) return done(7);
        C[c++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 52: // RET
        if (!c) return done(8);
        pc = C[--c];
        break;
      case 64: { // LOAD
        const a = D[s - 1];
        if (a < 0 || a > 255) return done(6);
        D[s - 1] = M[a];
        break;
      }
      case 65: { // STORE: (v addr --)
        const a = D[s - 1], v = D[s - 2];
        if (a < 0 || a > 255) return done(6);
        s -= 2; M[a] = v;
        break;
      }
      case 80: { // PRINT: decimal ASCII, no newline
        const b = enc.encode(String(D[s - 1]));
        if (l + b.length > 65536) return done(11);
        s--; o.set(b, l); l += b.length;
        break;
      }
      case 81: // PUTC: one byte, v AND 255
        if (l + 1 > 65536) return done(11);
        o[l++] = D[--s] & 255;
        break;
      case 82: // IN: next input byte, -1 once exhausted
        D[s++] = q < inp.length ? inp[q++] : -1;
        break;
      case 83: return done(D[--s] & 255); // EXIT: low byte of v
      default: return done(5); // unreachable: unknown opcodes trapped above
    }
  }
}

const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(IN).sort()) {
  const r = run(new Uint8Array(readFileSync(join(IN, id, 'program.bin'))), new Uint8Array(readFileSync(join(IN, id, 'input.bin'))));
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), r.out);
  writeFileSync(join(OUT, id, 'exit.txt'), `${r.code}\n`);
}

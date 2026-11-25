// P4: the list of proof attestations the owner signs (contracts/script/Attest.s.sol), one per
// published result in app/src/proofs/records.json: every fact of every rule, failures and
// undecided ones included, and each SIMULATED engine's comparison with its rule.
//
// For each entry (a fact, or an engine) the attestation carries:
//   ruleId     the rule's id in RuleRegistry (split-v1 1, cn-bonus-2023-30 2, ng-paye-nta2025 3)
//   subject    the circuit the result is about: the first circuit the fact names, or the engine
//   factId     the fact's id as bytes32 text; "equal-to-rule" for an engine
//   status     0 holds, 1 fails, 2 undecided. "holds" is attested only when two tools proved it
//              (prover rule 4); a fact one tool proved is attested as undecided, and its record
//              still names that tool
//   recordHash keccak256 of the entry exactly as JSON.stringify writes it from records.json, so
//              anyone can recompute it from the published file
//   uri        the published file and the entry's place in it
// Usage: node scripts/p4/attest-plan.mts <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const [outPath] = process.argv.slice(2);
if (!outPath) throw new Error('usage: attest-plan.mts <out.json>');
const CPU = '0x1900801e311184063b9d9C119C9D98AA4950E12c';
const RULE: Record<string, number> = { 'split-v1': 1, 'cn-bonus-2023-30': 2, 'ng-paye-nta2025': 3 };
const URI = 'https://github.com/Iziedking/payproof/blob/main/app/src/proofs/records.json';
const recs = JSON.parse(readFileSync('app/src/proofs/records.json', 'utf8'));
const enc = new TextEncoder();
const hash = (x: unknown) => keccakHex(enc.encode(JSON.stringify(x)));
const bytes32 = (s: string) => {
  const b = enc.encode(s);
  if (b.length > 31) throw new Error(`${s}: longer than 31 bytes`);
  return '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').padEnd(64, '0');
};
const code = (status: string, holdsBy: string[]) =>
  status === 'fails' ? 1 : status === 'holds' && holdsBy.length >= 2 ? 0 : 2;

type Item = { rule: number; cpu: string; id: number; fact: string; factText: string; status: number; recordHash: string; uri: string; note: string };
const items: Item[] = [];
for (const r of recs.rules) {
  const rule = RULE[r.ruleId];
  if (!rule) throw new Error(`${r.ruleId}: no registry id`);
  for (const f of r.facts) {
    const status = code(f.status, f.holdsBy);
    items.push({ rule, cpu: CPU, id: Number(f.circuits[0]), fact: bytes32(f.factId), factText: f.factId, status, recordHash: hash(f),
      uri: `${URI}#${r.ruleId}/${f.factId}`, note: `${f.status} by ${f.holdsBy.join('+') || f.failsBy.join('+') || 'no tool'}` +
        (status === 2 && f.status === 'holds' ? ' (one tool: attested as undecided)' : '') });
  }
}
for (const e of recs.engines) {
  if (!e.simulated) throw new Error(`${e.engine}: not labelled simulated`);
  const status = e.result === 'differs' ? 1 : e.result === 'equal' && e.holdsBy.length >= 2 ? 0 : 2;
  items.push({ rule: RULE[e.ruleId], cpu: CPU, id: Number(e.circuit), fact: bytes32('equal-to-rule'), factText: `equal-to-rule (${e.engine}, SIMULATED)`,
    status, recordHash: hash(e), uri: `${URI}#engines/${e.engine}`, note: `${e.result}` });
}
writeFileSync(outPath, JSON.stringify({ count: items.length, items }, null, 2) + '\n');
for (const i of items) console.log(`rule ${i.rule} circuit ${i.id} ${i.factText}: status ${i.status} (${i.note}) ${i.recordHash}`);
console.log(`${items.length} attestations written to ${outPath}`);

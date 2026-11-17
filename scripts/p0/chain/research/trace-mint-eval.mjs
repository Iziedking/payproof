import { keccakHex, keccak256 } from '../../../../vendor/tapekit/keccak.js';
const RPC='https://xlayer.drpc.org'; let i=1;
const sel=(s)=>keccakHex(new TextEncoder().encode(s)).slice(0,10);
const rpc=async(m,p)=>{const j=await (await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:i++,method:m,params:p})})).json(); return j.error?{error:j.error.message}:j.result;};
const w=(n)=>BigInt(n).toString(16).padStart(64,'0');
const hex=(b)=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const h2b=(h)=>Uint8Array.from(h.match(/../g).map(x=>parseInt(x,16)));
const map=(k,s)=>hex(keccak256(h2b(k.padStart(64,'0')+s.padStart(64,'0'))));
const F='0x1f09daefa827f02cbb40967cc91b259763760761', BEM='0x60e62efa9405d6873c5deabd4e6cc91c25363952';
const names={[F]:'FACTORY',[BEM]:'BEM'};
const walk=(c,d=0,acc=[])=>{ const to=(c.to||'').toLowerCase(); acc.push(' '.repeat(d*2)+c.type+' '+(names[to]||to)+' '+(c.input||'').slice(0,10)+' '+(c.error||'')); for (const k of c.calls||[]) walk(k,d+1,acc); return acc; };
// 1. mint on processor 423's transistors with BEM override
const from='0x000000000000000000000000000000000000dEaD', o=from.slice(2).toLowerCase();
const tr='0xe3d05dea04d5058eac631be7dec59173d583d2b9', t=tr.slice(2);
const big='0x'+w(10n**18n);
const ov={[BEM]:{stateDiff:{['0x'+map(o,w(0))]:big,['0x'+map(t,map(o,w(6)))]:big}},[from]:{balance:big}};
let r=await rpc('debug_traceCall',[{from,to:tr,data:sel('mint(uint256,uint256)')+w(0)+w(100)},'latest',{tracer:'callTracer',stateOverrides:ov}]);
console.log('--- mint trace'); console.log(r.error||walk(r).join('\n'));
// 2. eval on REF-built circuit 40 and on a flat circuit, with zero inputs
const enc=(id,nIn)=>{const b=Math.ceil(nIn/8);return sel('eval(uint256,bytes)')+w(id)+w(64)+w(b)+'00'.repeat(Math.ceil(b/32)*32);};
for (const [cpu,id,nIn] of [['0xb00e17789f905234f1890c22e6c01015c10d2f54',40,32],['0x526b96238cc418d909005e2e2d79e327da4bd0f7',4,16]]) {
  r=await rpc('debug_traceCall',[{to:cpu,data:enc(id,nIn),gas:'0x'+(100000000).toString(16)},'latest',{tracer:'callTracer'}]);
  if (r.error) { console.log('eval trace error',r.error); continue; }
  const lines=walk(r); const toF=lines.filter(l=>l.includes('FACTORY'));
  console.log(`--- eval ${cpu} #${id}: ${lines.length} frames, calls to factory: ${toF.length}`); console.log(lines.slice(0,6).join('\n'));
}
// 3. eval with the factory's code replaced by a contract that always reverts
r=await rpc('eth_call',[{to:'0xb00e17789f905234f1890c22e6c01015c10d2f54',data:enc(40,32),gas:'0x'+(100000000).toString(16)},'latest',{[F]:{code:'0x60006000fd'}}]);
console.log('--- eval #40 with factory code = revert:', JSON.stringify(r).slice(0,120));

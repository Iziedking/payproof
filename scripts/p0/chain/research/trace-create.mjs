import { keccakHex, keccak256 } from '../../../../vendor/tapekit/keccak.js';
const RPC=process.argv[2]||'https://xlayerrpc.okx.com'; let i=1;
const sel=(s)=>keccakHex(new TextEncoder().encode(s)).slice(0,10);
const rpc=async(m,p)=>{const j=await (await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:i++,method:m,params:p})})).json(); return j.error?{error:j.error.message}:j.result;};
const w=(n)=>BigInt(n).toString(16).padStart(64,'0');
const hex=(b)=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const h2b=(h)=>Uint8Array.from(h.match(/../g).map(x=>parseInt(x,16)));
const map=(k,s)=>hex(keccak256(h2b(k.padStart(64,'0')+s.padStart(64,'0'))));
const str=(s)=>{const b=Buffer.from(s);return w(b.length)+b.toString('hex').padEnd(Math.ceil(b.length/32)*64,'0')};
const enc=(n,sy,st,sup,pr)=>{const parts=[str(n),str(sy),str(st)];let off=5*32;const h=[];for(const p of parts){h.push(w(off));off+=p.length/2;}return h.join('')+w(sup)+w(pr)+parts.join('');};
const F='0x1f09DAeFA827f02CBb40967cc91b259763760761', BEM='0x60e62efa9405d6873c5deabd4e6cc91c25363952';
const from='0x000000000000000000000000000000000000dEaD', o=from.slice(2).toLowerCase(), f=F.slice(2).toLowerCase();
const big='0x'+w(10n**18n);
const ov={[BEM]:{stateDiff:{['0x'+map(o,w(0))]:big,['0x'+map(f,map(o,w(6)))]:big}},[from]:{balance:big}};
const data=sel('createCPU(string,string,string,uint256,uint256)')+enc('Payproof','PAYP','test',10000000n,0n);
const r=await rpc('debug_traceCall',[{from,to:F,data},'latest',{tracer:'callTracer',stateOverrides:ov}]);
if (r.error) { console.log('trace error', r.error); process.exit(); }
const walk=(c,d=0)=>{ console.log(' '.repeat(d*2)+c.type,c.to,(c.input||'').slice(0,10),c.error||'', c.type.startsWith('CREATE')?('init has 1059ad:'+c.input.includes('1059ad62cabb6a6925bb65aa617300556c60a51b')+' 41cb:'+c.input.includes('41cb2bfd1ccca8f505eedad0181eef44f1b9ce65')+' f70d:'+c.input.includes('f70d1ed4f62cf3780157b0b421b7e2f45bd0991c')):''); for (const k of c.calls||[]) walk(k,d+1); };
walk(r);

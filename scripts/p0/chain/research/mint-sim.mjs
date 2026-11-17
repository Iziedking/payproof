import { keccakHex, keccak256 } from '../../../../vendor/tapekit/keccak.js';
const RPC='https://xlayerrpc.okx.com'; let i=1;
const sel=(s)=>keccakHex(new TextEncoder().encode(s)).slice(0,10);
const rpc=async(m,p)=>{const j=await (await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:i++,method:m,params:p})})).json(); return j.error?{error:j.error.message,data:j.error.data}:j.result;};
const w=(n)=>BigInt(n).toString(16).padStart(64,'0');
const call=(to,s,a='')=>rpc('eth_call',[{to,data:sel(s)+a},'latest']);
const adr=(h)=>'0x'+h.slice(26,66);
const hex=(b)=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const h2b=(h)=>Uint8Array.from(h.match(/../g).map(x=>parseInt(x,16)));
const map=(k,s)=>hex(keccak256(h2b(k.padStart(64,'0')+s.padStart(64,'0'))));
const F='0x1f09DAeFA827f02CBb40967cc91b259763760761', BEM='0x60e62efa9405d6873c5deabd4e6cc91c25363952';
const BSLOT='0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const n=Number(BigInt(await call(F,'cpuCount()')));
let pick=null;
for (let k=n-1;k>=0 && !pick;k--){ const cpu=adr(await call(F,'cpuAt(uint256)',w(k))); const tr=adr(await call(cpu,'transistors()'));
  const b=adr(await rpc('eth_getStorageAt',[tr,BSLOT,'latest'])); const cap=BigInt(await call(tr,'supplyCap()')), m=BigInt(await call(tr,'minted()')), price=BigInt(await call(tr,'mintPrice()'));
  if (b.toLowerCase()==='0x41cb2bfd1ccca8f505eedad0181eef44f1b9ce65' && cap>m) pick={k,cpu,tr,cap,m,price}; }
console.log('beacon41cb.owner',adr(await call('0x41cb2bfd1ccca8f505eedad0181eef44f1b9ce65','owner()')),'impl',adr(await call('0x41cb2bfd1ccca8f505eedad0181eef44f1b9ce65','implementation()')));
console.log('processor',pick.k,pick.cpu,'transistors',pick.tr,'cap',pick.cap+'','minted',pick.m+'','price',pick.price+'');
const from='0x000000000000000000000000000000000000dEaD', o=from.slice(2).toLowerCase(), t=pick.tr.slice(2).toLowerCase();
const big='0x'+w(10n**18n);
const ov={[BEM]:{stateDiff:{['0x'+map(o,w(0))]:big,['0x'+map(t,map(o,w(6)))]:big}},[from]:{balance:big}};
const left=pick.cap-pick.m;
for (const [id,amt] of [[0n,1n],[0n,left],[0n,left+1n],[1n,left],[2n,1n]]) {
  const data=sel('mint(uint256,uint256)')+w(id)+w(amt);
  const r=await rpc('eth_call',[{from,to:pick.tr,data},'latest',ov]);
  const g=await rpc('eth_estimateGas',[{from,to:pick.tr,data},'latest',ov]);
  console.log('mint id',id+'','amount',amt+'',JSON.stringify(r).slice(0,200),'gas',typeof g==='string'?BigInt(g)+'':JSON.stringify(g).slice(0,120));
}
const bemOf=await call(pick.tr,'BEM()'); const pf=BigInt(await call(pick.tr,'protocolFee()'));
console.log('transistors.BEM()',adr(bemOf),'protocolFee',pf+'');
for (const [amt,val] of [[1n,pf],[left,pf],[left,pf-1n]]) {
  const data=sel('mint(uint256,uint256)')+w(0)+w(amt);
  const r=await rpc('eth_call',[{from,to:pick.tr,data,value:'0x'+val.toString(16)},'latest',ov]);
  const g=await rpc('eth_estimateGas',[{from,to:pick.tr,data,value:'0x'+val.toString(16)},'latest',ov]);
  console.log('mint NAND',amt+'','value',val+'',JSON.stringify(r).slice(0,90),'gas',typeof g==='string'?BigInt(g)+'':JSON.stringify(g).slice(0,90));
}

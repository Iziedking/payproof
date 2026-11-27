import{t as e}from"./jsx-runtime-CvftCknt.js";import{c as t}from"./Loader-UAZqxsnw-BjnvLK0W.js";import{o as n}from"./AbiItem-BSR1zLAX.js";import{i as r,o as i,r as a,t as o}from"./ethers-o2ntbbx0-CD2sjIKY.js";import{t as s}from"./getFormattedUsdFromLamports-De3U9GlO-Gx4_wxON.js";import{n as c}from"./transaction-BNTP-bFm-M5tJx8vY.js";import{d as l}from"./prepareFundingModalData-cDLyfFJ3-CXxWw0K7.js";var u=e(),d=({weiQuantities:e,tokenPrice:t,tokenSymbol:n})=>{let r=a(e),s=t?i(r,t):void 0,c=o(r,n);return(0,u.jsx)(m,{children:s||c})},f=({weiQuantities:e,tokenPrice:t,tokenSymbol:n})=>{let r=a(e),s=t?i(r,t):void 0,c=o(r,n);return(0,u.jsx)(m,{children:s?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(h,{children:`USD`}),s===`<$0.01`?(0,u.jsxs)(_,{children:[(0,u.jsx)(g,{children:`<`}),`$0.01`]}):s]}):c})},p=({quantities:e,tokenPrice:t,tokenSymbol:r=`SOL`,tokenDecimals:i=9})=>{let a=e.reduce(((e,t)=>e+t),0n),o=t&&r===`SOL`&&i===9?s(a,t):void 0,l=r===`SOL`&&i===9?c(a):`${n(a,i)} ${r}`;return(0,u.jsx)(m,{children:o?(0,u.jsx)(u.Fragment,{children:o===`<$0.01`?(0,u.jsxs)(_,{children:[(0,u.jsx)(g,{children:`<`}),`$0.01`]}):o}):l})},m=t.span`
  font-size: 14px;
  line-height: 140%;
  display: flex;
  gap: 4px;
  align-items: center;
`,h=t.span`
  font-size: 12px;
  line-height: 12px;
  color: var(--privy-color-foreground-3);
`,g=t.span`
  font-size: 10px;
`,_=t.span`
  display: flex;
  align-items: center;
`;function v(e,t){return`https://explorer.solana.com/account/${e}?chain=${t}`}var y=e=>(0,u.jsx)(b,{href:e.chainType===`ethereum`?r(e.chainId,e.walletAddress):v(e.walletAddress,e.chainId),target:`_blank`,children:l(e.walletAddress)}),b=t.a`
  &:hover {
    text-decoration: underline;
  }
`;export{y as i,f as n,d as r,p as t};
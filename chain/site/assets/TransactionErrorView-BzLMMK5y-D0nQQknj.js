import{o as e}from"./rolldown-runtime-DLMaRju-.js";import{n as t,t as n}from"./jsx-runtime-CvftCknt.js";import{t as r}from"./ChevronDownIcon-Cix9gOo-.js";import{c as i}from"./Loader-UAZqxsnw-BjnvLK0W.js";import{G as a,Q as o,W as s}from"./start-mfa-enrollment-DVLkqFkK-DTEfGukF.js";import{c,i as l,l as u,r as d,t as f}from"./ModalHeader-DwjVHxNn-BoeGJbGR.js";import{a as p,i as m,n as h,r as g,t as _}from"./Value-DTgR824E-BePrm8Jl.js";import{t as v}from"./ErrorMessage-D8VaAP5m-CS06WdNK.js";import{t as y}from"./LabelXs-oqZNqbm_-DLlwZvt7.js";import{t as ee}from"./Subtitle-CV-2yKE4-G0IX-WCN.js";import{t as te}from"./Title-BnzYV3Is-CNtNBwmi.js";import{t as b}from"./Address-Gm1e6Mbq-DBHzm8pM.js";import{t as x}from"./WalletInfoCard-CjlJgjiL-Cg5rmXwF.js";import{O as ne,ot as S}from"./user-DONTX7Nb-DEn_FIjv.js";import{t as re}from"./useActiveWallet-Bb_DnM2V-BU-0eGQ-.js";import{n as C}from"./LoadingSkeleton-BMsgO5PV-CquAQqwF.js";import{t as w}from"./isAddress-7BiR4TZ2.js";import{t as T}from"./shared-FM0rljBt-D-wAu1V6.js";import{n as E,t as D}from"./Checkbox-D1EDeo41-CBza6Itl.js";import{t as O}from"./ErrorBanner-BcpGRt0h-C-8MHaqy.js";import{t as k}from"./WarningBanner-ZZqCEtZK-BmunQMYG.js";import{y as A}from"./index.browser-B9DtAScm.js";import{n as j}from"./JsonTree-BHzNC-ic-BD2CORNN.js";import{t as M}from"./ExclamationCircleIcon-BfN0y50L.js";var N=e(t());function P({title:e,titleId:t,...n},r){return N.createElement(`svg`,Object.assign({xmlns:`http://www.w3.org/2000/svg`,fill:`none`,viewBox:`0 0 24 24`,strokeWidth:1.5,stroke:`currentColor`,"aria-hidden":`true`,"data-slot":`icon`,ref:r,"aria-labelledby":t},n),e?N.createElement(`title`,{id:t},e):null,N.createElement(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3`}))}var ie=N.forwardRef(P);function F({title:e,titleId:t,...n},r){return N.createElement(`svg`,Object.assign({xmlns:`http://www.w3.org/2000/svg`,fill:`none`,viewBox:`0 0 24 24`,strokeWidth:1.5,stroke:`currentColor`,"aria-hidden":`true`,"data-slot":`icon`,ref:r,"aria-labelledby":t},n),e?N.createElement(`title`,{id:t},e):null,N.createElement(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z`}))}var ae=N.forwardRef(F),I=n();function L({title:e,titleId:t,...n},r){return N.createElement(`svg`,Object.assign({xmlns:`http://www.w3.org/2000/svg`,fill:`none`,viewBox:`0 0 24 24`,strokeWidth:1.5,stroke:`currentColor`,"aria-hidden":`true`,"data-slot":`icon`,ref:r,"aria-labelledby":t},n),e?N.createElement(`title`,{id:t},e):null,N.createElement(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z`}))}var R=N.forwardRef(L),z=i(_)`
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--privy-color-accent);
  svg {
    fill: var(--privy-color-accent);
  }
`,B=({iconUrl:e,value:t,symbol:n,usdValue:r,nftName:i,nftCount:a,decimals:o,$isLoading:s})=>{if(s)return(0,I.jsx)(V,{$isLoading:s});let c=t&&r&&o?function(e,t,n){let r=parseFloat(e),i=parseFloat(n);if(r===0||i===0||Number.isNaN(r)||Number.isNaN(i))return e;let a=Math.ceil(-Math.log10(.01/(i/r))),o=10**(a=Math.max(a=Math.min(a,t),1)),s=+(Math.floor(r*o)/o).toFixed(a).replace(/\.?0+$/,``);return Intl.NumberFormat(void 0,{maximumFractionDigits:t}).format(s)}(t,o,r):t;return(0,I.jsxs)(`div`,{children:[(0,I.jsxs)(V,{$isLoading:s,children:[e&&(0,I.jsx)(U,{src:e,alt:`Token icon`}),a&&a>1?a+`x`:void 0,` `,i,c,` `,n]}),r&&(0,I.jsxs)(H,{$isLoading:s,children:[`$`,r]})]})},V=i.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.375rem;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  /**
   * @NOTE This is a code smell anti-pattern for styling components.
   * We are mixing JSX definitions with styled-components CSS definitions.
   * This is not ideal and should be refactored in the future to separate concerns.
   * This is also hard to read, as it makes it difficult to understand the structure
   * of the component and its styles by viewing the JSX.
   */

  ${C}
`,H=i.span`
  color: var(--privy-color-foreground-2);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  ${C}
`,U=i.img`
  height: 14px;
  width: 14px;
  margin-right: 4px;
  object-fit: contain;
`,oe=e=>{let{chain:t,transactionDetails:n,isTokenContractInfoLoading:r,symbol:i}=e,{action:a,functionName:o}=n;return(0,I.jsx)(T,{children:(0,I.jsxs)(p,{children:[a!==`transaction`&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Action`}),(0,I.jsx)(h,{children:o})]}),o===`mint`&&`args`in n&&n.args.filter((e=>e)).map(((e,n)=>(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Param ${n}`}),(0,I.jsx)(h,{children:typeof e==`string`&&w(e)?(0,I.jsx)(b,{address:e,url:t?.blockExplorers?.default?.url,showCopyIcon:!1}):e?.toString()})]},n))),o===`setApprovalForAll`&&n.operator&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Operator`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:n.operator,url:t?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),o===`setApprovalForAll`&&n.approved!==void 0&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Set approval to`}),(0,I.jsx)(h,{children:n.approved?`true`:`false`})]}),o===`transfer`||o===`transferWithMemo`||o===`transferFrom`||o===`safeTransferFrom`||o===`approve`?(0,I.jsxs)(I.Fragment,{children:[`formattedAmount`in n&&n.formattedAmount&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amount`}),(0,I.jsxs)(h,{$isLoading:r,children:[n.formattedAmount,` `,i]})]}),`tokenId`in n&&n.tokenId&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token ID`}),(0,I.jsx)(h,{children:n.tokenId.toString()})]})]}):null,o===`safeBatchTransferFrom`&&(0,I.jsxs)(I.Fragment,{children:[`amounts`in n&&n.amounts&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amounts`}),(0,I.jsx)(h,{children:n.amounts.join(`, `)})]}),`tokenIds`in n&&n.tokenIds&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token IDs`}),(0,I.jsx)(h,{children:n.tokenIds.join(`, `)})]})]}),o===`approve`&&n.spender&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Spender`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:n.spender,url:t?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),(o===`transferFrom`||o===`safeTransferFrom`||o===`safeBatchTransferFrom`)&&n.transferFrom&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Transferring from`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:n.transferFrom,url:t?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),(o===`transferFrom`||o===`safeTransferFrom`||o===`safeBatchTransferFrom`)&&n.transferTo&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Transferring to`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:n.transferTo,url:t?.blockExplorers?.default?.url,showCopyIcon:!1})})]})]})})},se=({variant:e,setPreventMaliciousTransaction:t,colorScheme:n=`light`,preventMaliciousTransaction:r})=>e===`warn`?(0,I.jsx)(W,{children:(0,I.jsxs)(k,{theme:n,children:[(0,I.jsx)(`span`,{style:{fontWeight:`500`},children:`Warning: Suspicious transaction`}),(0,I.jsx)(`br`,{}),`This has been flagged as a potentially deceptive request. Approving could put your assets or funds at risk.`]})}):e===`error`?(0,I.jsx)(I.Fragment,{children:(0,I.jsxs)(W,{children:[(0,I.jsx)(O,{theme:n,children:(0,I.jsxs)(`div`,{children:[(0,I.jsx)(`strong`,{children:`This is a malicious transaction`}),(0,I.jsx)(`br`,{}),`This transaction transfers tokens to a known malicious address. Proceeding may result in the loss of valuable assets.`]})}),(0,I.jsxs)(ce,{children:[(0,I.jsx)(D,{color:`var(--privy-color-error)`,checked:!r,readOnly:!0,onClick:()=>t(!r)}),(0,I.jsx)(`span`,{children:`I understand and want to proceed anyways.`})]})]})}):null,W=i.div`
  margin-top: 1.5rem;
`,ce=i.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
`,le=({transaction:e})=>(0,I.jsx)(ue,{as:`pre`,"aria-label":`Raw transaction data`,tabIndex:0,children:A().decode(e)}),ue=i(j)`
  && {
    margin-top: 1rem;
  }

  min-width: 0;
  max-width: 100%;
  overflow: auto;
  overflow-wrap: anywhere;
`,de=({transactionRequest:e})=>(0,I.jsx)(G,{as:`pre`,"aria-label":`Raw transaction data`,tabIndex:0,children:JSON.stringify(e,((e,t)=>typeof t==`bigint`?t.toString():t),2)}),G=i(j)`
  && {
    margin-top: 1rem;
  }

  min-width: 0;
  max-width: 100%;
  overflow: auto;
  overflow-wrap: anywhere;
`,fe=({transactionIndex:e,maxIndex:t})=>typeof e!=`number`||t===0?``:` (${e+1} / ${t+1})`,K=({img:e,submitError:t,prepareError:n,onClose:i,action:a,title:o,subtitle:l,txValue:y,rawTransaction:x,to:S,tokenAddress:C,network:w,missingFunds:T,fee:E,from:D,cta:O,disabled:k,chain:A,isSubmitting:j,isPreparing:M,isTokenPriceLoading:P,isTokenContractInfoLoading:F,isSponsored:L,symbol:R,balance:V,onClick:H,transactionDetails:U,transactionIndex:W,maxIndex:ce,onBack:le,chainName:ue,validation:G,hasScanDetails:K,setIsScanDetailsOpen:pe,preventMaliciousTransaction:q,setPreventMaliciousTransaction:J,tokensSent:Y,tokensReceived:X,isScanning:ye,isCancellable:be,functionName:xe})=>{let[Z,Se]=(0,N.useState)(!1),{showTransactionDetails:Q,setShowTransactionDetails:Ce,hasMoreDetails:$,isErc20Ish:we}=(e=>{let[t,n]=(0,N.useState)(!1),r=!0,i=!1;return(!e||e.isErc20Ish||e.action===`transaction`)&&(r=!1),r&&(i=Object.entries(e||{}).some((([e,t])=>t&&![`action`,`isErc20Ish`,`isNFTIsh`].includes(e)))),{showTransactionDetails:t,setShowTransactionDetails:n,hasMoreDetails:r&&i,isErc20Ish:e?.isErc20Ish}})(U),Te=ne(),Ee=we&&F||M||P||ye;return(0,I.jsxs)(I.Fragment,{children:[(0,I.jsx)(f,{onClose:i,backFn:le}),e&&(0,I.jsx)(ge,{children:e}),(0,I.jsxs)(te,{style:{marginTop:e?`1.5rem`:0},children:[o,(0,I.jsx)(fe,{maxIndex:ce,transactionIndex:W})]}),(0,I.jsx)(ee,{children:l}),Z&&x&&(0,I.jsx)(de,{transactionRequest:x}),(0,I.jsxs)(p,{style:{marginTop:`1rem`,display:Z?`none`:void 0},children:[y!==void 0&&BigInt(y)!==0n&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Value`}),(0,I.jsxs)(h,{children:[s({amount:BigInt(y),decimals:A?.nativeCurrency.decimals??18}),` `,A?.nativeCurrency.symbol??`ETH`]})]}),(!!Y[0]||Ee)&&(0,I.jsxs)(m,{children:[X.length>0?(0,I.jsx)(_,{children:`Send`}):(0,I.jsx)(_,{children:a===`approve`?`Approval amount`:`Amount`}),(0,I.jsxs)(`div`,{className:`flex flex-col`,children:[Y.length===0&&(0,I.jsx)(h,{children:`--`}),Y.map(((e,t)=>(0,I.jsx)(B,{iconUrl:e.iconUrl,value:xe===`setApprovalForAll`?`All`:e.value,usdValue:e.usdValue,symbol:e.symbol,nftName:e.nftName,nftCount:e.nftCount,decimals:e.decimals},t)))]})]}),X.length>0&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Receive`}),(0,I.jsx)(`div`,{className:`flex flex-col`,children:X.map(((e,t)=>(0,I.jsx)(B,{iconUrl:e.iconUrl,value:e.value,usdValue:e.usdValue,symbol:e.symbol,nftName:e.nftName,nftCount:e.nftCount,decimals:e.decimals},t)))})]}),U&&`spender`in U&&U?.spender?(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Spender`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:U.spender,url:A?.blockExplorers?.default?.url})})]}):null,S&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`To`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:S,url:A?.blockExplorers?.default?.url,showCopyIcon:!0})})]}),C&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token address`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:C,url:A?.blockExplorers?.default?.url})})]}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Network`}),(0,I.jsx)(h,{children:w})]}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Estimated fee`}),(0,I.jsx)(h,{$isLoading:M||P||L===void 0,children:L?(0,I.jsxs)(_e,{children:[(0,I.jsxs)(ve,{children:[`Sponsored by `,Te.name]}),(0,I.jsx)(ae,{height:16,width:16})]}):E})]}),$&&!K&&(0,I.jsxs)(I.Fragment,{children:[(0,I.jsx)(m,{className:`cursor-pointer`,onClick:()=>Ce(!Q),children:(0,I.jsxs)(g,{className:`flex items-center gap-x-1`,children:[`Details`,` `,(0,I.jsx)(r,{style:{width:`0.75rem`,marginLeft:`0.25rem`,transform:Q?`rotate(180deg)`:void 0}})]})}),Q&&U&&(0,I.jsx)(oe,{action:a,chain:A,transactionDetails:U,isTokenContractInfoLoading:F,symbol:R})]}),K&&(0,I.jsx)(m,{children:(0,I.jsxs)(z,{onClick:()=>pe(!0),children:[(0,I.jsx)(`span`,{className:`text-color-primary`,children:`Details`}),(0,I.jsx)(ie,{height:`14px`,width:`14px`,strokeWidth:`2`})]})})]}),x&&(0,I.jsx)(m,{style:{marginTop:`0.5rem`},children:(0,I.jsx)(z,{as:`button`,type:`button`,onClick:()=>Se((e=>!e)),children:Z?`View formatted`:`View raw`})}),(0,I.jsx)(re,{}),t?(0,I.jsx)(v,{style:{marginTop:`2rem`},children:t.message}):n&&W===0?(0,I.jsx)(v,{style:{marginTop:`2rem`},children:n.shortMessage??he}):null,(0,I.jsx)(se,{variant:G,preventMaliciousTransaction:q,setPreventMaliciousTransaction:J}),(0,I.jsx)(me,{$useSmallMargins:!(!n&&!t&&G!==`warn`&&G!==`error`),address:D,balance:V,errMsg:M||n||t||!T?void 0:`Add funds on ${A?.name??ue} to complete transaction.`}),(0,I.jsx)(u,{style:{marginTop:`1rem`},loading:j,disabled:k||M,onClick:H,children:O}),be&&(0,I.jsx)(c,{style:{marginTop:`1rem`},onClick:i,isSubmitting:!1,children:`Not now`}),(0,I.jsx)(d,{})]})},pe=({rawTransaction:e,img:t,title:n,subtitle:i,cta:a,instructions:o,network:c,blockExplorerUrl:l,isMissingFunds:g,submitError:x,parseError:S,total:C,swap:w,transactingWalletAddress:T,fee:E,balance:D,disabled:O,isSubmitting:k,isPreparing:A,isTokenPriceLoading:j,onClick:M,onClose:P,onBack:ie,isSponsored:F})=>{let L=A||j,[R,B]=(0,N.useState)(!1),[V,H]=(0,N.useState)(!1),U=ne();return(0,I.jsxs)(I.Fragment,{children:[(0,I.jsx)(f,{onClose:P,backFn:ie}),t&&(0,I.jsx)(ge,{children:t}),(0,I.jsx)(te,{style:{marginTop:t?`1.5rem`:0},children:n}),(0,I.jsx)(ee,{children:i}),V&&(0,I.jsx)(le,{transaction:e}),(0,I.jsxs)(p,{style:{marginTop:`1rem`,marginBottom:`.5rem`,display:V?`none`:void 0},children:[(C||L)&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amount`}),(0,I.jsx)(h,{$isLoading:L,children:C})]}),w&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Swap`}),(0,I.jsx)(h,{children:w})]}),c&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Network`}),(0,I.jsx)(h,{children:c})]}),(E||L||F!==void 0)&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Estimated fee`}),(0,I.jsx)(h,{$isLoading:L,children:F&&!L?(0,I.jsxs)(_e,{children:[(0,I.jsxs)(ve,{children:[`Sponsored by `,U.name]}),(0,I.jsx)(ae,{height:16,width:16})]}):E})]})]}),(0,I.jsx)(m,{style:{display:V?`none`:void 0},children:(0,I.jsxs)(z,{onClick:()=>B((e=>!e)),children:[(0,I.jsx)(`span`,{children:`Advanced`}),(0,I.jsx)(r,{height:`16px`,width:`16px`,strokeWidth:`2`,style:{transition:`all 300ms`,transform:R?`rotate(180deg)`:void 0}})]})}),!V&&R&&(0,I.jsx)(I.Fragment,{children:o.map(((e,t)=>e.type===`sol-transfer`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsxs)(y,{children:[`Transfer `,e.withSeed?`with seed`:``]})}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amount`}),(0,I.jsxs)(h,{children:[s({amount:e.value,decimals:e.token.decimals}),` `,e.token.symbol]})]}),!!e.toAccount&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Destination`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.toAccount,url:l})})]})]},t):e.type===`spl-transfer`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsxs)(y,{children:[`Transfer `,e.token.symbol]})}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amount`}),(0,I.jsx)(h,{children:e.value.toString()})]}),!!e.fromAta&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Source`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.fromAta,url:l})})]}),!!e.toAta&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Destination`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.toAta,url:l})})]}),!!e.token.address&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.token.address,url:l})})]})]},t):e.type===`ata-creation`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsx)(y,{children:`Create token account`})}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Program ID`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.program,url:l})})]}),!!e.owner&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Owner`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.owner,url:l})})]})]},t):e.type===`create-account`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsxs)(y,{children:[`Create account `,e.withSeed?`with seed`:``]})}),!!e.account&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Account`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.account,url:l})})]}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amount`}),(0,I.jsxs)(h,{children:[s({amount:e.value,decimals:9}),` SOL`]})]})]},t):e.type===`spl-init-account`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsx)(y,{children:`Initialize token account`})}),!!e.account&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Account`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.account,url:l})})]}),!!e.mint&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Mint`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mint,url:l})})]}),!!e.owner&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Owner`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.owner,url:l})})]})]},t):e.type===`spl-close-account`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsx)(y,{children:`Close token account`})}),!!e.source&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Source`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.source,url:l})})]}),!!e.destination&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Destination`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.destination,url:l})})]}),!!e.owner&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Owner`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.owner,url:l})})]})]},t):e.type===`spl-sync-native`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsx)(y,{children:`Sync native`})}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Program ID`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.program,url:l})})]})]},t):e.type===`raydium-swap-base-input`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsxs)(y,{children:[`Raydium swap`,` `,e.tokenIn&&e.tokenOut?`${e.tokenIn.symbol} → ${e.tokenOut.symbol}`:``]})}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amount in`}),(0,I.jsx)(h,{children:e.amountIn.toString()})]}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Minimum amount out`}),(0,I.jsx)(h,{children:e.minimumAmountOut.toString()})]}),e.mintIn&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token in`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mintIn,url:l})})]}),e.mintOut&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token out`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mintOut,url:l})})]})]},t):e.type===`raydium-swap-base-output`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsxs)(y,{children:[`Raydium swap`,` `,e.tokenIn&&e.tokenOut?`${e.tokenIn.symbol} → ${e.tokenOut.symbol}`:``]})}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Max amount in`}),(0,I.jsx)(h,{children:e.maxAmountIn.toString()})]}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amount out`}),(0,I.jsx)(h,{children:e.amountOut.toString()})]}),e.mintIn&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token in`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mintIn,url:l})})]}),e.mintOut&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token out`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mintOut,url:l})})]})]},t):e.type===`jupiter-swap-shared-accounts-route`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsxs)(y,{children:[`Jupiter swap`,` `,e.tokenIn&&e.tokenOut?`${e.tokenIn.symbol} → ${e.tokenOut.symbol}`:``]})}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`In amount`}),(0,I.jsx)(h,{children:e.inAmount.toString()})]}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Quoted out amount`}),(0,I.jsx)(h,{children:e.quotedOutAmount.toString()})]}),e.mintIn&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token in`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mintIn,url:l})})]}),e.mintOut&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token out`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mintOut,url:l})})]})]},t):e.type===`jupiter-swap-exact-out-route`?(0,I.jsxs)(q,{children:[(0,I.jsx)(m,{children:(0,I.jsxs)(y,{children:[`Jupiter swap`,` `,e.tokenIn&&e.tokenOut?`${e.tokenIn.symbol} → ${e.tokenOut.symbol}`:``]})}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Quoted in amount`}),(0,I.jsx)(h,{children:e.quotedInAmount.toString()})]}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Amount out`}),(0,I.jsx)(h,{children:e.outAmount.toString()})]}),e.mintIn&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token in`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mintIn,url:l})})]}),e.mintOut&&(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Token out`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.mintOut,url:l})})]})]},t):(0,I.jsxs)(q,{children:[(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Program ID`}),(0,I.jsx)(h,{children:(0,I.jsx)(b,{address:e.program,url:l})})]}),(0,I.jsxs)(m,{children:[(0,I.jsx)(_,{children:`Data`}),(0,I.jsx)(h,{children:e.discriminator})]})]},t)))}),(0,I.jsx)(m,{style:{marginTop:`0.5rem`},children:(0,I.jsx)(z,{as:`button`,type:`button`,onClick:()=>H((e=>!e)),children:V?`View formatted`:`View raw`})}),(0,I.jsx)(re,{}),x?(0,I.jsx)(v,{style:{marginTop:`2rem`},children:x.message}):S?(0,I.jsx)(v,{style:{marginTop:`2rem`},children:he}):null,(0,I.jsx)(me,{$useSmallMargins:!(!S&&!x),title:``,address:T,balance:D,errMsg:A||S||x||!g?void 0:`Add funds on Solana to complete transaction.`}),(0,I.jsx)(u,{style:{marginTop:`1rem`},loading:k,disabled:O||A,onClick:M,children:a}),(0,I.jsx)(d,{})]})},me=i(x)`
  ${e=>e.$useSmallMargins?`margin-top: 0.5rem;`:`margin-top: 2rem;`}
`,q=i(p)`
  margin-top: 0.5rem;
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: var(--privy-border-radius-sm);
  padding: 0.5rem;
`,he=`There was an error preparing your transaction. Your transaction request will likely fail.`,ge=i.div`
  display: flex;
  width: 100%;
  justify-content: center;
  max-height: 40px;

  > img {
    object-fit: contain;
    border-radius: var(--privy-border-radius-sm);
  }
`,_e=i.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
`,ve=i.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,J=e=>e?.code===o.COMPLIANCE_BLOCKED,Y=()=>(0,I.jsxs)(Z,{children:[(0,I.jsx)(Q,{}),(0,I.jsx)(Se,{})]}),X=({transactionError:e,chainId:t,onClose:n,onRetry:r,chainType:i,transactionHash:s})=>{let{chains:c}=S(),[u,d]=(0,N.useState)(!1),{errorCode:p,errorMessage:m}=((e,t)=>{if(e instanceof a&&e.code===o.MISSING_MFA_ENROLLMENT)return{errorCode:`MFA enrollment required`,errorMessage:e.message};if(t===`ethereum`)return J(e)?{errorCode:`Transaction blocked`,errorMessage:e.message}:{errorCode:e.details??e.message,errorMessage:e.shortMessage};let n=e.txSignature,r=e?.transactionMessage||`Something went wrong.`;if(Array.isArray(e.logs)){let t=e.logs.find((e=>/insufficient (lamports|funds)/gi.test(e)));t&&(r=t)}return{transactionHash:n,errorMessage:r}})(e,i),h=J(e),g=(({chains:e,chainId:t,chainType:n,transactionHash:r})=>n===`ethereum`?e.find((e=>e.id===t))?.blockExplorers?.default.url??`https://etherscan.io`:function(e,t){return`https://explorer.solana.com/tx/${e}?chain=${t}`}(r||``,t))({chains:c,chainId:t,chainType:i,transactionHash:s});return(0,I.jsxs)(I.Fragment,{children:[(0,I.jsx)(f,{onClose:n}),(0,I.jsxs)(ye,{children:[(0,I.jsx)(Y,{}),(0,I.jsx)(be,{children:p}),(0,I.jsx)(xe,{children:h?`This transaction cannot be completed.`:`Please try again.`}),(0,I.jsxs)(we,{children:[(0,I.jsx)($,{children:`Error message`}),(0,I.jsx)(Ee,{$clickable:!1,children:m})]}),s&&(0,I.jsxs)(we,{children:[(0,I.jsx)($,{children:`Transaction hash`}),(0,I.jsxs)(Te,{children:[`Copy this hash to view details about the transaction on a`,` `,(0,I.jsx)(`u`,{children:(0,I.jsx)(`a`,{href:g,children:`block explorer`})}),`.`]}),(0,I.jsxs)(Ee,{$clickable:!0,onClick:async()=>{await navigator.clipboard.writeText(s),d(!0)},children:[s,(0,I.jsx)(ke,{clicked:u})]})]}),!h&&(0,I.jsx)(Ce,{onClick:()=>r({resetNonce:!!s}),children:`Retry transaction`})]}),(0,I.jsx)(l,{})]})},ye=i.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`,be=i.span`
  color: var(--privy-color-foreground);
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.25rem; /* 111.111% */
  text-align: center;
  margin: 10px;
`,xe=i.span`
  margin-top: 4px;
  margin-bottom: 10px;
  color: var(--privy-color-foreground-3);
  text-align: center;

  font-size: 0.875rem;
  font-style: normal;
  font-weight: 400;
  line-height: 20px; /* 142.857% */
  letter-spacing: -0.008px;
`,Z=i.div`
  position: relative;
  width: 60px;
  height: 60px;
  margin: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
`,Se=i(M)`
  position: absolute;
  width: 35px;
  height: 35px;
  color: var(--privy-color-error);
`,Q=i.div`
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--privy-color-error);
  opacity: 0.1;
`,Ce=i(u)`
  && {
    margin-top: 24px;
  }
  transition:
    color 350ms ease,
    background-color 350ms ease;
`,$=i.span`
  width: 100%;
  text-align: left;
  font-size: 0.825rem;
  color: var(--privy-color-foreground);
  padding: 4px;
`,we=i.div`
  width: 100%;
  margin: 5px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`,Te=i.text`
  position: relative;
  width: 100%;
  padding: 5px;
  font-size: 0.8rem;
  color: var(--privy-color-foreground-3);
  text-align: left;
  overflow-wrap: break-word;
`,Ee=i.span`
  position: relative;
  width: 100%;
  background-color: var(--privy-color-background-2);
  padding: 8px 12px;
  border-radius: 10px;
  margin-top: 5px;
  font-size: 14px;
  color: var(--privy-color-foreground-3);
  text-align: left;
  overflow-wrap: break-word;
  ${e=>e.$clickable&&`cursor: pointer;
  transition: background-color 0.3s;
  padding-right: 45px;

  &:hover {
    background-color: var(--privy-color-foreground-4);
  }`}
`,De=i(R)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,Oe=i(E)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,ke=({clicked:e})=>(0,I.jsx)(e?Oe:De,{});export{pe as n,K as r,X as t};
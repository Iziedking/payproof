import{o as e}from"./rolldown-runtime-DLMaRju-.js";import{n as t,t as n}from"./jsx-runtime-CvftCknt.js";import{t as r}from"./lib-CB0iRLqZ.js";import{c as i,t as a}from"./Loader-UAZqxsnw-BjnvLK0W.js";import{t as o}from"./CopyToClipboard-i_OQSBJr-D_GDYkRo.js";import{t as s}from"./OpenLink-CUpJ1mOr-CcpZRXEy.js";import{t as c}from"./QrCode-BK-Z1p5j-D0bCPqCy.js";import{N as l,O as u,_ as d,ot as f}from"./user-DONTX7Nb-DEn_FIjv.js";import{t as p}from"./ScreenLayout-749WzGBp-DXhNNW7v.js";import{t as m}from"./farcaster-DPlSjvF5-hDHFwtNI.js";var h=n(),g=e(t(),1),_=e(r(),1),v=`#8a63d2`,y=({appName:e,loading:t,success:n,errorMessage:r,connectUri:i,onBack:l,onClose:u,onOpenFarcaster:d})=>(0,h.jsx)(p,_.isMobile||t?_.isIOS?{title:r?r.message:`Add a signer to Farcaster`,subtitle:r?r.detail:`This will allow ${e} to add casts, likes, follows, and more on your behalf.`,icon:m,iconVariant:`loading`,iconLoadingStatus:{success:n,fail:!!r},primaryCta:i&&d?{label:`Open Farcaster app`,onClick:d}:void 0,onBack:l,onClose:u,watermark:!0}:{title:r?r.message:`Requesting signer from Farcaster`,subtitle:r?r.detail:`This should only take a moment`,icon:m,iconVariant:`loading`,iconLoadingStatus:{success:n,fail:!!r},onBack:l,onClose:u,watermark:!0,children:i&&_.isMobile&&(0,h.jsx)(b,{children:(0,h.jsx)(s,{text:`Take me to Farcaster`,url:i,color:v})})}:{title:`Add a signer to Farcaster`,subtitle:`This will allow ${e} to add casts, likes, follows, and more on your behalf.`,onBack:l,onClose:u,watermark:!0,children:(0,h.jsxs)(x,{children:[(0,h.jsx)(S,{children:i?(0,h.jsx)(c,{url:i,size:275,squareLogoElement:m}):(0,h.jsx)(T,{children:(0,h.jsx)(a,{})})}),(0,h.jsxs)(C,{children:[(0,h.jsx)(w,{children:`Or copy this link and paste it into a phone browser to open the Farcaster app.`}),i&&(0,h.jsx)(o,{text:i,itemName:`link`,color:v})]})]})}),b=i.div`
  margin-top: 24px;
`,x=i.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,S=i.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,C=i.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,w=i.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,T=i.div`
  position: relative;
  width: 82px;
  height: 82px;
`,E={component:()=>{let{lastScreen:e,navigateBack:t,data:n}=d(),r=u(),{requestFarcasterSignerStatus:i,closePrivyModal:a}=f(),[o,s]=(0,g.useState)(void 0),[c,p]=(0,g.useState)(!1),[m,_]=(0,g.useState)(!1),v=(0,g.useRef)([]),b=n?.farcasterSigner;(0,g.useEffect)((()=>{let e=Date.now(),t=setInterval((async()=>{if(!b?.public_key)return clearInterval(t),void s({retryable:!0,message:`Connect failed`,detail:`Something went wrong. Please try again.`});b.status===`approved`&&(clearInterval(t),p(!1),_(!0),v.current.push(setTimeout((()=>a({shouldCallAuthOnSuccess:!1,isSuccess:!0})),1400)));let n=await i(b?.public_key),r=Date.now()-e;n.status===`approved`?(clearInterval(t),p(!1),_(!0),v.current.push(setTimeout((()=>a({shouldCallAuthOnSuccess:!1,isSuccess:!0})),l))):r>3e5?(clearInterval(t),s({retryable:!0,message:`Connect failed`,detail:`The request timed out. Try again.`})):n.status===`revoked`&&(clearInterval(t),s({retryable:!0,message:`Request rejected`,detail:`The request was rejected. Please try again.`}))}),2e3);return()=>{clearInterval(t),v.current.forEach((e=>clearTimeout(e)))}}),[]);let x=b?.status===`pending_approval`?b.signer_approval_url:void 0;return(0,h.jsx)(y,{appName:r.name,loading:c,success:m,errorMessage:o,connectUri:x,onBack:e?t:void 0,onClose:a,onOpenFarcaster:()=>{x&&(window.location.href=x)}})}};export{E as FarcasterSignerStatusScreen,E as default,y as FarcasterSignerStatusView};
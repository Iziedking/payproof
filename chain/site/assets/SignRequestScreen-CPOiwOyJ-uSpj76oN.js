import{o as e}from"./rolldown-runtime-DLMaRju-.js";import{n as t,t as n}from"./jsx-runtime-CvftCknt.js";import{r}from"./esm-n2lWo7kz.js";import{t as i}from"./createLucideIcon-Cp5gDHSp.js";import{c as a}from"./Loader-UAZqxsnw-BjnvLK0W.js";import{P as o,b as s}from"./isAddress-7BiR4TZ2.js";import{G as c,Q as l,x as u}from"./start-mfa-enrollment-DVLkqFkK-DTEfGukF.js";import{t as d}from"./CopyToClipboard-i_OQSBJr-D_GDYkRo.js";import{r as f}from"./Layouts-CaU-iybi-BXZv4R83.js";import{n as p,t as m}from"./JsonTree-BHzNC-ic-BD2CORNN.js";import{g as h,i as g}from"./use-sign-transaction-internal-D4F1fnSA-BM9LmPiN.js";import{C as _,N as v,X as y,_ as b,ot as x}from"./user-DONTX7Nb-DEn_FIjv.js";import{t as S}from"./ScreenLayout-749WzGBp-DXhNNW7v.js";var C=i(`square-pen`,[[`path`,{d:`M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7`,key:`1m0v6g`}],[`path`,{d:`M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z`,key:`ohrbg2`}]]),w=n(),T=e(t(),1),E=a.img`
  && {
    height: ${e=>e.size===`sm`?`65px`:`140px`};
    width: ${e=>e.size===`sm`?`65px`:`140px`};
    border-radius: 16px;
    margin-bottom: 12px;
  }
`,D=e=>{if(!o(e))return e;try{let t=s(e);return t.includes(`�`)?e:t}catch{return e}},O=e=>{try{let t=r.decode(e),n=new TextDecoder().decode(t);return n.includes(`�`)?e:n}catch{return e}},k=e=>{let{types:t,primaryType:n,...r}=e.typedData;return(0,w.jsxs)(w.Fragment,{children:[(0,w.jsx)(P,{data:r}),(0,w.jsx)(d,{text:(i=e.typedData,JSON.stringify(i,null,2)),itemName:`full payload to clipboard`}),` `]});var i},A=({method:e,messageData:t,copy:n,iconUrl:r,isLoading:i,success:a,walletProxyIsLoading:o,errorMessage:s,isCancellable:c,onSign:l,onCancel:u,onClose:d})=>(0,w.jsx)(S,{title:n.title,subtitle:n.description,showClose:!0,onClose:d,icon:C,iconVariant:`subtle`,helpText:s?(0,w.jsx)(N,{children:s}):void 0,primaryCta:{label:n.buttonText,onClick:l,disabled:i||a||o,loading:i},secondaryCta:c?{label:`Not now`,onClick:u,disabled:i||a||o}:void 0,watermark:!0,children:(0,w.jsxs)(f,{children:[r?(0,w.jsx)(E,{style:{alignSelf:`center`},size:`sm`,src:r,alt:`app image`}):null,(0,w.jsxs)(M,{children:[e===`personal_sign`&&(0,w.jsx)(F,{children:D(t)}),e===`eth_signTypedData_v4`&&(0,w.jsx)(k,{typedData:t}),e===`solana_signMessage`&&(0,w.jsx)(F,{children:O(t)})]})]})}),j={component:()=>{let{authenticated:e}=_(),{initializeWalletProxy:t,closePrivyModal:n}=x(),{navigate:r,data:i,onUserCloseViaDialogOrKeybindRef:a}=b(),[o,s]=(0,T.useState)(!0),[d,f]=(0,T.useState)(``),[p,m]=(0,T.useState)(),[S,C]=(0,T.useState)(null),[E,D]=(0,T.useState)(!1);(0,T.useEffect)((()=>{e||r(`LandingScreen`)}),[e]),(0,T.useEffect)((()=>{t(y).then((e=>{s(!1),e||(f(`An error has occurred, please try again.`),m(new h(new g(d,u.E32603_DEFAULT_INTERNAL_ERROR.eipCode))))}))}),[]);let{method:O,data:k,confirmAndSign:j,onSuccess:M,onFailure:N,uiOptions:P}=i.signMessage,F={title:P?.title||`Sign message`,description:P?.description||`Signing this message will not cost you any fees.`,buttonText:P?.buttonText||`Sign and continue`},I=e=>{e?M(e):N(p||new h(new g(`The user rejected the request.`,u.E4001_USER_REJECTED_REQUEST.eipCode))),n({shouldCallAuthOnSuccess:!1}),setTimeout((()=>{C(null),f(``),m(void 0)}),200)};return a.current=()=>{I(S)},(0,w.jsx)(A,{method:O,messageData:k,copy:F,iconUrl:P?.iconUrl&&typeof P.iconUrl==`string`?P.iconUrl:void 0,isLoading:E,success:S!==null,walletProxyIsLoading:o,errorMessage:d,isCancellable:P?.isCancellable,onSign:async()=>{D(!0),f(``);try{let e=await j();C(e),D(!1),setTimeout((()=>{I(e)}),v)}catch(e){console.error(e);let t=e instanceof c&&e.code===l.MISSING_MFA_ENROLLMENT?e.message:`An error has occurred, please try again.`;f(t),m(new h(new g(t,u.E32603_DEFAULT_INTERNAL_ERROR.eipCode))),D(!1)}},onCancel:()=>I(null),onClose:()=>I(S)})}},M=a.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`,N=a.p`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-error-dark);
    font-size: 14px;
    line-height: 22px;
  }
`,P=a(m)`
  margin-top: 0;
`,F=a(p)`
  margin-top: 0;
`;export{j as SignRequestScreen,j as default,A as SignRequestView};
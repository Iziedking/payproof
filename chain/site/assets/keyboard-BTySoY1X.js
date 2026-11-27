import{o as e}from"./rolldown-runtime-DLMaRju-.js";import{n as t}from"./jsx-runtime-CvftCknt.js";import{c as n,o as r,s as i}from"./Loader-UAZqxsnw-BjnvLK0W.js";var a=i`
  *,
  ::before,
  ::after {
    box-sizing: border-box;
    border-width: 0;
    border-style: solid;
  }

  line-height: 1.15;
  -webkit-text-size-adjust: 100%;
  -moz-tab-size: 4;
  tab-size: 4;
  font-feature-settings: normal;

  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif,
    'Apple Color Emoji',
    'Segoe UI Emoji';

  hr {
    height: 0;
    color: inherit;
    border-top-width: 1px;
  }

  abbr:where([title]) {
    text-decoration: underline dotted;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: inherit;
    font-weight: inherit;
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      Roboto,
      Helvetica,
      Arial,
      sans-serif,
      'Apple Color Emoji',
      'Segoe UI Emoji';
    display: inline;
  }

  a {
    color: inherit;
    text-decoration: inherit;
  }

  b,
  strong {
    font-weight: bolder;
  }

  code,
  kbd,
  samp,
  pre {
    font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 1em;
  }

  small {
    font-size: 80%;
  }

  sub,
  sup {
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }

  sub {
    bottom: -0.25em;
  }

  sup {
    top: -0.5em;
  }

  table {
    text-indent: 0;
    border-color: inherit;
    border-collapse: collapse;
  }

  button,
  input,
  optgroup,
  select,
  textarea {
    font-family: inherit;
    font-size: 100%;
    font-weight: inherit;
    line-height: inherit;
    color: inherit;
    margin: 0;
    padding: 0;
  }

  button,
  select {
    text-transform: none;
  }

  button,
  [type='button'],
  [type='reset'],
  [type='submit'] {
    -webkit-appearance: button;
    background-color: transparent;
    background-image: none;
  }

  ::-moz-focus-inner {
    border-style: none;
    padding: 0;
  }

  :-moz-focusring {
    outline: 1px dotted ButtonText;
  }

  :-moz-ui-invalid {
    box-shadow: none;
  }

  legend {
    padding: 0;
  }

  progress {
    vertical-align: baseline;
  }

  ::-webkit-inner-spin-button,
  ::-webkit-outer-spin-button {
    height: auto;
  }

  [type='search'] {
    -webkit-appearance: textfield;
    outline-offset: -2px;
  }

  ::-webkit-search-decoration {
    -webkit-appearance: none;
  }

  ::-webkit-file-upload-button {
    -webkit-appearance: button;
    font: inherit;
  }

  summary {
    display: list-item;
  }

  blockquote,
  dl,
  dd,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  hr,
  figure,
  p,
  pre {
    margin: 0;
  }

  fieldset {
    margin: 0;
    padding: 0;
  }

  legend {
    padding: 0;
  }

  ol,
  ul,
  menu {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  textarea {
    resize: vertical;
  }

  input::placeholder,
  textarea::placeholder {
    opacity: 1;
    color: #9ca3af;
  }

  button,
  [role='button'] {
    cursor: pointer;
  }

  :disabled {
    cursor: default;
  }

  img,
  svg,
  video,
  canvas,
  audio,
  iframe,
  embed,
  object {
    display: block;
  }

  img,
  video {
    max-width: 100%;
    height: auto;
  }

  [hidden] {
    display: none;
  }
`,o=r`
  :root {
     ${e=>c(e.palette)}
  };
`,s=e=>`var(${e})`,c=e=>{let t=function(e){return{"--privy-color-background":e.background,"--privy-color-background-2":e.background2,"--privy-color-background-3":e.background3,"--privy-color-foreground":e.foreground,"--privy-color-foreground-2":e.foreground2,"--privy-color-foreground-3":e.foreground3,"--privy-color-foreground-4":e.foreground4,"--privy-color-foreground-accent":e.foregroundAccent,"--privy-color-accent":e.accent,"--privy-color-accent-light":e.accentLight,"--privy-color-accent-hover":e.accentHover,"--privy-color-accent-dark":e.accentDark,"--privy-color-accent-darkest":e.accentDarkest,"--privy-color-success":e.success,"--privy-color-success-dark":e.successDark,"--privy-color-success-light":e.successLight,"--privy-color-success-bg":e.successBg,"--privy-color-error":e.error,"--privy-color-error-light":e.errorLight,"--privy-color-error-bg":e.errorBg,"--privy-color-error-bg-hover":e.errorBgHover,"--privy-color-warn":e.warn,"--privy-color-warn-light":e.warnLight,"--privy-color-warn-bg":e.warnBg,"--privy-color-warning-dark":e.warningDark,"--privy-color-error-dark":e.errorDark,"--privy-color-info-bg":e.infoBg,"--privy-color-info-bg-hover":e.infoBgHover,"--privy-color-border-default":e.borderDefault,"--privy-color-border-hover":e.borderHover,"--privy-color-border-focus":e.borderFocus,"--privy-color-border-error":e.borderError,"--privy-color-border-success":e.borderSuccess,"--privy-color-border-warning":e.borderWarning,"--privy-color-border-info":e.borderInfo,"--privy-color-border-interactive":e.borderInteractive,"--privy-color-border-interactive-hover":e.borderInteractiveHover,"--privy-color-background-hover":e.backgroundHover,"--privy-color-background-clicked":e.backgroundClicked,"--privy-color-background-disabled":e.backgroundDisabled,"--privy-color-background-interactive":e.backgroundInteractive,"--privy-color-background-interactive-hover":e.backgroundInteractiveHover,"--privy-color-background-interactive-clicked":e.backgroundInteractiveClicked,"--privy-color-background-interactive-disabled":e.backgroundInteractiveDisabled,"--privy-color-foreground-hover":e.foregroundHover,"--privy-color-foreground-clicked":e.foregroundClicked,"--privy-color-foreground-disabled":e.foregroundDisabled,"--privy-color-foreground-interactive":e.foregroundInteractive,"--privy-color-foreground-interactive-hover":e.foregroundInteractiveHover,"--privy-link-navigation-color":e.linkNavigationColor,"--privy-link-navigation-decoration":e.linkNavigationDecoration,"--privy-accent-has-good-contrast":e.accentHasGoodContrast,"--privy-color-icon-default":e.iconDefault,"--privy-color-icon-muted":e.iconMuted,"--privy-color-icon-subtle":e.iconSubtle,"--privy-color-icon-inverse":e.iconInverse,"--privy-color-icon-success":e.iconSuccess,"--privy-color-icon-warning":e.iconWarning,"--privy-color-icon-error":e.iconError,"--privy-color-icon-interactive":e.iconInteractive,"--privy-color-icon-default-hover":e.iconDefaultHover,"--privy-color-icon-muted-hover":e.iconMutedHover,"--privy-color-icon-subtle-hover":e.iconSubtleHover,"--privy-color-icon-default-clicked":e.iconDefaultClicked,"--privy-color-icon-muted-clicked":e.iconMutedClicked,"--privy-color-icon-subtle-clicked":e.iconSubtleClicked,"--privy-color-icon-default-disabled":e.iconDefaultDisabled,"--privy-color-icon-muted-disabled":e.iconMutedDisabled,"--privy-color-icon-subtle-disabled":e.iconSubtleDisabled,"--privy-color-icon-error-hover":e.iconErrorHover,"--privy-color-icon-interactive-hover":e.iconInteractiveHover,"--privy-color-icon-error-clicked":e.iconErrorClicked,"--privy-color-icon-interactive-clicked":e.iconInteractiveClicked,"--privy-color-icon-muted-disabled-alt":e.iconMutedDisabledAlt,"--privy-color-icon-subtle-disabled-alt":e.iconSubtleDisabledAlt,"--privy-color-shadow-elevation":e.shadow,"--privy-shadow-popover":`0 2px 4px var(--privy-color-shadow-elevation)`,"--privy-shadow-sheet":`0 0 36px var(--privy-color-shadow-elevation)`,"--privy-shadow-modal":`0 8px 36px var(--privy-color-shadow-elevation)`,"--privy-shadow-focus-ring":`0 0 0 3px var(--privy-color-border-focus)`,"--privy-border-radius-xs":`6px`,"--privy-border-radius-sm":`8px`,"--privy-border-radius-md":`12px`,"--privy-border-radius-mdlg":`16px`,"--privy-border-radius-lg":`24px`,"--privy-border-radius-full":`9999px`,"--privy-height-modal-full":`620px`,"--privy-height-modal-compact":`480px`}}(e);return i`
    ${Object.entries(t).map((([e,t])=>`${e}: ${t};`)).join(`
`)}
  `},l=n.div`
  /* css normalize only the privy application to avoid conflicts
     with consuming application */
  ${a}

  /* Privy styles */
  color: var(--privy-color-foreground-2);

  h3 {
    font-size: 16px;
    line-height: 24px;
    font-weight: 500;
    color: var(--privy-color-foreground-2);
  }

  h4 {
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    color: var(--privy-color-foreground);
  }

  p {
    font-size: 13px;
    line-height: 20px;
    color: var(--privy-color-foreground-2);
  }

  button:focus,
  input:focus,
  optgroup:focus,
  select:focus,
  textarea:focus {
    outline: none;
  }

  button:focus-visible,
  input:focus-visible,
  optgroup:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: none;
    border-color: var(--privy-color-accent-light);
    box-shadow: var(--privy-shadow-focus-ring);
  }

  .mobile-only {
    @media (min-width: 441px) {
      display: none;
    }
  }

  /* Animations */

  @keyframes fadein {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`,u=Object.defineProperty,d=(e,t,n)=>t in e?u(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,f=(e,t,n)=>(d(e,typeof t==`symbol`?t:t+``,n),n),p=new class{constructor(){f(this,`current`,this.detect()),f(this,`handoffState`,`pending`),f(this,`currentId`,0)}set(e){this.current!==e&&(this.handoffState=`pending`,this.currentId=0,this.current=e)}reset(){this.set(this.detect())}nextId(){return++this.currentId}get isServer(){return this.current===`server`}get isClient(){return this.current===`client`}detect(){return typeof window>`u`||typeof document>`u`?`server`:`client`}handoff(){this.handoffState===`pending`&&(this.handoffState=`complete`)}get isHandoffComplete(){return this.handoffState===`complete`}};function m(e){return p.isServer?null:e==null?document:e?.ownerDocument??document}function h(e){return p.isServer?null:e==null?document:(e?.getRootNode)?.call(e)??document}function g(e){return h(e)?.activeElement??null}function ee(e){return g(e)===e}var _=e(t(),1);function v(e){typeof queueMicrotask==`function`?queueMicrotask(e):Promise.resolve().then(e).catch(e=>setTimeout(()=>{throw e}))}function y(){let e=[],t={addEventListener(e,n,r,i){return e.addEventListener(n,r,i),t.add(()=>e.removeEventListener(n,r,i))},requestAnimationFrame(...e){let n=requestAnimationFrame(...e);return t.add(()=>cancelAnimationFrame(n))},nextFrame(...e){return t.requestAnimationFrame(()=>t.requestAnimationFrame(...e))},setTimeout(...e){let n=setTimeout(...e);return t.add(()=>clearTimeout(n))},microTask(...e){let n={current:!0};return v(()=>{n.current&&e[0]()}),t.add(()=>{n.current=!1})},style(e,t,n){let r=e.style.getPropertyValue(t);return Object.assign(e.style,{[t]:n}),this.add(()=>{Object.assign(e.style,{[t]:r})})},group(e){let t=y();return e(t),this.add(()=>t.dispose())},add(t){return e.includes(t)||e.push(t),()=>{let n=e.indexOf(t);if(n>=0)for(let t of e.splice(n,1))t()}},dispose(){for(let t of e.splice(0))t()}};return t}function b(){let[e]=(0,_.useState)(y);return(0,_.useEffect)(()=>()=>e.dispose(),[e]),e}var x=(e,t)=>{p.isServer?(0,_.useEffect)(e,t):(0,_.useLayoutEffect)(e,t)};function S(e){let t=(0,_.useRef)(e);return x(()=>{t.current=e},[e]),t}var C=function(e){let t=S(e);return _.useCallback((...e)=>t.current(...e),[t])};function w(e){return(0,_.useMemo)(()=>e,Object.values(e))}var te=(0,_.createContext)(void 0);function T(){return(0,_.useContext)(te)}function E(...e){return Array.from(new Set(e.flatMap(e=>typeof e==`string`?e.split(` `):[]))).filter(Boolean).join(` `)}function D(e,t,...n){if(e in t){let r=t[e];return typeof r==`function`?r(...n):r}let r=Error(`Tried to handle "${e}" but there is no handler defined. Only defined handlers are: ${Object.keys(t).map(e=>`"${e}"`).join(`, `)}.`);throw Error.captureStackTrace&&Error.captureStackTrace(r,D),r}var O=(e=>(e[e.None=0]=`None`,e[e.RenderStrategy=1]=`RenderStrategy`,e[e.Static=2]=`Static`,e))(O||{}),k=(e=>(e[e.Unmount=0]=`Unmount`,e[e.Hidden=1]=`Hidden`,e))(k||{});function A(){let e=ne();return(0,_.useCallback)(t=>j({mergeRefs:e,...t}),[e])}function j({ourProps:e,theirProps:t,slot:n,defaultTag:r,features:i,visible:a=!0,name:o,mergeRefs:s}){s??=re;let c=N(t,e);if(a)return M(c,n,r,o,s);let l=i??0;if(l&2){let{static:e=!1,...t}=c;if(e)return M(t,n,r,o,s)}if(l&1){let{unmount:e=!0,...t}=c;return D(+!e,{0(){return null},1(){return M({...t,hidden:!0,style:{display:`none`}},n,r,o,s)}})}return M(c,n,r,o,s)}function M(e,t={},n,r,i){let{as:a=n,children:o,refName:s=`ref`,...c}=L(e,[`unmount`,`static`]),l=e.ref===void 0?{}:{[s]:e.ref},u=typeof o==`function`?o(t):o;u=R(u),`className`in c&&c.className&&typeof c.className==`function`&&(c.className=c.className(t)),c[`aria-labelledby`]&&c[`aria-labelledby`]===c.id&&(c[`aria-labelledby`]=void 0);let d={};if(t){let e=!1,n=[];for(let[r,i]of Object.entries(t))typeof i==`boolean`&&(e=!0),i===!0&&n.push(r.replace(/([A-Z])/g,e=>`-${e.toLowerCase()}`));if(e){d[`data-headlessui-state`]=n.join(` `);for(let e of n)d[`data-${e}`]=``}}if(z(a)&&(Object.keys(I(c)).length>0||Object.keys(I(d)).length>0)){if(!(0,_.isValidElement)(u)||Array.isArray(u)&&u.length>1||B(u)){if(Object.keys(I(c)).length>0)throw Error([`Passing props on "Fragment"!`,``,`The current component <${r} /> is rendering a "Fragment".`,`However we need to passthrough the following props:`,Object.keys(I(c)).concat(Object.keys(I(d))).map(e=>`  - ${e}`).join(`
`),``,`You can apply a few solutions:`,['Add an `as="..."` prop, to ensure that we render an actual element instead of a "Fragment".',`Render a single element as the child so that we can forward the props onto that element.`].map(e=>`  - ${e}`).join(`
`)].join(`
`))}else{let e=u.props?.className,t=typeof e==`function`?(...t)=>E(e(...t),c.className):E(e,c.className),n=t?{className:t}:{},r=N(u.props,I(L(c,[`ref`])));for(let e in d)e in r&&delete d[e];return(0,_.cloneElement)(u,Object.assign({},r,d,l,{ref:i(ie(u),l.ref)},n))}}return(0,_.createElement)(a,Object.assign({},L(c,[`ref`]),!z(a)&&l,!z(a)&&d),u)}function ne(){let e=(0,_.useRef)([]),t=(0,_.useCallback)(t=>{for(let n of e.current)n!=null&&(typeof n==`function`?n(t):n.current=t)},[]);return(...n)=>{if(!n.every(e=>e==null))return e.current=n,t}}function re(...e){return e.every(e=>e==null)?void 0:t=>{for(let n of e)n!=null&&(typeof n==`function`?n(t):n.current=t)}}function N(...e){if(e.length===0)return{};if(e.length===1)return e[0];let t={},n={};for(let r of e)for(let e in r)e.startsWith(`on`)&&typeof r[e]==`function`?(n[e]??(n[e]=[]),n[e].push(r[e])):t[e]=r[e];if(t.disabled||t[`aria-disabled`])for(let e in n)/^(on(?:Click|Pointer|Mouse|Key)(?:Down|Up|Press)?)$/.test(e)&&(n[e]=[e=>(e?.preventDefault)?.call(e)]);for(let e in n)Object.assign(t,{[e](t,...r){let i=n[e];for(let e of i){if((t instanceof Event||t?.nativeEvent instanceof Event)&&t.defaultPrevented)return;e(t,...r)}}});return t}function P(...e){if(e.length===0)return{};if(e.length===1)return e[0];let t={},n={};for(let r of e)for(let e in r)e.startsWith(`on`)&&typeof r[e]==`function`?(n[e]??(n[e]=[]),n[e].push(r[e])):t[e]=r[e];for(let e in n)Object.assign(t,{[e](...t){let r=n[e];for(let e of r)e?.(...t)}});return t}function F(e){return Object.assign((0,_.forwardRef)(e),{displayName:e.displayName??e.name})}function I(e){let t=Object.assign({},e);for(let e in t)t[e]===void 0&&delete t[e];return t}function L(e,t=[]){let n=Object.assign({},e);for(let e of t)e in n&&delete n[e];return n}function ie(e){return`19.3.1`.split(`.`)[0]>=`19`?e.props.ref:e.ref}function R(e){if(e!=null&&e.$$typeof===Symbol.for(`react.lazy`)){let t=e._payload;if(t!=null&&t.status===`fulfilled`)return R(t.value)}return e}function z(e){return e===_.Fragment||e===Symbol.for(`react.fragment`)}function B(e){return z(e.type)}var V=`span`,H=(e=>(e[e.None=1]=`None`,e[e.Focusable=2]=`Focusable`,e[e.Hidden=4]=`Hidden`,e))(H||{});function U(e,t){let{features:n=1,...r}=e,i={ref:t,"aria-hidden":(n&2)==2?!0:r[`aria-hidden`]??void 0,hidden:(n&4)==4||void 0,style:{position:`fixed`,top:1,left:1,width:1,height:0,padding:0,margin:-1,overflow:`hidden`,clip:`rect(0, 0, 0, 0)`,whiteSpace:`nowrap`,borderWidth:`0`,...(n&4)==4&&(n&2)!=2&&{display:`none`}}};return A()({ourProps:i,theirProps:r,slot:{},defaultTag:V,name:`Hidden`})}var W=F(U);function G(e){return typeof e!=`object`||!e?!1:`nodeType`in e}function K(e){return G(e)&&`tagName`in e}function q(e){return K(e)&&`accessKey`in e}function J(e){return K(e)&&`tabIndex`in e}function ae(e){return K(e)&&`style`in e}function oe(e){return q(e)&&e.nodeName===`IFRAME`}function se(e){return q(e)&&e.nodeName===`INPUT`}function ce(e){return q(e)&&e.nodeName===`LABEL`}function le(e){return q(e)&&e.nodeName===`FIELDSET`}function ue(e){return q(e)&&e.nodeName===`LEGEND`}function de(e){return K(e)?e.matches(`a[href],audio[controls],button,details,embed,iframe,img[usemap],input:not([type="hidden"]),label,select,textarea,video[controls]`):!1}var Y=Symbol();function fe(e,t=!0){return Object.assign(e,{[Y]:t})}function X(...e){let t=(0,_.useRef)(e);(0,_.useEffect)(()=>{t.current=e},[e]);let n=C(e=>{for(let n of t.current)n!=null&&(typeof n==`function`?n(e):n.current=e)});return e.every(e=>e==null||e?.[Y])?void 0:n}var Z=(0,_.createContext)(null);Z.displayName=`DescriptionContext`;function Q(){let e=(0,_.useContext)(Z);if(e===null){let e=Error(`You used a <Description /> component, but it is not inside a relevant parent.`);throw Error.captureStackTrace&&Error.captureStackTrace(e,Q),e}return e}function pe(){return(0,_.useContext)(Z)?.value??void 0}function me(){let[e,t]=(0,_.useState)([]);return[e.length>0?e.join(` `):void 0,(0,_.useMemo)(()=>function(e){let n=C(e=>(t(t=>[...t,e]),()=>t(t=>{let n=t.slice(),r=n.indexOf(e);return r!==-1&&n.splice(r,1),n}))),r=(0,_.useMemo)(()=>({register:n,slot:e.slot,name:e.name,props:e.props,value:e.value}),[n,e.slot,e.name,e.props,e.value]);return _.createElement(Z.Provider,{value:r},e.children)},[t])]}var he=`p`;function ge(e,t){let n=(0,_.useId)(),r=T(),{id:i=`headlessui-description-${n}`,...a}=e,o=Q(),s=X(t);x(()=>o.register(i),[i,o.register]);let c=w({...o.slot,disabled:r||!1}),l={ref:s,...o.props,id:i};return A()({ourProps:l,theirProps:a,slot:c,defaultTag:he,name:o.name||`Description`})}var _e=F(ge),ve=Object.assign(_e,{}),$=(e=>(e.Space=` `,e.Enter=`Enter`,e.Escape=`Escape`,e.Backspace=`Backspace`,e.Delete=`Delete`,e.ArrowLeft=`ArrowLeft`,e.ArrowUp=`ArrowUp`,e.ArrowRight=`ArrowRight`,e.ArrowDown=`ArrowDown`,e.Home=`Home`,e.End=`End`,e.PageUp=`PageUp`,e.PageDown=`PageDown`,e.Tab=`Tab`,e))($||{});export{T as A,m as B,A as C,I as D,z as E,b as F,s as G,p as H,y as I,v as L,C as M,S as N,D as O,x as P,ee as R,k as S,F as T,l as U,h as V,o as W,oe as _,fe as a,_ as b,de as c,se as d,ce as f,K as g,ae as h,pe as i,w as j,E as k,le as l,G as m,me as n,X as o,q as p,ve as r,ue as s,$ as t,J as u,W as v,P as w,O as x,H as y,g as z};
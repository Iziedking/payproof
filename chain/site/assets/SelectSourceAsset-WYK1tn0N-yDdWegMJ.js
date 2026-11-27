import{o as e}from"./rolldown-runtime-DLMaRju-.js";import{n as t,t as n}from"./jsx-runtime-CvftCknt.js";import{t as r}from"./chevron-down-Bie_7Zqx.js";import{c as i}from"./Loader-UAZqxsnw-BjnvLK0W.js";import{f as a}from"./use-headless-crypto-deposit-C6DpPcvH-BV8bQKVa.js";import{t as o}from"./sanitize-amount-input-DE8xlD-I-BcOHvMQZ.js";import{t as s}from"./ScreenLayout-749WzGBp-DXhNNW7v.js";var c=n(),l=e(t(),1),u=({currency:e=`usd`,value:t,onChange:n,inputMode:r=`decimal`,autoFocus:i})=>{let[s,u]=(0,l.useState)(`0`),[d,g]=(0,l.useState)(null),_=(0,l.useRef)(null),v=(0,l.useRef)(null),y=t??s,b=a[e]?.symbol??`$`,x=y.length>9?`small`:y.length>6?`compact`:`default`;(0,l.useLayoutEffect)((()=>{let e=v.current?.offsetWidth;g(e?Math.ceil(e)+2:null)}),[x,y]);let S=(0,l.useCallback)((e=>{let t=o(e.target.value)||`0`;n?n(t):u(t)}),[n]),C=(0,l.useCallback)((e=>{[`Delete`,`Backspace`,`Tab`,`Escape`,`Enter`,`.`,`ArrowLeft`,`ArrowRight`,`ArrowUp`,`ArrowDown`,`Home`,`End`].includes(e.key)||(e.ctrlKey||e.metaKey)&&[`a`,`c`,`v`,`x`].includes(e.key.toLowerCase())||e.key>=`0`&&e.key<=`9`||e.preventDefault()}),[]);return(0,c.jsxs)(f,{$size:x,onClick:()=>_.current?.focus(),children:[(0,c.jsx)(h,{$size:x,children:b}),(0,c.jsx)(p,{ref:_,type:`text`,inputMode:r,value:y,onChange:S,onKeyDown:C,autoFocus:i,placeholder:`0`,"aria-label":`Amount`,style:d?{width:`${d}px`}:void 0}),(0,c.jsx)(m,{ref:v,"aria-hidden":`true`,children:y}),(0,c.jsx)(h,{$size:x,style:{opacity:0},children:b})]})},d=({selectedAsset:e,onEditSourceAsset:t})=>{let{icon:n}=a[e];return(0,c.jsxs)(g,{onClick:t,children:[(0,c.jsx)(_,{children:n}),(0,c.jsx)(v,{children:e.toLocaleUpperCase()}),(0,c.jsx)(y,{children:(0,c.jsx)(r,{})})]})},f=i.span`
  position: relative;
  background-color: var(--privy-color-background);
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  font-kerning: none;
  font-feature-settings: 'calt' off;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  cursor: pointer;

  && {
    color: var(--privy-color-foreground);
    font-size: ${({$size:e})=>e===`small`?`2.25rem`:e===`compact`?`3rem`:`3.75rem`};
    font-style: normal;
    font-weight: 600;
    line-height: 5.375rem;
  }
`,p=i.input`
  appearance: none;
  align-self: flex-start;
  min-width: 1ch;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-align: left;
  caret-color: currentcolor;

  &:focus {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }
`,m=i.span`
  position: absolute;
  visibility: hidden;
  white-space: pre;
  pointer-events: none;
`,h=i.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;
  font-size: ${({$size:e})=>e===`small`?`0.75rem`:e===`compact`?`0.875rem`:`1rem`};
  font-style: normal;
  font-weight: 600;
  line-height: 1.5rem;
  margin-top: 0.75rem;
`,g=i.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: auto;
  gap: 0.5rem;
  border: 1px solid var(--privy-color-border-default);
  border-radius: var(--privy-border-radius-full);

  && {
    margin: auto;
    padding: 0.5rem 1rem;
  }
`,_=i.div`
  svg {
    width: 1rem;
    height: 1rem;
    border-radius: var(--privy-border-radius-full);
    overflow: hidden;
    border: solid 0.1px var(--privy-color-border-default);
  }
`,v=i.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;
  font-size: 0.875rem;
  font-style: normal;
  font-weight: 500;
  line-height: 1.375rem;
`,y=i.div`
  color: var(--privy-color-foreground);

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`,b=({opts:e,isLoading:t,onSelectSource:n})=>(0,c.jsx)(s,{showClose:!1,showBack:!0,onBack:()=>n(e.source.selectedAsset),title:`Select currency`,children:(0,c.jsx)(x,{children:e.source.assets.map((e=>{let{icon:r,name:i}=a[e];return(0,c.jsx)(S,{onClick:()=>n(e),disabled:t,children:(0,c.jsxs)(C,{children:[(0,c.jsx)(w,{children:r}),(0,c.jsxs)(T,{children:[(0,c.jsx)(E,{children:i}),(0,c.jsx)(D,{children:e.toLocaleUpperCase()})]})]})},e)}))})}),x=i.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-height: 20.875rem;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`,S=i.button`
  border-color: var(--privy-color-border-default);
  border-width: 1px;
  border-radius: var(--privy-border-radius-mdlg);
  border-style: solid;
  display: flex;

  && {
    padding: 0.75rem 1rem;
  }
`,C=i.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
`,w=i.div`
  svg {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--privy-border-radius-full);
    overflow: hidden;
    border: solid 0.1px var(--privy-color-border-default);
  }
`,T=i.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
`,E=i.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
`,D=i.span`
  color: var(--privy-color-foreground-3);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.125rem;
`;export{u as n,b as r,d as t};
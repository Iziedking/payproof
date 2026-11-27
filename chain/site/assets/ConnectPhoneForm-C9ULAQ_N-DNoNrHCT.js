import{o as e}from"./rolldown-runtime-DLMaRju-.js";import{n as t,t as n}from"./jsx-runtime-CvftCknt.js";import{c as r}from"./Loader-UAZqxsnw-BjnvLK0W.js";import{J as i,O as a,Z as o,h as s,p as c,q as l}from"./start-mfa-enrollment-DVLkqFkK-DTEfGukF.js";import{O as u}from"./user-DONTX7Nb-DEn_FIjv.js";import{s as d}from"./useActiveWallet-Bb_DnM2V-BU-0eGQ-.js";import{c as f,l as p}from"./ModalHeader-DwjVHxNn-BoeGJbGR.js";import{t as m}from"./PhoneCountryDropdown-ByTf_otu-2q3dYxkF.js";import{t as h}from"./Chip-CZKIKt9K-DvWm5ag8.js";var g=n(),_=e(t(),1),v=(0,_.forwardRef)(((e,t)=>{let n=u(),[r,v]=(0,_.useState)(!1),{accountType:x}=d(),[S,C]=(0,_.useState)(``),[w,T]=(0,_.useState)(e.defaultCountry??n?.intl.defaultCountry??`US`),E=i(S,w),D=c(w),O=a(w),k=o(w),A=!E,[j,M]=(0,_.useState)(!1),N=k.length,P=t=>{let n=t.target.value;T(n),C(``),e.onChange&&e.onChange({rawPhoneNumber:S,qualifiedPhoneNumber:l(S,n),countryCode:n,isValid:i(S,w)})},F=(t,n)=>{try{let r=t.replace(/\D/g,``)===S.replace(/\D/g,``)?t:D.input(t);C(r),e.onChange&&e.onChange({rawPhoneNumber:r,qualifiedPhoneNumber:l(t,n),countryCode:n,isValid:i(t,n)})}catch(e){console.error(`Error processing phone number:`,e)}},I=()=>{M(!0);let t=l(S,w);e.onSubmit({rawPhoneNumber:S,qualifiedPhoneNumber:t,countryCode:w,isValid:i(S,w)}).finally((()=>M(!1)))};return(0,_.useEffect)((()=>{if(e.defaultValue){let t=s(e.defaultValue);D.reset(),P({target:{value:t.countryCode}}),F(t.phone,t.countryCode)}}),[e.defaultValue]),(0,g.jsxs)(g.Fragment,{children:[(0,g.jsx)(y,{children:(0,g.jsxs)(b,{$callingCodeLength:N,$stacked:e.stacked,children:[(0,g.jsx)(m,{value:w,onChange:P}),(0,g.jsx)(`input`,{ref:t,id:`phone-number-input`,className:`login-method-button`,type:`tel`,placeholder:O,onFocus:()=>v(!0),onChange:e=>{F(e.target.value,w)},onKeyUp:e=>{e.key===`Enter`&&I()},value:S,autoComplete:`tel`}),x!==`phone`||r||e.hideRecent?e.stacked||e.noIncludeSubmitButton?(0,g.jsx)(`span`,{}):(0,g.jsx)(f,{isSubmitting:j,onClick:I,disabled:A,children:`Submit`}):(0,g.jsx)(h,{color:`gray`,children:`Recent`})]})}),e.stacked&&!e.noIncludeSubmitButton?(0,g.jsx)(p,{loading:j,loadingText:null,onClick:I,disabled:A,children:`Submit`}):null]})})),y=r.div`
  width: 100%;
`,b=r.label`
  --country-code-dropdown-width: calc(54px + calc(12 * ${e=>e.$callingCodeLength}px));
  --phone-input-extra-padding-left: calc(12px + calc(3 * ${e=>e.$callingCodeLength}px));
  display: block;
  position: relative;
  width: 100%;

  /* Tablet and Up */
  @media (min-width: 441px) {
    --country-code-dropdown-width: calc(52px + calc(10 * ${e=>e.$callingCodeLength}px));
  }

  && > select {
    font-size: 16px;
    height: 24px;
    position: absolute;
    margin: 13px calc(var(--country-code-dropdown-width) / 4);
    line-height: 24px;
    width: var(--country-code-dropdown-width);
    background-color: var(--privy-color-background);
    background-size: auto;
    background-position-x: right;
    cursor: pointer;

    /* Tablet and Up */
    @media (min-width: 441px) {
      font-size: 14px;
      width: var(--country-code-dropdown-width);
    }

    :focus {
      outline: none;
      box-shadow: none;
    }
  }

  && > input {
    font-size: 16px;
    line-height: 24px;
    color: var(--privy-color-foreground);

    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    padding: 12px 88px 12px
      calc(var(--country-code-dropdown-width) + var(--phone-input-extra-padding-left));
    padding-right: ${e=>e.$stacked?`16px`:`88px`};
    flex-grow: 1;
    background: var(--privy-color-background);
    border: 1px solid var(--privy-color-foreground-4);
    border-radius: var(--privy-border-radius-md);
    width: 100%;

    :focus {
      outline: none;
      border-color: var(--privy-color-accent);
    }

    :autofill,
    :-webkit-autofill {
      background: var(--privy-color-background);
    }

    /* Tablet and Up */
    @media (min-width: 441px) {
      font-size: 14px;
      padding-right: 78px;
    }
  }

  && > :last-child {
    right: 16px;
    position: absolute;
    top: 50%;
    transform: translate(0, -50%);
  }

  && > button:last-child {
    right: 0;
    line-height: 24px;
    padding: 13px 17px;

    :focus {
      outline: none;
      border-color: var(--privy-color-accent);
    }
  }

  && > input::placeholder {
    color: var(--privy-color-foreground-3);
  }
`;export{v as t};
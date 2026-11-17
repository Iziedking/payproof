# Payproof brand kit

Approved by the owner on 2026-11-17. Source designs: Figma file "Payproof
design directions", pages "Logo · final" and "Brand kit".

## The mark

Two folded halves that lock together around an empty square. Ink is what you
were paid; coral is what the rule gives. When they fit, nothing is left over
and nothing is hidden in the middle. It does not use the letter P.

Each half is one strip bent at a right angle, drawn as two flat planes that
meet on a diagonal fold. No gradients, no shadows.

### Rules

- Clear space around the mark: at least one quarter of its width.
- Do not recolour the halves, swap their order, round the corners, add a
  shadow or place the mark on a busy background.
- The mark may stand alone. The wordmark always appears with the mark.
- Below 24 px, use the mark only.

## Files

| File | Use |
| --- | --- |
| `logo/payproof-mark.svg` | Mark on light backgrounds, transparent |
| `logo/payproof-mark-on-dark.svg` | Mark on dark backgrounds, transparent |
| `logo/payproof-icon-paper.svg`, `logo/payproof-icon-ink.svg` | Square icon on paper or ink |
| `logo/payproof-lockup.svg`, `logo/payproof-lockup-on-dark.svg` | Mark and wordmark. Letters are outlines, no font needed |
| `logo/png/payproof-icon-paper-256.png` | 256 x 256 logo for forms. Use this for the hackathon form |
| `logo/png/payproof-icon-ink-256.png` | 256 x 256, dark |
| `logo/png/payproof-mark-256.png`, `logo/png/payproof-mark-on-dark-256.png` | 256 x 256, transparent |
| `favicon/favicon.svg` | Browser tab icon; switches to light planes in dark mode |
| `favicon/favicon-32.png` | Fallback tab icon |
| `favicon/apple-touch-icon-180.png` | iOS home screen |
| `favicon/icon-192.png`, `favicon/icon-512.png` | Web app manifest |
| `social/x-avatar-400.png` | X profile picture for @payproofhq. Sized to survive the circle crop |
| `social/x-banner-1500x500.png` | X header. Text sits left and high, clear of the avatar |
| `tokens.css` | Colours, type, spacing, radius and icon size as CSS variables |

The SVG files are the masters. PNGs were exported from the same shapes in
Figma at their exact pixel size.

Head tags for the site:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
```

## Colour

Built from the logo. Neutrals carry the interface. Coral is spent on the rule,
the trap and the main action. Contrast is the WCAG 2.x ratio, measured in
Figma against the background named.

### Light

| Token | Hex | Contrast | Use |
| --- | --- | --- | --- |
| Paper | `#F6F5F1` | | Page background |
| Surface | `#FFFFFF` | | Cards |
| Sunk | `#EDEBE4` | | Fields, wells |
| Ink | `#15161A` | 16.57 on paper | Main text, primary button |
| Ink 2 | `#4B4D55` | 7.72 on paper | Secondary text |
| Muted | `#6B6D75` | 4.73 on paper | Small text, captions |
| Coral | `#F2552C` | 3.15 on paper | Graphics and buttons only, never text |
| Ink on coral | `#15161A` | 5.26 on coral | Text on a coral button |
| Coral text | `#B23A17` | 5.48 on paper | Links, trap figures |
| Green | `#1E7A4E` | 4.87 on paper | "Matches the rule" |

### Dark

| Token | Hex | Contrast | Use |
| --- | --- | --- | --- |
| Night | `#15161A` | | Page background |
| Surface | `#1D1F24` | | Cards |
| Raised | `#272930` | | Fields, menus |
| Text | `#F3F2EC` | 16.12 on night, 14.70 on surface | Main text |
| Text 2 | `#B9B8B1` | 9.09 on night | Secondary text |
| Muted | `#8D8F96` | 5.60 on night | Small text |
| Coral | `#F2552C` | 5.26 on night | Graphics, buttons |
| Coral text | `#FF7A57` | 7.04 on night | Links, trap figures |
| Green | `#4CC38A` | 8.16 on night | "Matches the rule" |

## Type

All four families are under the SIL Open Font License 1.1, read from each
project's `OFL.txt` in https://github.com/google/fonts on 2026-11-17.

| Family | Weights | Use | Copyright |
| --- | --- | --- | --- |
| Bricolage Grotesque | Bold | Headings, wordmark | 2022 The Bricolage Grotesque Project Authors |
| Figtree | Regular, Medium, SemiBold | Interface and body text | 2022 The Figtree Project Authors |
| JetBrains Mono | Regular | Figures, addresses, hashes, in normal case | 2020 The JetBrains Mono Project Authors |
| Noto Sans SC | Regular, Medium | All Chinese text | 2014-2021 Adobe, Reserved Font Name "Source" |

Sizes: display 48, H1 32, H2 24, H3 20, body 16, small 14, caption 12.
Headings use tight letter spacing (-2%); body text never does. Weights stay
at 400 to 600 in the interface. No italics for emphasis.

## Spacing and radius

Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64, 96. Space inside a group is
smaller than space between groups.

Radius: 4 for tags and inputs inside cards, 8 for buttons and inputs, 12 for
cards, 16 for panels and sheets. An inner radius is the outer radius minus
the padding between them.

## Icons

Lucide (https://lucide.dev), ISC licence; some icons carry the MIT licence of
the set they came from (read from `LICENSE` in lucide-icons/lucide on
2026-11-17). 20 px, stroke 1.8, always the colour of the text beside them,
never their own colour. Icons sit next to a word; they do not replace one.

## Voice

Payproof says what a rule does to a number, plainly, and says what it has not
checked yet.

- Short sentences. The figure comes before the adjective.
- Name the source of every figure, and label samples and unchecked readings.
- No hype words, no exclamation marks, no crypto terms on the surface
  ("Sign in", not "Connect wallet"; addresses sit behind "Details").
- Never accuse. A trap is in the rule, not in the person who applied it.
- English and Simplified Chinese are written together, line by line.

| English | 中文 |
| --- | --- |
| Were you paid what the rule says? | 你拿到的钱，符合规则吗？ |
| A bonus of ¥36,001 leaves you ¥2,309.10 worse off than ¥36,000. | 年终奖 36,001 元，到手比 36,000 元少 2,309.10 元。 |
| This is a trap in the rule itself, not an error by your employer. | 这是规则本身的陷阱，不是雇主算错了。 |
| Your figures stay on this device. | 你输入的数字只保存在本设备上。 |
| Sample data. Our reading of the rule; the official text is not yet checked. | 示例数据。按我们对规则的理解计算，尚未核对官方原文。 |

The Chinese lines are drafts. They must be read by a native speaker before
launch.

Not like this: "Unlock total payroll transparency!", "Trustless, on-chain
tax verification", "Your employer cheated you."

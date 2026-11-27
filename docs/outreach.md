# Outreach log

Who was asked for their rule or offered the split, when, where, and what they answered. Every
send and every answer is logged here, including no answer. The owner sends every message; the
drafts below are what was sent, word for word, once the "Sent" column is filled in.

The product does not depend on any answer (PLAN R5).

Send drafts 1 to 4 only after the DeWEB site has been updated: until then the links
`#/splits` and `#/check/payout` open the P2 build, which does not have those pages.

## Log

| # | To | Where | Sent (UTC) | Link to the post | Answer | Answer date |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Ignix | X, and the Ignix Telegram group | not sent | | | |
| 2 | FabX | X, and the FabX Telegram group | not sent | | | |
| 3 | 0xbengss (asked for a pool reward checker, 2026-11-16) | X reply | not sent | | | |
| 4 | Pool operators: TapMine, CoTape, TapeSurge, the official pool | X, and each Telegram group | not sent | | | |
| 5 | TapeOut team: binding a domain to an X Layer DeWEB site | TapeOut Telegram (t.me/tapeouten) | not sent | | | |

## Drafts

The Chinese versions are drafts and need a native speaker's review before they are sent, like
the app's Chinese strings.

### 1 and 2. The rule request (Ignix, FabX)

English:

> Hi @[Ignix / FabX], we are building Payproof for the X Layer TapeOut hackathon: it checks pool
> payouts against a rule that is taped out as a circuit on X Layer, so anyone can confirm what
> each share holder should get.
>
> Could you share the exact rule you use to pay holders? In particular: the split between
> holders, LP and fees, when the share snapshot is taken, how rounding is done, and which
> contract pays. If you publish it, we will tape it out as a circuit and link back to you.
>
> Our own split is live on X Layer mainnet: https://9-2-425.tapekit.org/#/splits

Chinese (draft, needs review):

> 你好 @[Ignix / FabX]，我们正在为 X Layer TapeOut 黑客松开发 Payproof：它用 X Layer 上流片的电路来核对矿池分配，任何人都可以确认每位持有人应得多少。
>
> 能否公开你们给持有人分配收益的具体规则？特别是：持有人、LP 和手续费之间的比例，份额快照的时间，取整方式，以及由哪个合约支付。如果你们公开规则，我们会把它流片为电路，并注明来源。
>
> 我们自己的分配规则已在 X Layer 主网运行：https://9-2-425.tapekit.org/#/splits

### 3. Reply to 0xbengss

English:

> You asked for a pool reward checker on Nov 16. Payproof does this: paste an address and it
> shows, round by round, the shares held at the snapshot, what the rule gives and what was paid.
> The rule runs as a circuit on X Layer. https://9-2-425.tapekit.org/#/check/payout

### 4. The split offer to pool operators

English:

> To pool operators on TapeOut (@TapMine @CoTape @TapeSurge and the official pool): Payproof's
> split-v1 pays share holders by a snapshot taken when a round opens, and the vault only accepts
> a claim that a circuit on X Layer agrees with. One real round has run on mainnet: three
> holders claimed, and a share transfer after the snapshot did not change the round.
>
> If you want your holders to be able to check every payout, we would like to set up a split
> for your pool. Details and every transaction: https://github.com/Iziedking/payproof

Chinese (draft, needs review):

> 致 TapeOut 上的矿池运营方（@TapMine @CoTape @TapeSurge 以及官方矿池）：Payproof 的 split-v1 按每轮开启时的份额快照给持有人分配，金库只接受 X Layer 上电路认可的领取。主网上已经跑完一轮真实分配：三位持有人已领取，快照之后的份额转账没有改变这一轮。
>
> 如果你希望持有人能核对每一笔分配，我们愿意为你的矿池设置一个分配。详情和所有交易：
> https://github.com/Iziedking/payproof

### 5. Question to the TapeOut team

English:

> Hi, Payproof is published on DeWEB from circuit 9 of processor 425 on X Layer and is live at
> https://9-2-425.tapekit.org/ (bound as 9.2.425.tape). We would like it to open at
> payproof.kingizie.tech as well. TAP-10 mentions a normal domain through HashPort, but we could
> not find the steps for an X Layer site. What DNS record should we add, what is the CNAME
> target, and who serves the certificate? Is there a HashPort console link for X Layer?

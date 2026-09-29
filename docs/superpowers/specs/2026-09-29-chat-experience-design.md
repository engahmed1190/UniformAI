# Chat experience upgrade: the account manager leads

**Date:** 2026-09-29 · **Branch:** `client-assistant` · **Status:** approved ("yes, go ahead with all 4 tasks")
**Input:** `.superpowers/sdd/2026-09-29-client-assistant/ux-audit.md` (findings and top 10)
**Builds on:** `docs/superpowers/specs/2026-09-29-client-assistant-design.md` and the Global Constraints of `docs/superpowers/plans/2026-09-29-client-assistant.md`

## Goal

The account manager leads the conversation. It notices what changed, speaks like one person, shows richer cards, and needs fewer taps. Everything stays scripted: turns are built by code from the customer's orders and invoices.

## A. Updates and greeting

- **Baseline.** When the page loads, the dock reads `GET /api/orders` and `GET /api/invoices` once. It keeps one snapshot per order and one per invoice: `{ orders: key → Workflow, invoices: name → status | null }`. The order key is `o.quote ?? o.id`, because `id` changes from SAL-QTN-… to SAL-ORD-… when an order is created.
- **When it re-reads.** On window `focus` and `visibilitychange → visible`, whether the chat is open or closed. When the chat opens. Every 30 s while it is open. It skips a re-read while a reply or write is running. Every read inside the chat (menu, order, sizes and so on) also updates the snapshot.
- **What counts as news.** An order that moves into `quote_ready` ("quote ready"), `collecting_sizes` ("confirmed, sizes are yours"), `in_progress` ("sizes in, production started") or `delivered`. An invoice that did not exist before ("invoice issued"). If its order was delivered in the same read, it folds into the delivered line. An invoice that becomes `paid`. The customer's own writes (request, approve, send sizes) are recorded as seen, so they are never news. The first read gives no news: the greeting covers it.
- **How news is shown.** If the chat is open and idle on a button turn, a turn is posted: "Since we last spoke: …; ….", with up to 4 buttons (Approve / Send the sizes / Invoices), the first one primary. If the customer is filling a form, the news waits and is posted before the next reply. If the chat is closed, an **unread dot** shows on the launcher. It clears when the chat opens, and the news is posted then.
- **Greeting.** It uses the Home banner's sentence (`greeting()` in `lib/manager.ts`, now taking `hour`), so both say "Good afternoon, Mr. Ahmed. 1 waiting for your approval, …" with the same counts. The generic "What can I help you with today?" is gone.
- **Greeting buttons (the rule the tests pin).** First, up to two waiting items, newest first. A quote shows as "Approve the {kit} quote ({total})" and goes straight to the Yes/Not now confirmation. Sizes show as "Send the sizes for {kit}". Then **Start a new uniform request**, then **Ask the team to contact me**, then **Check my quotations and orders** if there is room. That is at most 4 journey buttons, plus **More**, which takes the place of Menu on the home turn. More lists the overflow first (a third waiting item onward, then Orders), then Invoices, Check stock and Last price paid. If there are more than 4, it shows 3 plus another More.
- The confirmation turn after Approve also offers **View quotation**, since the greeting skips the quote turn.

## B. Pacing, voice, Arabic

- **Typing indicator.** Before every assistant reply, the dock shows three dots (`role="status"`, labelled "Your account manager is typing"). The wait is `min(1000, 600 + 4 × characters)` ms, counted from the tap, so time spent fetching counts toward it. With `prefers-reduced-motion: reduce` the wait is 150 ms and the dots do not animate. Every branch of `act`, including the replies that need no data, runs under `busy`, so buttons cannot be tapped during the wait.
- **One voice.** The launcher, header and subtitle speak as "Your account manager" / "مدير حسابكم". The greeting uses the time of day (from A).
- **No system wording in the customer's view.** The trace rail ("Looking up your orders · 12 found in 0.1s"), "Checked at hh:mm:ss", "Based on N records" and "Records checked" are removed. When a list is cut short it says "Your latest 10 of 12 orders".
- **Every reply ends with who acts next and when.** Quote requested: "our team prices it within one working day". Approved: "the team confirms within one working day, then I ask for sizes". Sizes sent: "Production starts now; expected delivery {date}. Nothing else is needed from you." Delivered: "Invoice {id} for {total} is attached to this delivery, due on {date}", or "our accounts team will send the invoice". Contact: "within one working day". The delivered sentence needs the invoice-to-order link: `/api/invoices` now also reads `items.sales_order` and returns `order?`. That is the same route with one more field.
- **Arabic counts.** A new `countOf(locale, 'set' | 'person', n)` picks the Arabic form: طقم واحد / طقمان / 3–10 أطقم / 11–99 طقمًا / 100 طقم, and the same forms of موظف. The fixes: "19 طقمًا", "لفريق من 18 موظفًا", and "أحلت طلب التواصل" in the case receipt. The unreadable size-run sentence is removed by C's size card.

## C. Cards

- **Order status card** (after Show order, on an order's details, and in a refused-write reply). The header shows the kit name, the document number, and "{sets} · {total}". A 7-step bar: Quote issued → Approved by you → Order confirmed → Sizes received → In production → Delivered → Invoiced. Five labels come from `orders.step.*`, and two are new (In production, Invoiced). Steps are done / now / to do, derived from the `Workflow` plus whether a linked invoice exists. The existing `timeline()` is not used, because a hand-made order with no quote would show an empty first step. The card says who acts next ("Waiting on you" / "With our team · usually within one working day" / "Complete" / "Closed"). It shows the key date ("Expected delivery {date}" or "Delivered {date}") and **one** primary action: Approve, Enter the sizes, or Invoices. The turn's own buttons then drop that primary, which leaves View quotation and Discuss.
- **Invoices card.** The header shows the outstanding total first, then "Open invoices: N". Rows list open invoices only: overdue ones first (oldest due first, "Overdue since {date}"), then unpaid ones, newest first ("Due {date}"). Paid invoices collapse to one line: "Paid invoices: N". It has one action, "Discuss invoice {id}". The invoice named is the oldest overdue one, else the newest unpaid one (`billingDoc`). The sentence becomes one line ("One invoice is past due. The rest are on time.").
- **Size-run card.** It opens already filled with the proposed split. The grid can be edited, a counter shows "N assigned, M left", and the primary is **Send the size run**, enabled only when the total is exactly right. A "Reset to the proposed split" button appears only once the numbers change. The separate review turn is removed, along with `sizeConfirmTurn` and `runText`.

## D. Taps and polish

- **Contact** sends on the first tap, from the greeting, from Discuss and from the invoices card. There is no confirmation turn that repeats the label. The receipt names the document when there is one. `contactTurn` and the `contact` act are removed. All callers use `sendContact`.
- **New request.** The people step shows the recommendation live under the number field, and its button is "Request a quotation for {sets}". Launcher → New → team → Request is 4 taps. The separate plan turn, "Continue" and "Change the number" are removed.
- **Numbers never wrap.** Document numbers (`SAL-QTN-…`, `SAL-ORD-…`, `ACC-SINV-…`, `MAT-DN-…`, `CASE-…`) and amounts (`EGP 27,451`) in sentences and button labels are rendered in `<bdi class=evNum>` with `white-space: nowrap`. `.evId` loses `overflow-wrap: anywhere`.
- **Scroll.** Each new reply scrolls to its **top**. A short reply shows whole, with its buttons.
- **Phone.** At ≤760 px, the size inputs, choice buttons, card buttons and Close are at least 44 px high, and the size grid has 4 columns. In RTL, logical properties only: the step bar runs right to left, and nothing is mirrored by hand.

## Copy (every new or changed customer string)

| Key | English | Arabic (formal) |
|---|---|---|
| erpAsk.launcher / title | Your account manager | مدير حسابكم |
| erpAsk.live | UniformAI · replies from your live account | UniformAI · من بيانات حسابكم مباشرة |
| erpAsk.typing | Your account manager is typing | مدير حسابكم يكتب الآن |
| erpAsk.news | News from your account manager | أخبار جديدة من مدير حسابكم |
| erpAsk.evidence | From your account | من حسابكم |
| erpAsk.evidenceSome | Your latest {shown} of {count} orders | أحدث {shown} من طلباتكم، وعددها {count} |
| erpAsk.noRecordNote | Nothing in your account or our stock matches, so I have not guessed. | لا شيء في حسابكم أو في مخزوننا يطابق ذلك، لذا لم أخمّن. |
| journey.btnApproveKit | Approve the {kit} quote ({total}) | الموافقة على عرض سعر {kit} ({total}) |
| journey.btnSendSizesKit | Send the sizes for {kit} | إرسال مقاسات {kit} |
| journey.news.since | Since we last spoke: | منذ حديثنا الأخير: |
| journey.news.quote_ready | quotation {id} is ready for your approval ({total}) | عرض السعر {id} جاهز لموافقتكم ({total}) |
| journey.news.confirmed | our team has confirmed order {id}, and the next step is yours: the sizes | أكّد فريقنا الطلب {id}، والخطوة التالية لديكم: المقاسات |
| journey.news.production | the sizes for order {id} are in and production has started; delivery is expected on {date} | اكتملت مقاسات الطلب {id} وبدأ الإنتاج، والتسليم متوقع في {date} |
| journey.news.delivered | order {id} has been delivered | تم تسليم الطلب {id} |
| journey.news.deliveredInvoice | order {id} has been delivered, and invoice {invoice} for {total} is ready | تم تسليم الطلب {id}، وفاتورته {invoice} بقيمة {total} جاهزة |
| journey.news.invoiced | invoice {id} for {total} has been issued, due on {date} | صدرت الفاتورة {id} بقيمة {total}، وتستحق في {date} |
| journey.news.paid | invoice {id} is now paid, thank you | تم سداد الفاتورة {id}، شكرًا لكم |
| journey.plan | For {people} I recommend {sets}, which leaves {spare} for replacements and new starters. The estimate is {price}, before our team reviews it. | لفريق من {people} أوصي بـ {sets}، يبقى منها {spare} للاستبدال وللموظفين الجدد. التقدير المبدئي {price} قبل مراجعة فريقنا. |
| journey.planMoq | Our minimum for a made-to-order uniform is {min}, so for {people} I recommend {sets}; the other {spare} serve as spares. The estimate is {price}, before our team reviews it. | الحد الأدنى للزي المصنوع حسب الطلب {min}، لذا أوصي لفريق من {people} بـ {sets}، ويبقى {spare} احتياطيًا. التقدير المبدئي {price} قبل مراجعة فريقنا. |
| journey.btnRequest | Request a quotation for {sets} | طلب عرض سعر لـ {sets} |
| journey.stage.quote_requested | Our team is pricing quotation {quote}; you will have it within one working day, and I will bring it to you here to approve. | يقوم فريقنا بتسعير عرض السعر {quote}، وسيصلكم خلال يوم عمل واحد، وسأعرضه عليكم هنا للموافقة. |
| journey.stage.quote_ready | Quotation {quote} is ready for your approval: {total} for {sets}. Once you approve, our team confirms the order within one working day. | عرض السعر {quote} جاهز لموافقتكم: {total} مقابل {sets}. وبعد موافقتكم يؤكد فريقنا الطلب خلال يوم عمل واحد. |
| journey.stage.awaiting | Order {id} is with our team; they will confirm it within one working day, and then I will ask you for the sizes. | الطلب {id} لدى فريقنا، وسيؤكدونه خلال يوم عمل واحد، ثم أطلب منكم المقاسات. |
| journey.stage.collecting_sizes | Order {id} is confirmed. The next step is yours: the sizes for all {sets}; production starts as soon as they are in. | تم تأكيد الطلب {id}. والخطوة التالية لديكم: مقاسات {sets} جميعها، ويبدأ الإنتاج فور وصولها. |
| journey.stage.in_progress | Order {id} is in production; expected delivery {date}. Nothing else is needed from you. | الطلب {id} قيد الإنتاج، والتسليم متوقع في {date}. لا نحتاج منكم شيئًا آخر. |
| journey.stage.in_progress_part | Order {id} is being delivered: {pct}% has arrived so far, and the rest is expected by {date}. Nothing else is needed from you. | يجري تسليم الطلب {id}: وصل {pct}% حتى الآن، والباقي متوقع بحلول {date}. لا نحتاج منكم شيئًا آخر. |
| journey.stage.delivered | All {sets} of order {id} were delivered on {date}. | تم تسليم الطلب {id} كاملًا ({sets}) في {date}. |
| journey.stage.deliveredInvoice | Invoice {invoice} for {total} is attached to this delivery, due on {date}. | وفاتورته {invoice} بقيمة {total} مرفقة بهذا التسليم، وتستحق في {date}. |
| journey.stage.deliveredNoInvoice | Our accounts team will send the invoice within one working day. | وسيرسل فريق الحسابات الفاتورة خلال يوم عمل واحد. |
| journey.quoteShown | Those are the details. Once you approve, our team confirms the order within one working day. | هذه هي التفاصيل. وبعد موافقتكم يؤكد فريقنا الطلب خلال يوم عمل واحد. |
| journey.confirmApprove | Please confirm that you approve quotation {id} for {total}. Our team will then confirm the order within one working day. | أرجو تأكيد موافقتكم على عرض السعر {id} بقيمة {total}، ثم يؤكد فريقنا الطلب خلال يوم عمل واحد. |
| journey.quoteSent | Thank you, Mr. Ahmed. I have passed your request to our team; they will price it within one working day as quotation {id}, and I will bring it to you here to approve. | شكرًا لكم أستاذ أحمد. أحلت طلبكم إلى فريقنا، وسيسعّرونه خلال يوم عمل واحد في عرض السعر {id}، وسأعرضه عليكم هنا للموافقة. |
| journey.approved | Thank you. I have passed your approval to our team; they will confirm order {id} within one working day, and then I will ask you for the sizes. | شكرًا لكم. أحلت موافقتكم إلى فريقنا، وسيؤكدون الطلب {id} خلال يوم عمل واحد، ثم أطلب منكم المقاسات. |
| journey.sizesSent | Thank you, Mr. Ahmed. I have received the sizes for all {sets} of order {id}. Production starts now; expected delivery {date}. Nothing else is needed from you. | شكرًا لكم أستاذ أحمد. استلمت مقاسات الطلب {id} كاملةً ({sets}). يبدأ الإنتاج الآن، والتسليم متوقع في {date}. لا نحتاج منكم شيئًا آخر. |
| journey.caseSent | Thank you. I have passed your request to our team (reference {id}); someone will contact you within one working day. | شكرًا لكم. أحلت طلب التواصل إلى فريقنا برقم مرجعي {id}، وسيتواصل معكم أحد أعضاء الفريق خلال يوم عمل واحد. |
| journey.caseAbout | Thank you. I have asked our team to contact you about {doc} (reference {id}); someone will be in touch within one working day. | شكرًا لكم. أحلت طلب التواصل بشأن {doc} إلى فريقنا برقم مرجعي {id}، وسيتواصل معكم أحد أعضاء الفريق خلال يوم عمل واحد. |
| journey.card.production / invoiced | In production / Invoiced | قيد الإنتاج / صدرت الفاتورة |
| journey.card.you / team | Waiting on you / With our team · usually within one working day | بانتظاركم / لدى فريقنا · عادةً خلال يوم عمل واحد |
| journey.card.done / closed | Complete / Closed | مكتمل / مغلق |
| journey.card.due / deliveredOn | Expected delivery {date} / Delivered {date} | التسليم المتوقع {date} / تم التسليم {date} |
| journey.invCard.outstanding / open / paid / lateSince | {total} outstanding / Open invoices: {count} / Paid invoices: {count} / Overdue since {date} | المستحق {total} / الفواتير المفتوحة: {count} / الفواتير المسدّدة: {count} / متأخرة منذ {date} |
| journey.invLateOne / invLateMany | One invoice is past due. / {count} invoices are past due. | فاتورة واحدة تجاوزت موعد استحقاقها. / عدد الفواتير التي تجاوزت موعد استحقاقها: {count}. |
| journey.invRest / invOnTime | The rest are on time. / All your open invoices are on time. | والباقي في موعده. / جميع فواتيركم المفتوحة في موعدها. |
| journey.btnDiscussInvoice | Discuss invoice {id} | الاستفسار عن الفاتورة {id} |
| journey.sizesAsk | Here is a proposed size split for order {id}, {sets} in total. Adjust any number, then send it; it becomes the production plan. | هذا توزيع مقترح لمقاسات الطلب {id}، وإجماليه {sets}. عدّلوا أي رقم ثم أرسلوه، وسيُعتمد خطةً للإنتاج. |
| journey.btnSplit | Reset to the proposed split | العودة إلى التوزيع المقترح |

**Removed keys** (from both dictionaries): `erpAsk.stepOrders/stepOrder/stepStock/stepPrice/stepOptions/stepFound/stepNone/stepFailed/evidenceOne/evidenceMany/checkedAt`, `journey.hello/btnReview/btnSendSizes/confirmSizes/btnReviewRun/btnAdjust/invLatest/invOpen/invLate/invWord/contactAbout/contactBilling/contactGeneral/btnContinue/btnChangePeople/peopleEcho`.

## Tap targets (from Home; the launcher counts as 1; typing does not count)

| Goal | Before | After | Path |
|---|---|---|---|
| Approve a quote | 5 | 3 | launcher → Approve the {kit} quote → Yes, approve |
| New request | 5 | 4 | launcher → Start a new uniform request → team → Request a quotation for {sets} |
| Send sizes (proposed split) | 5 | 3 | launcher → Send the sizes for {kit} → Send the size run |
| Order + invoices after delivery | 2–3 | 1 | launcher: "Since we last spoke: order … delivered, and invoice … for EGP … is ready" |
| Contact our team | 4 | 2 | launcher → Ask the team to contact me (sent) |

## Constraints

- The customer never sees "ERPNext", an ERP URL, an item code (`UA-…`) or a raw status. Document numbers are fine.
- Professional voice: "Mr. Ahmed" / "أستاذ أحمد"; formal Arabic (plural address). The EN and AR keys must match, with the same `{placeholders}` (`lib/i18n.test.ts`).
- At most 4 journey buttons per turn, plus Menu (or More on the home turn). At most one primary per turn, and one per card.
- No LLM. Keep the existing FAB look (only its text changes, and it gains the dot). Demo only: no transcript persistence, no free text, no push, and no new server routes. `/api/orders`, `/api/invoices` and `/api/contact` are reused, and `/api/invoices` gains one field.

## Out of scope (audit items deliberately not taken)

Estimate card (3.3), quote-card line totals (3.4), grouped orders list (3.6), people chips / default head count (4.4), Menu moved to a footer (4.5), "Not now" returning to the quote (2.3), rotating "anything else" wording (1.4), team-first labels on the orders list, P2 banner reorder, P3 header inset, P9 sheet height, P10 sidebar counts, and phone/email choice for contact.

## Testing

- Pure logic in `lib/` gets `tsx` + `node:assert` tests, run by `npm test`. The news diff (`lib/updates.test.ts`) covers: a null baseline, a key that is stable across quote → order, own writes, the delivered + invoice fold, paid, and an orders-only read keeping the invoice baseline. Greeting buttons and More paging go in `lib/journey.test.ts`. `typingMs` goes in `lib/pace.test.ts`. `countOf` goes in `lib/i18n.test.ts`. The next-step sentences go in `lib/journey.test.ts`. The card view-models and `billingDoc` go in `lib/cards.test.ts`. `splitCodes` goes in `lib/rich.test.ts`.
- Browser (Playwright MCP, http://127.0.0.1:3100, the server is already running): EN and AR, desktop 1440×900 and phone 390×844. The seed is **never** reset. Team steps (`npm run team -- issue|confirm|sizes|deliver`) move demo documents forward; that is expected. "Invoice paid" news has no team verb, so it is covered by the pure test only.

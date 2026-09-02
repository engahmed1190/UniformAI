// Every visible string in the product, in both languages. Components hold
// behaviour; this file holds language. The rule that keeps it working: no
// component may contain `locale === 'ar' ? ... : ...` -- if a string differs
// by language it belongs here, under a key.

export type Locale = 'en' | 'ar';
export const LOCALES = ['en', 'ar'] as const;

/** Page direction. The whole RTL layer hangs off this. */
export const dir = (l: Locale): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', ar: 'العربية' };
/** The ISO code, shown beside the name the way a size label carries both. */
export const LOCALE_CODES: Record<Locale, string> = { en: 'EN', ar: 'AR' };

// Polite, natural Modern Standard Arabic for business use: زي موحد، طقم،
// خامة، عرض سعر. Keep the tone warm without regional colloquialisms.
// The product name stays UniformAI in both.
/** The shape both dictionaries share: same keys, any string values. Typing ar
 *  as `typeof en` after `as const` demanded the exact English strings, which
 *  is not a check at all -- it just fails on every translated value. */
type Dict<T> = { [K in keyof T]: T[K] extends string ? string : Dict<T[K]> };

const en = {
  common: {
    close: 'Close', cancel: 'Cancel', back: 'Back', next: 'Next',
    save: 'Save', confirm: 'Confirm', loading: 'Working…', included: 'Included',
    people: 'people', sets: 'sets', perPerson: 'per person', total: 'Total',
    person: 'person', spare: 'spare', noSpare: 'no spare', none: 'None',
  },
  nav: {
    home: 'Home', newUniform: 'New uniform', configure: 'Configure',
    savedKits: 'Saved kits', orders: 'Orders', settings: 'Settings',
    workspace: 'Workspace', more: 'More', sections: 'Sections',
    moreSections: 'More sections', closeMenu: 'Close menu', staff: '{count} staff · Summer 2026',
  },
  home: {
    title: 'Home', subtitle: 'Where your uniform work stands today.',
    askTitle: 'What do you need to kit out?', askSubtitle: 'Describe the team in your own words.',
    describeTeam: 'Describe what you need', showKits: 'Show kits',
    savedKits: 'Saved kits', savedKitsNote: 'Ready to reorder',
    collectingSizes: 'Collecting sizes', noneWaiting: 'None waiting',
    inProduction: 'In production', nothingOnFloor: 'Nothing on the floor',
    delivered: 'Delivered', nothingYet: 'Nothing yet',
    nextDue: 'Next due {date}', orderLine: '{id} · {sets} sets',
    recentActivity: 'Recent activity', viewOrders: 'View orders',
    browseSavedKits: 'Browse saved kits', firstOrderHere: 'Nothing yet. Your first order shows here.',
    colWhat: 'What', colStatus: 'Status', colValue: 'Value', colUpdated: 'Updated',
  },
  design: {
    title: 'New uniform', subtitle: 'Describe who it is for and we will put three kits together.',
    needLabel: 'What do you need?',
    needHint: 'Mention the team, the season, and any colours you have to stick to.',
    peopleLabel: 'How many people?', logoLabel: 'Logo text',
    logoHint: 'Shown on the garment previews.',
    generate: 'Show me some kits', generating: 'Putting three kits together…',
    threeKits: 'Three kits for {count} people',
    pickClosest: 'Pick the closest one and change anything you like.',
    chooseDifferent: 'Choose a different kit',
    configureThis: 'Configure this kit',
    replaceTitle: 'Replace these kits?',
    replaceWarning: 'New kits will replace the ones you have changed.\n\nSave the kit first if you want to keep it.',
  },
  configure: {
    title: 'Configure', subtitle: 'Indicative prices from the demo catalogue.',
    nothingYet: 'Nothing to configure yet',
    nothingYetNote: 'Describe a team on the New uniform page and I will put three kits together.',
    startOne: 'Start a uniform',
    garments: 'Garments', outfit: 'Outfit', fit: 'Fit',
    colours: 'Colours', branding: 'Branding', quantity: 'Quantity', sizes: 'Sizes',
    step: 'Step {n}: {name}',
    buildOutfit: 'Build the outfit',
    buildOutfitNote: 'Add the pieces this team needs. One top and one bottom always stay in the kit.',
    top: 'Top', layer: 'Layer', bottom: 'Bottom',
    add: 'Add', added: 'Added', required: 'Required',
    addGarment: 'Add {garment}', removeGarment: 'Remove {garment}',
    requiredGarment: '{garment} is required',
    genderCut: 'Gender & cut',
    genderCutNote: 'The design stays shared; production uses the selected garment blocks.',
    fitAndFabric: 'Fit & fabric',
    fitAndFabricNote: 'Choose a construction fit and the right cloth for each piece.',
    fitNote: 'Fit changes the garment ease. Size is allocated separately.',
    selectPreviewToSwitch: 'Select another piece in the preview to switch.',
    fabric: 'Fabric', fabricNote: 'Each garment is priced on its own cloth.',
    coloursNote: 'Editing the {garment}. Pick another garment in the preview to switch.',
    brandingNote: 'Charged once per person, whatever the kit contains.',
    quantityNote: 'Spare stock covers new starters and replacements.',
    logoColour: 'Logo colour', placement: 'Placement',
    peopleToKit: 'People to kit out', spareStock: 'Spare stock',
    quantitySizes: 'Quantity & sizes',
    quantitySizesNote: 'Set the order total, then allocate sizes now or collect them from staff.',
    sizeCollection: 'Size collection',
    sizesNote: 'Sizes are collected from staff after the order is placed.',
    previewUpdates: 'Preview updates as you choose', selectGarment: 'Select a garment to recolour it',
    selectGarmentToEdit: 'Select a garment to adjust its fit and fabric',
    showingBack: 'Showing the back, where the logo goes',
    colourThe: 'Colour the {garment}', editThe: 'Edit the {garment}',
    spareOf: '{pct}% spare',
    examples: 'Navy polo with a gold logo|Use the performance knit|Move the logo to the sleeve|10% spare',
    standardCloth: 'Standard cloth', mixedGrades: 'Mixed grades',
    askTitle: 'Tell me what to change',
    askNote: 'Ask for several things at once. I will show you exactly what changed.',
    describeChange: 'Describe a change', apply: 'Apply',
    saveKit: 'Save kit', getQuote: 'Get a quote', saveAsKit: 'Save as a kit',
    nextStep: 'Next: {name}', perPersonPrice: '{price} / person',
    beforeOptions: '{price} a person · {total} for {count} before options',
    setsLine: '{price} per person · {sets} sets (incl. {spare} spare)',
    setsLineNoSpare: '{price} per person · {sets} sets',
  },
  /* The designer's own proposals. Each `ask*` is fed verbatim to refine(),
     so these are not labels: they are working sentences, and changing one
     changes what the button does. Keep them in the parser's vocabulary. */
  suggest: {
    title: 'I would change this',
    open: 'Talk to your designer',
    askPerformance: 'Use the performance knit',
    askTwill: 'Use the brushed twill',
    askWorsted: 'Use the fine worsted cloth',
    askStandard: 'Use the standard cloth',
    askLogoWhite: 'Make the logo white',
    askLogoNavy: 'Make the logo navy',
    whyHeat: 'Your brief mentions heat, and this is quoted on cloth that holds it. Wicking knit adds {delta} a person — {total} across {sets} sets.',
    whyDurable: 'Standard weave goes at the knees on site work. The brushed twill adds {delta} a person — {total} across {sets} sets.',
    whyFormal: 'Front of house reads the cloth before the cut. Fine worsted adds {delta} a person — {total} across {sets} sets.',
    whyBudget: 'You mentioned budget and this is quoted above the standard grade. Dropping back saves {delta} a person — {total} across {sets} sets.',
    whyLogo: 'A {logo} logo on a {body} body is there but unreadable from a few paces.',
  },
  /* Quick asks. Like the suggest.ask* lines these are submitted verbatim, so
     each one has to stay inside the parser's vocabulary. "Embroider the logo"
     rather than "Use embroidery": the branch is gated on \bembroider\b, and
     the trailing "y" defeats the boundary. */
  chip: {
    logoSleeve: 'Move the logo to the sleeve',
    logoBack: 'Put the logo on the back',
    logoChest: 'Move the logo to the chest',
    embroider: 'Embroider the logo',
    print: 'Print the logo',
    noLogo: 'No logo',
    spare10: '10% spare',
    noSpare: 'No spare',
  },
  quote: {
    title: 'Your quote', validFor: 'Held for 30 days.',
    branding: 'Branding', upgrade: 'upgrade', sets: 'Sets',
    coversPeople: '{people} people plus {spare} spare', coversNoSpare: '{people} people, no spare',
    cutRange: 'Production cuts', fitProfile: 'Fit profile', sizing: 'Size plan',
    total: 'Total', keepEditing: 'Keep editing', submit: 'Place order',
  },
  orders: {
    title: 'Orders', subtitle: 'Where everything is right now.',
    noneTitle: 'No orders yet',
    noneNote: 'Configure a kit, review the quote and place the order. It lands here with its production stages.',
    startOne: 'Start a uniform',
    colOrder: 'Order', colStatus: 'Status', colValue: 'Value', colDue: 'Due',
    colItem: 'Item', colQty: 'Qty', colProgress: 'Progress', colReady: 'Ready',
    open: 'Open {name}, {id}',
    dueAround: 'Due around {date}', deliveredOn: 'Delivered {date}',
    whatIsBeingMade: 'What is being made', whatWasMade: 'What was made',
    waitingOnSizes: 'Waiting on sizes',
    setsAndValue: '{sets} sets · {value}',
    ordered: 'Ordered', sizesIn: 'Sizes in', fabricCut: 'Fabric cut',
    sewing: 'Sewing', checks: 'Checks', delivery: 'Delivery', now: 'Now',
  },
  kits: {
    title: 'Saved kits', subtitle: 'Reorder these without starting again.',
    newUniform: 'New uniform', noneTitle: 'No saved kits yet',
    noneNote: 'When you configure a uniform you are happy with, save it here and reorder it any time.',
    createFirst: 'Create your first kit',
    forPeople: '{price} for {count}',
    specLine: '{cuts} · {fit}',
    saved: 'Saved “{name}” to your kits', already: '“{name}” is already in your kits',
  },
  settings: {
    title: 'Settings', subtitle: 'Used to keep every kit on brand.',
    company: 'Your company', companyNote: 'Shown on quotes and used to size every order.',
    companyName: 'Company name', totalStaff: 'Total staff', industry: 'Industry',
    industryHint: 'Sets the starting point for new kits.',
    dressCode: 'Dress code', dressCodeNote: 'I read this before suggesting kits, so write it in plain words.',
    rulesLabel: 'What your teams should wear',
    language: 'Language', languageNote: 'Changes the interface and everything I write.',
    interfaceLanguage: 'Interface language',
    save: 'Save settings', saved: 'Settings saved',
    nameNeeded: 'A name is needed — it goes on every quote.',
    staffNeeded: 'At least one person.',
    industryTech: 'Technology', industryHospitality: 'Hospitality',
    industryFacilities: 'Facilities management', industryRetail: 'Retail',
  },
  manager: {
    who: 'UniformAI · your account manager',
    // Whole sentences per branch, not fragments: Arabic word order and
    // agreement do not survive being glued together from English pieces.
    reasonHeat: '“{word}”, so breathable weaves',
    heatFallback: 'heat',
    reasonDurable: 'hard-wearing fabrics throughout',
    reasonOutdoor: 'cuts that hold up on site',
    reasonFormal: 'smart enough for client-facing work',
    reasonDefault: 'the closest matches to what you described',
    didColourKept: 'kept {colour}',
    didColour: 'in {colour}',
    didLogo: 'logo on the {place}',
    didUnbranded: 'unbranded',
    whyWithDid: '{did} — {reason}.',
    whyPlain: '{reason}.',
    cheapest: '{name} is the cheapest at {price} a person.',
    fabricPushKnit: 'In this heat the performance knit is worth the extra 90 a person.',
    fabricGoodCall: 'Good call — 90 more a person, and people notice it by mid-afternoon.',
    fabricStandard: 'The standard grade is fine unless these get worn every day.',
    outfitCuts: 'One shared design can carry both men’s and women’s production cuts, so a mixed team stays in sync.',
    fitRelaxed: 'Relaxed leaves room to bend and reach on site. Regular pulls tight across the back.',
    fitSlim: 'Slim reads sharper front of house. A relaxed cut looks borrowed at the desk.',
    sizesAllocateNow: 'Assigning sizes now locks the run. A wrong guess becomes a reorder, not a swap.',
    colourLight: 'Light bodies show marks fast on site — worth keeping the trouser dark.',
    colourDark: 'Dark hides wear and washes well. One lighter accent stops it reading as security kit.',
    brandNone: 'Saves 17–35 a person, but without a mark these stop reading as a uniform.',
    brandPrint: 'Print saves 17 a person. Right on knits, but it fades if washed hot.',
    brandEmbroidery: 'Embroidery is 17 more a person and outlasts the garment — cheaper over two years.',
    spareNone: 'Exactly {sets} sets — a new starter waits for the next run. 5% is cheap insurance.',
    quoteCovers: 'Covers {people} people plus {spare} spare. Nothing is charged until you order — I collect sizes after that.',
    quoteCoversNoSpare: 'Covers {people} people. Nothing is charged until you order — I collect sizes after that.',
    quoteSized: 'Covers {people} people plus {spare} spare, with every size assigned. Nothing is charged until you order.',
    quoteSizedNoSpare: 'Covers {people} people, with every size assigned. Nothing is charged until you order.',
    orderDelivered: 'Delivered {date}. Say the word if anything needs replacing — same spec, same price.',
    orderMaking: '{stage} now, fabric all in. Delivery around {date} — I will flag it here if that moves.',
    orderSizes: 'Placed {placed}. I am collecting sizes now — cutting starts once they are in, delivery around {due}. I will flag it here if that moves.',
    greetNothing: '{part}, {name}. Nothing needs you today.',
    greetSizes: '{part}, {name}. {kit} is ordered — I am collecting sizes for {id}.',
    greetMaking: '{part}, {name}. {kit} is in production, due around {date}.',
    greetMany: '{part}, {name}. {sizes} waiting on sizes, {making} in production.',
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
    placeChest: 'chest', placeRightChest: 'right chest', placeSleeve: 'sleeve', placeBack: 'back',
  },
  kitNames: {
    'front-office': 'Front Office', operations: 'Operations',
    management: 'Management', technicians: 'Technicians',
  },
  statuses: {
    collectingSizes: 'Collecting sizes', inProduction: 'In production', delivered: 'Delivered',
  },
  garments: {
    polo: 'Polo Shirt', shirt: 'Formal Shirt', chino: 'Chino Trouser',
    blazer: 'Blazer', cargo: 'Cargo Trouser',
  },
  garmentNotes: {
    polo: 'Easy-care everyday knit', shirt: 'Smart woven shirt',
    blazer: 'Structured outer layer', chino: 'Clean everyday trouser',
    cargo: 'Hard-wearing utility trouser',
  },
  fits: {
    slim: 'Slim', regular: 'Regular', relaxed: 'Relaxed',
    slimNote: 'Closer through body and leg', regularNote: 'Balanced everyday ease',
    relaxedNote: 'More room for movement',
  },
  cuts: {
    mixed: "Men's + women's", unisex: 'Unisex', men: "Men's only", women: "Women's only",
    mixedNote: 'One design, supplied in both cuts.', unisexNote: 'One shared block across the team.',
    menNote: "Supply the men's block only.", womenNote: "Supply the women's block only.",
    menBlock: "Men's cut", womenBlock: "Women's cut", unisexBlock: 'Unisex cut',
  },
  sizing: {
    collect_later: 'Collect from staff later',
    collect_laterNote: 'Send a size form after approval. Best when names are not final.',
    allocate_now: 'Enter size quantities now',
    allocate_nowNote: 'Build the production breakdown for this quote.',
    assigned: '{assigned} of {sets} sets assigned', complete: 'Ready for production',
    remaining: '{count} still to assign', over: '{count} over the order total',
    cutCount: '{count} sets', cutCountOne: '{count} set',
    drawingNote: 'Sizes change the quantity table, not the flat drawing. Final measurements are confirmed before cutting.',
    collectQuote: 'Collect from staff after approval',
    allocatedQuote: '{count} size quantities assigned',
  },
  parts: {
    body: 'body', collar: 'collar', cuffs: 'cuffs', placket: 'placket',
    leg: 'leg', lapel: 'lapel', buttons: 'buttons', pockets: 'pockets',
  },
  colours: {
    // Swatch names, keyed by the English name the parser matches on. The
    // stored value is the hex; only what the buyer reads changes.
    Navy: 'Navy', Ink: 'Ink', Sand: 'Sand', Slate: 'Slate',
    White: 'White', Olive: 'Olive', Oxblood: 'Oxblood', Brass: 'Brass',
    darkFamily: 'dark', lightFamily: 'light', neutralFamily: 'neutral',
    closeTo: 'Close to {name}',
  },

  fabrics: {
    // The cloth names stay as they are: a buyer sourcing uniforms in Egypt
    // uses the trade names in either language. Only the notes translate.
    knit0: '220 GSM · breathable everyday knit',
    knit1: '240 GSM · softer hand, holds colour',
    knit2: 'Moisture wicking · best for heat',
    woven0: 'The cloth this kit is quoted at',
    woven1: 'Heavier, softer, holds a press',
    woven2: 'Smooth finish · best for client-facing work',
  },

  branding: {
    embroidery: 'Embroidery', print: 'Screen print',
    embroideryNote: 'Stitched. Hard wearing, premium finish.',
    printNote: 'Printed. Lower cost, best on flat knits.',
    left_chest: 'Left chest', right_chest: 'Right chest', sleeve: 'Sleeve',
    back: 'Back', none: 'No logo',
    left_chestNote: 'The default for corporate wear.',
    right_chestNote: 'Use when a name badge sits left.',
    sleeveNote: 'Subtle. Good for client-facing teams.',
    backNote: 'High visibility across a floor or site.',
    noneNote: 'Plain garments, no branding cost.',
    embroideredLogo: 'Embroidered logo', printedLogo: 'Printed logo',
  },
  spare: {
    none: 'No spare', noneNote: 'A new starter waits for the next run',
    five: '5% spare', ten: '10% spare',
    note: '{count} sets for new starters and replacements',
    setsCount: '{count} sets',
    sets: '{count} sets',
  },
  reply: {
    // What the editor says back. Whole sentences per outcome: these read as
    // the product's own voice, so a fragment glued together from an English
    // template is exactly what does not survive translation.
    droppedLogo: 'Dropped the logo. The branding line comes off the price.',
    droppedSpare: 'Dropped the spare stock. A new starter waits for the next run.',
    setPart: 'Set the {garment} {part} to {colour}.',
    movedFabric: 'Moved to {fabric}. The price follows.',
    // Asking for "the standard cloth" on a mixed kit resolves to a different
    // cloth per garment. Listing all three answers a question nobody asked --
    // you asked for a grade, so the reply is about the grade.
    movedStandard: 'Every piece is back on its standard cloth. The price follows.',
    movedUp: 'Every piece moved up a grade. The price follows.',
    noFabric: '{wanted} is not available for {these}. I can offer {offered}.',
    theseGarments: 'these garments', thisGarment: 'this garment',
    setSpare: 'Set spare stock to {pct}%. It covers new starters without sitting on stock.',
    logoColour: 'Set the logo to {colour}.',
    logoMethod: 'Switched the logo to {method}.',
    logoPlace: 'Moved the logo to the {place}.',
    and: ' and ',
    or: ' or ',
    updatedBranding: 'Updated the branding.',
    bothFollow: 'The drawing and the price both follow.',
    notFollowed: 'I did not follow “{part}” — say that one on its own and I will.',
  },

  errors: {
    notUnderstood: 'I can change a colour, a fabric, the branding, or the spare stock. Try “make the trouser navy” or “use the performance knit”.',
  },
} as const;

const ar: Dict<typeof en> = {
  common: {
    close: 'إغلاق', cancel: 'إلغاء', back: 'رجوع', next: 'التالي',
    save: 'حفظ', confirm: 'تأكيد', loading: 'جارٍ العمل…', included: 'مشمول',
    people: 'موظف', sets: 'طقم', perPerson: 'للفرد', total: 'الإجمالي',
    person: 'موظف', spare: 'احتياطي', noSpare: 'بلا احتياطي', none: 'لا يوجد',
  },

  nav: {
    home: 'الرئيسية', newUniform: 'تصميم زي جديد', configure: 'تخصيص الطقم',
    savedKits: 'الأطقم المحفوظة', orders: 'الطلبات', settings: 'الإعدادات',
    workspace: 'مساحة العمل', more: 'المزيد', sections: 'الأقسام',
    moreSections: 'أقسام أخرى', closeMenu: 'إغلاق القائمة',
    staff: '{count} موظف · صيف 2026',
  },

  home: {
    title: 'الرئيسية',
    subtitle: 'تابع كل ما يخص زي فريقك، خطوة بخطوة.',
    askTitle: 'يسعدنا أن نجهّز الزي المناسب لفريقك',
    askSubtitle: 'عرّفنا بطبيعة عمل الفريق واحتياجاته.',
    describeTeam: 'عرّفنا بفريقك',
    showKits: 'عرض الأطقم المقترحة',
    savedKits: 'الأطقم المحفوظة',
    savedKitsNote: 'جاهزة لإعادة الطلب',
    collectingSizes: 'بانتظار المقاسات',
    noneWaiting: 'لا شيء بانتظار المقاسات',
    inProduction: 'قيد الإنتاج',
    nothingOnFloor: 'لا شيء قيد الإنتاج',
    delivered: 'تم التسليم',
    nothingYet: 'لا شيء حتى الآن',
    nextDue: 'التسليم القادم {date}',
    orderLine: '{id} · {sets} طقم',
    recentActivity: 'آخر التحديثات',
    viewOrders: 'عرض الطلبات',
    browseSavedKits: 'تصفح الأطقم المحفوظة',
    firstOrderHere: 'أول طلب لك سيظهر هنا.',
    colWhat: 'التفاصيل',
    colStatus: 'الحالة',
    colValue: 'القيمة',
    colUpdated: 'آخر تحديث',
  },

  design: {
    title: 'تصميم زي جديد',
    subtitle: 'عرّفنا بالفريق، وسنجهّز لك ثلاثة خيارات مناسبة.',
    needLabel: 'ما الذي يحتاجه الفريق؟',
    needHint: 'اذكر طبيعة العمل والموسم والألوان التي تودّ الالتزام بها.',
    peopleLabel: 'عدد الموظفين',
    logoLabel: 'النص على الشعار',
    logoHint: 'ستراه على معاينة الزي.',
    generate: 'عرض الأطقم المقترحة',
    generating: 'نجهّز لك ثلاثة أطقم…',
    threeKits: 'ثلاثة أطقم اخترناها لـ {count} موظف',
    pickClosest: 'اختر الأقرب، ثم غيّر ما تريد.',
    chooseDifferent: 'اختيار طقم آخر',
    configureThis: 'تخصيص هذا الطقم',
    replaceTitle: 'هل تريد أطقمًا جديدة؟',
    replaceWarning: 'الأطقم الجديدة ستحل محل الحالية، وستفقد تعديلاتك.\n\nاحفظ الطقم أولًا إذا أردت الرجوع إليه.',
  },

  configure: {
    title: 'تخصيص الطقم',
    subtitle: 'الأسعار مبدئية ومأخوذة من الكتالوج التجريبي.',
    nothingYet: 'لا يوجد لديك طقم لتعدّله بعد',
    nothingYetNote: 'عرّفنا بفريقك أولًا، وسنجهّز لك ثلاثة أطقم لتختار منها.',
    startOne: 'تصميم زي جديد',
    garments: 'قطع الزي',
    outfit: 'الطقم',
    fit: 'القَصّة',
    colours: 'الألوان',
    branding: 'الشعار',
    quantity: 'الكمية',
    sizes: 'المقاسات',
    step: 'الخطوة {n}: {name}',
    buildOutfit: 'اختيار قطع الطقم',
    buildOutfitNote: 'اختر القطع التي يحتاجها الفريق. القطعة العلوية والبنطال أساسيان في كل طقم.',
    top: 'قطعة علوية',
    layer: 'طبقة خارجية',
    bottom: 'بنطال',
    add: 'إضافة',
    added: 'تمت الإضافة',
    required: 'أساسي',
    addGarment: 'إضافة {garment}',
    removeGarment: 'إزالة {garment}',
    requiredGarment: 'قطعة {garment} أساسية في الطقم',
    genderCut: 'نوع القَصّة',
    genderCutNote: 'نفس التصميم، بالقَصّات التي تناسب فريقك.',
    fitAndFabric: 'القَصّة والخامة',
    fitAndFabricNote: 'اختر القَصّة والخامة المناسبة لكل قطعة.',
    fitNote: 'القَصّة تحدد اتساع القطعة، أما المقاس فتختاره بشكل منفصل.',
    selectPreviewToSwitch: 'اختر أي قطعة من المعاينة لتعدّلها.',
    fabric: 'الخامة',
    fabricNote: 'لكل قطعة خامتها وسعرها.',
    coloursNote: 'أنت تغيّر لون {garment}. اختر قطعة أخرى من المعاينة للتبديل.',
    brandingNote: 'نحسب تكلفة الشعار مرة واحدة للفرد، مهما كان عدد قطع الطقم.',
    quantityNote: 'الاحتياطي يغطّي الموظفين الجدد وأي قطع تحتاج إلى استبدال.',
    logoColour: 'لون الشعار',
    placement: 'موضع الشعار',
    peopleToKit: 'عدد الموظفين',
    spareStock: 'الأطقم الاحتياطية',
    quantitySizes: 'الكمية والمقاسات',
    quantitySizesNote: 'حدد الكمية، ثم وزّع المقاسات الآن أو اجمعها من الفريق لاحقًا.',
    sizeCollection: 'تجميع المقاسات',
    sizesNote: 'سنجمع المقاسات من الموظفين بعد تأكيد الطلب.',
    previewUpdates: 'المعاينة تتغير مع اختياراتك',
    selectGarment: 'اختر قطعة لتعديل لونها',
    selectGarmentToEdit: 'اختر قطعة لتعديل القَصّة والخامة',
    showingBack: 'نعرض الظهر حيث سيظهر الشعار',
    colourThe: 'لوّن {garment}',
    editThe: 'تعديل {garment}',
    spareOf: '{pct}٪ احتياطي',
    examples: 'قميص بولو كحلي بشعار ذهبي|استخدم خامة مناسبة للأجواء الحارة|انقل الشعار إلى الكم|أضف 10٪ أطقم احتياطية',
    standardCloth: 'الخامة القياسية',
    mixedGrades: 'درجات خامة مختلفة',
    askTitle: 'ما الذي تودّ تغييره؟',
    askNote: 'اكتب جميع التعديلات معًا، وسأوضح لك ما تغيّر.',
    describeChange: 'اكتب التعديل',
    apply: 'تطبيق',
    saveKit: 'حفظ الطقم',
    getQuote: 'طلب عرض سعر',
    saveAsKit: 'حفظ ضمن الأطقم',
    nextStep: 'التالي: {name}',
    perPersonPrice: '{price} للفرد',
    beforeOptions: '{price} للفرد · {total} لـ {count} موظف قبل الخيارات الإضافية',
    setsLine: '{price} للفرد · {sets} طقم، منها {spare} احتياطي',
    setsLineNoSpare: '{price} للفرد · {sets} طقم',
  },

  suggest: {
    title: 'اقتراح من المصمم',
    open: 'تحدّث مع المصمم',

    askPerformance: 'استخدم الخامة عالية الأداء',
    askTwill: 'استخدم خامة أكثر متانة',
    askWorsted: 'استخدم الخامة الرسمية',
    askStandard: 'استخدم الخامة القياسية',
    askLogoWhite: 'اجعل الشعار أبيض',
    askLogoNavy: 'اجعل الشعار كحليًا',

    whyHeat: 'ذكرت أن الجو حار، والخامة الحالية تحتفظ بالحرارة. الخامة عالية الأداء أكثر راحة، وفارقها {delta} للفرد — أي {total} لـ {sets} طقم.',

    whyDurable: 'في مواقع العمل، ستبلى الخامة القياسية سريعًا عند الركبتين. التويل المبروش أكثر متانة، وفارق السعر {delta} للفرد — أي {total} لـ {sets} طقم.',

    whyFormal: 'يلاحظ العميل الخامة قبل القَصّة. الخامة الرسمية أكثر أناقة، وفارقها {delta} للفرد — أي {total} لـ {sets} طقم.',

    whyBudget: 'بما أن الميزانية مهمة، يمكننا العودة إلى الخامة القياسية. ستوفّر {delta} للفرد — أي {total} لـ {sets} طقم.',

    whyLogo: 'الشعار {logo} قريب جدًا من لون القماش {body}، لذلك لن يظهر بوضوح من بعيد.',
  },
  chip: {
    logoSleeve: 'انقل الشعار إلى الكم',
    logoBack: 'ضع الشعار على الظهر',
    logoChest: 'انقل الشعار إلى الصدر',
    embroider: 'تطريز الشعار',
    print: 'طباعة الشعار',
    noLogo: 'بلا شعار',
    spare10: 'أضف 10٪ أطقم احتياطية',
    noSpare: 'بلا احتياطي',
  },
  quote: {
    title: 'عرض السعر',
    validFor: 'السعر ثابت لمدة 30 يومًا.',
    branding: 'الشعار والتخصيص',
    upgrade: 'الإضافات',
    sets: 'الأطقم',
    coversPeople: '{people} موظف + {spare} طقم احتياطي',
    coversNoSpare: '{people} موظف · بلا أطقم احتياطية',
    cutRange: 'قوالب التفصيل',
    fitProfile: 'القَصّة',
    sizing: 'خطة المقاسات',
    total: 'الإجمالي',
    keepEditing: 'العودة للتعديل',
    submit: 'تأكيد الطلب',
  },

  orders: {
    title: 'الطلبات',
    subtitle: 'تابع كل طلب من التأكيد حتى التسليم.',
    noneTitle: 'لم تطلب أي أطقم بعد',
    noneNote: 'اختر طقمًا وراجع سعره، وبعد تأكيد الطلب يمكنك متابعة كل خطوة من هنا.',
    startOne: 'تصميم زي جديد',
    colOrder: 'الطلب',
    colStatus: 'الحالة',
    colValue: 'القيمة',
    colDue: 'التسليم المتوقع',
    colItem: 'الصنف',
    colQty: 'الكمية',
    colProgress: 'مراحل التنفيذ',
    colReady: 'الجاهزية',
    open: 'عرض الطلب {name}، {id}',
    dueAround: 'نتوقع التسليم في {date}',
    deliveredOn: 'تم التسليم في {date}',
    whatIsBeingMade: 'ما نعمل عليه الآن',
    whatWasMade: 'ما تم تجهيزه',
    waitingOnSizes: 'بانتظار المقاسات',
    setsAndValue: '{sets} طقم · {value}',
    ordered: 'الطلب مؤكد',
    sizesIn: 'المقاسات وصلت',
    fabricCut: 'قص القماش',
    sewing: 'الخياطة',
    checks: 'فحص الجودة',
    delivery: 'التسليم',
    now: 'المرحلة الحالية',
  },

  kits: {
    title: 'الأطقم المحفوظة',
    subtitle: 'أعد طلب هذه الأطقم دون البدء من جديد.',
    newUniform: 'تصميم زي جديد',
    noneTitle: 'لم تحفظ أي طقم بعد',
    noneNote: 'عندما تصل إلى طقم يعجبك، احفظه هنا لتطلبه مرة أخرى في أي وقت.',
    createFirst: 'صمّم أول طقم',
    forPeople: '{price} لـ {count} موظف',
    specLine: '{cuts} · {fit}',
    saved: 'حفظنا «{name}» في أطقمك',
    already: '«{name}» موجود بالفعل في أطقمك',
  },

  settings: {
    title: 'الإعدادات',
    subtitle: 'عرّفنا بشركتك مرة، وسنراعي هويتها في كل طقم.',
    company: 'بيانات الشركة',
    companyNote: 'سنضع هذه البيانات في عروض الأسعار ونستخدمها عند تجهيز الطلبات.',
    companyName: 'اسم الشركة',
    totalStaff: 'عدد الموظفين',
    industry: 'قطاع العمل',
    industryHint: 'يساعدنا على تقديم اقتراحات أقرب إلى طبيعة عملك.',
    dressCode: 'معايير الزي',
    dressCodeNote: 'سأقرأ هذه التفاصيل قبل أن أقترح أي طقم، فاكتبها بطريقتك.',
    rulesLabel: 'ما الذي يجب أن يرتديه فريقك؟',
    language: 'اللغة',
    languageNote: 'اختر اللغة التي تريحك في الواجهة والرسائل.',
    interfaceLanguage: 'لغة الواجهة',
    save: 'حفظ الإعدادات',
    saved: 'حفظنا الإعدادات',
    nameNeeded: 'اكتب اسم الشركة ليظهر في عرض السعر.',
    staffNeeded: 'اكتب عدد الموظفين، ولو كان موظفًا واحدًا.',
    industryTech: 'التكنولوجيا',
    industryHospitality: 'الضيافة',
    industryFacilities: 'إدارة المرافق',
    industryRetail: 'تجارة التجزئة',
  },

  manager: {
    who: 'UniformAI · مدير حسابك',
    reasonHeat: 'ذكرت «{word}»، فاخترت لك خامات جيدة التهوية',
    heatFallback: 'الحرارة',
    reasonDurable: 'الأولوية هنا لخامات متينة تتحمل الاستخدام اليومي',
    reasonOutdoor: 'الأولوية لقَصّات عملية تسهّل الحركة في الموقع',
    reasonFormal: 'المظهر الأنيق مهم عند التعامل مع العملاء',
    reasonDefault: 'هذه الخيارات هي الأقرب لما وصفته',
    didColourKept: 'أبقيت اللون {colour}',
    didColour: 'اخترت {colour}',
    didLogo: 'وضعت الشعار على {place}',
    didUnbranded: 'تركت الطقم بلا شعار',
    whyWithDid: '{did} — {reason}.',
    whyPlain: '{reason}.',
    cheapest: 'طقم {name} هو الأقل سعرًا: {price} للفرد.',
    fabricPushKnit: 'مع الحر، الخامة عالية الأداء تستحق فارق 90 للفرد.',
    fabricGoodCall: 'اختيار موفق — 90 إضافية للفرد، وسيشعر الفريق بالفارق في نهاية اليوم.',
    fabricStandard: 'الخامة القياسية مناسبة، إلا إذا كان الفريق سيرتدي الزي كل يوم.',
    outfitCuts: 'يمكننا تنفيذ التصميم نفسه بقَصّات رجالية ونسائية، ليظهر الفريق كله بشكل موحّد.',
    fitRelaxed: 'القَصّة المريحة أسهل للحركة داخل الموقع؛ أما العادية فقد تشدّ عند الظهر.',
    fitSlim: 'القَصّة الضيقة أكثر أناقة أمام العملاء؛ أما المريحة فقد تبدو واسعة في مكتب الاستقبال.',
    sizesAllocateNow: 'إذا أدخلت المقاسات الآن، سنثبّت خطة الإنتاج. وأي تقدير خاطئ سيحتاج إلى طلب جديد، وليس مجرد استبدال.',
    colourLight: 'الألوان الفاتحة تُظهر البقع بسرعة في الموقع، فالأفضل أن يظل البنطال داكنًا.',
    colourDark: 'اللون الداكن عملي ويتحمل الغسيل. تفصيلة أفتح ستمنع الطقم من أن يبدو كزي أمني.',
    brandNone: 'من دون شعار ستوفّر من 17 إلى 35 للفرد، لكن هوية شركتك لن تكون واضحة على الطقم.',
    brandPrint: 'الطباعة توفّر 17 للفرد وتناسب الأقمشة الملساء، لكنها تبهت مع الغسيل الساخن.',
    brandEmbroidery: 'التطريز يزيد السعر 17 للفرد، لكنه يدوم مع القطعة ويحافظ على شكله.',
    spareNone: 'يتضمن الطلب {sets} طقم بالضبط. أي موظف جديد سينتظر الدفعة التالية؛ واحتياطي 5٪ يكفي لتجنّب ذلك.',
    quoteCovers: 'العرض يغطي {people} موظفًا ومعهم {spare} طقم احتياطي. لن تدفع شيئًا قبل تأكيد الطلب، وسأجمع المقاسات بعد ذلك.',
    quoteCoversNoSpare: 'العرض يغطي {people} موظفًا بلا احتياطي. لن تدفع شيئًا قبل تأكيد الطلب، وسأجمع المقاسات بعد ذلك.',
    quoteSized: 'العرض يغطي {people} موظفًا ومعهم {spare} طقم احتياطي، وكل المقاسات موزعة. لن تدفع شيئًا قبل تأكيد الطلب.',
    quoteSizedNoSpare: 'العرض يغطي {people} موظفًا، وكل المقاسات موزعة. لن تدفع شيئًا قبل تأكيد الطلب.',
    orderDelivered: 'تم التسليم في {date}. إذا احتجت إلى بديل، فسننفّذه بالمواصفات نفسها.',
    orderMaking: 'الطلب الآن في مرحلة {stage}، وجميع الخامات جاهزة. نتوقع التسليم في {date} — وسأخبرك هنا إذا تغيّر الموعد.',
    orderSizes: 'أكدنا الطلب في {placed}. نجمع المقاسات الآن، وسيبدأ القص عند اكتمالها. نتوقع التسليم في {due}.',
    greetNothing: '{part} يا {name}. لا شيء يحتاج منك متابعة اليوم.',
    greetSizes: '{part} يا {name}. أكدنا طلب طقم {kit}، ونجمع الآن المقاسات للطلب {id}.',
    greetMaking: '{part} يا {name}. بدأنا إنتاج طقم {kit}، والتسليم تقريبًا {date}.',
    greetMany: '{part} يا {name}. طلبات بانتظار المقاسات: {sizes}، وطلبات قيد الإنتاج: {making}.',
    morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير',
    placeChest: 'الصدر', placeRightChest: 'الجهة اليمنى من الصدر', placeSleeve: 'الكم', placeBack: 'الظهر',
  },

  kitNames: {
    'front-office': 'الاستقبال',
    operations: 'التشغيل',
    management: 'الإدارة',
    technicians: 'الفنيون',
  },

  statuses: {
    collectingSizes: 'بانتظار المقاسات',
    inProduction: 'قيد الإنتاج',
    delivered: 'تم التسليم',
  },

  garments: {
    polo: 'قميص بولو',
    shirt: 'قميص رسمي',
    chino: 'بنطال تشينو',
    blazer: 'سترة بليزر',
    cargo: 'بنطال كارجو',
  },
  garmentNotes: {
    polo: 'عملي وسهل العناية للاستخدام اليومي',
    shirt: 'قميص منسوج وأنيق',
    blazer: 'طبقة خارجية بقَصّة محددة',
    chino: 'بنطال يومي بمظهر أنيق',
    cargo: 'بنطال عملي متين',
  },
  fits: {
    slim: 'ضيقة',
    regular: 'عادية',
    relaxed: 'مريحة',
    slimNote: 'أقرب إلى الجسم والساق',
    regularNote: 'اتساع متوازن للاستخدام اليومي',
    relaxedNote: 'مساحة أكبر وحرية في الحركة',
  },
  cuts: {
    mixed: 'رجالي ونسائي',
    unisex: 'موحّدة للجميع',
    men: 'رجالي فقط',
    women: 'نسائي فقط',
    mixedNote: 'تصميم واحد يُنفّذ بالقَصّتين.',
    unisexNote: 'قالب تفصيل واحد لجميع أفراد الفريق.',
    menNote: 'تنفيذ القالب الرجالي فقط.',
    womenNote: 'تنفيذ القالب النسائي فقط.',
    menBlock: 'القَصّة الرجالية',
    womenBlock: 'القَصّة النسائية',
    unisexBlock: 'القَصّة الموحّدة',
  },
  sizing: {
    collect_later: 'جمع المقاسات من الموظفين لاحقًا',
    collect_laterNote: 'سنرسل نموذج المقاسات بعد الموافقة. هذا أنسب إذا لم تتحدد أسماء الفريق بعد.',
    allocate_now: 'إدخال كميات المقاسات الآن',
    allocate_nowNote: 'جهّز توزيع المقاسات للإنتاج ضمن عرض السعر.',
    assigned: 'المقاسات الموزعة: {assigned} من {sets}',
    complete: 'جاهز للإنتاج',
    remaining: 'بقي {count} من الأطقم',
    over: 'تجاوزت الكمية إجمالي الطلب بمقدار {count}',
    cutCount: '{count} طقم', cutCountOne: '{count} طقم',
    drawingNote: 'المقاسات تغيّر جدول الكميات، لا الرسم. سنؤكد القياسات النهائية قبل القص.',
    collectQuote: 'تُجمع من الموظفين بعد اعتماد العرض',
    allocatedQuote: 'تم توزيع مقاسات {count} طقم',
  },

  parts: {
    body: 'الجزء الرئيسي',
    collar: 'الياقة',
    cuffs: 'أساور الأكمام',
    placket: 'شريط الأزرار',
    // No garment word inside a part name: every sentence that uses one names
    // the garment already, so these read "لون ساق البنطال في بنطال تشينو".
    // Nothing is lost -- a blazer has no separate collar, and the colour
    // picker only ever shows one garment's parts at a time.
    leg: 'الساق',
    lapel: 'الياقة',
    buttons: 'الأزرار',
    pockets: 'الجيوب',
  },

  colours: {
    Navy: 'كحلي',
    Ink: 'أسود',
    Sand: 'بيج',
    Slate: 'رمادي',
    White: 'أبيض',
    Olive: 'زيتي',
    Oxblood: 'نبيتي',
    Brass: 'ذهبي',
    darkFamily: 'الداكن',
    lightFamily: 'الفاتح',
    neutralFamily: 'المحايد',
    closeTo: 'درجة قريبة من {name}',
  },

  fabrics: {
    knit0: '220 غرام · مريحة وجيدة التهوية للاستخدام اليومي',
    knit1: '240 غرام · أنعم وتحافظ على اللون',
    knit2: 'تمتص الرطوبة · الأفضل للأجواء الحارة',
    woven0: 'الخامة الداخلة في سعر هذا الطقم',
    woven1: 'أثقل وأنعم وتحافظ على الكي',
    woven2: 'ملمس ناعم · الأفضل للتعامل مع العملاء',
  },

  branding: {
    embroidery: 'تطريز',
    print: 'طباعة',
    embroideryNote: 'مخيّط، متين، وتشطيبه راقٍ.',
    printNote: 'أقل تكلفة، والأنسب لأقمشة التريكو.',
    left_chest: 'الجهة اليسرى من الصدر',
    right_chest: 'الجهة اليمنى من الصدر',
    sleeve: 'الكم',
    back: 'الظهر',
    none: 'بلا شعار',
    left_chestNote: 'الموضع المعتاد للزي المؤسسي.',
    right_chestNote: 'مناسب إذا كانت بطاقة الاسم على اليسار.',
    sleeveNote: 'هادئ ومناسب للفرق التي تقابل العملاء.',
    backNote: 'واضح من بعيد في أرض العمل أو الموقع.',
    noneNote: 'قطع سادة، بلا تكلفة للشعار.',
    embroideredLogo: 'شعار مطرّز',
    printedLogo: 'شعار مطبوع',
  },

  spare: {
    none: 'بلا أطقم احتياطية',
    noneNote: 'الموظف الجديد سينتظر الدفعة التالية.',
    five: '5٪ احتياطي',
    ten: '10٪ احتياطي',
    note: '{count} طقم للموظفين الجدد وحالات الاستبدال',
    setsCount: '{count} طقم',
    sets: '{count} طقم',
  },

  reply: {
    droppedLogo: 'أزلت الشعار، وخصمت تكلفته من السعر.',
    droppedSpare: 'أزلت الأطقم الاحتياطية. وأي موظف جديد سينتظر دورة الإنتاج التالية.',
    setPart: 'غيّرت لون {part} في {garment} إلى {colour}.',
    movedFabric: 'غيّرت الخامة إلى {fabric}، وتغيّر السعر معها.',
    movedStandard: 'أعدت كل قطعة إلى خامتها القياسية، وتغيّر السعر معها.',
    movedUp: 'رفعت خامة كل قطعة درجة، وتغيّر السعر معها.',
    noFabric: 'خامة {wanted} غير متاحة {these}. يمكنني تقديم {offered}.',
    theseGarments: 'لهذه القطع',
    thisGarment: 'لهذه القطعة',
    setSpare: 'ضبطت الاحتياطي على {pct}٪؛ ليغطي الموظفين الجدد من دون تكديس المخزون.',
    logoColour: 'غيّرت لون الشعار إلى {colour}.',
    logoMethod: 'الشعار الآن بتقنية {method}.',
    logoPlace: 'نقلت الشعار إلى {place}.',
    // A space after the waw. Arabic attaches it to the next word, but these
    // join catalogue cloth names, which are Latin: "GSM وCotton Twill" runs
    // the conjunction into the name.
    and: ' و ',
    or: ' أو ',
    updatedBranding: 'حدّثت الشعار.',
    bothFollow: 'وتحدّثت المعاينة والسعر تلقائيًا.',
    notFollowed: 'لم أتمكن من تنفيذ «{part}» — اطلب هذا التعديل وحده وسأنفّذه.',
  },

  errors: {
    notUnderstood: 'يمكنني تغيير اللون أو الخامة أو الشعار أو عدد الأطقم الاحتياطية. جرّب: «غيّر البنطال إلى الكحلي» أو «استخدم خامة مناسبة للجو الحار».',
  },
};

export const translations = { en, ar } as const;

/** Look up a key like "orders.title", filling {placeholders} from `values`.
 *  A missing key returns the key itself: visible in the UI, caught by the
 *  key-parity test, and never a blank space or a thrown error mid-render. */
export function t(
  locale: Locale,
  key: string,
  values?: Record<string, string | number>,
): string {
  const found = key.split('.').reduce<unknown>(
    (o, part) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[part] : undefined),
    translations[locale],
  );
  if (typeof found !== 'string') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Missing translation: ${locale}.${key}`);
    }
    return key;
  }
  if (!values) return found;
  return found.replace(/\{(\w+)\}/g, (m, name) =>
    (name in values ? isolate(locale, String(values[name])) : m));
}

/** Latin dropped into an Arabic sentence -- a cloth name like "Wool Blend 260
 *  GSM" -- is reordered by the bidi algorithm against the run around it, and
 *  comes out scrambled: "Wool Blend 260g Cotton Twill 240 GSMg GSM" on screen
 *  from three perfectly ordered names. U+2068/U+2069 isolate the run so it is
 *  laid out on its own and placed as a unit.
 *
 *  Only where it can matter: an Arabic sentence, and a value that actually
 *  carries Latin. English needs none of this, and the characters are
 *  invisible but still characters -- a value quoted back inside guillemets
 *  should stay something a reader, or a test, can match on. */
export function isolate(locale: Locale, value: string): string {
  return locale === 'ar' && /[A-Za-z]/.test(value) ? `\u2068${value}\u2069` : value;
}

/** Egyptian business software shows 28,896 and EGP -- not ٢٨٬٨٩٦ -- so both
 *  locales keep Western digits and the currency code. */
const NUM: Intl.NumberFormatOptions = { numberingSystem: 'latn' } as Intl.NumberFormatOptions;

export const formatNumber = (locale: Locale, n: number): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', NUM).format(n);

export function formatCurrency(locale: Locale, n: number): string {
  return `EGP ${formatNumber(locale, Math.round(n))}`;
}

export const formatDate = (locale: Locale, d: Date): string =>
  new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB',
    { day: 'numeric', month: 'short', ...NUM }).format(d);

/** Arabic counts in five categories, not two. Written out rather than
 *  templated because the noun itself changes case and form: طقم / طقمان /
 *  أطقم / طقمًا. Intl.PluralRules gives the category; the sentence is ours. */
export function spareMessage(locale: Locale, count: number): string {
  if (locale === 'en') {
    return count === 0
      ? 'No spare sets, so a new starter waits for the next run.'
      : `${count} spare ${count === 1 ? 'set' : 'sets'}, enough for new starters without sitting on stock.`;
  }
  if (count === 0) return 'لا توجد أطقم احتياطية، فالموظف الجديد ينتظر دورة الإنتاج التالية.';
  if (count === 1) return 'طقم احتياطي واحد، يكفي لموظف جديد دون تكديس المخزون.';
  if (count === 2) return 'طقمان احتياطيان، يكفيان للموظفين الجدد دون تكديس المخزون.';
  if (count <= 10) return `${count} أطقم احتياطية، تكفي للموظفين الجدد دون تكديس المخزون.`;
  return `${count} طقمًا احتياطيًا، تكفي للموظفين الجدد دون تكديس المخزون.`;
}

/** A kit's display name. The stored id is stable data -- an order placed in
 *  Arabic must still read correctly in English -- so only the label here
 *  changes with the language. A saved copy carries a -v2 suffix on its id;
 *  the base name is translated and the number kept. Anything unrecognised
 *  falls back to the id, which is visible rather than blank. */
export function kitName(locale: Locale, id: string): string {
  const m = /^(.*?)(?:-v(\d+))?$/.exec(id);
  const base = m?.[1] ?? id;
  const version = m?.[2];
  const label = (translations[locale].kitNames as Record<string, string>)[base];
  if (!label) return id;
  return version ? `${label} ${version}` : label;
}

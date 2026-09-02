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

// Egyptian business Arabic, not literary Arabic: زي موحد, طقم, خامة, عرض سعر.
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
    save: 'حفظ', confirm: 'تأكيد', loading: 'جارٍ التحميل…', included: 'مشمول',
    people: 'موظف', sets: 'طقم', perPerson: 'للفرد', total: 'الإجمالي',
    person: 'موظف', spare: 'احتياطي', noSpare: 'بدون احتياطي', none: 'بدون',
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
    subtitle: 'كل ما تحتاجه لتصميم وإدارة زي فريقك في مكان واحد.',
    askTitle: 'ما الزي المناسب لفريقك؟',
    askSubtitle: 'صف طبيعة عمل فريقك ومتطلباته، وسنقترح لك أطقمًا مناسبة.',
    describeTeam: 'صف احتياجات فريقك',
    showKits: 'عرض الأطقم المقترحة',
    savedKits: 'الأطقم المحفوظة',
    savedKitsNote: 'جاهزة لإعادة الطلب',
    collectingSizes: 'بانتظار المقاسات',
    noneWaiting: 'لا توجد طلبات بانتظار المقاسات',
    inProduction: 'قيد الإنتاج',
    nothingOnFloor: 'لا توجد طلبات قيد الإنتاج',
    delivered: 'تم التسليم',
    nothingYet: 'لا توجد طلبات حتى الآن',
    nextDue: 'موعد التسليم القادم: {date}',
    orderLine: '{id} · {sets} طقم',
    recentActivity: 'أحدث الأنشطة',
    viewOrders: 'عرض الطلبات',
    browseSavedKits: 'استعراض الأطقم المحفوظة',
    firstOrderHere: 'لا توجد طلبات حتى الآن. سيظهر طلبك الأول هنا بعد تأكيده.',
    colWhat: 'التفاصيل',
    colStatus: 'الحالة',
    colValue: 'القيمة',
    colUpdated: 'آخر تحديث',
  },

  design: {
    title: 'تصميم زي جديد',
    subtitle: 'صف احتياجات فريقك وسنقترح لك 3 أطقم مناسبة.',
    needLabel: 'ما متطلبات الزي؟',
    needHint: 'اذكر طبيعة العمل، والموسم، والألوان المفضلة، وأي متطلبات خاصة بالزي.',
    peopleLabel: 'عدد الموظفين',
    logoLabel: 'اسم أو نص الشعار',
    logoHint: 'سيظهر الشعار على معاينة قطع الزي.',
    generate: 'اقتراح 3 أطقم',
    generating: 'جارٍ إعداد 3 مقترحات تناسب احتياجاتك…',
    threeKits: '3 أطقم مقترحة لـ {count} موظف',
    pickClosest: 'اختر الطقم الأنسب، ثم خصّص تفاصيله بما يتوافق مع احتياجاتك.',
    chooseDifferent: 'اختيار طقم آخر',
    configureThis: 'تخصيص هذا الطقم',
    replaceTitle: 'استبدال هذه الأطقم؟',
    replaceWarning: 'سيؤدي إنشاء مقترحات جديدة إلى استبدال المقترحات الحالية وإلغاء أي تعديلات أجريتها عليها.\n\nاحفظ الطقم أولًا إذا كنت ترغب في الاحتفاظ به.',
  },

  configure: {
    title: 'تخصيص الطقم',
    subtitle: 'الأسعار المعروضة تقديرية وتستند إلى خيارات الكتالوج الحالية.',
    nothingYet: 'لا يوجد طقم متاح للتخصيص',
    nothingYetNote: 'ابدأ بتصميم زي جديد، وأخبرنا باحتياجات فريقك لنقترح لك أطقمًا مناسبة.',
    startOne: 'تصميم زي جديد',
    garments: 'قطع الزي',
    outfit: 'الطقم',
    fit: 'القَصّة',
    colours: 'الألوان',
    branding: 'الشعار',
    quantity: 'الكمية',
    sizes: 'المقاسات',
    step: 'الخطوة {n}: {name}',
    buildOutfit: 'تكوين الطقم',
    buildOutfitNote: 'أضف القطع التي يحتاجها الفريق. يجب أن يتضمن الطقم قطعة علوية وبنطلونًا واحدًا على الأقل.',
    top: 'قطعة علوية',
    layer: 'طبقة خارجية',
    bottom: 'بنطلون',
    add: 'إضافة',
    added: 'تمت الإضافة',
    required: 'أساسي',
    addGarment: 'إضافة {garment}',
    removeGarment: 'إزالة {garment}',
    requiredGarment: 'قطعة {garment} أساسية في الطقم',
    genderCut: 'النوع وقَصّة التفصيل',
    genderCutNote: 'يبقى التصميم موحدًا، ويُنفّذ على قوالب التفصيل المختارة.',
    fitAndFabric: 'القَصّة والخامة',
    fitAndFabricNote: 'اختر درجة اتساع القَصّة والخامة المناسبة لكل قطعة.',
    fitNote: 'تتحكم القَصّة في اتساع القطعة، بينما تُحدد المقاسات بصورة منفصلة.',
    selectPreviewToSwitch: 'اختر قطعة أخرى من المعاينة لتعديلها.',
    fabric: 'الخامة',
    fabricNote: 'يتم احتساب سعر كل قطعة وفقًا للخامة المختارة.',
    coloursNote: 'أنت تعدّل الآن لون {garment}. اختر قطعة أخرى من المعاينة لتعديل لونها.',
    brandingNote: 'تُحتسب تكلفة إضافة الشعار مرة واحدة لكل موظف، بغض النظر عن عدد قطع الطقم.',
    quantityNote: 'يمكنك إضافة أطقم احتياطية للموظفين الجدد أو لاستبدال القطع عند الحاجة.',
    logoColour: 'لون الشعار',
    placement: 'موضع الشعار',
    peopleToKit: 'عدد الموظفين',
    spareStock: 'الأطقم الاحتياطية',
    quantitySizes: 'الكمية والمقاسات',
    quantitySizesNote: 'حدد إجمالي الطلب، ثم أدخل كميات المقاسات الآن أو اجمعها من الموظفين لاحقًا.',
    sizeCollection: 'تجميع المقاسات',
    sizesNote: 'سيتم جمع مقاسات الموظفين بعد تأكيد الطلب.',
    previewUpdates: 'تابع تأثير تعديلاتك مباشرة على المعاينة',
    selectGarment: 'اختر قطعة لتعديل لونها',
    selectGarmentToEdit: 'اختر قطعة لتعديل القَصّة والخامة',
    showingBack: 'يتم عرض الجهة الخلفية لمعاينة موضع الشعار',
    colourThe: 'لون {garment}',
    editThe: 'تعديل {garment}',
    spareOf: '{pct}٪ احتياطي',
    examples: 'قميص بولو كحلي بشعار ذهبي|استخدم خامة مناسبة للأجواء الحارة|انقل الشعار إلى الكم|أضف 10٪ أطقم احتياطية',
    standardCloth: 'خامة موحدة',
    mixedGrades: 'خامات مختلفة',
    askTitle: 'اكتب التعديلات التي تريدها',
    askNote: 'يمكنك طلب أكثر من تعديل في رسالة واحدة، وسنوضح لك ما تغيّر.',
    describeChange: 'اكتب التعديل المطلوب',
    apply: 'تطبيق التعديلات',
    saveKit: 'حفظ الطقم',
    getQuote: 'طلب عرض سعر',
    saveAsKit: 'حفظ ضمن الأطقم',
    nextStep: 'التالي: {name}',
    perPersonPrice: '{price} للفرد',
    beforeOptions: '{price} للفرد · {total} لـ {count} موظف قبل الإضافات',
    setsLine: '{price} للفرد · {sets} طقم، منها {spare} احتياطي',
    setsLineNoSpare: '{price} للفرد · {sets} طقم',
  },

  quote: {
    title: 'عرض السعر',
    validFor: 'عرض السعر صالح لمدة 30 يومًا من تاريخ الإصدار.',
    branding: 'الشعار والتخصيص',
    upgrade: 'الإضافات',
    sets: 'الأطقم',
    coversPeople: '{people} موظف + {spare} طقم احتياطي',
    coversNoSpare: '{people} موظف · بدون أطقم احتياطية',
    cutRange: 'قوالب التفصيل',
    fitProfile: 'القَصّة',
    sizing: 'خطة المقاسات',
    total: 'الإجمالي',
    keepEditing: 'العودة للتعديل',
    submit: 'تأكيد الطلب',
  },

  orders: {
    title: 'الطلبات',
    subtitle: 'تابع طلباتك ومراحل التجهيز والإنتاج والتسليم.',
    noneTitle: 'لا توجد طلبات حتى الآن',
    noneNote: 'ابدأ بتصميم الطقم، ثم خصّصه وراجع عرض السعر وأكّد الطلب. ستتمكن بعدها من متابعة مراحل التنفيذ من هنا.',
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
    dueAround: 'التسليم المتوقع: {date}',
    deliveredOn: 'تم التسليم في {date}',
    whatIsBeingMade: 'القطع قيد التصنيع',
    whatWasMade: 'القطع المكتملة',
    waitingOnSizes: 'بانتظار المقاسات',
    setsAndValue: '{sets} طقم · {value}',
    ordered: 'تم تأكيد الطلب',
    sizesIn: 'تم استلام المقاسات',
    fabricCut: 'قص القماش',
    sewing: 'الخياطة',
    checks: 'فحص الجودة',
    delivery: 'التسليم',
    now: 'المرحلة الحالية',
  },

  kits: {
    title: 'الأطقم المحفوظة',
    subtitle: 'احفظ تصميماتك المفضلة لتتمكن من إعادة طلبها بسهولة.',
    newUniform: 'تصميم زي جديد',
    noneTitle: 'لا توجد أطقم محفوظة حتى الآن',
    noneNote: 'بعد تخصيص الطقم المناسب لفريقك، احفظه هنا لتتمكن من الرجوع إليه أو إعادة طلبه لاحقًا.',
    createFirst: 'تصميم أول طقم',
    forPeople: '{price} لـ {count} موظف',
    specLine: '{cuts} · {fit}',
    saved: 'تم حفظ «{name}» ضمن الأطقم المحفوظة',
    already: '«{name}» محفوظ بالفعل ضمن الأطقم',
  },

  settings: {
    title: 'الإعدادات',
    subtitle: 'احفظ بيانات شركتك ومتطلبات الزي لاستخدامها تلقائيًا عند إنشاء تصميمات جديدة.',
    company: 'بيانات الشركة',
    companyNote: 'تُستخدم بيانات الشركة في عروض الأسعار وتساعدنا على إعداد الطلبات بما يتناسب مع احتياجات فريقك.',
    companyName: 'اسم الشركة',
    totalStaff: 'عدد الموظفين',
    industry: 'قطاع العمل',
    industryHint: 'يساعدنا قطاع عملك على اقتراح خامات وتصميمات مناسبة لطبيعة عمل فريقك.',
    dressCode: 'معايير الزي',
    dressCodeNote: 'سنستخدم هذه المتطلبات عند اقتراح الأطقم، لذلك يُفضل كتابتها بوضوح.',
    rulesLabel: 'متطلبات ومعايير الزي',
    language: 'اللغة',
    languageNote: 'اختر اللغة المستخدمة في الواجهة والمحتوى.',
    interfaceLanguage: 'لغة الواجهة',
    save: 'حفظ الإعدادات',
    saved: 'تم حفظ الإعدادات بنجاح',
    nameNeeded: 'يرجى إدخال اسم الشركة ليظهر في عروض الأسعار.',
    staffNeeded: 'يجب أن يكون عدد الموظفين موظفًا واحدًا على الأقل.',
    industryTech: 'التكنولوجيا',
    industryHospitality: 'الضيافة',
    industryFacilities: 'إدارة المرافق',
    industryRetail: 'تجارة التجزئة',
  },

  manager: {
    who: 'UniformAI · مستشارك للزي المؤسسي',
    reasonHeat: 'بناءً على ذكرك «{word}»، اخترت خامات جيدة التهوية وأكثر راحة في الأجواء الحارة',
    heatFallback: 'الحرارة',
    reasonDurable: 'اخترت خامات متينة ومناسبة للاستخدام اليومي',
    reasonOutdoor: 'اخترت قصّات عملية ومناسبة لطبيعة العمل الميداني',
    reasonFormal: 'اخترت تصميمًا أنيقًا واحترافيًا يناسب الفرق التي تتعامل مباشرة مع العملاء',
    reasonDefault: 'هذه الخيارات هي الأقرب إلى طبيعة عمل فريقك ومتطلباتك',
    didColourKept: 'حافظت على اللون {colour}',
    didColour: 'اخترت اللون {colour}',
    didLogo: 'وأضفت الشعار في {place}',
    didUnbranded: 'بدون إضافة شعار',
    whyWithDid: '{did}. {reason}.',
    whyPlain: '{reason}.',
    cheapest: '{name} هو الخيار الأكثر توفيرًا، بسعر {price} للفرد.',
    fabricPushKnit: 'للعمل في الأجواء الحارة، توفر الخامة عالية الأداء راحة وتهوية أفضل مقابل فارق 90 للفرد.',
    fabricGoodCall: 'اختيار مناسب. الزيادة 90 للفرد تمنح الموظفين راحة وتهوية أفضل طوال يوم العمل.',
    fabricStandard: 'الخامة القياسية خيار اقتصادي مناسب إذا كان استخدام الزي متوسطًا وغير مكثف.',
    outfitCuts: 'يمكن تنفيذ التصميم نفسه بقَصّات رجالية ونسائية، ليظل زي الفريق المختلط موحدًا وسهل الإدارة.',
    fitRelaxed: 'القَصّة الواسعة تمنح حرية أكبر في الحركة والانحناء أثناء العمل، بينما تشدّ القَصّة العادية عند الظهر.',
    fitSlim: 'القَصّة الضيقة تعطي مظهرًا أكثر أناقة أمام العملاء، بينما تبدو القَصّة الواسعة غير مناسبة لمكاتب الاستقبال.',
    sizesAllocateNow: 'تحديد المقاسات الآن يثبّت أعداد الطلب، وأي خطأ في التقدير يتحول إلى طلب جديد بدلًا من استبدال بسيط.',
    colourLight: 'تظهر آثار الأتربة والبقع على الألوان الفاتحة بصورة أسرع في بيئات العمل، لذلك يُفضّل اختيار لون داكن للبنطلون.',
    colourDark: 'الألوان الداكنة عملية أكثر للاستخدام اليومي وتُظهر آثار العمل بدرجة أقل. إضافة لون أفتح في بعض التفاصيل تمنح الزي مظهرًا أكثر توازنًا واحترافية.',
    brandNone: 'عدم إضافة شعار يوفر ما بين 17 و35 للفرد، لكنه يقلل من حضور هوية الشركة على الزي.',
    brandPrint: 'الطباعة توفر 17 للفرد، وهي مناسبة للشعارات على الأقمشة الملساء، لكن عمرها الافتراضي قد يكون أقل مع الغسيل المكثف.',
    brandEmbroidery: 'التطريز يزيد التكلفة بمقدار 17 للفرد، لكنه أكثر متانة ويحافظ على مظهر احترافي لفترة أطول.',
    spareNone: 'طلب {sets} طقم فقط لا يترك أي احتياطي للموظفين الجدد أو حالات الاستبدال. إضافة 5٪ احتياطي تمنحك مرونة أكبر بتكلفة محدودة.',
    quoteCovers: 'يشمل العرض زي {people} موظفًا بالإضافة إلى {spare} طقم احتياطي. لن يتم تحصيل أي مبلغ قبل تأكيد الطلب، وسيتم جمع المقاسات بعد التأكيد.',
    quoteCoversNoSpare: 'يشمل العرض زي {people} موظفًا بدون أطقم احتياطية. لن يتم تحصيل أي مبلغ قبل تأكيد الطلب، وسيتم جمع المقاسات بعد التأكيد.',
    quoteSized: 'يشمل العرض زي {people} موظفًا بالإضافة إلى {spare} طقم احتياطي، وقد اكتمل توزيع المقاسات. لن يتم تحصيل أي مبلغ قبل تأكيد الطلب.',
    quoteSizedNoSpare: 'يشمل العرض زي {people} موظفًا، وقد اكتمل توزيع المقاسات. لن يتم تحصيل أي مبلغ قبل تأكيد الطلب.',
    orderDelivered: 'تم تسليم الطلب في {date}. ويمكنك طلب أي قطع إضافية أو بديلة لاحقًا بنفس المواصفات.',
    orderMaking: 'الطلب حاليًا في مرحلة {stage}، وجميع الخامات المطلوبة متوفرة. موعد التسليم المتوقع {date}. سنبلغك هنا في حال حدوث أي تحديث.',
    orderSizes: 'تم تأكيد الطلب في {placed}. نعمل حاليًا على استكمال مقاسات الموظفين، وسيبدأ القص فور اكتمالها. موعد التسليم المتوقع {due}.',
    greetNothing: '{part} يا {name}. لا توجد إجراءات مطلوبة منك حاليًا.',
    greetSizes: '{part} يا {name}. تم تأكيد طلب {kit}، ونعمل حاليًا على جمع المقاسات لأمر البيع {id}.',
    greetMaking: '{part} يا {name}. طقم {kit} قيد الإنتاج حاليًا، والتسليم المتوقع في {date}.',
    greetMany: '{part} يا {name}. لديك {sizes} طلب بانتظار المقاسات و{making} قيد الإنتاج.',
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
    chino: 'بنطلون تشينو',
    blazer: 'جاكيت بليزر',
    cargo: 'بنطلون كارجو',
  },
  garmentNotes: {
    polo: 'خامة عملية وسهلة العناية للاستخدام اليومي',
    shirt: 'قميص منسوج بمظهر رسمي',
    blazer: 'طبقة خارجية بقَصّة منظمة',
    chino: 'بنطلون عملي بمظهر أنيق',
    cargo: 'بنطلون عملي متين بجيوب إضافية',
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
    collect_laterNote: 'إرسال نموذج المقاسات بعد اعتماد العرض، وهو الأنسب إذا لم تكتمل أسماء الفريق.',
    allocate_now: 'إدخال كميات المقاسات الآن',
    allocate_nowNote: 'إعداد توزيع المقاسات المطلوب للإنتاج ضمن عرض السعر.',
    assigned: 'تم توزيع {assigned} من أصل {sets} طقم',
    complete: 'جاهز للإنتاج',
    remaining: 'متبقي توزيع {count} طقم',
    over: 'الكمية تزيد عن إجمالي الطلب بمقدار {count}',
    cutCount: '{count} طقم', cutCountOne: '{count} طقم',
    drawingNote: 'تغيّر المقاسات جدول الكميات، ولا تغيّر الرسم المسطح. يتم اعتماد القياسات النهائية قبل القص.',
    collectQuote: 'تُجمع من الموظفين بعد اعتماد العرض',
    allocatedQuote: 'تم توزيع {count} من كميات المقاسات',
  },

  parts: {
    body: 'الجزء الرئيسي',
    collar: 'الياقة',
    cuffs: 'أساور الأكمام',
    placket: 'شريط الأزرار',
    leg: 'ساق البنطلون',
    lapel: 'ياقة الجاكيت',
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
    closeTo: 'درجة قريبة من {name}',
  },

  fabrics: {
    knit0: '220 جرام · خامة مريحة وجيدة التهوية للاستخدام اليومي',
    knit1: '240 جرام · خامة أنعم مع ثبات أفضل للون',
    knit2: 'سريعة الجفاف وتمتص الرطوبة · مثالية للأجواء الحارة',
    woven0: 'الخامة الأساسية المستخدمة في تسعير هذا الطقم',
    woven1: 'خامة أثقل وأكثر نعومة وتحافظ على مظهرها بعد الكي لفترة أطول',
    woven2: 'خامة ناعمة بمظهر راقٍ · مثالية للفرق التي تتعامل مباشرة مع العملاء',
  },

  branding: {
    embroidery: 'تطريز',
    print: 'طباعة',
    embroideryNote: 'خيار متين واحترافي يحافظ على مظهر الشعار لفترة طويلة.',
    printNote: 'خيار اقتصادي وعملي، مناسب للشعارات والتصميمات المطبوعة.',
    left_chest: 'الجهة اليسرى من الصدر',
    right_chest: 'الجهة اليمنى من الصدر',
    sleeve: 'الكم',
    back: 'الظهر',
    none: 'بدون شعار',
    left_chestNote: 'الموضع الأكثر شيوعًا واحترافية لشعار الشركة.',
    right_chestNote: 'خيار مناسب عند استخدام بطاقة اسم أو عنصر آخر على الجهة اليسرى.',
    sleeveNote: 'موضع بسيط وأنيق، مناسب للزي المؤسسي والفرق التي تتعامل مع العملاء.',
    backNote: 'يوفر ظهورًا أكبر للشعار من مسافة بعيدة، ومناسب لفرق التشغيل والعمل الميداني.',
    noneNote: 'بدون إضافة شعار، وبالتالي لن تُحتسب تكلفة طباعة أو تطريز.',
    embroideredLogo: 'شعار مطرّز',
    printedLogo: 'شعار مطبوع',
  },

  spare: {
    none: 'بدون أطقم احتياطية',
    noneNote: 'لن تتوفر أطقم جاهزة للموظفين الجدد أو حالات الاستبدال.',
    five: '5٪ احتياطي',
    ten: '10٪ احتياطي',
    note: '{count} طقم احتياطي للموظفين الجدد أو لاستبدال القطع عند الحاجة',
    setsCount: '{count} طقم',
    sets: '{count} طقم',
  },

  reply: {
    droppedLogo: 'تمت إزالة الشعار وتحديث السعر وفقًا لذلك.',
    droppedSpare: 'تم إلغاء الأطقم الاحتياطية وتحديث الكمية المطلوبة.',
    setPart: 'تم تغيير لون {part} في {garment} إلى {colour}.',
    movedFabric: 'تم تغيير الخامة إلى {fabric} وتحديث السعر وفقًا للاختيار الجديد.',
    noFabric: 'خامة {wanted} غير متاحة {these}. الخيارات المتاحة هي: {offered}.',
    theseGarments: 'لهذه القطع',
    thisGarment: 'لهذه القطعة',
    setSpare: 'تم ضبط نسبة الأطقم الاحتياطية على {pct}٪ لتغطية الموظفين الجدد وحالات الاستبدال.',
    logoColour: 'تم تغيير لون الشعار إلى {colour}.',
    logoMethod: 'تم تغيير طريقة تنفيذ الشعار إلى {method}.',
    logoPlace: 'تم نقل الشعار إلى {place}.',
    and: ' و',
    or: ' أو ',
    updatedBranding: 'تم تحديث إعدادات الشعار.',
    bothFollow: 'تم تحديث المعاينة والسعر وفقًا للتعديلات.',
    notFollowed: 'لم أتمكن من تطبيق «{part}». جرّب طلب هذا التعديل بشكل منفصل.',
  },

  errors: {
    notUnderstood: 'يمكنني مساعدتك في تعديل الألوان أو الخامات أو الشعار أو عدد الأطقم الاحتياطية. جرّب مثلًا: «غيّر لون البنطلون إلى الكحلي» أو «استخدم خامة مناسبة للعمل الميداني».',
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
    (name in values ? String(values[name]) : m));
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

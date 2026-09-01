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
    replaceWarning: 'New kits will replace the ones you have changed.\n\nSave the kit first if you want to keep it.',
  },
  configure: {
    title: 'Configure', subtitle: 'Indicative prices from the demo catalogue.',
    nothingYet: 'Nothing to configure yet',
    nothingYetNote: 'Describe a team on the New uniform page and I will put three kits together.',
    startOne: 'Start a uniform',
    garments: 'Garments', colours: 'Colours', branding: 'Branding', quantity: 'Quantity',
    step: 'Step {n}: {name}',
    fabric: 'Fabric', fabricNote: 'Each garment is priced on its own cloth.',
    coloursNote: 'Editing the {garment}. Pick another garment in the preview to switch.',
    brandingNote: 'Charged once per person, whatever the kit contains.',
    quantityNote: 'Spare stock covers new starters and replacements.',
    logoColour: 'Logo colour', placement: 'Placement',
    peopleToKit: 'People to kit out', spareStock: 'Spare stock',
    sizesNote: 'Sizes are collected from staff after the order is placed.',
    previewUpdates: 'Preview updates as you choose', selectGarment: 'Select a garment to recolour it',
    showingBack: 'Showing the back, where the logo goes',
    colourThe: 'Colour the {garment}',
    spareOf: '{pct}% spare',
    examples: 'Navy polo with a gold logo|Use the performance knit|Move the logo to the sleeve|10% spare',
    standardCloth: 'Standard cloth', mixedGrades: 'Mixed grades',
    askTitle: 'Or just tell me what to change',
    askNote: 'Ask for several things at once. I will show you exactly what I changed, so nothing moves that you did not ask for.',
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
    colourLight: 'Light bodies show marks fast on site — worth keeping the trouser dark.',
    colourDark: 'Dark hides wear and washes well. One lighter accent stops it reading as security kit.',
    brandNone: 'Saves 17–35 a person, but without a mark these stop reading as a uniform.',
    brandPrint: 'Print saves 17 a person. Right on knits, but it fades if washed hot.',
    brandEmbroidery: 'Embroidery is 17 more a person and outlasts the garment — cheaper over two years.',
    spareNone: 'Exactly {sets} sets — a new starter waits for the next run. 5% is cheap insurance.',
    quoteCovers: 'Covers {people} people plus {spare} spare. Nothing is charged until you order — I collect sizes after that.',
    quoteCoversNoSpare: 'Covers {people} people. Nothing is charged until you order — I collect sizes after that.',
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
    save: 'حفظ', confirm: 'تأكيد', loading: 'جارٍ التحميل…', included: 'متضمن',
    people: 'موظف', sets: 'طقم', perPerson: 'للفرد', total: 'الإجمالي',
    person: 'موظف', spare: 'احتياطي', noSpare: 'بدون كمية احتياطية', none: 'بدون',
  },

  nav: {
    home: 'الرئيسية', newUniform: 'تصميم زي جديد', configure: 'تخصيص الطقم',
    savedKits: 'الأطقم المحفوظة', orders: 'الطلبات', settings: 'الإعدادات',
    workspace: 'مساحة العمل', more: 'المزيد', sections: 'الأقسام',
    moreSections: 'أقسام إضافية', closeMenu: 'إغلاق القائمة',
    staff: '{count} موظف · صيف 2026',
  },

  home: {
    title: 'الرئيسية',
    subtitle: 'كل ما تحتاجه لإدارة الزي الموحد لفريقك في مكان واحد.',
    askTitle: 'لأي فريق تريد تصميم الزي؟',
    askSubtitle: 'صف طبيعة عمل الفريق واحتياجاته، وسنساعدك في اختيار الزي الأنسب.',
    describeTeam: 'صف احتياجات الفريق',
    showKits: 'اقترح الأطقم',
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
    recentActivity: 'آخر الأنشطة',
    viewOrders: 'عرض الطلبات',
    browseSavedKits: 'تصفح الأطقم المحفوظة',
    firstOrderHere: 'لا توجد طلبات حتى الآن. سيظهر أول طلب لك هنا.',
    colWhat: 'البيان',
    colStatus: 'الحالة',
    colValue: 'القيمة',
    colUpdated: 'آخر تحديث',
  },

  design: {
    title: 'تصميم زي جديد',
    subtitle: 'صف احتياجات فريقك وسنقترح 3 أطقم مناسبة.',
    needLabel: 'صف احتياجات فريقك',
    needHint: 'اذكر طبيعة عمل الفريق والموسم والألوان المطلوبة وأي متطلبات خاصة بالزي.',
    peopleLabel: 'كم عدد الموظفين؟',
    logoLabel: 'نص الشعار',
    logoHint: 'سيظهر على معاينة قطع الزي.',
    generate: 'اقترح 3 أطقم',
    generating: 'جارٍ إعداد 3 مقترحات مناسبة…',
    threeKits: '3 أطقم مقترحة لـ{count} موظف',
    pickClosest: 'اختر الطقم الأقرب لاحتياجاتك، ثم عدّل التفاصيل كما تريد.',
    chooseDifferent: 'اختر طقمًا آخر',
    configureThis: 'خصّص هذا الطقم',
    replaceWarning: 'سيتم استبدال المقترحات الحالية بالمقترحات الجديدة، بما في ذلك أي تعديلات أجريتها.\n\nاحفظ الطقم أولًا إذا أردت الاحتفاظ به.',
  },

  configure: {
    title: 'تخصيص الطقم',
    subtitle: 'الأسعار المعروضة تقديرية وتستند إلى كتالوج العرض الحالي.',
    nothingYet: 'لا يوجد طقم جاهز للتخصيص حتى الآن',
    nothingYetNote: 'ابدأ بتصميم زي جديد، وصف احتياجات فريقك لنقترح لك 3 أطقم مناسبة.',
    startOne: 'تصميم زي جديد',
    garments: 'قطع الزي',
    colours: 'الألوان',
    branding: 'الشعار',
    quantity: 'الكمية',
    step: 'الخطوة {n}: {name}',
    fabric: 'الخامة',
    fabricNote: 'يتم تسعير كل قطعة حسب الخامة المختارة لها.',
    coloursNote: 'يتم الآن تعديل لون {garment}. اختر قطعة أخرى من المعاينة لتعديل لونها.',
    brandingNote: 'تُحتسب تكلفة إضافة الشعار مرة واحدة لكل فرد، بغض النظر عن عدد قطع الطقم.',
    quantityNote: 'أضف كمية احتياطية للموظفين الجدد أو لاستبدال القطع عند الحاجة.',
    logoColour: 'لون الشعار',
    placement: 'مكان الشعار',
    peopleToKit: 'عدد الموظفين',
    spareStock: 'الكمية الاحتياطية',
    sizesNote: 'يتم جمع مقاسات الموظفين بعد تأكيد الطلب.',
    previewUpdates: 'شاهد تأثير التغييرات مباشرة في المعاينة',
    selectGarment: 'اختر قطعة لتعديل لونها',
    showingBack: 'عرض الظهر، حيث يوضع الشعار',
    colourThe: 'تلوين {garment}',
    spareOf: '{pct}٪ احتياطي',
    examples: 'قميص بولو كحلي بشعار ذهبي|استخدم الخامة عالية الأداء|انقل الشعار إلى الكم|10٪ احتياطي',
    standardCloth: 'خامة موحدة',
    mixedGrades: 'خامات متعددة',
    askTitle: 'أو صف التعديلات المطلوبة',
    askNote: 'يمكنك طلب عدة تعديلات معًا. سنوضح لك ما تم تطبيقه، ولن نغيّر أي شيء لم تطلبه.',
    describeChange: 'صف التعديل المطلوب',
    apply: 'تطبيق',
    saveKit: 'حفظ الطقم',
    getQuote: 'طلب عرض سعر',
    saveAsKit: 'حفظ ضمن الأطقم',
    nextStep: 'التالي: {name}',
    perPersonPrice: '{price} للفرد',
    beforeOptions: '{price} للفرد · {total} لعدد {count} موظف قبل الإضافات',
    setsLine: '{price} للفرد · {sets} طقم، منها {spare} احتياطي',
    setsLineNoSpare: '{price} للفرد · {sets} طقم',
  },

  quote: {
    title: 'عرض السعر',
    validFor: 'عرض السعر صالح لمدة 30 يومًا من تاريخ إصداره.',
    branding: 'الشعار والتخصيص',
    upgrade: 'إضافات',
    sets: 'الأطقم',
    coversPeople: '{people} موظف + {spare} طقم احتياطي',
    coversNoSpare: '{people} موظف · بدون أطقم احتياطية',
    total: 'الإجمالي',
    keepEditing: 'العودة للتعديل',
    submit: 'تأكيد الطلب',
  },

  orders: {
    title: 'الطلبات',
    subtitle: 'تابع حالة طلباتك ومراحل الإنتاج.',
    noneTitle: 'لا توجد طلبات حتى الآن',
    noneNote: 'صمّم طقمًا، خصّص تفاصيله، راجع عرض السعر ثم أكّد الطلب. بعد ذلك يمكنك متابعة جميع مراحل الإنتاج من هنا.',
    startOne: 'تصميم زي جديد',
    colOrder: 'الطلب',
    colStatus: 'الحالة',
    colValue: 'القيمة',
    colDue: 'موعد التسليم',
    colItem: 'الصنف',
    colQty: 'الكمية',
    colProgress: 'مراحل الإنتاج',
    colReady: 'حالة الجاهزية',
    open: 'فتح الطلب {name}، {id}',
    dueAround: 'موعد التسليم المتوقع: {date}',
    deliveredOn: 'تم التسليم بتاريخ {date}',
    whatIsBeingMade: 'القطع الجاري تصنيعها',
    whatWasMade: 'القطع المكتملة',
    waitingOnSizes: 'بانتظار المقاسات',
    setsAndValue: '{sets} طقم · {value}',
    ordered: 'تم تأكيد الطلب',
    sizesIn: 'تم استلام المقاسات',
    fabricCut: 'قصّ القماش',
    sewing: 'الخياطة',
    checks: 'فحص الجودة',
    delivery: 'التسليم',
    now: 'المرحلة الحالية',
  },

  kits: {
    title: 'الأطقم المحفوظة',
    subtitle: 'احفظ تصميماتك المفضلة وأعد طلبها في أي وقت.',
    newUniform: 'تصميم زي جديد',
    noneTitle: 'لا توجد أطقم محفوظة حتى الآن',
    noneNote: 'بعد الانتهاء من تخصيص طقم مناسب لفريقك، احفظه هنا لتتمكن من إعادة طلبه بسهولة في أي وقت.',
    createFirst: 'صمّم أول طقم',
    forPeople: '{price} لـ{count} موظف',
    saved: 'تم حفظ «{name}» في الأطقم المحفوظة',
    already: '«{name}» موجود بالفعل ضمن الأطقم المحفوظة',
  },

  settings: {
    title: 'الإعدادات',
    subtitle: 'احفظ بيانات شركتك ومتطلبات الزي لاستخدامها تلقائيًا في كل تصميم جديد.',
    company: 'بيانات الشركة',
    companyNote: 'تظهر بيانات الشركة في عروض الأسعار وتساعدنا على تجهيز الطلبات بما يناسب فريقك.',
    companyName: 'اسم الشركة',
    totalStaff: 'عدد الموظفين',
    industry: 'القطاع',
    industryHint: 'يساعدنا تحديد القطاع على اقتراح أطقم تناسب طبيعة عمل فريقك.',
    dressCode: 'معايير الزي',
    dressCodeNote: 'نستخدم هذه المتطلبات عند اقتراح الأطقم، لذا اكتبها بوضوح واختصار.',
    rulesLabel: 'متطلبات الزي',
    language: 'اللغة',
    languageNote: 'تحدد اللغة المستخدمة في الواجهة والمحتوى المعروض.',
    interfaceLanguage: 'لغة الواجهة',
    save: 'حفظ الإعدادات',
    saved: 'تم حفظ الإعدادات',
    nameNeeded: 'اسم الشركة مطلوب لأنه سيظهر في عروض الأسعار.',
    staffNeeded: 'يجب ألا يقل عدد الموظفين عن موظف واحد.',
    industryTech: 'التكنولوجيا',
    industryHospitality: 'الضيافة',
    industryFacilities: 'إدارة المرافق',
    industryRetail: 'التجزئة',
  },

  manager: {
    who: 'UniformAI · مستشار الزي الخاص بك',
    reasonHeat: 'ذكرت «{word}»، لذلك اخترت خامات جيدة التهوية',
    heatFallback: 'الحرارة',
    reasonDurable: 'اخترت خامات متينة لجميع القطع',
    reasonOutdoor: 'اخترت قصّات مناسبة للعمل الميداني',
    reasonFormal: 'اخترت مظهرًا أنيقًا ومهنيًا للفرق التي تتعامل مع العملاء',
    reasonDefault: 'هذه الخيارات هي الأقرب إلى احتياجاتك',
    didColourKept: 'حافظت على الألوان {colour}',
    didColour: 'استخدمت اللون {colour}',
    didLogo: 'وأضفت الشعار على {place}',
    didUnbranded: 'بدون إضافة شعار',
    whyWithDid: '{did}. {reason}.',
    whyPlain: '{reason}.',
    cheapest: '{name} هو الخيار الأكثر توفيرًا بسعر {price} للفرد.',
    fabricPushKnit: 'في حرارة الصيف، تستحق الخامة عالية الأداء فارق 90 للفرد بفضل الراحة والتهوية الأفضل.',
    fabricGoodCall: 'اختيار موفق؛ الزيادة 90 للفرد مقابل راحة أفضل طوال يوم العمل.',
    fabricStandard: 'الخامة القياسية مناسبة إذا لم يكن الزي للاستخدام اليومي المكثف.',
    colourLight: 'تُظهر الألوان الفاتحة الأوساخ بسرعة في مواقع العمل، لذلك يُفضّل أن يبقى البنطلون بلون داكن.',
    colourDark: 'الألوان الداكنة تُخفي آثار الاستخدام وتتحمل الغسيل المتكرر. إضافة لمسة أفتح تمنح الزي مظهرًا أكثر توازنًا وأقل شبهًا بالزي الأمني.',
    brandNone: 'اختيار الزي بدون شعار يوفر ما بين 17 و35 للفرد، لكنه يقلل من وضوح هوية الشركة على الزي.',
    brandPrint: 'الطباعة توفر 17 للفرد. خيار مناسب للأقمشة الملساء، لكنها قد تتأثر مع الغسيل المتكرر بدرجات حرارة مرتفعة.',
    brandEmbroidery: 'التطريز يزيد التكلفة 17 للفرد، لكنه أكثر متانة ويحافظ على مظهره لفترة أطول، ما يجعله أوفر على المدى الطويل.',
    spareNone: 'طلب {sets} طقم فقط يعني أن الموظف الجديد سيحتاج إلى انتظار دورة الإنتاج التالية. إضافة 5٪ احتياطي خيار عملي بتكلفة محدودة.',
    quoteCovers: 'يشمل العرض {people} موظفًا بالإضافة إلى {spare} طقم احتياطي. لن يتم احتساب أي مبلغ قبل تأكيد الطلب، وسيتم جمع المقاسات بعد التأكيد.',
    quoteCoversNoSpare: 'يشمل العرض {people} موظفًا بدون أطقم احتياطية. لن يتم احتساب أي مبلغ قبل تأكيد الطلب، وسيتم جمع المقاسات بعد التأكيد.',
    orderDelivered: 'تم التسليم في {date}. إذا احتجت إلى استبدال أي قطعة، يمكننا توفيرها بنفس المواصفات والسعر.',
    orderMaking: '{stage} حاليًا، وجميع الخامات متوفرة. موعد التسليم المتوقع حوالي {date}. سأخبرك هنا إذا طرأ أي تغيير.',
    orderSizes: 'تم تأكيد الطلب في {placed}. نقوم الآن بجمع المقاسات، وسيبدأ القص فور اكتمالها. موعد التسليم المتوقع حوالي {due}. سأخبرك هنا إذا طرأ أي تغيير.',
    greetNothing: '{part} يا {name}. لا توجد أي إجراءات مطلوبة منك اليوم.',
    greetSizes: '{part} يا {name}. تم تأكيد طلب {kit}. نقوم الآن بجمع المقاسات لأمر البيع {id}.',
    greetMaking: '{part} يا {name}. طقم {kit} قيد الإنتاج، وموعد التسليم المتوقع حوالي {date}.',
    greetMany: '{part} يا {name}. لديك {sizes} بانتظار المقاسات و{making} قيد الإنتاج.',
    morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير',
    placeChest: 'الصدر', placeRightChest: 'الصدر الأيمن', placeSleeve: 'الكم', placeBack: 'الظهر',
  },

  kitNames: {
    'front-office': 'الاستقبال', operations: 'العمليات',
    management: 'الإدارة', technicians: 'الفنيون',
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

  parts: {
    body: 'الجزء الأساسي',
    collar: 'الياقة',
    cuffs: 'أساور الأكمام',
    placket: 'شريط الأزرار',
    leg: 'ساق البنطلون',
    lapel: 'طية ياقة الجاكيت',
    buttons: 'الأزرار',
    pockets: 'الجيوب',
  },

  colours: {
    Navy: 'كحلي', Ink: 'أسود', Sand: 'بيج', Slate: 'رمادي',
    White: 'أبيض', Olive: 'زيتي', Oxblood: 'نبيتي', Brass: 'ذهبي',
    closeTo: 'قريب من {name}',
  },

  fabrics: {
    knit0: '220 جرام · خامة مريحة جيدة التهوية للاستخدام اليومي',
    knit1: '240 جرام · ملمس أنعم ويحافظ على ثبات اللون',
    knit2: 'تمتص العرق وتجف سريعًا · الأنسب للأجواء الحارة',
    woven0: 'الخامة المعتمدة في تسعير هذا الطقم',
    woven1: 'أثقل وأنعم وتحافظ على الكيّ لفترة أطول',
    woven2: 'مظهر ناعم وراقٍ · الأنسب للفرق التي تتعامل مع العملاء',
  },

  branding: {
    embroidery: 'تطريز',
    print: 'طباعة',
    embroideryNote: 'تطريز متين يمنح الزي مظهرًا احترافيًا وراقيًا.',
    printNote: 'خيار اقتصادي مناسب للشعارات والتصميمات التي تُنفذ بالطباعة.',
    left_chest: 'الجهة اليسرى من الصدر',
    right_chest: 'الجهة اليمنى من الصدر',
    sleeve: 'الكم',
    back: 'الظهر',
    none: 'بدون شعار',
    left_chestNote: 'المكان الأكثر استخدامًا لشعار الشركة على الزي الرسمي.',
    right_chestNote: 'مناسب عند وضع بطاقة الاسم على الجهة اليسرى.',
    sleeveNote: 'مكان أنيق وبسيط، مناسب للفرق التي تتعامل مباشرة مع العملاء.',
    backNote: 'يوفر وضوحًا أكبر من مسافة بعيدة، ومناسب لفرق التشغيل والعمل الميداني.',
    noneNote: 'بدون شعار، وبالتالي لا توجد تكلفة للطباعة أو التطريز.',
    embroideredLogo: 'شعار مطرّز',
    printedLogo: 'شعار مطبوع',
  },

  spare: {
    none: 'بدون كمية احتياطية',
    noneNote: 'سيحتاج أي موظف جديد إلى الانتظار حتى دورة الإنتاج التالية.',
    five: 'احتياطي 5%',
    ten: 'احتياطي 10%',
    note: '{count} طقم احتياطي للموظفين الجدد أو لاستبدال القطع عند الحاجة',
    setsCount: '{count} طقم',
    sets: '{count} طقم',
  },

  reply: {
    droppedLogo: 'تم حذف الشعار، وأُزيلت تكلفة العلامة من السعر.',
    droppedSpare: 'تم إلغاء الكمية الاحتياطية. أي موظف جديد سينتظر دورة الإنتاج التالية.',
    setPart: 'تم ضبط {part} في {garment} على اللون {colour}.',
    movedFabric: 'تم التغيير إلى {fabric}، وتم تحديث السعر تبعًا لذلك.',
    noFabric: 'خامة {wanted} غير متاحة {these}. البدائل المتاحة: {offered}.',
    theseGarments: 'لهذه القطع', thisGarment: 'لهذه القطعة',
    setSpare: 'تم ضبط الكمية الاحتياطية على {pct}٪، وهي تغطي الموظفين الجدد دون تكديس المخزون.',
    logoColour: 'تم ضبط لون الشعار على {colour}.',
    logoMethod: 'تم تغيير طريقة تنفيذ الشعار إلى {method}.',
    logoPlace: 'تم نقل الشعار إلى {place}.',
    and: ' و',
    or: ' أو ',
    updatedBranding: 'تم تحديث العلامة.',
    bothFollow: 'تم تحديث المعاينة والسعر معًا.',
    notFollowed: 'لم أنفذ «{part}» — اذكرها بمفردها وسأنفذها.',
  },

  errors: {
    notUnderstood: 'يمكنني مساعدتك في تغيير اللون أو الخامة أو الشعار أو الكمية الاحتياطية. جرّب مثلًا «غيّر لون البنطلون إلى الكحلي» أو «استخدم خامة مناسبة للعمل الميداني».',
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

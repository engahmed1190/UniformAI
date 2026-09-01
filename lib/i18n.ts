// Every visible string in the product, in both languages. Components hold
// behaviour; this file holds language. The rule that keeps it working: no
// component may contain `locale === 'ar' ? ... : ...` -- if a string differs
// by language it belongs here, under a key.

export type Locale = 'en' | 'ar';
export const LOCALES = ['en', 'ar'] as const;

/** Page direction. The whole RTL layer hangs off this. */
export const dir = (l: Locale): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', ar: 'العربية' };

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
    standardCloth: 'Standard cloth', mixedGrades: 'Mixed grades',
    askTitle: 'Or just tell me what to change',
    askNote: 'Ask for several things at once. I will show you exactly what I changed, so nothing moves that you did not ask for.',
    describeChange: 'Describe a change', apply: 'Apply',
    saveKit: 'Save kit', getQuote: 'Get a quote', saveAsKit: 'Save as a kit',
    nextStep: 'Next: {name}', perPersonPrice: '{price} / person',
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
    sets: '{count} sets',
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
    person: 'موظف', spare: 'احتياطي', noSpare: 'بدون احتياطي', none: 'بدون',
  },
  nav: {
    home: 'الرئيسية', newUniform: 'زي جديد', configure: 'التخصيص',
    savedKits: 'الأطقم المحفوظة', orders: 'الطلبات', settings: 'الإعدادات',
    workspace: 'مساحة العمل', more: 'المزيد', sections: 'الأقسام',
    moreSections: 'أقسام إضافية', closeMenu: 'إغلاق القائمة', staff: '{count} موظف · صيف ٢٠٢٦',
  },
  home: {
    title: 'الرئيسية', subtitle: 'حالة أعمال الزي الموحد لديك اليوم.',
    askTitle: 'ما الفريق الذي تريد تجهيزه؟', askSubtitle: 'صف الفريق بكلماتك.',
    describeTeam: 'صف ما تحتاجه', showKits: 'اعرض الأطقم',
    savedKits: 'الأطقم المحفوظة', savedKitsNote: 'جاهزة لإعادة الطلب',
    collectingSizes: 'جمع المقاسات', noneWaiting: 'لا شيء في الانتظار',
    inProduction: 'قيد الإنتاج', nothingOnFloor: 'لا شيء في الإنتاج',
    delivered: 'تم التسليم', nothingYet: 'لا شيء بعد',
    nextDue: 'التالي في {date}', orderLine: '{id} · {sets} طقم',
    recentActivity: 'آخر النشاطات', viewOrders: 'عرض الطلبات',
    browseSavedKits: 'تصفح الأطقم المحفوظة', firstOrderHere: 'لا شيء بعد. سيظهر أول طلب لك هنا.',
    colWhat: 'البيان', colStatus: 'الحالة', colValue: 'القيمة', colUpdated: 'آخر تحديث',
  },
  design: {
    title: 'زي جديد', subtitle: 'صف الفريق وسأجهز لك ثلاثة أطقم.',
    needLabel: 'ما الذي تحتاجه؟',
    needHint: 'اذكر الفريق والموسم وأي ألوان يجب الالتزام بها.',
    peopleLabel: 'كم عدد الموظفين؟', logoLabel: 'نص الشعار',
    logoHint: 'يظهر على معاينات القطع.',
    generate: 'اعرض لي بعض الأطقم', generating: 'جارٍ تجهيز ثلاثة أطقم…',
    threeKits: 'ثلاثة أطقم لـ{count} موظف',
    pickClosest: 'اختر الأقرب لاحتياجك وغيّر ما تشاء.',
    chooseDifferent: 'اختر طقمًا آخر',
    replaceWarning: 'الأطقم الجديدة ستحل محل التي عدّلتها.\n\nاحفظ الطقم أولًا إذا أردت الاحتفاظ به.',
  },
  configure: {
    title: 'التخصيص', subtitle: 'أسعار إرشادية من كتالوج العرض التوضيحي.',
    nothingYet: 'لا يوجد ما تخصصه بعد',
    nothingYetNote: 'صف فريقًا في صفحة زي جديد وسأجهز لك ثلاثة أطقم.',
    startOne: 'ابدأ زيًا جديدًا',
    garments: 'القطع', colours: 'الألوان', branding: 'العلامة', quantity: 'الكمية',
    step: 'الخطوة {n}: {name}',
    fabric: 'الخامة', fabricNote: 'كل قطعة تُسعّر حسب خامتها.',
    coloursNote: 'تعديل {garment}. اختر قطعة أخرى من المعاينة للتبديل.',
    brandingNote: 'تُحتسب مرة واحدة لكل فرد، مهما كانت محتويات الطقم.',
    quantityNote: 'المخزون الاحتياطي يغطي الموظفين الجدد والاستبدال.',
    logoColour: 'لون الشعار', placement: 'الموضع',
    peopleToKit: 'عدد الموظفين', spareStock: 'مخزون احتياطي',
    sizesNote: 'تُجمع المقاسات من الموظفين بعد تأكيد الطلب.',
    previewUpdates: 'تتحدث المعاينة مع كل اختيار', selectGarment: 'اختر قطعة لتغيير لونها',
    standardCloth: 'خامة قياسية', mixedGrades: 'خامات متنوعة',
    askTitle: 'أو اكتب لي ما تريد تغييره',
    askNote: 'اطلب عدة أشياء معًا. سأعرض لك بالضبط ما غيّرته، فلا يتحرك شيء لم تطلبه.',
    describeChange: 'صف التغيير', apply: 'تطبيق',
    saveKit: 'حفظ الطقم', getQuote: 'اطلب عرض سعر', saveAsKit: 'احفظه كطقم',
    nextStep: 'التالي: {name}', perPersonPrice: '{price} للفرد',
    setsLine: '{price} للفرد · {sets} طقم (منها {spare} احتياطي)',
    setsLineNoSpare: '{price} للفرد · {sets} طقم',
  },
  quote: {
    title: 'عرض السعر', validFor: 'ساري لمدة ٣٠ يومًا.',
    branding: 'العلامة', upgrade: 'ترقية', sets: 'الأطقم',
    coversPeople: '{people} موظف بالإضافة إلى {spare} احتياطي', coversNoSpare: '{people} موظف، بدون احتياطي',
    total: 'الإجمالي', keepEditing: 'متابعة التعديل', submit: 'تأكيد الطلب',
  },
  orders: {
    title: 'الطلبات', subtitle: 'حالة كل طلب الآن.',
    noneTitle: 'لا توجد طلبات بعد',
    noneNote: 'خصص طقمًا، راجع عرض السعر ثم أكّد الطلب. سيظهر هنا مع مراحل الإنتاج.',
    startOne: 'ابدأ زيًا جديدًا',
    colOrder: 'الطلب', colStatus: 'الحالة', colValue: 'القيمة', colDue: 'موعد التسليم',
    colItem: 'الصنف', colQty: 'الكمية', colProgress: 'التقدم', colReady: 'الجاهزية',
    open: 'فتح {name}، {id}',
    dueAround: 'التسليم حوالي {date}', deliveredOn: 'سُلّم في {date}',
    whatIsBeingMade: 'ما يجري تصنيعه', whatWasMade: 'ما تم تصنيعه',
    waitingOnSizes: 'في انتظار المقاسات',
    setsAndValue: '{sets} طقم · {value}',
    ordered: 'تم الطلب', sizesIn: 'استلام المقاسات', fabricCut: 'قص الخامة',
    sewing: 'الحياكة', checks: 'الفحص', delivery: 'التسليم', now: 'الآن',
  },
  kits: {
    title: 'الأطقم المحفوظة', subtitle: 'أعد طلبها دون البدء من جديد.',
    newUniform: 'زي جديد', noneTitle: 'لا توجد أطقم محفوظة بعد',
    noneNote: 'عندما تجهز زيًا يعجبك، احفظه هنا وأعد طلبه في أي وقت.',
    createFirst: 'أنشئ أول طقم لك',
    forPeople: '{price} لعدد {count}',
    saved: 'تم حفظ «{name}» في أطقمك', already: '«{name}» محفوظ لديك بالفعل',
  },
  settings: {
    title: 'الإعدادات', subtitle: 'تُستخدم للحفاظ على هوية كل طقم.',
    company: 'شركتك', companyNote: 'تظهر على عروض الأسعار وتُستخدم لتحديد حجم كل طلب.',
    companyName: 'اسم الشركة', totalStaff: 'إجمالي الموظفين', industry: 'القطاع',
    industryHint: 'يحدد نقطة البداية للأطقم الجديدة.',
    dressCode: 'قواعد الزي', dressCodeNote: 'أقرأ هذا قبل اقتراح الأطقم، فاكتبه بكلمات واضحة.',
    rulesLabel: 'ما الذي يجب أن يرتديه فريقك',
    language: 'اللغة', languageNote: 'تغير الواجهة وكل ما أكتبه لك.',
    interfaceLanguage: 'لغة الواجهة',
    save: 'حفظ الإعدادات', saved: 'تم حفظ الإعدادات',
    nameNeeded: 'الاسم مطلوب — يظهر على كل عرض سعر.',
    staffNeeded: 'موظف واحد على الأقل.',
    industryTech: 'التكنولوجيا', industryHospitality: 'الضيافة',
    industryFacilities: 'إدارة المرافق', industryRetail: 'التجزئة',
  },
  statuses: {
    collectingSizes: 'جمع المقاسات', inProduction: 'قيد الإنتاج', delivered: 'تم التسليم',
  },
  garments: {
    polo: 'قميص بولو', shirt: 'قميص رسمي', chino: 'بنطلون تشينو',
    blazer: 'بليزر', cargo: 'بنطلون كارجو',
  },
  parts: {
    body: 'الجسم', collar: 'الياقة', cuffs: 'الأساور', placket: 'فتحة الأزرار',
    leg: 'الساق', lapel: 'الطية', buttons: 'الأزرار', pockets: 'الجيوب',
  },
  branding: {
    embroidery: 'تطريز', print: 'طباعة',
    embroideryNote: 'مطرز. متين وبمظهر راقٍ.',
    printNote: 'مطبوع. تكلفة أقل، والأنسب للأقمشة المسطحة.',
    left_chest: 'الصدر الأيسر', right_chest: 'الصدر الأيمن', sleeve: 'الكم',
    back: 'الظهر', none: 'بدون شعار',
    left_chestNote: 'الخيار المعتاد للزي المؤسسي.',
    right_chestNote: 'يُستخدم عندما تكون بطاقة الاسم على اليسار.',
    sleeveNote: 'خيار هادئ. مناسب للفرق التي تقابل العملاء.',
    backNote: 'وضوح عالٍ عبر الموقع أو صالة العمل.',
    noneNote: 'قطع سادة، بدون تكلفة علامة.',
    embroideredLogo: 'شعار مطرز', printedLogo: 'شعار مطبوع',
  },
  spare: {
    none: 'بدون احتياطي', noneNote: 'الموظف الجديد ينتظر دورة الإنتاج التالية',
    five: '٥٪ احتياطي', ten: '١٠٪ احتياطي',
    note: '{count} طقم للموظفين الجدد والاستبدال',
    sets: '{count} طقم',
  },
  errors: {
    notUnderstood: 'أستطيع تغيير اللون أو الخامة أو العلامة أو المخزون الاحتياطي. جرب «اجعل البنطلون كحلي» أو «استخدم الخامة عالية الأداء».',
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

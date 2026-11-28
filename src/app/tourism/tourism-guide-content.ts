export interface TourismGuideSection {
  readonly headingEnglish: string;
  readonly headingTamil: string;
  readonly bodyEnglish: string;
  readonly bodyTamil: string;
}

export interface TourismGuideFaq {
  readonly questionEnglish: string;
  readonly questionTamil: string;
  readonly answerEnglish: string;
  readonly answerTamil: string;
}

export interface TourismGuide {
  readonly slug: string;
  readonly titleEnglish: string;
  readonly titleTamil: string;
  readonly descriptionEnglish: string;
  readonly descriptionTamil: string;
  readonly image: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly imageAltEnglish: string;
  readonly imageAltTamil: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly secondarySourceLabel?: string;
  readonly secondarySourceUrl?: string;
  readonly sourceUpdatedAt: string;
  readonly lastVerifiedAt: string;
  readonly mapQuery: string;
  readonly sections: readonly TourismGuideSection[];
  readonly faqs: readonly TourismGuideFaq[];
}

/**
 * Locally written, cautious destination guidance. Volatile hours, prices,
 * access rules, and availability are intentionally not asserted.
 */
export const TOURISM_GUIDES: readonly TourismGuide[] = [
  {
    slug: 'nataraja-temple-guide',
    titleEnglish: 'Chidambaram Nataraja Temple Guide',
    titleTamil: 'சிதம்பரம் நடராஜர் கோவில் வழிகாட்டி',
    descriptionEnglish: 'An independent visitor-planning guide to Chidambaram Nataraja Temple, with official district references and practical reminders to confirm current visitor guidance.',
    descriptionTamil: 'அதிகாரப்பூர்வ மாவட்ட ஆதாரங்களும் தற்போதைய வருகை வழிகாட்டுதலை உறுதிப்படுத்த வேண்டிய நினைவூட்டல்களும் கொண்ட சிதம்பரம் நடராஜர் கோவில் பயணத் திட்ட வழிகாட்டி.',
    image: '/assets/images/chidambaram-hero2.webp',
    imageWidth: 1651,
    imageHeight: 953,
    imageAltEnglish: 'Illustrative artwork inspired by Chidambaram temple tank and gopuram',
    imageAltTamil: 'சிதம்பரம் கோவில் குளம் மற்றும் கோபுரத்தை நினைவூட்டும் விளக்கப் படம்',
    sourceLabel: 'Cuddalore District Administration · Chidambaram tourist place',
    sourceUrl: 'https://cuddalore.nic.in/tourist-place/chidamabaram/',
    sourceUpdatedAt: '2026-10-29',
    lastVerifiedAt: '2026-11-28',
    mapQuery: 'Chidambaram Nataraja Temple',
    sections: [
      {
        headingEnglish: 'A starting point for a temple-town visit',
        headingTamil: 'கோவில் நகரப் பயணத்திற்கான தொடக்கம்',
        bodyEnglish: 'The Cuddalore District Administration lists Chidambaram as a historic and religious destination and refers to Nataraja Temple as Thillai Nataraja Temple. This page is an independent CDM 360 guide, not an official temple publication or affiliation.',
        bodyTamil: 'கடலூர் மாவட்ட நிர்வாகத்தின் சுற்றுலா பக்கம் சிதம்பரத்தை வரலாற்று மற்றும் சமயச் சுற்றுலாத் தலமாகக் குறிப்பிடுகிறது; நடராஜர் கோவிலை தில்லை நடராஜர் கோவில் என்றும் குறிப்பிடுகிறது. இது CDM 360-ன் சுயாதீன வழிகாட்டி; கோவிலின் அதிகாரப்பூர்வ வெளியீடோ இணைப்போ அல்ல.',
      },
      {
        headingEnglish: 'Confirm visitor guidance before travelling',
        headingTamil: 'பயணத்திற்கு முன் வருகை வழிகாட்டுதலை உறுதிப்படுத்துங்கள்',
        bodyEnglish: 'Opening information, entry arrangements, ceremonies, photography guidance, and local conditions can change. Check the district source and confirm current rules with the temple administration before setting out. This guide does not publish unverified schedules, fees, or access rules.',
        bodyTamil: 'திறந்திருக்கும் தகவல், நுழைவு ஏற்பாடுகள், விழாக்கள், புகைப்பட வழிகாட்டுதல் மற்றும் உள்ளூர் நிலவரங்கள் மாறக்கூடும். புறப்படுவதற்கு முன் மாவட்ட ஆதாரத்தைப் பார்த்து கோவில் நிர்வாகத்திடம் தற்போதைய விதிகளை உறுதிப்படுத்துங்கள். உறுதிப்படுத்தப்படாத நேரம், கட்டணம் அல்லது நுழைவு விதிகளை இந்த வழிகாட்டி வெளியிடவில்லை.',
      },
      {
        headingEnglish: 'Plan local services separately',
        headingTamil: 'உள்ளூர் சேவைகளைத் தனியாகத் திட்டமிடுங்கள்',
        bodyEnglish: 'CDM 360 lists public community services, including stays and local transport where published. Contact each provider directly to confirm details. A directory listing or enquiry is not a reservation or booking confirmation.',
        bodyTamil: 'வெளியிடப்பட்ட தங்குமிடங்கள் மற்றும் உள்ளூர் போக்குவரத்து உட்பட சமூகச் சேவைப் பட்டியல்களை CDM 360 காட்டுகிறது. விவரங்களை ஒவ்வொரு வழங்குநரிடமும் நேரடியாக உறுதிப்படுத்துங்கள். பட்டியல் அல்லது விசாரணை என்பது முன்பதிவு உறுதி அல்ல.',
      },
    ],
    faqs: [
      {
        questionEnglish: 'Does CDM 360 publish confirmed temple opening times?',
        questionTamil: 'கோவில் திறந்திருக்கும் உறுதியான நேரத்தை CDM 360 வெளியிடுகிறதா?',
        answerEnglish: 'No. Use the official district source and confirm current visitor information with the temple administration.',
        answerTamil: 'இல்லை. அதிகாரப்பூர்வ மாவட்ட ஆதாரத்தைப் பார்த்து தற்போதைய வருகைத் தகவலை கோவில் நிர்வாகத்திடம் உறுதிப்படுத்துங்கள்.',
      },
      {
        questionEnglish: 'Can I book accommodation through this guide?',
        questionTamil: 'இந்த வழிகாட்டி மூலம் தங்குமிடத்தை முன்பதிவு செய்ய முடியுமா?',
        answerEnglish: 'No. CDM 360 provides public listings and enquiry links. Confirm availability, rates, and arrangements directly with the provider.',
        answerTamil: 'இல்லை. CDM 360 பொது பட்டியல்களையும் விசாரணை இணைப்புகளையும் வழங்குகிறது. கிடைப்பது, விலை, ஏற்பாடுகளை வழங்குநரிடம் நேரடியாக உறுதிப்படுத்துங்கள்.',
      },
    ],
  },
  {
    slug: 'pichavaram-mangrove-forest',
    titleEnglish: 'Pichavaram Mangrove Forest Visitor Guide',
    titleTamil: 'பிச்சாவரம் மாங்குரோவ் காடு பயண வழிகாட்டி',
    descriptionEnglish: 'A source-linked guide to planning a Pichavaram visit, with current operations and boat availability left for the official district and TTDC sources to confirm.',
    descriptionTamil: 'பிச்சாவரம் பயணத்தைத் திட்டமிடுவதற்கான ஆதார இணைப்புகளுடன் கூடிய வழிகாட்டி. தற்போதைய சேவை மற்றும் படகு கிடைப்பை மாவட்ட மற்றும் TTDC அதிகாரப்பூர்வ ஆதாரங்களில் உறுதிப்படுத்துங்கள்.',
    image: '/assets/images/pichavaram-image-1.webp',
    imageWidth: 1915,
    imageHeight: 821,
    imageAltEnglish: 'Illustrative image of a boat among Pichavaram mangroves',
    imageAltTamil: 'பிச்சாவரம் மாங்குரோவ் பகுதியில் படகை காட்டும் விளக்கப் படம்',
    sourceLabel: 'Cuddalore District Administration · Pichavaram',
    sourceUrl: 'https://cuddalore.nic.in/tourist-place/pichavaram/',
    secondarySourceLabel: 'Tamil Nadu Tourism Development Corporation · Public booking information',
    secondarySourceUrl: 'https://ttdc.in/',
    sourceUpdatedAt: '2026-10-29',
    lastVerifiedAt: '2026-11-28',
    mapQuery: 'Pichavaram Mangrove Forest',
    sections: [
      {
        headingEnglish: 'Understand the destination',
        headingTamil: 'இடத்தைப் பற்றி அறிந்துகொள்ளுங்கள்',
        bodyEnglish: 'The district administration describes Pichavaram as a natural and scenic destination and a mangrove forest between the Vellar and Coleroon estuaries. Its current visitor page provides the source for destination details; check that page for later updates.',
        bodyTamil: 'மாவட்ட நிர்வாகம் பிச்சாவரத்தை இயற்கை மற்றும் காட்சியழகுடைய சுற்றுலாத் தலமாகவும் வெள்ளாறு, கொள்ளிடம் கழிமுகங்களுக்கு இடையிலுள்ள மாங்குரோவ் காடாகவும் விவரிக்கிறது. தற்போதைய இட விவரங்களுக்கு அந்த அதிகாரப்பூர்வ பக்கத்தைப் பார்க்கவும்; புதிய தகவல்களையும் அங்கே உறுதிப்படுத்தவும்.',
      },
      {
        headingEnglish: 'Check boating and conditions directly',
        headingTamil: 'படகு சேவை மற்றும் நிலவரங்களை நேரடியாக உறுதிப்படுத்துங்கள்',
        bodyEnglish: 'The cited district page links to TTDC boating information. Schedules, ticket terms, weather, water conditions, and service availability are time-sensitive. Check the official TTDC booking page and district guidance before departure; CDM 360 does not sell boat tickets or guarantee service.',
        bodyTamil: 'மேற்கோள் காட்டப்பட்ட மாவட்டப் பக்கம் TTDC படகு தகவலுடன் இணைக்கிறது. நேர அட்டவணை, சீட்டு விதிகள், வானிலை, நீர்நிலை மற்றும் சேவை கிடைப்பு மாறக்கூடியவை. புறப்படுவதற்கு முன் TTDC முன்பதிவு பக்கத்தையும் மாவட்ட வழிகாட்டுதலையும் பார்க்கவும்; CDM 360 படகு சீட்டுகளை விற்கவோ சேவையை உறுதி செய்யவோ இல்லை.',
      },
      {
        headingEnglish: 'Arrange transport and stays with providers',
        headingTamil: 'போக்குவரத்து மற்றும் தங்குமிடத்தை வழங்குநர்களிடம் ஏற்பாடு செய்யுங்கள்',
        bodyEnglish: 'Explore current local service listings for transport or accommodation and contact providers directly. The directory does not confirm a cab quote, hotel vacancy, rate, or booking.',
        bodyTamil: 'போக்குவரத்து அல்லது தங்குமிடத்திற்கான தற்போதைய உள்ளூர் சேவைப் பட்டியல்களைப் பார்த்து வழங்குநர்களை நேரடியாகத் தொடர்புகொள்ளுங்கள். கேப் கட்டணம், ஹோட்டல் காலியிடம், விலை அல்லது முன்பதிவை அடைவு உறுதி செய்யாது.',
      },
    ],
    faqs: [
      {
        questionEnglish: 'Are boat schedules and ticket prices guaranteed here?',
        questionTamil: 'படகு நேரம் மற்றும் சீட்டு விலை இங்கே உறுதி செய்யப்படுகிறதா?',
        answerEnglish: 'No. Check the official TTDC booking page and district visitor information for current details.',
        answerTamil: 'இல்லை. தற்போதைய விவரங்களுக்கு TTDC அதிகாரப்பூர்வ முன்பதிவு பக்கத்தையும் மாவட்ட வருகைத் தகவலையும் பார்க்கவும்.',
      },
      {
        questionEnglish: 'Can CDM 360 confirm transport or hotel availability?',
        questionTamil: 'போக்குவரத்து அல்லது ஹோட்டல் கிடைப்பை CDM 360 உறுதி செய்யுமா?',
        answerEnglish: 'No. Public directory listings are starting points; contact each provider directly to confirm arrangements.',
        answerTamil: 'இல்லை. பொது அடைவு பட்டியல்கள் தொடக்கத் தகவல் மட்டுமே; ஏற்பாடுகளை வழங்குநரிடம் நேரடியாக உறுதிப்படுத்துங்கள்.',
      },
    ],
  },
];

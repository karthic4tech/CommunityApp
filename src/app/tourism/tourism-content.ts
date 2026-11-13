export interface TourismDestination {
  readonly id: string;
  readonly titleEnglish: string;
  readonly titleTamil: string;
  readonly descriptionEnglish: string;
  readonly descriptionTamil: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly width: number;
  readonly height: number;
  readonly mapQuery: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly sourceUpdatedAt?: string;
  /** Optional future fields for Supabase-backed editorial and partner content. */
  readonly lastVerifiedAt?: string;
  readonly partnerId?: string | null;
  readonly sponsored?: boolean;
}

export interface TourismItineraryStop {
  readonly titleEnglish: string;
  readonly titleTamil: string;
  readonly descriptionEnglish: string;
  readonly descriptionTamil: string;
}

export interface TourismItinerary {
  readonly id: 'one-day' | 'two-day';
  readonly titleEnglish: string;
  readonly titleTamil: string;
  readonly subtitleEnglish: string;
  readonly subtitleTamil: string;
  readonly stops: readonly TourismItineraryStop[];
}

export interface TourismFaq {
  readonly questionEnglish: string;
  readonly questionTamil: string;
  readonly answerEnglish: string;
  readonly answerTamil: string;
}

/**
 * Editorial destination content is kept separate from presentation so it can
 * be mapped to a future Supabase tourism_content table without changing UI.
 * Destination imagery is illustrative CDM 360 artwork, not official photography.
 */
export const TOURISM_DESTINATIONS: readonly TourismDestination[] = [
  {
    id: 'nataraja-temple',
    titleEnglish: 'Chidambaram Nataraja Temple',
    titleTamil: 'சிதம்பரம் நடராஜர் கோவில்',
    descriptionEnglish: 'A landmark of Chidambaram’s spiritual and architectural heritage. Check current visitor guidance with the temple administration before your visit.',
    descriptionTamil: 'சிதம்பரத்தின் ஆன்மிக மற்றும் கட்டிடக்கலை மரபின் முக்கியத் தலம். வருகைக்கு முன் கோவில் நிர்வாகத்திடம் தற்போதைய வழிகாட்டுதலை உறுதிப்படுத்தவும்.',
    image: '/assets/images/chidambaram-hero2.png',
    imageAlt: 'Illustrative artwork of Chidambaram temple tank and gopuram',
    width: 1651,
    height: 953,
    mapQuery: 'Chidambaram Nataraja Temple',
    sourceLabel: 'Cuddalore District Administration · Tourist Places',
    sourceUrl: 'https://cuddalore.nic.in/tourist-places/',
  },
  {
    id: 'pichavaram',
    titleEnglish: 'Pichavaram Mangrove Forest',
    titleTamil: 'பிச்சாவரம் மாங்குரோவ் காடு',
    descriptionEnglish: 'Explore the mangrove waterways and local ecotourism information. Boating operations and conditions can change; check the district source before travelling.',
    descriptionTamil: 'மாங்குரோவ் நீர்வழிகளையும் உள்ளூர் சூழல் சுற்றுலா தகவல்களையும் அறியுங்கள். படகு சேவையும் நிலவரங்களும் மாறக்கூடும்; பயணத்திற்கு முன் மாவட்டத் தகவலைப் பார்க்கவும்.',
    image: '/assets/images/pichavaram-image-1.png',
    imageAlt: 'Illustrative image of a boat in Pichavaram mangrove waterways',
    width: 1915,
    height: 821,
    mapQuery: 'Pichavaram Mangrove Forest',
    sourceLabel: 'Cuddalore District Administration · Pichavaram',
    sourceUrl: 'https://cuddalore.nic.in/tourist-place/pichavaram/',
    sourceUpdatedAt: '2026-10-29',
  },
  {
    id: 'annamalai-university',
    titleEnglish: 'Annamalai University',
    titleTamil: 'அண்ணாமலைப் பல்கலைக்கழகம்',
    descriptionEnglish: 'A notable nearby campus and part of the wider Chidambaram area. Check access and visitor rules with the university before visiting.',
    descriptionTamil: 'சிதம்பரம் சுற்றுப்பகுதியில் அமைந்துள்ள குறிப்பிடத்தக்க கல்வி வளாகம். வருகைக்கு முன் பல்கலைக்கழகத்தின் அணுகல் மற்றும் பார்வையாளர் விதிகளைப் பார்க்கவும்.',
    image: '/assets/images/Annamalai University Clock Tower Campus.png',
    imageAlt: 'Illustrative image of Annamalai University campus',
    width: 1938,
    height: 811,
    mapQuery: 'Annamalai University Chidambaram',
    sourceLabel: 'Annamalai University',
    sourceUrl: 'https://annamalaiuniversity.ac.in/',
  },
  {
    id: 'samiyarpettai-beach',
    titleEnglish: 'Samiyarpettai Beach',
    titleTamil: 'சாமியார்பேட்டை கடற்கரை',
    descriptionEnglish: 'A coastal outing in Cuddalore district. Check local weather, sea conditions, and safety guidance before going into the water.',
    descriptionTamil: 'கடலூர் மாவட்டக் கடற்கரைப் பயணத் தளம். கடலுக்குள் செல்லும் முன் உள்ளூர் வானிலை, கடல் நிலை மற்றும் பாதுகாப்பு வழிகாட்டுதலைப் பார்க்கவும்.',
    image: '/assets/images/samiyarpettai-beach-1.png',
    imageAlt: 'Illustrative image of Samiyarpettai beach and fishing boats',
    width: 1939,
    height: 811,
    mapQuery: 'Samiyarpettai Beach Cuddalore',
    sourceLabel: 'Cuddalore District Administration · Tourist Places',
    sourceUrl: 'https://cuddalore.nic.in/tourist-places/',
  },
];

export const TOURISM_ITINERARIES: readonly TourismItinerary[] = [
  {
    id: 'one-day',
    titleEnglish: 'A day in Chidambaram',
    titleTamil: 'சிதம்பரத்தில் ஒரு நாள்',
    subtitleEnglish: 'A flexible town-and-temple day, at your own pace.',
    subtitleTamil: 'உங்கள் விருப்பமான வேகத்தில் நகரமும் கோவிலும்.',
    stops: [
      { titleEnglish: 'Temple quarter', titleTamil: 'கோவில் பகுதி', descriptionEnglish: 'Begin with the Nataraja Temple area. Confirm current visitor guidance before setting out.', descriptionTamil: 'நடராஜர் கோவில் பகுதியுடன் தொடங்குங்கள். புறப்படுவதற்கு முன் தற்போதைய வருகை வழிகாட்டுதலை உறுதிப்படுத்தவும்.' },
      { titleEnglish: 'Local lunch', titleTamil: 'உள்ளூர் மதிய உணவு', descriptionEnglish: 'Browse current restaurant listings and contact a provider directly about menus and availability.', descriptionTamil: 'தற்போதைய உணவகப் பட்டியலைப் பார்த்து உணவு மற்றும் கிடைப்புத் தகவலை வழங்குநரிடம் நேரடியாகக் கேளுங்கள்.' },
      { titleEnglish: 'Explore the town', titleTamil: 'நகரைச் சுற்றிப் பாருங்கள்', descriptionEnglish: 'Leave time for local streets and heritage stops that suit your group and access needs.', descriptionTamil: 'உங்கள் குழு மற்றும் அணுகல் தேவைகளுக்கேற்ற உள்ளூர் தெருக்கள் மற்றும் பாரம்பரிய இடங்களுக்கு நேரம் ஒதுக்குங்கள்.' },
    ],
  },
  {
    id: 'two-day',
    titleEnglish: 'A two-day coastal escape',
    titleTamil: 'இரண்டு நாள் கடற்கரைப் பயணம்',
    subtitleEnglish: 'Pair Chidambaram with a separately planned nature excursion.',
    subtitleTamil: 'சிதம்பரத்துடன் தனியாகத் திட்டமிட்ட இயற்கைச் சுற்றுலாவை இணைக்கவும்.',
    stops: [
      { titleEnglish: 'Day 1 · Chidambaram', titleTamil: 'நாள் 1 · சிதம்பரம்', descriptionEnglish: 'Explore the temple quarter and choose local dining or a town stop that fits your plans.', descriptionTamil: 'கோவில் பகுதியைப் பார்வையிட்டு, உங்கள் திட்டத்திற்கு ஏற்ற உள்ளூர் உணவகம் அல்லது நகர இடத்தைத் தேர்ந்தெடுக்கவும்.' },
      { titleEnglish: 'Day 2 · Pichavaram', titleTamil: 'நாள் 2 · பிச்சாவரம்', descriptionEnglish: 'Plan a mangrove visit after checking current boat operations, weather, and district guidance.', descriptionTamil: 'மாங்குரோவ் பயணத்திற்கு முன் தற்போதைய படகு சேவை, வானிலை மற்றும் மாவட்ட வழிகாட்டுதலைச் சரிபார்க்கவும்.' },
      { titleEnglish: 'Keep plans flexible', titleTamil: 'திட்டத்தை நெகிழ்வாக வைத்திருங்கள்', descriptionEnglish: 'Confirm transport, opening information, and any local arrangements directly before departure.', descriptionTamil: 'புறப்படுவதற்கு முன் போக்குவரத்து, திறந்திருக்கும் தகவல் மற்றும் உள்ளூர் ஏற்பாடுகளை நேரடியாக உறுதிப்படுத்தவும்.' },
    ],
  },
];

export const TOURISM_FAQS: readonly TourismFaq[] = [
  {
    questionEnglish: 'Can I book a hotel or taxi on CDM 360?',
    questionTamil: 'CDM 360 மூலம் ஹோட்டல் அல்லது டாக்ஸியை முன்பதிவு செய்ய முடியுமா?',
    answerEnglish: 'CDM 360 shows public community service listings and enquiry links. It does not confirm a booking, availability, or price. Contact the provider directly to agree on details.',
    answerTamil: 'CDM 360 பொதுவான சமூக சேவைப் பட்டியல்களையும் விசாரணை இணைப்புகளையும் காட்டுகிறது. முன்பதிவு, கிடைப்பது அல்லது விலை உறுதி செய்யப்படாது. விவரங்களை வழங்குநரிடம் நேரடியாக உறுதிப்படுத்தவும்.',
  },
  {
    questionEnglish: 'Are temple timings, entry rules, and boat schedules listed here?',
    questionTamil: 'கோவில் நேரம், நுழைவு விதிகள், படகு அட்டவணை இங்கே உள்ளதா?',
    answerEnglish: 'No schedules, fees, or entry rules are asserted here. Use the linked district and tourism sources and confirm current guidance with the destination before travelling.',
    answerTamil: 'நேர அட்டவணை, கட்டணம் அல்லது நுழைவு விதிகள் இங்கே உறுதியாகக் கூறப்படவில்லை. இணைக்கப்பட்ட மாவட்ட மற்றும் சுற்றுலா ஆதாரங்களைப் பார்த்து பயணத்திற்கு முன் உறுதிப்படுத்தவும்.',
  },
  {
    questionEnglish: 'Is CDM 360 affiliated with Nataraja Temple?',
    questionTamil: 'CDM 360 நடராஜர் கோவிலுடன் இணைந்ததா?',
    answerEnglish: 'No. CDM 360 is an independent community platform and is not affiliated with the temple or its administration.',
    answerTamil: 'இல்லை. CDM 360 ஒரு சுயாதீன சமூகத் தளம்; கோவில் அல்லது அதன் நிர்வாகத்துடன் தொடர்புடையதல்ல.',
  },
];

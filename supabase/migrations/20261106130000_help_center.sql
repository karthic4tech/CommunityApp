-- CDM 360 Help Center: published bilingual content is public; management is admin-only.
create table if not exists public.help_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title_en text not null check (length(trim(title_en)) between 2 and 120),
  title_ta text not null check (length(trim(title_ta)) between 2 and 240),
  description_en text not null default '',
  description_ta text not null default '',
  icon text not null default 'bi-question-circle',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.help_categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  question_en text not null check (length(trim(question_en)) between 5 and 240),
  question_ta text not null check (length(trim(question_ta)) between 2 and 480),
  answer_en text not null check (length(trim(answer_en)) between 10 and 5000),
  answer_ta text not null check (length(trim(answer_ta)) between 2 and 10000),
  article_type text not null default 'faq' check (article_type in ('faq','guide')),
  related_route text check (related_route is null or related_route like '/%'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_featured boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_feedback (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.help_articles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  is_helpful boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists ix_help_categories_active_order on public.help_categories(is_active, sort_order);
create index if not exists ix_help_articles_published_order on public.help_articles(is_published, is_featured desc, category_id, sort_order);
create index if not exists ix_help_articles_category on public.help_articles(category_id, is_published, sort_order);
create index if not exists ix_help_feedback_article_created on public.help_feedback(article_id, created_at desc);

alter table public.help_categories enable row level security;
alter table public.help_articles enable row level security;
alter table public.help_feedback enable row level security;

drop policy if exists "public reads active help categories" on public.help_categories;
create policy "public reads active help categories" on public.help_categories for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "admins manage help categories" on public.help_categories;
create policy "admins manage help categories" on public.help_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public reads published help articles" on public.help_articles;
create policy "public reads published help articles" on public.help_articles for select to anon, authenticated using (is_published and exists (select 1 from public.help_categories c where c.id = category_id and c.is_active) or public.is_admin());
drop policy if exists "admins manage help articles" on public.help_articles;
create policy "admins manage help articles" on public.help_articles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users submit help feedback" on public.help_feedback;
create policy "users submit help feedback" on public.help_feedback for insert to anon, authenticated with check (user_id is null or user_id = (select auth.uid()));
drop policy if exists "users read own help feedback" on public.help_feedback;
create policy "users read own help feedback" on public.help_feedback for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

grant select on public.help_categories, public.help_articles to anon, authenticated;
grant insert on public.help_feedback to anon, authenticated;
grant select on public.help_feedback to authenticated;
grant insert, update, delete on public.help_categories, public.help_articles to authenticated;

drop trigger if exists help_categories_updated_at on public.help_categories;
create trigger help_categories_updated_at before update on public.help_categories for each row execute function public.set_updated_at();
drop trigger if exists help_articles_updated_at on public.help_articles;
create trigger help_articles_updated_at before update on public.help_articles for each row execute function public.set_updated_at();

insert into public.help_categories (slug, title_en, title_ta, description_en, description_ta, icon, sort_order)
values
 ('getting-started','Getting Started','தொடங்குதல்','Learn the basics of CDM 360.','CDM 360 பற்றிய அடிப்படைகளை அறியுங்கள்.','bi-compass',10),
 ('add-services','Add Your Services','உங்கள் சேவைகளைச் சேர்க்கவும்','Share your local service with the community.','உங்கள் உள்ளூர் சேவையை சமூகத்துடன் பகிருங்கள்.','bi-person-badge',20),
 ('find-services','Find Services','சேவைகளைத் தேடுங்கள்','Find published local services and providers.','வெளியிடப்பட்ட உள்ளூர் சேவைகள் மற்றும் வழங்குநர்களைக் கண்டறியுங்கள்.','bi-search',30),
 ('jobs-careers','Jobs and Careers','வேலைவாய்ப்புகள்','Job features are being introduced in stages.','வேலைவாய்ப்பு அம்சங்கள் படிப்படியாக அறிமுகப்படுத்தப்படுகின்றன.','bi-briefcase',40),
 ('marketplace','Buy & Sell Marketplace','வாங்கவும் விற்கவும்','Browse and manage local marketplace listings.','உள்ளூர் சந்தை பட்டியல்களைப் பாருங்கள் மற்றும் நிர்வகியுங்கள்.','bi-shop',50),
 ('ai-search','AI Smart Search','AI ஸ்மார்ட் தேடல்','Search local services using natural language.','இயல்பான மொழியில் உள்ளூர் சேவைகளைத் தேடுங்கள்.','bi-stars',60),
 ('essential-services','Essential Services','அத்தியாவசிய சேவைகள்','Quickly find curated priority categories.','தேர்ந்தெடுக்கப்பட்ட முக்கிய வகைகளை விரைவாகக் கண்டறியுங்கள்.','bi-lightning-charge',70),
 ('account-security','Account and Security','கணக்கு மற்றும் பாதுகாப்பு','Manage access and protect your information.','உங்கள் அணுகலையும் தகவலையும் பாதுகாப்பாக நிர்வகியுங்கள்.','bi-shield-check',80)
on conflict (slug) do update set title_en=excluded.title_en,title_ta=excluded.title_ta,description_en=excluded.description_en,description_ta=excluded.description_ta,icon=excluded.icon,sort_order=excluded.sort_order;

-- Seed the most-used guides and FAQs. Additional questions can be maintained by administrators without a code release.
with seed(category_slug, slug, question_en, question_ta, answer_en, answer_ta, article_type, related_route, sort_order, is_featured) as (values
 ('getting-started','what-is-cdm-360','What is CDM 360?','CDM 360 என்றால் என்ன?','CDM 360 is a bilingual local platform for discovering services, businesses and community resources in Chidambaram.','CDM 360 என்பது சிதம்பரத்தில் சேவைகள், வணிகங்கள் மற்றும் சமூகத் தகவல்களைத் தேட உதவும் தமிழ்–ஆங்கில உள்ளூர் தளமாகும்.','faq','/',1,true),
 ('getting-started','create-an-account','How do I create an account?','கணக்கை எவ்வாறு உருவாக்குவது?','Choose Sign up, enter your details, and complete the verification step shown by Supabase Auth.','Sign up என்பதைத் தேர்ந்தெடுத்து உங்கள் விவரங்களை உள்ளிட்டு Supabase Auth காட்டும் சரிபார்ப்பை முடிக்கவும்.','guide','/auth/sign-up',2,true),
 ('getting-started','contact-support','How do I contact support?','ஆதரவை எவ்வாறு தொடர்புகொள்வது?','Use the support details shown in the Help Center. Do not share passwords or one-time codes.','Help Center-ல் காட்டப்படும் ஆதரவு விவரங்களைப் பயன்படுத்துங்கள். கடவுச்சொல் அல்லது OTP-ஐ பகிர வேண்டாம்.','faq','/help',3,false),
 ('add-services','register-as-provider','How do I register as a service provider?','சேவை வழங்குநராக எவ்வாறு பதிவு செய்வது?','Sign in, open Add your service, describe your service, choose or confirm an existing category, add the required details, and submit it for the existing review workflow.','உள்நுழைந்து, உங்கள் சேவையைச் சேர்க்கவும் என்பதைத் திறந்து, சேவையை விவரித்து, ஏற்கனவே உள்ள வகையைத் தேர்வு செய்து, விவரங்களைச் சமர்ப்பிக்கவும்.','guide','/services/submit',1,true),
 ('add-services','choose-service-category','How do I select the correct service category?','சரியான சேவை வகையை எவ்வாறு தேர்வு செய்வது?','Use the category assistant for a suggestion, then confirm it. You can always use the parent and subcategory selectors manually.','வகை உதவியாளரின் பரிந்துரையைப் பார்த்து உறுதிப்படுத்துங்கள். பெற்றோர் வகை மற்றும் உட்வகையை கைமுறையாகவும் தேர்வு செய்யலாம்.','guide','/services/submit',2,true),
 ('add-services','ai-category-suggestion','Can AI suggest my service category?','AI எனது சேவை வகையைப் பரிந்துரைக்குமா?','Yes. Describe your service in Tamil, English or mixed language. The assistant only suggests categories that already exist and never submits the form for you.','ஆம். உங்கள் சேவையை தமிழ், ஆங்கிலம் அல்லது கலப்பு மொழியில் விவரிக்கலாம். ஏற்கனவே உள்ள வகைகளிலிருந்து மட்டுமே பரிந்துரைக்கப்படும்; படிவம் தானாகச் சமர்ப்பிக்கப்படாது.','faq','/services/submit',3,true),
 ('find-services','find-services-in-chidambaram','How do I find services in Chidambaram?','சிதம்பரத்தில் சேவைகளை எவ்வாறு கண்டறிவது?','Open All Services, Essential Services, or AI Search. Browse categories or enter a service and locality.','All Services, Essential Services அல்லது AI Search-ஐத் திறக்கவும். வகைகளைப் பாருங்கள் அல்லது சேவை மற்றும் இடத்தை உள்ளிடுங்கள்.','guide','/services',1,true),
 ('find-services','contact-service-provider','How do I contact a service provider?','சேவை வழங்குநரை எவ்வாறு தொடர்புகொள்வது?','Open a published listing and use the public contact details provided by that provider. CDM 360 does not make bookings on your behalf.','வெளியிடப்பட்ட பட்டியலைத் திறந்து, வழங்குநர் கொடுத்துள்ள பொது தொடர்பு விவரங்களைப் பயன்படுத்துங்கள். CDM 360 உங்கள் சார்பில் முன்பதிவு செய்யாது.','faq','/services',2,false),
 ('find-services','report-incorrect-listing','How do I report incorrect listing information?','தவறான பட்டியல் தகவலை எவ்வாறு தெரிவிப்பது?','Use the available report or support route and include the listing link and a brief explanation. Do not include passwords or private documents.','கிடைக்கும் report அல்லது support வழியைப் பயன்படுத்தி, பட்டியல் இணைப்பையும் சுருக்கமான விளக்கத்தையும் அளிக்கவும். கடவுச்சொல் அல்லது தனிப்பட்ட ஆவணங்களை பகிர வேண்டாம்.','faq','/help',3,false),
 ('jobs-careers','jobs-not-available','How do I find jobs?','வேலைகளை எவ்வாறு கண்டறிவது?','A dedicated jobs workflow is not currently available in the application. This section will be updated when a published jobs feature is released.','தற்போது பயன்பாட்டில் தனிப்பட்ட வேலைவாய்ப்பு workflow இல்லை. வெளியிடப்பட்ட வேலைவாய்ப்பு அம்சம் வந்ததும் இந்தப் பகுதி புதுப்பிக்கப்படும்.','faq',null,1,true),
 ('marketplace','sell-on-cdm-360','How do I sell something on CDM 360?','CDM 360-ல் எவ்வாறு பொருளை விற்பது?','Sign in, open Marketplace, choose Sell, complete the listing details, add photos if requested, and submit it through the existing marketplace workflow.','உள்நுழைந்து Marketplace-ஐத் திறந்து Sell என்பதைத் தேர்வு செய்து, விவரங்களை நிரப்பி, கேட்கப்பட்டால் படங்களைச் சேர்த்து சமர்ப்பிக்கவும்.','guide','/marketplace/sell',1,true),
 ('marketplace','contact-a-seller','How do I contact a seller?','விற்பனையாளரை எவ்வாறு தொடர்புகொள்வது?','Open a published item and use the contact or enquiry action shown there. Arrange transactions carefully and meet safely.','வெளியிடப்பட்ட பொருளைத் திறந்து அங்கே காணப்படும் contact அல்லது enquiry வசதியைப் பயன்படுத்துங்கள். பரிவர்த்தனைகளை கவனமாகச் செய்து பாதுகாப்பாகச் சந்திக்கவும்.','faq','/marketplace',2,false),
 ('ai-search','use-ai-search','How do I use AI Search?','AI Search-ஐ எவ்வாறு பயன்படுத்துவது?','Open AI Search and describe the service you need, optionally including a locality. Review the results and contact providers directly.','AI Search-ஐத் திறந்து, தேவையான சேவையையும் விருப்பமாக இடத்தையும் இயல்பான மொழியில் எழுதுங்கள். முடிவுகளைப் பார்த்து வழங்குநரை நேரடியாகத் தொடர்புகொள்ளுங்கள்.','guide','/service-search',1,true),
 ('ai-search','search-in-tamil','Can I search in Tamil?','தமிழில் தேடலாமா?','Yes. AI Search supports Tamil, English, transliterated Tamil and mixed Tamil-English requests.','ஆம். AI Search தமிழ், ஆங்கிலம், தமிழ் transliteration மற்றும் தமிழ்–ஆங்கில கலப்பு தேடல்களை ஆதரிக்கிறது.','faq','/service-search',2,true),
 ('ai-search','voice-search','Can I search using voice?','குரல் மூலம் தேடலாமா?','Use the voice control when your browser and device provide speech recognition permission. Review the transcribed text before searching.','உங்கள் உலாவி மற்றும் சாதனம் அனுமதித்தால் குரல் கட்டுப்பாட்டைப் பயன்படுத்தலாம். தேடுவதற்கு முன் மாற்றப்பட்ட உரையைச் சரிபார்க்கவும்.','faq','/service-search',3,false),
 ('essential-services','what-are-essential-services','What are Essential Services?','அத்தியாவசிய சேவைகள் என்றால் என்ன?','Essential Services is a curated view of priority local categories. It helps you find published listings; it is not an emergency dispatch service.','Essential Services என்பது முக்கியமான உள்ளூர் வகைகளுக்கான தேர்ந்தெடுக்கப்பட்ட பகுதி. இது வெளியிடப்பட்ட பட்டியல்களைத் தேட உதவும்; அவசர சேவை dispatch அல்ல.','faq','/essential-services',1,true),
 ('essential-services','find-ambulance','How do I find an ambulance?','ஆம்புலன்ஸை எவ்வாறு கண்டறிவது?','Open Essential Services and choose the relevant published category. For an emergency, contact the appropriate official emergency service directly.','Essential Services-ஐத் திறந்து பொருத்தமான வெளியிடப்பட்ட வகையைத் தேர்வு செய்யுங்கள். அவசரத்தில் உரிய அதிகாரப்பூர்வ அவசர சேவையை நேரடியாகத் தொடர்புகொள்ளுங்கள்.','faq','/essential-services',2,false),
 ('account-security','change-account-details','How do I change my account details?','கணக்கு விவரங்களை எவ்வாறு மாற்றுவது?','Sign in and open Account. Edit the profile fields available there; authentication credentials remain managed by Supabase Auth.','உள்நுழைந்து Account-ஐத் திறக்கவும். கிடைக்கும் profile விவரங்களை மாற்றலாம்; authentication விவரங்களை Supabase Auth நிர்வகிக்கிறது.','guide','/account',1,true),
 ('account-security','phone-otp-login','How does phone OTP login work?','தொலைபேசி OTP உள்நுழைவு எவ்வாறு செயல்படுகிறது?','Enter your phone number, request a code, and enter the code sent by the configured Supabase SMS provider. Never share the code.','தொலைபேசி எண்ணை உள்ளிட்டு code-ஐக் கோருங்கள்; Supabase SMS provider அனுப்பிய code-ஐ உள்ளிடுங்கள். அந்த code-ஐ யாருடனும் பகிர வேண்டாம்.','faq','/auth/sign-in',2,false),
 ('account-security','google-sign-in','Can I sign in using Google?','Google மூலம் உள்நுழையலாமா?','Google sign-in is available when the Google provider is enabled and configured for the current production environment.','தற்போதைய production சூழலில் Google provider இயக்கப்பட்டு அமைக்கப்பட்டிருந்தால் Google sign-in பயன்படுத்தலாம்.','faq','/auth/sign-in',3,false),
 ('account-security','protect-personal-information','How do I protect my personal information?','தனிப்பட்ட தகவலை எவ்வாறு பாதுகாப்பது?','Use a strong password, keep OTPs private, share only public listing contact details, and sign out on shared devices.','வலுவான கடவுச்சொல்லைப் பயன்படுத்தி, OTP-ஐ ரகசியமாக வைத்திருந்து, பொது பட்டியல் தொடர்பு விவரங்களை மட்டும் பகிர்ந்து, பகிரப்பட்ட சாதனங்களில் sign out செய்யுங்கள்.','faq','/account',4,false)
)
insert into public.help_articles (category_id, slug, question_en, question_ta, answer_en, answer_ta, article_type, related_route, sort_order, is_featured, is_published)
select c.id, s.slug, s.question_en, s.question_ta, s.answer_en, s.answer_ta, s.article_type, s.related_route, s.sort_order, s.is_featured, true
from seed s join public.help_categories c on c.slug = s.category_slug
on conflict (slug) do update set category_id=excluded.category_id,question_en=excluded.question_en,question_ta=excluded.question_ta,answer_en=excluded.answer_en,answer_ta=excluded.answer_ta,article_type=excluded.article_type,related_route=excluded.related_route,sort_order=excluded.sort_order,is_featured=excluded.is_featured,is_published=true;

-- Complete the requested starter FAQ set. These entries deliberately describe
-- unavailable modules as unavailable instead of promising functionality.
with seed(category_slug, slug, question_en, question_ta, answer_en, answer_ta, sort_order) as (values
 ('getting-started','who-can-use-cdm-360','Who can use CDM 360?','CDM 360-ஐ யார் பயன்படுத்தலாம்?','Residents, visitors, service providers and local businesses can browse the public platform. An account is needed for protected actions.','பொதுத் தளத்தை குடியிருப்போர், வருகையாளர்கள், சேவை வழங்குநர்கள் மற்றும் உள்ளூர் வணிகங்கள் பயன்படுத்தலாம். பாதுகாக்கப்பட்ட செயல்களுக்கு கணக்கு தேவை.','4'),
 ('getting-started','cdm-360-on-mobile','Can I use CDM 360 on my mobile phone?','மொபைல் தொலைபேசியில் CDM 360-ஐப் பயன்படுத்தலாமா?','Yes. The responsive web application works in a current mobile browser.','ஆம். தற்போதைய மொபைல் உலாவியில் responsive web application இயங்கும்.','5'),
 ('getting-started','cdm-360-in-tamil','Is CDM 360 available in Tamil?','CDM 360 தமிழில் கிடைக்குமா?','Yes. Use the Tamil/English switch in the header. Published help content includes Tamil text where provided.','ஆம். Header-ல் உள்ள தமிழ்/English மாற்றியைப் பயன்படுத்துங்கள். வெளியிடப்பட்ட உதவி உள்ளடக்கத்தில் தேவையான தமிழ் உரை உள்ளது.','6'),
 ('getting-started','update-profile','How do I update my profile?','சுயவிவரத்தை எவ்வாறு புதுப்பிப்பது?','Sign in, open Account, edit the available profile fields, and save.','உள்நுழைந்து Account-ஐத் திறந்து, கிடைக்கும் சுயவிவர விவரங்களை மாற்றி சேமிக்கவும்.','7'),
 ('getting-started','how-to-log-in','How do I log in?','எவ்வாறு உள்நுழைவது?','Open Sign in and use an enabled authentication method: email/password, phone OTP, or Google when configured.','Sign in-ஐத் திறந்து இயக்கப்பட்ட authentication முறையைப் பயன்படுத்துங்கள்: email/password, phone OTP அல்லது அமைக்கப்பட்டிருந்தால் Google.','8'),
 ('add-services','add-new-service','How do I add a new service?','புதிய சேவையை எவ்வாறு சேர்ப்பது?','Sign in and open Add your service. Complete the provider and listing steps, then submit for review.','உள்நுழைந்து உங்கள் சேவையைச் சேர்க்கவும் என்பதைத் திறக்கவும். வழங்குநர் மற்றும் பட்டியல் படிகளை முடித்து மதிப்பாய்வுக்குச் சமர்ப்பிக்கவும்.','4'),
 ('add-services','add-service-photos','How do I add service photos?','சேவைப் படங்களை எவ்வாறு சேர்ப்பது?','Use the photo upload control in the service form and choose clear, relevant images. Uploads remain subject to the existing media workflow.','சேவைப் படிவத்தில் உள்ள upload கட்டுப்பாட்டைப் பயன்படுத்தி தெளிவான பொருத்தமான படங்களைத் தேர்வு செய்யுங்கள். Upload-கள் ஏற்கனவே உள்ள media workflow-க்கு உட்பட்டவை.','5'),
 ('add-services','service-location','How do I specify my service location?','சேவை இடத்தை எவ்வாறு குறிப்பிடுவது?','Choose the available locality and coverage options in the service form. Select only areas you actually serve.','சேவைப் படிவத்தில் கிடைக்கும் locality மற்றும் coverage விருப்பங்களைத் தேர்வு செய்யுங்கள். நீங்கள் உண்மையில் சேவை செய்யும் பகுதிகளை மட்டும் குறிப்பிடவும்.','6'),
 ('add-services','edit-service-listing','How do I edit my service listing?','சேவைப் பட்டியலை எவ்வாறு திருத்துவது?','Open My submissions, choose the listing, and use the available edit workflow. Published changes may require review.','My submissions-ஐத் திறந்து பட்டியலைத் தேர்வு செய்து கிடைக்கும் edit workflow-ஐப் பயன்படுத்தவும். வெளியிடப்பட்ட மாற்றங்களுக்கு மதிப்பாய்வு தேவைப்படலாம்.','7'),
 ('add-services','remove-service-listing','How do I deactivate or remove my listing?','சேவைப் பட்டியலை எவ்வாறு நிறுத்துவது அல்லது அகற்றுவது?','Use the listing management workflow or contact support if the required action is not shown. Do not create duplicate listings.','பட்டியல் நிர்வாக workflow-ஐப் பயன்படுத்தவும்; தேவையான செயல் தெரியவில்லை என்றால் support-ஐத் தொடர்புகொள்ளுங்கள். duplicate பட்டியல்கள் உருவாக்க வேண்டாம்.','8'),
 ('add-services','service-not-visible','Why is my service not visible?','என் சேவை ஏன் தெரியவில்லை?','Listings may be waiting for review, inactive, missing required information, or not yet published. Check My submissions and correct any requested changes.','பட்டியல் மதிப்பாய்வில் இருக்கலாம், inactive ஆக இருக்கலாம், தேவையான தகவல் இல்லாமல் இருக்கலாம் அல்லது இன்னும் வெளியிடப்படாமல் இருக்கலாம். My submissions-ஐச் சரிபார்க்கவும்.','9'),
 ('add-services','customers-contact-provider','How do customers contact me?','வாடிக்கையாளர்கள் என்னை எவ்வாறு தொடர்புகொள்வார்கள்?','Customers use the public contact details you choose to publish on an approved listing.','அங்கீகரிக்கப்பட்ட பட்டியலில் நீங்கள் வெளியிடத் தேர்வு செய்த பொது தொடர்பு விவரங்களை வாடிக்கையாளர்கள் பயன்படுத்துவார்கள்.','10'),
 ('find-services','search-by-service-name','How do I search by service name?','சேவை பெயரால் எவ்வாறு தேடுவது?','Use the All Services search or AI Search and enter the service name in Tamil or English.','All Services search அல்லது AI Search-ல் சேவை பெயரை தமிழ் அல்லது ஆங்கிலத்தில் உள்ளிடுங்கள்.','4'),
 ('find-services','search-by-locality','How do I search by locality?','வட்டாரத்தால் எவ்வாறு தேடுவது?','Choose a locality where the search control provides one, or include the locality in your AI Search request.','தேடல் கட்டுப்பாட்டில் locality-ஐத் தேர்வு செய்யுங்கள் அல்லது AI Search கோரிக்கையில் locality-ஐச் சேர்க்கவும்.','5'),
 ('find-services','browse-service-categories','How do I browse categories?','சேவை வகைகளை எவ்வாறு பார்ப்பது?','Open All Services and select a parent category to see its active subcategories and published listings.','All Services-ஐத் திறந்து parent category-ஐத் தேர்வு செய்தால் active subcategories மற்றும் வெளியிடப்பட்ட பட்டியல்கள் தெரியும்.','6'),
 ('find-services','essential-vs-all-services','What is the difference between Essential Services and All Services?','Essential Services மற்றும் All Services வித்தியாசம் என்ன?','Essential Services is a curated priority view. All Services is the broader active directory.','Essential Services என்பது முக்கியமாகத் தேர்ந்தெடுக்கப்பட்ட பகுதி. All Services என்பது விரிவான active directory.','7'),
 ('find-services','find-emergency-services','How do I find emergency services?','அவசர சேவைகளை எவ்வாறு கண்டறிவது?','Use Essential Services to find published local listings, but contact official emergency services directly for urgent help.','Essential Services-ல் வெளியிடப்பட்ட உள்ளூர் பட்டியல்களைப் பாருங்கள்; அவசர உதவிக்கு அதிகாரப்பூர்வ அவசர சேவையை நேரடியாக அழைக்கவும்.','8'),
 ('jobs-careers','post-job-vacancy','How do I post a job vacancy?','வேலை வாய்ப்பை எவ்வாறு வெளியிடுவது?','A dedicated job-posting workflow is not currently available. This page will be updated when it is released.','தனிப்பட்ட job-posting workflow தற்போது இல்லை. அது வெளியிடப்பட்டதும் இந்தப் பக்கம் புதுப்பிக்கப்படும்.','2'),
 ('jobs-careers','who-can-post-jobs','Who can post jobs?','யார் வேலைகளை வெளியிடலாம்?','The application does not currently provide a published job-posting workflow, so posting eligibility is not yet defined.','தற்போது வெளியிடப்பட்ட job-posting workflow இல்லாததால், யார் வெளியிடலாம் என்பது இன்னும் வரையறுக்கப்படவில்லை.','3'),
 ('jobs-careers','edit-job-posting','How do I edit a job posting?','வேலைப் பதிவை எவ்வாறு திருத்துவது?','Job posting management is not currently available in the application.','வேலைப் பதிவு நிர்வாகம் தற்போது பயன்பாட்டில் இல்லை.','4'),
 ('jobs-careers','close-job-vacancy','How do I close a vacancy?','வேலை வாய்ப்பை எவ்வாறு மூடுவது?','Vacancy management is not currently available in the application.','வேலை வாய்ப்பு நிர்வாகம் தற்போது பயன்பாட்டில் இல்லை.','5'),
 ('jobs-careers','apply-for-job','How do I apply for a job?','வேலைக்கு எவ்வாறு விண்ணப்பிப்பது?','A built-in job application workflow is not currently available.','உள்ளமைந்த job application workflow தற்போது இல்லை.','6'),
 ('jobs-careers','contact-employer','How do I contact an employer?','முதலாளியை எவ்வாறு தொடர்புகொள்வது?','Employer contact through a dedicated jobs module is not currently available.','தனிப்பட்ட jobs module மூலம் employer-ஐத் தொடர்புகொள்ளும் வசதி தற்போது இல்லை.','7'),
 ('jobs-careers','report-suspicious-job','How do I report a suspicious job listing?','சந்தேகமான வேலைப் பட்டியலை எவ்வாறு தெரிவிப்பது?','Because job listings are not currently supported, use the general support route if you see misleading content elsewhere.','வேலைப் பட்டியல்கள் தற்போது ஆதரிக்கப்படாததால், வேறு இடத்தில் தவறான உள்ளடக்கம் இருந்தால் பொதுவான support வழியைப் பயன்படுத்தவும்.','8'),
 ('marketplace','create-marketplace-listing','How do I create a marketplace listing?','Marketplace பட்டியலை எவ்வாறு உருவாக்குவது?','Sign in, open Sell, choose a marketplace category, enter accurate details, and save the listing through the existing workflow.','உள்நுழைந்து Sell-ஐத் திறந்து marketplace category-ஐத் தேர்ந்தெடுத்து சரியான விவரங்களை உள்ளிட்டு சேமிக்கவும்.','3'),
 ('marketplace','upload-product-photos','How do I upload product photos?','பொருள் படங்களை எவ்வாறு பதிவேற்றுவது?','Use the image controls in the marketplace form. Use your own clear photos and avoid private documents.','Marketplace படிவத்தில் உள்ள image கட்டுப்பாட்டைப் பயன்படுத்துங்கள். உங்கள் தெளிவான படங்களை மட்டும் பயன்படுத்தி, தனிப்பட்ட ஆவணங்களைப் பதிவேற்ற வேண்டாம்.','4'),
 ('marketplace','set-selling-price','How do I set the selling price?','விற்பனை விலையை எவ்வாறு அமைப்பது?','Enter the asking price in the marketplace form and review it carefully before publishing. CDM 360 does not process the transaction for you.','Marketplace படிவத்தில் கேட்கும் விலையை உள்ளிட்டு வெளியிடுவதற்கு முன் சரிபார்க்கவும். CDM 360 உங்கள் பரிவர்த்தனையைச் செய்யாது.','5'),
 ('marketplace','find-used-bikes-cars','How do I find used bikes and cars?','பயன்படுத்திய bikes மற்றும் cars-ஐ எவ்வாறு கண்டறிவது?','Browse Marketplace categories and use the available category or search controls.','Marketplace categories-ஐப் பார்த்து கிடைக்கும் category அல்லது search கட்டுப்பாடுகளைப் பயன்படுத்தவும்.','6'),
 ('marketplace','edit-marketplace-listing','How do I edit my listing?','என் பட்டியலை எவ்வாறு திருத்துவது?','Open My listings, choose the item, and use Edit when available.','My listings-ஐத் திறந்து பொருளைத் தேர்வு செய்து கிடைக்கும் Edit வசதியைப் பயன்படுத்துங்கள்.','7'),
 ('marketplace','mark-item-sold','How do I mark an item as sold?','பொருளை விற்றதாக எவ்வாறு குறிக்கலாம்?','Open your marketplace listing and use the status action provided by the current workflow.','உங்கள் marketplace பட்டியலைத் திறந்து தற்போதைய workflow வழங்கும் status செயலைப் பயன்படுத்துங்கள்.','8'),
 ('marketplace','delete-marketplace-listing','How do I delete my listing?','என் பட்டியலை எவ்வாறு நீக்குவது?','Open My listings and use the available delete action after checking that you selected the correct item.','My listings-ஐத் திறந்து சரியான பொருளைத் தேர்வு செய்ததை உறுதிப்படுத்தி கிடைக்கும் delete செயலைப் பயன்படுத்தவும்.','9'),
 ('marketplace','report-suspicious-seller','How do I report suspicious sellers?','சந்தேகமான விற்பனையாளரை எவ்வாறு தெரிவிப்பது?','Use the report action where available and include the listing details. Never share OTPs or send money before verifying a transaction.','கிடைக்கும் report செயலைப் பயன்படுத்தி பட்டியல் விவரங்களை அளிக்கவும். OTP-ஐ பகிர வேண்டாம்; சரிபார்க்காமல் பணம் அனுப்ப வேண்டாம்.','10'),
 ('ai-search','what-is-ai-search','What is CDM 360 AI Search?','CDM 360 AI Search என்றால் என்ன?','It is a natural-language service search that interprets a request and matches it to active local categories and published listings.','இது உங்கள் இயல்பான மொழி கோரிக்கையைப் புரிந்து active உள்ளூர் வகைகள் மற்றும் வெளியிடப்பட்ட பட்டியல்களுடன் பொருத்தும் சேவை தேடல்.','4'),
 ('ai-search','how-ai-understands-request','How does AI understand my request?','AI என் கோரிக்கையை எவ்வாறு புரிந்துகொள்கிறது?','It uses the active category and locality catalogue to identify intent. It does not create businesses or categories.','Active category மற்றும் locality catalogue மூலம் intent-ஐக் கண்டறிகிறது. இது வணிகங்கள் அல்லது வகைகளை உருவாக்காது.','5'),
 ('ai-search','ai-no-results','What happens if AI finds no results?','AI முடிவுகளைக் கண்டறியவில்லை என்றால் என்ன நடக்கும்?','You can adjust the wording, browse categories, or use normal keyword search. Empty results are not replaced with invented businesses.','வார்த்தைகளை மாற்றி முயற்சிக்கலாம், categories-ஐப் பார்க்கலாம் அல்லது normal keyword search பயன்படுத்தலாம். கற்பனை வணிகங்கள் காட்டப்படாது.','6'),
 ('ai-search','ai-vs-normal-search','How is AI Search different from normal search?','AI Search மற்றும் normal search வித்தியாசம் என்ன?','AI Search interprets natural language; normal search uses your words directly. Both use the existing published directory.','AI Search இயல்பான மொழியைப் புரிந்துகொள்ளும்; normal search உங்கள் சொற்களை நேரடியாகப் பயன்படுத்தும். இரண்டும் வெளியிடப்பட்ட directory-ஐப் பயன்படுத்தும்.','7'),
 ('ai-search','ai-search-privacy','Is my search information private?','என் தேடல் தகவல் தனிப்பட்டதா?','Search requests are processed to return results and the system avoids exposing private listing or authentication data. Do not include sensitive personal information in a query.','முடிவுகளை வழங்க தேடல்கள் செயலாக்கப்படுகின்றன; private listing அல்லது authentication தகவல்கள் வெளிப்படுத்தப்படாது. தேடலில் உணர்வான தனிப்பட்ட தகவலை சேர்க்க வேண்டாம்.','8'),
 ('essential-services','find-home-nursing','How do I find home nursing services?','வீட்டு nursing சேவைகளை எவ்வாறு கண்டறிவது?','Open Essential Services and choose the relevant active category, then review the published listings.','Essential Services-ஐத் திறந்து பொருத்தமான active category-ஐத் தேர்வு செய்து வெளியிடப்பட்ட பட்டியல்களைப் பாருங்கள்.','3'),
 ('essential-services','find-emergency-mechanics','How do I find emergency mechanics?','அவசர mechanic சேவைகளை எவ்வாறு கண்டறிவது?','Search Essential Services or AI Search for the relevant published local category. CDM 360 does not dispatch mechanics directly.','Essential Services அல்லது AI Search-ல் பொருத்தமான வெளியிடப்பட்ட உள்ளூர் வகையைத் தேடுங்கள். CDM 360 mechanics-ஐ நேரடியாக அனுப்பாது.','4'),
 ('essential-services','find-local-transport','How do I find local transportation?','உள்ளூர் போக்குவரத்தை எவ்வாறு கண்டறிவது?','Browse the relevant Essential Services category or search by service and locality.','பொருத்தமான Essential Services வகையைப் பாருங்கள் அல்லது சேவை மற்றும் locality மூலம் தேடுங்கள்.','5'),
 ('essential-services','find-funeral-assistance','How do I find funeral assistance services?','இறுதிச்சடங்கு உதவி சேவைகளை எவ்வாறு கண்டறிவது?','Browse the relevant published category and contact providers directly using the public details shown.','பொருத்தமான வெளியிடப்பட்ட வகையைப் பார்த்து காட்டப்படும் பொது விவரங்கள் மூலம் வழங்குநர்களை நேரடியாகத் தொடர்புகொள்ளுங்கள்.','6'),
 ('account-security','manage-my-listings','How do I manage my listings?','என் பட்டியல்களை எவ்வாறு நிர்வகிப்பது?','Use My submissions for service listings and the relevant My listings page for marketplace items.','Service listings-க்கு My submissions-ஐயும் marketplace பொருட்களுக்கு தொடர்புடைய My listings பக்கத்தையும் பயன்படுத்துங்கள்.','5'),
 ('account-security','report-a-problem','How do I report a problem?','சிக்கலை எவ்வாறு தெரிவிப்பது?','Use the support route and include the page or listing involved, what happened, and the time. Never include passwords or OTPs.','Support வழியைப் பயன்படுத்தி பக்கம் அல்லது பட்டியல், நடந்தது, நேரம் ஆகியவற்றைத் தெரிவிக்கவும். கடவுச்சொல் அல்லது OTP-ஐ சேர்க்க வேண்டாம்.','6'),
 ('account-security','personal-information-security','How do I protect my personal information?','தனிப்பட்ட தகவலை எவ்வாறு பாதுகாப்பது?','Share only information needed for a listing, keep credentials private, and review public contact fields before publishing.','பட்டியலுக்குத் தேவையான தகவலை மட்டும் பகிர்ந்து, credentials-ஐ ரகசியமாக வைத்து, வெளியிடுவதற்கு முன் பொது தொடர்பு fields-ஐச் சரிபார்க்கவும்.','7')
)
insert into public.help_articles (category_id, slug, question_en, question_ta, answer_en, answer_ta, article_type, related_route, sort_order, is_featured, is_published)
select c.id,s.slug,s.question_en,s.question_ta,s.answer_en,s.answer_ta,'faq',null,s.sort_order::integer,false,true from seed s join public.help_categories c on c.slug=s.category_slug
on conflict (slug) do update set question_en=excluded.question_en,question_ta=excluded.question_ta,answer_en=excluded.answer_en,answer_ta=excluded.answer_ta,sort_order=excluded.sort_order,is_published=true;

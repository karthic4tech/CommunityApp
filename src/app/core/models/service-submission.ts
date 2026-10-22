export type SubmissionStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'suspended' | 'archived';

export interface SubmissionContactInput {
  contact_type: 'phone' | 'whatsapp' | 'email' | 'website' | 'facebook' | 'instagram' | 'youtube';
  contact_value: string;
  is_public: boolean;
  sort_order: number;
}

export interface SubmissionLocationInput {
  location_id: string;
  coverage_type: 'based_here' | 'serves_here';
}

export interface SubmissionFormInput {
  listingId: string | null;
  providerId: string | null;
  provider: {
    provider_type: 'individual' | 'business' | 'organisation';
    display_name: string;
    description: string | null;
    public_email: string | null;
    website_url: string | null;
    address: string | null;
    postal_code: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  listing: {
    category_id: string;
    title: string;
    description: string;
  };
  contacts: SubmissionContactInput[];
  locations: SubmissionLocationInput[];
  submitForReview: boolean;
}

export interface SubmissionRow {
  id: string;
  provider_id: string;
  category_id: string;
  title: string;
  description: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  published_at: string | null;
  updated_at: string;
  service_providers: {
    id: string;
    owner_user_id: string;
    provider_type: string;
    display_name: string;
    description: string | null;
    verification_status: string;
    public_email: string | null;
    website_url: string | null;
    address: string | null;
    postal_code: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  service_categories: {
    id: string;
    parent_id: string | null;
    name_ta: string;
    name_en: string;
    slug: string;
  } | null;
  listing_contacts?: SubmissionContactInput[];
  listing_locations?: { coverage_type: 'based_here' | 'serves_here'; locations: { id: string; name_ta: string; name_en: string | null } | null }[];
  listing_verification_history?: SubmissionHistoryRow[];
  listing_media?: { sort_order: number; media_assets: { id: string } | null }[];
  service_listing_revisions?: { id: string; version_number: number; status: string; review_notes: string | null; updated_at: string }[];
}

export interface SubmissionHistoryRow {
  id: string;
  decision: string;
  notes: string | null;
  created_at: string;
  reviewer_user_id: string | null;
}

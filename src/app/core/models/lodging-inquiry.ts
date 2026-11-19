export type LodgingQuestionType = 'availability' | 'assisted_booking' | 'booking_instructions' | 'other';
export type LodgingInquiryStatus = 'new' | 'contacted' | 'closed';

export interface LodgingInquiryInput {
  listing_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  question_type: LodgingQuestionType;
  check_in: string | null;
  check_out: string | null;
  guest_count: number | null;
  message: string | null;
}

export interface LodgingInquiry extends LodgingInquiryInput {
  id: string;
  status: LodgingInquiryStatus;
  created_at: string;
  updated_at: string;
  service_listings: {
    title: string;
    service_providers: { display_name: string };
  };
}

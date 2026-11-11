export type ContactRequestStatus = 'new' | 'contacted' | 'closed';

export interface ContactRequest {
  id: string;
  name: string;
  email: string;
  mobile: string;
  message: string;
  status: ContactRequestStatus;
  created_at: string;
}

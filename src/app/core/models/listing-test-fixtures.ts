import { DirectoryLocation, ServiceListing } from './service-listing';

export const listingId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

export function listing(changes: Partial<ServiceListing> = {}): ServiceListing {
  return {
    id: listingId, category_id: 'child', title: 'Plumbing repairs', description: 'Leaks and maintenance', status: 'published',
    service_providers: { id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', display_name: 'Local Plumbing', description: null, verification_status: 'verified', public_email: null, website_url: null },
    listing_locations: [], listing_contacts: [], listing_media: [], ...changes,
  };
}

export const places: DirectoryLocation[] = [
  { id: 'district', parent_id: null, name_ta: 'கடலூர்', name_en: 'Cuddalore', location_type: 'district' },
  { id: 'town', parent_id: 'district', name_ta: 'சிதம்பரம்', name_en: 'Chidambaram', location_type: 'town' },
  { id: 'locality', parent_id: 'town', name_ta: 'பகுதி', name_en: 'Locality', location_type: 'locality' },
];

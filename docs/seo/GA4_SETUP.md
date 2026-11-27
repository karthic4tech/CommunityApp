# Google Analytics 4 setup

GA4 is not active by default. There is no Measurement ID in this repository, and no consent-management UI is currently wired.

## Owner setup

1. Create or select the owner's GA4 property and web data stream.
2. Copy its actual Measurement ID (`G-...`). Do not use a sample ID.
3. Review the site's privacy notice and applicable consent requirements with the owner/legal contact.
4. Implement or approve a consent UI. After explicit analytics consent call `AnalyticsService.setConsent(true)`; on decline/revocation call `setConsent(false)`. Do not call consent-granted automatically on page load.
5. Set `googleAnalyticsMeasurementId` in `src/environments/environment.ts` to the actual ID and rebuild/deploy. The Measurement ID is public configuration; never put a secret in the browser.
6. Leave the value empty to keep GA4 completely inactive. The app continues to function.

## Implemented behavior

- GA loads only with a valid configured ID and explicit consent. Ads storage, ad user data and ad personalization remain denied.
- `send_page_view: false` disables automatic page views. `App` sends one manually sanitized `page_view` per Angular route path; query strings/fragments are removed and UUID path segments are masked.
- Wired event names: `tourism_page_view`, `hotel_listing_view`, `hotel_enquiry_submitted`, and `service_contact_click`.
- `hotel_enquiry_submitted` runs only after the backend insert resolves successfully.
- `cab_listing_view`, `cab_enquiry_submitted` and `advertisement_click` are exposed as allowed event names but are not wired because no corresponding cab enquiry/advertisement workflow was found.
- `bookingConfirmed(idempotencyKey)` is not called by the app. A future trusted workflow may call it only after customer acceptance and partner confirmation. It hashes the key locally for duplicate prevention and sends no key or booking reference to GA.
- No event parameters accept names, phone numbers, email addresses, message text, free-text searches, private booking references or other customer details. Page URLs omit query values.

## Test after owner configuration

1. Confirm the consent UI's accept, decline and revoke paths.
2. With consent declined or the ID empty, verify no request to `googletagmanager.com` is made.
3. With consent granted, use GA4 **Realtime** and **DebugView**. Navigate between routes and verify exactly one `page_view` for each distinct path.
4. Submit a test hotel enquiry and verify the event appears only after backend success. Confirm failure cases emit no submission event.
5. Confirm parameters do not include PII, query values, message text or booking IDs.
6. Test page reload/duplicate booking confirmation against the authorized booking workflow before enabling `booking_confirmed`.

No GA property, Measurement ID, consent signal, live event or conversion was configured or verified by this code change.

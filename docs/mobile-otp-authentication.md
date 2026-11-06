# CDM 360 mobile OTP authentication

The Angular application uses Supabase Auth SMS OTP. No SMS credentials or service-role keys are stored in the frontend.

## Supabase Dashboard configuration

1. Open the CDM 360 Supabase project.
2. Go to **Authentication → Sign In / Providers → Phone**.
3. Enable phone authentication.
4. Configure an SMS provider supported by Supabase and add its credentials in the Supabase Dashboard only.
5. Configure the SMS template and confirm that it includes the OTP variable required by Supabase.
6. Review OTP expiry and rate-limit settings for the expected production traffic.
7. Send a real test SMS from the production project before release.

The application validates and normalizes phone numbers in the browser, but Supabase remains the authority for OTP generation, delivery, expiry, rate limiting, session creation, and authorization.

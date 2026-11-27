// Public browser configuration only. Never use a Supabase service-role key here.
export const environment = {
  supabaseUrl: 'https://avgvkymmzclckazxglli.supabase.co',
  supabasePublishableKey: 'sb_publishable_Fkk4ChSd_0_PJVhBjCuHVg__Xg9a1Xq',
  // Public IDs only. AnalyticsService additionally requires production mode
  // and explicit consent before it loads the GTM container.
  googleTagManagerId: 'GTM-5FG93SJC',
  googleAnalyticsMeasurementId: 'G-WWQX1NRF3W',
  googleAnalyticsProductionOrigin: 'https://cdm360.in',
  // Set this to an allow-listed Supabase Auth redirect URL for production.
  supabaseAuthRedirectUrl: '',
  supabasePasswordResetRedirectUrl: '',
};

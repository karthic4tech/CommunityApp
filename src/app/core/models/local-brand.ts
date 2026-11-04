export interface LocalBrand {
  readonly id: string;
  readonly displayName: string;
  readonly featured: boolean;
  readonly featureOrder: number;
  /** Existing public listing used by the provider-detail route. */
  readonly listingId: string;
  readonly logoUrl: string | null;
  readonly logoAlt: string;
}

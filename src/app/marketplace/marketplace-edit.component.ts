import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MarketplaceListingFormComponent } from './marketplace-listing-form.component';

@Component({
  selector: 'app-marketplace-edit',
  imports: [MarketplaceListingFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-marketplace-listing-form [listingId]="listingId" />`,
})
export class MarketplaceEditComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly listingId = this.route.snapshot.paramMap.get('id');
}

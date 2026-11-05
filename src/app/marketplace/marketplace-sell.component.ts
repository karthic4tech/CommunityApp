import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MarketplaceListingFormComponent } from './marketplace-listing-form.component';

@Component({
  selector: 'app-marketplace-sell',
  imports: [MarketplaceListingFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-marketplace-listing-form />`,
})
export class MarketplaceSellComponent {}

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./home/home.component').then((m) => m.LandingComponent) },
      { path: 'services', loadComponent: () => import('./services/services.component').then((m) => m.ServicesComponent) },
      { path: 'service-search', loadComponent: () => import('./services/ai-service-search/ai-service-search.component').then((m) => m.AiServiceSearchComponent) },
      { path: 'services/:categorySlug/:subcategorySlug', loadComponent: () => import('./services/service-listings-page.component').then((m) => m.ServiceListingsPageComponent) },
      { path: 'services/:categorySlug', loadComponent: () => import('./services/service-category-page.component').then((m) => m.ServiceCategoryPageComponent) },
      { path: 'providers/:id', loadComponent: () => import('./services/provider-detail/provider-detail.component').then((m) => m.ProviderDetailComponent) },
    ],
  },
];

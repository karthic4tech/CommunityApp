import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { userGuard } from './core/auth/user.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./home/home.component').then((m) => m.LandingComponent) },
      { path: 'admin/login', loadComponent: () => import('./admin/admin-login.component').then((m) => m.AdminLoginComponent) },
      { path: 'admin/categories/new', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-category-form.component').then((m) => m.AdminCategoryFormComponent) },
      { path: 'admin/categories/:id/edit', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-category-form.component').then((m) => m.AdminCategoryFormComponent) },
      { path: 'admin/categories', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-category-management.component').then((m) => m.AdminCategoryManagementComponent) },
      { path: 'admin/listings/review', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-review.component').then((m) => m.AdminReviewComponent) },
      { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent) },
      { path: 'auth/sign-up', loadComponent: () => import('./auth/auth-sign-up.component').then((m) => m.AuthSignUpComponent) },
      { path: 'auth/sign-in', loadComponent: () => import('./auth/auth-sign-in.component').then((m) => m.AuthSignInComponent) },
      { path: 'auth/verify-email', loadComponent: () => import('./auth/auth-verify-email.component').then((m) => m.AuthVerifyEmailComponent) },
      { path: 'auth/forgot-password', loadComponent: () => import('./auth/auth-forgot-password.component').then((m) => m.AuthForgotPasswordComponent) },
      { path: 'auth/reset-password', loadComponent: () => import('./auth/auth-reset-password.component').then((m) => m.AuthResetPasswordComponent) },
      { path: 'account', canActivate: [userGuard], loadComponent: () => import('./account/account.component').then((m) => m.AccountComponent) },
      { path: 'my-submissions', canActivate: [userGuard], loadComponent: () => import('./services/my-submissions.component').then((m) => m.MySubmissionsComponent) },
      { path: 'services/submit/:id', canActivate: [userGuard], loadComponent: () => import('./services/submit-service.component').then((m) => m.SubmitServiceComponent) },
      { path: 'services/submit', canActivate: [userGuard], loadComponent: () => import('./services/submit-service.component').then((m) => m.SubmitServiceComponent) },
      { path: 'services', loadComponent: () => import('./services/services.component').then((m) => m.ServicesComponent) },
      { path: 'service-search', loadComponent: () => import('./services/ai-service-search/ai-service-search.component').then((m) => m.AiServiceSearchComponent) },
      { path: 'services/:categorySlug/:subcategorySlug', loadComponent: () => import('./services/service-listings-page.component').then((m) => m.ServiceListingsPageComponent) },
      { path: 'services/:categorySlug', loadComponent: () => import('./services/service-category-page.component').then((m) => m.ServiceCategoryPageComponent) },
      { path: 'providers/:id', loadComponent: () => import('./services/provider-detail/provider-detail.component').then((m) => m.ProviderDetailComponent) },
    ],
  },
];

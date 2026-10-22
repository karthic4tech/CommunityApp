import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.refreshAuthorization();

  if (auth.isAuthenticated() && auth.isAdmin()) return true;

  return router.createUrlTree(['/admin/login'], {
    queryParams: auth.isAuthenticated()
      ? { reason: 'forbidden' }
      : { returnUrl: state.url },
  });
};

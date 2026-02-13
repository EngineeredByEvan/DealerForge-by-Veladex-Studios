export type PlatformRole = 'NONE' | 'OPERATOR' | 'ADMIN';
export type DealershipRole = 'ADMIN' | 'MANAGER' | 'SALES' | 'BDC';

export type AuthorizedUser = {
  platformRole: PlatformRole;
  dealerships: { dealershipId: string; role: DealershipRole | string }[];
};

const AUTHENTICATED_ROUTES = ['/dashboard'];
const SALES_ROUTES = ['/leads', '/tasks', '/appointments'];
const MANAGER_ROUTES = ['/reports'];
const INTEGRATIONS_ROUTES = ['/settings/integrations', '/integrations'];

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function getDealershipRole(user: AuthorizedUser, dealershipId: string): DealershipRole | null {
  const membership = user.dealerships.find((item) => item.dealershipId === dealershipId);
  if (!membership) {
    return null;
  }

  if (membership.role === 'ADMIN' || membership.role === 'MANAGER' || membership.role === 'SALES' || membership.role === 'BDC') {
    return membership.role;
  }

  return null;
}

export function canAccess(pathname: string, user: AuthorizedUser | null, dealershipId: string | null): boolean {
  if (!user) {
    return false;
  }

  if (pathname === '/' || pathname === '/login') {
    return true;
  }

  if (matchesRoute(pathname, AUTHENTICATED_ROUTES)) {
    return true;
  }

  const dealershipRole = dealershipId ? getDealershipRole(user, dealershipId) : null;

  if (matchesRoute(pathname, SALES_ROUTES)) {
    return dealershipRole === 'SALES' || dealershipRole === 'BDC' || dealershipRole === 'MANAGER' || dealershipRole === 'ADMIN';
  }

  if (matchesRoute(pathname, MANAGER_ROUTES)) {
    return user.platformRole === 'OPERATOR' || user.platformRole === 'ADMIN' || dealershipRole === 'MANAGER' || dealershipRole === 'ADMIN';
  }

  if (matchesRoute(pathname, INTEGRATIONS_ROUTES)) {
    return user.platformRole === 'OPERATOR' || user.platformRole === 'ADMIN' || dealershipRole === 'ADMIN';
  }

  return true;
}

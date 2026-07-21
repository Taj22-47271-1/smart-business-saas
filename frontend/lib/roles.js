export const PLATFORM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  USER: "USER",
};

export const BUSINESS_ROLES = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  ACCOUNTANT: "ACCOUNTANT",
  STAFF: "STAFF",
  EMPLOYEE: "EMPLOYEE", // legacy role; migrations convert it to STAFF
};

export const ALL_BUSINESS_ROLES = Object.values(BUSINESS_ROLES);
export const MANAGEMENT_ROLES = [
  BUSINESS_ROLES.OWNER,
  BUSINESS_ROLES.MANAGER,
];
export const FINANCE_ROLES = [
  BUSINESS_ROLES.OWNER,
  BUSINESS_ROLES.MANAGER,
  BUSINESS_ROLES.ACCOUNTANT,
];

export function getActiveMembership(user, businessId) {
  return (user?.business_memberships || []).find(
    (membership) =>
      membership.status === "ACTIVE" &&
      String(membership.business_id) === String(businessId)
  );
}

export function hasActiveBusinessRole(user, businessId, roles) {
  const membership = getActiveMembership(user, businessId);
  return Boolean(membership && roles.includes(membership.role));
}

export function getActiveBusinessRoles(user) {
  return new Set(
    (user?.business_memberships || [])
      .filter((membership) => membership.status === "ACTIVE")
      .map((membership) => membership.role)
  );
}

export function getLandingRoute(user) {
  if (!user) return "/login";
  if (user.role === PLATFORM_ROLES.SUPER_ADMIN) return "/admin/payments";

  const roles = getActiveBusinessRoles(user);
  if (
    roles.has(BUSINESS_ROLES.OWNER) ||
    roles.has(BUSINESS_ROLES.MANAGER) ||
    roles.has(BUSINESS_ROLES.ACCOUNTANT)
  ) {
    return "/dashboard";
  }
  if (
    roles.has(BUSINESS_ROLES.STAFF) ||
    roles.has(BUSINESS_ROLES.EMPLOYEE)
  ) return "/sales";
  return "/business";
}

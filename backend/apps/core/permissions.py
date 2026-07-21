from django.db.models import Q
from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.accounts.models import UserRole
from apps.businesses.models import (
    Business,
    BusinessMember,
    BusinessMemberRole,
    BusinessMemberStatus,
)
ALL_BUSINESS_ROLES = (
    BusinessMemberRole.OWNER,
    BusinessMemberRole.MANAGER,
    BusinessMemberRole.ACCOUNTANT,
    BusinessMemberRole.STAFF,
    BusinessMemberRole.EMPLOYEE,
)

MANAGEMENT_ROLES = (
    BusinessMemberRole.OWNER,
    BusinessMemberRole.MANAGER,
)

FINANCE_ROLES = (
    BusinessMemberRole.OWNER,
    BusinessMemberRole.MANAGER,
    BusinessMemberRole.ACCOUNTANT,
)

STAFF_ROLES = (BusinessMemberRole.STAFF, BusinessMemberRole.EMPLOYEE)


def get_business_id_from_request(request, view):
    return (
        view.kwargs.get("business_id")
        or request.data.get("business_id")
        or request.query_params.get("business_id")
        or request.query_params.get("business")
    )


def is_super_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.role == UserRole.SUPER_ADMIN)
    )


def get_active_membership(user, business):
    if not user or not user.is_authenticated or is_super_admin(user):
        return None

    business_id = business.pk if isinstance(business, Business) else business
    return BusinessMember.objects.filter(
        user=user,
        business_id=business_id,
        status=BusinessMemberStatus.ACTIVE,
    ).first()


def user_has_business_role(user, business, *roles):
    if not user or not user.is_authenticated or is_super_admin(user):
        return False

    business_id = business.pk if isinstance(business, Business) else business

    # Backward compatibility: older project databases may have Business.owner
    # but no OWNER BusinessMember row. The owner must never lose access because
    # of that historical data shape.
    if BusinessMemberRole.OWNER in roles and Business.objects.filter(
        pk=business_id,
        owner=user,
        is_active=True,
    ).exists():
        return True

    membership = get_active_membership(user, business_id)
    return bool(membership and membership.role in roles)


def is_business_owner(user, business=None):
    if business is None:
        return BusinessMember.objects.filter(
            user=user,
            role=BusinessMemberRole.OWNER,
            status=BusinessMemberStatus.ACTIVE,
        ).exists()
    return user_has_business_role(user, business, BusinessMemberRole.OWNER)


def is_business_employee(user, business):
    # Backward-compatible helper: limited staff and legacy employees.
    return user_has_business_role(user, business, *STAFF_ROLES)


def get_user_business_queryset(user):
    if not user or not user.is_authenticated or is_super_admin(user):
        return Business.objects.none()

    return Business.objects.filter(
        Q(owner=user)
        | Q(
            memberships__user=user,
            memberships__status=BusinessMemberStatus.ACTIVE,
        )
    ).distinct()


def user_can_access_business(user, business):
    if not user or not user.is_authenticated or is_super_admin(user):
        return False

    business_id = business.pk if isinstance(business, Business) else business
    if Business.objects.filter(pk=business_id, owner=user, is_active=True).exists():
        return True

    return get_active_membership(user, business_id) is not None


def user_can_access_business_id(user, business_id):
    if not business_id:
        return True
    return user_can_access_business(user, business_id)


class IsSuperAdmin(BasePermission):
    message = "Only SuperAdmin can perform this action."

    def has_permission(self, request, view):
        return is_super_admin(request.user)


class IsBusinessOwner(BasePermission):
    message = "Only an active business owner can perform this action."

    def has_permission(self, request, view):
        business_id = get_business_id_from_request(request, view)
        if not request.user or not request.user.is_authenticated or is_super_admin(request.user):
            return False
        if not business_id:
            return True
        return user_has_business_role(request.user, business_id, BusinessMemberRole.OWNER)

    def has_object_permission(self, request, view, obj):
        business = getattr(obj, "business", obj)
        return user_has_business_role(request.user, business, BusinessMemberRole.OWNER)


class IsBusinessOwnerOrSuperAdmin(BasePermission):
    """For platform-safe resources only; never use this on private operations."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if is_super_admin(request.user):
            return True
        business = getattr(obj, "business", obj)
        return user_has_business_role(request.user, business, BusinessMemberRole.OWNER)


class HasBusinessAccess(BasePermission):
    message = "You do not have active membership for this business."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or is_super_admin(request.user):
            return False
        business_id = get_business_id_from_request(request, view)
        return not business_id or user_can_access_business_id(request.user, business_id)

    def has_object_permission(self, request, view, obj):
        return user_can_access_business(request.user, getattr(obj, "business", obj))


class HasActiveBusinessSubscription(HasBusinessAccess):
    message = "Your free trial or subscription has expired. Please subscribe to continue."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        business_id = get_business_id_from_request(request, view)
        if not business_id or request.method in SAFE_METHODS:
            return True
        business = Business.objects.filter(id=business_id).select_related("subscription").first()
        return bool(business and getattr(business, "subscription", None) and business.subscription.has_access)

    def has_object_permission(self, request, view, obj):
        if not super().has_object_permission(request, view, obj):
            return False
        if request.method in SAFE_METHODS:
            return True
        business = getattr(obj, "business", obj)
        return bool(getattr(business, "subscription", None) and business.subscription.has_access)


class BusinessRolePermission(BasePermission):
    safe_roles = ALL_BUSINESS_ROLES
    write_roles = (BusinessMemberRole.OWNER,)

    def roles_for_request(self, request, view):
        return self.safe_roles if request.method in SAFE_METHODS else self.write_roles

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or is_super_admin(request.user):
            return False
        business_id = get_business_id_from_request(request, view)
        if not business_id:
            return True  # Detail querysets and object checks still enforce membership.
        return user_has_business_role(
            request.user, business_id, *self.roles_for_request(request, view)
        )

    def has_object_permission(self, request, view, obj):
        business = getattr(obj, "business", obj)
        return user_has_business_role(
            request.user, business, *self.roles_for_request(request, view)
        )


class CanManageProducts(BusinessRolePermission):
    write_roles = MANAGEMENT_ROLES


class CanManageStock(BusinessRolePermission):
    def roles_for_request(self, request, view):
        if request.method in SAFE_METHODS:
            return self.safe_roles
        if view.__class__.__name__ == "StockTransactionCreateView":
            return MANAGEMENT_ROLES + STAFF_ROLES
        return MANAGEMENT_ROLES


class CanManageSales(BusinessRolePermission):
    def roles_for_request(self, request, view):
        if request.method in SAFE_METHODS:
            return self.safe_roles
        if view.__class__.__name__ == "SaleCreateView":
            return MANAGEMENT_ROLES + STAFF_ROLES
        if view.__class__.__name__ == "SalePaymentListCreateView":
            return FINANCE_ROLES + STAFF_ROLES
        return MANAGEMENT_ROLES


class CanManageCustomers(BusinessRolePermission):
    employee_create_views = {"CustomerCreateView", "CustomerPaymentCreateView"}

    def roles_for_request(self, request, view):
        if request.method in SAFE_METHODS:
            return self.safe_roles
        if view.__class__.__name__ in self.employee_create_views:
            return MANAGEMENT_ROLES + STAFF_ROLES + (BusinessMemberRole.ACCOUNTANT,)
        return MANAGEMENT_ROLES


class CanManageExpenses(BusinessRolePermission):
    def roles_for_request(self, request, view):
        if request.method in SAFE_METHODS:
            return self.safe_roles
        if view.__class__.__name__ == "ExpenseCreateView":
            return FINANCE_ROLES + STAFF_ROLES
        return FINANCE_ROLES


class CanViewReports(BasePermission):
    message = "Business reports are available to owners, managers, and accountants."

    def has_permission(self, request, view):
        business_id = get_business_id_from_request(request, view)
        return bool(
            business_id
            and user_has_business_role(request.user, business_id, *FINANCE_ROLES)
        )

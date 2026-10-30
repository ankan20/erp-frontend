import { getLocalStorage }
from "@/lib/localStorage";

// used for every other module
// except settings and master
// they have separate logics

export const getPageAccess = ({
  pageCode,
  pageType,
  defaultToAllowed = false,
}) => {

  const permissions =
    getLocalStorage(
      "permissions"
    ) || {};

  let canView =
    permissions?.[
      `${pageCode}.VIEW`
    ];

  let canEdit =
    permissions?.[
      `${pageCode}.EDIT`
    ];

  let canApprove =
    permissions?.[
      `${pageCode}.APPROVER`
    ];

  let hasAccess =
    canView ||
    canEdit ||
    canApprove;

  // NO ACCESS — if defaultToAllowed, treat as full edit access (for new/unconfigured modules)

  if (!hasAccess) {
    if (defaultToAllowed) {
      canView = true;
      canEdit = true;
      hasAccess = true;
    } else {
      return {
        allowed: false,
      };
    }
  }

  // LIST PAGE

  if (pageType === "LIST") {

    return {

      allowed: true,

      // SHOW ADD BUTTON
      canAdd: !!canEdit,

      // TABLE ROW CLICK
      canOpenDetails: true,

      canApprove,

      mode: "list",
    };
  }

  // ADD PAGE

  if (pageType === "ADD") {

    // ONLY EDIT USERS
    if (!canEdit) {

      return {
        allowed: false,
      };
    }

    return {

      allowed: true,

      disabled: false,

      mode: "create",

      canApprove: false,
    };
  }

  // EDIT/DETAIL PAGE

  if (
    pageType === "EDIT"
  ) {

    return {

      allowed: true,

      // ONLY EDIT CAN MODIFY
      disabled: !canEdit,

      // APPROVAL BUTTON
      canApprove,

      mode:
        canEdit
          ? "edit"
          : canApprove
            ? "approver"
            : "view",
    };
  }

  return {
    allowed: false,
  };
};
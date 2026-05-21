import { getLocalStorage }
from "@/lib/localStorage";

// used for every other module
// except settings and master
// they have separate logics

export const getPageAccess = ({
  pageCode,
  pageType,
}) => {

  const permissions =
    getLocalStorage(
      "permissions"
    ) || {};

  const canView =
    permissions?.[
      `${pageCode}.VIEW`
    ];

  const canEdit =
    permissions?.[
      `${pageCode}.EDIT`
    ];

  const canApprove =
    permissions?.[
      `${pageCode}.APPROVER`
    ];

  const hasAccess =
    canView ||
    canEdit ||
    canApprove;

  // NO ACCESS

  if (!hasAccess) {

    return {
      allowed: false,
    };
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
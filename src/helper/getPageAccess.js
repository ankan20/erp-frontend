import { getLocalStorage } from "@/lib/localStorage";

export const getPageAccess = (
  pageCode
) => {

  const permissions = getLocalStorage("permissions") || {};

  const pageRoles = getLocalStorage("pageRoles") || {};

  // NORMAL PERMISSIONS
  const canView =
    permissions?.[
      `${pageCode}.VIEW`
    ];

  const canEditPage =
    permissions?.[
      `${pageCode}.EDIT`
    ];

  // SPECIAL ROLES
  const isCreator =
    pageRoles?.[
      `${pageCode}.CREATOR`
    ];

  const isApprover =
    pageRoles?.[
      `${pageCode}.APPROVER`
    ];

  // CREATOR

  if (isCreator) {

    return {
      allowed: true,

      // FULL EDIT MODE
      disabled: false,

      mode: "EDIT",

      canApprove: false,

      isCreator: true,
      isApprover: false,
    };
  }

  // APPROVER

  if (isApprover) {

    return {
      allowed: true,

      // READONLY
      disabled: true,

      mode: "APPROVER",

      canApprove: true,

      isCreator: false,
      isApprover: true,
    };
  }

  // VIEW / EDIT PAGE ACCESS

  if (
    canView ||
    canEditPage
  ) {

    return {
      allowed: true,

      // READONLY
      disabled: true,

      mode: "VIEW",

      canApprove: false,

      isCreator: false,
      isApprover: false,
    };
  }

  // NO ACCESS

  return {
    allowed: false,

    disabled: true,

    mode: "NO_ACCESS",

    canApprove: false,

    isCreator: false,
    isApprover: false,
  };
};
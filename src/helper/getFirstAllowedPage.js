export const getFirstAllowedPage = (
  sidebarConfig,
  permissions
) => {

  const findFirstPath = (
    items
  ) => {

    for (const item of items) {

      if (
        item.permissionKey &&
        item.path
      ) {

        const canAccess =
          permissions[
            `${item.permissionKey}.VIEW`
          ] ||
          permissions[
            `${item.permissionKey}.EDIT`
          ]; //have to add if only approve there

        if (canAccess) {
          return item.path;
        }
      }

      if (item.children) {

        const nested =
          findFirstPath(
            item.children
          );

        if (nested) {
          return nested;
        }
      }
    }

    return null;
  };

  return findFirstPath(
    sidebarConfig
  );
};
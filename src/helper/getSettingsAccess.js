import { getCookie }
from "@/lib/cookies";

import { ROLE }
from "@/config/role.config";

export const canAccessSettings =
  () => {

    const role =
      getCookie("role");

    return (
      role ===
      ROLE.SUPER_ADMIN
    );
};
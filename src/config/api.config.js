const API_BASE_URL = "http://167.233.108.123:8000"; //change here later

export const API_ENDPOINTS = {
  LOGIN: "/auth/login",
  GET_COMPANIES: "/compny/my-companies", //only for super admin
  GET_PROJECT_PERMISSION: "/project/enter", //projectcode
  SETTINGS: {
    CREATE_COMPANY: "/compny/company", //used for update also
    GET_COMPANY_DETAILS_BY_ID: "/compny/company",
    GET_ALL_USERS: "/setting/users",
    GET_USER_BY_ID: "/setting/user", //get /put
    CREATE_USER: "/setting/create-user", //used for update also,
    GET_ALL_PROJECTS: "/setting/project-list",
    CREATE_PROJECT: "/setting/create-project",
    GET_PROJECT_BY_ID: "/setting/project", //get and put for update
    ADD_DESIGNATION: "/setting/designation",
    UPDATE_PROJECT_ROLES: "/setting/project-role", //project code also used for get
    DELETE_ROLE: "/setting/delete-project-designation", //delete

    PROJECT_LOCATION: "/setting/project-location",

    APPROVAL_PATH: {
      SAVE: "/setting/approval-path",
      GET_USERS_BY_PROJECT: "/setting/users",
      LIST: "/setting/approval-path/list",
      EDIT_USERS: "/setting/edit-users",
    },
  },
  MASTER: {
    CREATE_GROUP: "/master/group/create",
    UPDATE_GROUP_BY_ID: "/master/group/update", //id
    GET_ALL_GROUP: "/master/group/list",
    CREATE_CATEGORY: "/master/category/create",
    UPDATE_CATEGORY_BY_ID: "/master/category/update",
    GET_ALL_CATEGORY: "/master/category/list",
    GET_ALL_CC_CODE: "/master/cc-code/list",
    GET_CC_CODE_BY_ID: "/master/cc-code",
    CREATE_CC_CODE: "/master/cc-code/create",
    UPDATE_CC_CODE_BY_ID: "/master/cc-code/update",
    //ledger
    GET_ALL_LEDGER: "/master/ledger/list",
    CREATE_LEDGER: "/master/ledger/create",
    GET_LEDGER_BY_ID: "/master/ledger",
    UPDATE_LEDGER_BY_ID: "/master/ledger/update",
    //item
    GET_ALL_ITEM: "/master/item/list",
    GET_ITEM_BY_ID: "/master/item",
    UPDATE_ITEM_BY_ID: "/master/item/update",
    CREATE_ITEM: "/master/item/create",
    //asset
    GET_ALL_ASSET: "/master/asset/list",
    GET_ASSET_BY_ID: "/master/asset",
    UPDATE_ASSET_BY_ID: "/master/asset/update",
    CREATE_ASSET: "/master/asset/create",
    //unit
    GET_ALL_UNIT: "/master/unit/list", //unitType ,categoryId filter options
    CREATE_UNIT: "/master/unit/create",
    UPDATE_UNIT_BY_ID: "/master/unit/update", //unitId
    GET_UNIT_BY_ID: "/master/unit", //unitId

    TERM: {
      CREATE: "/master/term/create",
      LIST: "/master/term/list",
      GET_BY_ID: "/master/term",
      UPDATE: "/master/term/update",
      DELETE: "/master/term/delete",
    },
    BANK_CASH: {
      LIST:      "/master/bank-cash/list",
      CREATE:    "/master/bank-cash/create",
      GET_BY_ID: "/master/bank-cash",       // /<id>
      UPDATE:    "/master/bank-cash/update", // /<id>
      DELETE:    "/master/bank-cash/delete", // /<id>
    },
  },
  // resource/indent
  RESOURCE: {
    PROCUREMENT: {
      INDENT: {
        GET_ALL_INDENT: "/resource/indent/list",
        CREATE_INDENT: "/resource/indent/create",
        GET_INDENT_BY_ID: "/resource/indent/", //id
        UPDATE_INDENT_BY_ID: "/resource/indent/update/", //id ,put
        SUBMIT_INDENT_BY_ID: "/resource/indent/submit/", //id ,post
        GET_ITEMS_BY_CATEGORY: "/resource/indent/items-by-category", //?categoryCode=CAT001 get
        APPROVE: "/resource/indent/approve", //indenId POST
        REBACK: "/resource/indent/reback", //indenId POST
        REJECT: "/resource/indent/reject", //indenId POST
        DELETE: "/resource/indent/delete", //indentId DELETE
        HISTORY: "/resource/indent/history", //indentId GET
      },
      ORDER: {
        GET_ALL_ORDER: "/resource/order/list",
        CREATE_ORDER: "/resource/order/create",
        GET_ORDER_BY_ID: "/resource/order/details", //id
        UPDATE_ORDER_BY_ID: "/resource/order/edit/", //id ,put
        SUBMIT_ORDER_BY_ID: "/resource/order/submit/", //id ,post
        GET_ITEMS_BY_CATEGORY: "/resource/order/items-by-category", //?categoryCode=CAT001 get
        GET_INDENT_LIST: "/resource/order/indent-pending", //projectCode subCategoryCode
        APPROVE: "/resource/order/approve", //orderId POST
        REBACK: "/resource/order/reback", //orderId POST
        REJECT: "/resource/order/reject", //orderId POST
        DELETE: "/resource/order/delete", //orderId DELETE
        HISTORY: "/resource/order/history", //orderId GET
        PROJECT_WORK: {
          GET_ALL_ORDER: "/resource/pw-order/list", //projectCode GET
          CREATE_ORDER: "/resource/pw-order/create",
          GET_ORDER_BY_ID: "/resource/pw-order/details", //id
          UPDATE_ORDER_BY_ID: "/resource/pw-order/edit/", //id ,put
          SUBMIT_ORDER_BY_ID: "/resource/pw-order/submit/", //id ,post
          GET_ITEM_LIST: "/resource/pw-order/item-list", //projectCode subCodes[] GET
          APPROVE: "/resource/pw-order/approve", //orderId POST
          REBACK: "/resource/pw-order/reback", //orderId POST
          REJECT: "/resource/pw-order/reject", //orderId POST
          DELETE: "/resource/pw-order/delete", //orderId DELETE
          HISTORY: "/resource/pw-order/history", //orderId GET
        },
      },
    },
    VENDOR_BILLING: {
      BSS: {
        GET_VENDOR_ORDERS: "/resource/bss/vendor-orders", // vendorId projectCode receivedCategory itemCategory costHead GET
        GET_SRNS_BY_ORDER: "/resource/bss/srns-by-order", // /:orderId GET
        CREATE_BSS: "/resource/bss/create", // POST JSON
        GET_ALL_BSS: "/resource/bss/list", // GET
        GET_BSS_BY_ID: "/resource/bss/details", // /:bssId GET
        UPDATE_BSS_BY_ID: "/resource/bss/edit", // /:bssId PUT JSON
        SUBMIT_BSS_BY_ID: "/resource/bss/submit", // /:bssId POST
        APPROVE: "/resource/bss/approve", // /:bssId POST
        REBACK: "/resource/bss/reback", // /:bssId POST
        REJECT: "/resource/bss/reject", // /:bssId POST
        HISTORY: "/resource/bss/history", // /:bssId GET
      },
      BVS: {
        GET_VENDOR_ORDERS: "/resource/bvs/vendor-orders", // vendorId projectCode categoryCode costHead GET
        GET_GRNS_BY_ORDER: "/resource/bvs/grns-by-order", // /:orderId GET
        CREATE_BVS: "/resource/bvs/create", // POST JSON
        GET_ALL_BVS: "/resource/bvs/list", // GET
        GET_BVS_BY_ID: "/resource/bvs/details", // /:bvsId GET
        UPDATE_BVS_BY_ID: "/resource/bvs/edit", // /:bvsId PUT JSON
        SUBMIT_BVS_BY_ID: "/resource/bvs/submit", // /:bvsId POST
        APPROVE: "/resource/bvs/approve", // /:bvsId POST
        REBACK: "/resource/bvs/reback", // /:bvsId POST
        REJECT: "/resource/bvs/reject", // /:bvsId POST
        HISTORY: "/resource/bvs/history", // /:bvsId GET
      },
    },
    MACHINERY: {
      LOG_BOOK: {
        GET_PW_ORDERS: "/resource/machinery/log-book/pw-orders",
        CREATE:        "/resource/machinery/log-book/create",
        LIST:          "/resource/machinery/log-book/list",
        DETAILS:       "/resource/machinery/log-book/details",
        EDIT:          "/resource/machinery/log-book/edit",
        SUBMIT:        "/resource/machinery/log-book/submit",
        APPROVE:       "/resource/machinery/log-book/approve",
        REBACK:        "/resource/machinery/log-book/reback",
        REJECT:        "/resource/machinery/log-book/reject",
        HISTORY:       "/resource/machinery/log-book/history",
      },
      LOG_ENTRY: {
        CREATE:  "/resource/machinery/log-entry/create",
        LIST:    "/resource/machinery/log-entry/list",
        DETAILS: "/resource/machinery/log-entry/details",
        EDIT:    "/resource/machinery/log-entry/edit",
        SUBMIT:  "/resource/machinery/log-entry/submit",
        APPROVE: "/resource/machinery/log-entry/approve",
        REBACK:  "/resource/machinery/log-entry/reback",
        REJECT:  "/resource/machinery/log-entry/reject",
        HISTORY: "/resource/machinery/log-entry/history",
      },
    },
    MATERIAL_MANAGEMENT: {
      // resource/gin
      GIN: {
        GET_VENDOR_ORDERS: "/resource/gin/vendor-orders", // vendorId projectCode filters GET
        GET_ORDER_ITEMS: "/resource/gin/order-items", // /:orderId GET
        CREATE_GIN: "/resource/gin/create", // POST multipart/form-data
        GET_ALL_GIN: "/resource/gin/list", // GET
        GET_GIN_BY_ID: "/resource/gin/details", // /:ginId GET
        UPDATE_GIN_BY_ID: "/resource/gin/edit", // /:ginId PUT
        SUBMIT_GIN_BY_ID: "/resource/gin/submit", // /:ginId POST
        APPROVE: "/resource/gin/approve", // /:ginId POST
        REBACK: "/resource/gin/reback", // /:ginId POST
        REJECT: "/resource/gin/reject", // /:ginId POST
        HISTORY: "/resource/gin/history", // /:ginId GET
      },
      //resource/grn
      GRN: {
        GET_VENDOR_ORDERS: "/resource/grn/vendor-orders", // vendorId projectCode filters GET
        GET_ORDER_ITEMS: "/resource/grn/order-items", // /:orderId GET
        CREATE_GRN: "/resource/grn/create", // POST multipart/form-data
        GET_ALL_GRN: "/resource/grn/list", // GET
        GET_GRN_BY_ID: "/resource/grn/details", // /:grnId GET
        UPDATE_GRN_BY_ID: "/resource/grn/edit", // /:grnId PUT
        SUBMIT_GRN_BY_ID: "/resource/grn/submit", // /:grnId POST
        APPROVE: "/resource/grn/approve", // /:grnId POST
        REBACK: "/resource/grn/reback", // /:grnId POST
        REJECT: "/resource/grn/reject", // /:grnId POST
        HISTORY: "/resource/grn/history", // /:grnId GET
      },
      SRN: {
        GET_VENDOR_ORDERS: "/resource/srn/vendor-orders", // vendorId projectCode filters GET
        GET_ORDER_ITEMS: "/resource/srn/order-items", // /:orderId GET pw
        CREATE_SRN: "/resource/srn/create", // POST multipart/form-data
        GET_ALL_SRN: "/resource/srn/list", // GET
        GET_SRN_BY_ID: "/resource/srn/details", // /:srnId GET
        UPDATE_SRN_BY_ID: "/resource/srn/edit", // /:srnId PUT
        SUBMIT_SRN_BY_ID: "/resource/srn/submit", // /:srnId POST
        APPROVE: "/resource/srn/approve", // /:srnId POST
        REBACK: "/resource/srn/reback", // /:srnId POST
        REJECT: "/resource/srn/reject", // /:srnId POST
        HISTORY: "/resource/srn/history", // /:srnId GET
      },
      LOGISTICS: {
        DC: {
          GET_APPROVED_ORDERS: "/resource/dc/approved-orders", // GET ?projectCode&orderType
          GET_ORDER_ITEMS:     "/resource/dc/order-items",     // /:orderId GET
          GET_FROM_DETAILS:    "/resource/dc/from-details",    // /:orderId GET ?currentProjectCode
          CREATE:              "/resource/dc/create",          // POST multipart/form-data
          LIST:                "/resource/dc/list",            // GET ?projectCode&orderType&workflowStatus&search
          GET_BY_ID:           "/resource/dc/detail",          // /:dcId GET
          UPDATE:              "/resource/dc/edit",            // /:dcId PUT
          SUBMIT:              "/resource/dc/submit",          // /:dcId POST
          APPROVE:             "/resource/dc/approve",         // /:dcId POST
          REBACK:              "/resource/dc/reback",          // /:dcId POST
          REJECT:              "/resource/dc/reject",          // /:dcId POST
          HISTORY:             "/resource/dc/history",         // /:dcId GET
        },
      },
    },
  },
  //project-management/register/concrete
  PROJECT: {
    REGISTER: {
      CONCRETE: {
        CREATE: "/project-mgmt/register/concrete-registry/create", //post
        GET_ALL_CONCRETE: "/project-mgmt/register/concrete-registry/list", //get
        GET_DETAILS_BY_ID: "/project-mgmt/register/concrete-registry/list", //reg_id
        UPDATE: "/project-mgmt/register/concrete-registry/update", //registry_id
        SUBMIT:"/project-mgmt/register/concrete-registry/submit",//registry_id
        APPROVE: "/project-mgmt/register/concrete-registry/approve", //indenId POST
        REBACK: "/project-mgmt/register/concrete-registry/reback", //indenId POST
        REJECT: "/project-mgmt/register/concrete-registry/reject", //indenId POST
        DELETE: "/project-mgmt/register/concrete-registry/delete", //indentId DELETE
        HISTORY: "/project-mgmt/register/concrete-registry/history", //indentId GET
      },
      DRAWING_REGISTER: {
        CREATE: "/project-mgmt/register/drawing-register/create", // POST multipart/form-data
        GET_ALL_DRAWING_REGISTER:
          "/project-mgmt/register/drawing-register/list", // GET
        GET_DRAWING_REGISTER_BY_ID:
          "/project-mgmt/register/drawing-register/details", // /:drId GET
        UPDATE_DRAWING_REGISTER_BY_ID:
          "/project-mgmt/register/drawing-register/edit", // /:drId PUT
        SUBMIT_DRAWING_REGISTER_BY_ID:
          "/project-mgmt/register/drawing-register/submit", // /:drId POST
        APPROVE: "/project-mgmt/register/drawing-register/approve", // /:drId POST
        REBACK: "/project-mgmt/register/drawing-register/reback", // /:drId POST
        REJECT: "/project-mgmt/register/drawing-register/reject", // /:drId POST
        HISTORY: "/project-mgmt/register/drawing-register/history", // /:drId GET
      },
    },
  },
};

export default API_BASE_URL;

const API_BASE_URL = "http://132.154.156.82/api"; //change here later

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

    PROJECT_LOCATION: {
      LIST:   "/setting/project-location", // GET  /{projectCode}
      CREATE: "/setting/project-location", // POST
      UPDATE: "/setting/project-location", // PUT  /{locationId}
      DELETE: "/setting/project-location", // DELETE /{locationId}
    },

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
        GET_BY_UUID: "/resource/indent/uuid", // /:uuid GET — no auth required
        MY_APPROVAL_STATUS: "/resource/indent/my-approval-status", // /:id GET
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
        GET_BY_UUID: "/resource/order/uuid", // /:uuid GET — no auth required
        MY_APPROVAL_STATUS: "/resource/order/my-approval-status", // /:id GET
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
          GET_BY_UUID: "/resource/pw-order/uuid", // /:uuid GET — no auth required
          MY_APPROVAL_STATUS: "/resource/pw-order/my-approval-status", // /:id GET
        },
      },
    },
    BILL_RECEIVE_REGISTER: {
      GET_VENDOR_ORDERS: "/billing/brr/vendor-orders", // vendorId projectCode orderCategory GET
      CREATE:            "/billing/brr/create",         // POST FormData
      LIST:              "/billing/brr/list",            // GET projectCode
      DETAILS:           "/billing/brr/details",         // /:brrId GET
      EDIT:              "/billing/brr/edit",            // /:brrId PUT FormData
      SUBMIT:            "/billing/brr/submit",          // /:brrId POST
      APPROVE:           "/billing/brr/approve",         // /:brrId POST
      REBACK:            "/billing/brr/reback",          // /:brrId POST
      REJECT:            "/billing/brr/reject",          // /:brrId POST
      HISTORY:           "/billing/brr/history",         // /:brrId GET
      MY_APPROVAL_STATUS: "/billing/brr/my-approval-status", // /:id GET
    },
    BRB: {
      ITEMS_BY_BRR: "/billing/brb/items-by-brr", // /:brrId GET — returns grns[] or srns[] based on billingType
      CREATE:       "/billing/brb/create",         // POST JSON
      LIST:         "/billing/brb/list",            // GET
      DETAILS:      "/billing/brb/details",         // /:brbId GET
      EDIT:         "/billing/brb/edit",            // /:brbId PUT JSON
      SUBMIT:       "/billing/brb/submit",          // /:brbId POST
      APPROVE:      "/billing/brb/approve",         // /:brbId POST
      REBACK:       "/billing/brb/reback",          // /:brbId POST
      REJECT:       "/billing/brb/reject",          // /:brbId POST
      HISTORY:           "/billing/brb/history",            // /:brbId GET
      MY_APPROVAL_STATUS: "/billing/brb/my-approval-status", // /:id GET
    },
    MACHINERY: {
      PM_ID: {
        CREATE:     "/resource/machinery/pm-id/create",
        LIST:       "/resource/machinery/pm-id/list",
        GET_BY_ID:  "/resource/machinery/pm-id/",      // + id
        GET_BY_UID: "/resource/machinery/pm-id/by-uid/", // + uid
        EDIT:       "/resource/machinery/pm-id/edit/", // + id
      },
      SERVICE_HISTORY: {
        CREATE:    "/resource/machinery/service-history/create",
        LIST:      "/resource/machinery/service-history/list",
        GET_BY_ID: "/resource/machinery/service-history/", // + historyId
        EDIT:      "/resource/machinery/service-history/edit/", // + historyId
      },
      SERVICE_SCHEDULE: {
        CREATE:    "/resource/machinery/service-schedule/create",
        LIST:      "/resource/machinery/service-schedule/list",
        GET_BY_ID: "/resource/machinery/service-schedule/", // + scheduleId
        EDIT:      "/resource/machinery/service-schedule/edit/", // + scheduleId
      },
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
        HISTORY:            "/resource/machinery/log-book/history",
        MY_APPROVAL_STATUS: "/resource/machinery/log-book/my-approval-status", // /:id GET
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
        HISTORY:            "/resource/machinery/log-entry/history",
        MY_APPROVAL_STATUS: "/resource/machinery/log-entry/my-approval-status", // /:id GET
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
        GET_BY_UUID: "/resource/gin/uuid", // /:uuid GET — no auth required
        MY_APPROVAL_STATUS: "/resource/gin/my-approval-status", // /:id GET
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
        GET_BY_UUID: "/resource/grn/uuid", // /:uuid GET — no auth required
        MY_APPROVAL_STATUS: "/resource/grn/my-approval-status", // /:id GET
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
        GET_BY_UUID: "/resource/srn/uuid", // /:uuid GET — no auth required
        MY_APPROVAL_STATUS: "/resource/srn/my-approval-status", // /:id GET
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
          MY_APPROVAL_STATUS:  "/resource/dc/my-approval-status", // /:id GET
        },
      },
      STOCK: {
        LIST:        "/resource/stock/list",        // GET ?project_code&item_category
        ITEM_DETAIL: "/resource/stock/item-detail", // GET ?project_code&item_code
      },
    },
    BATCHING_PLANT: {
      CREATE:             "/resource/batching/create",
      LIST:               "/resource/batching/list",
      DETAILS:            "/resource/batching/details",             // /<id>
      EDIT:               "/resource/batching/edit",                // /<id>
      SUBMIT:             "/resource/batching/submit",              // /<id>
      APPROVE:            "/resource/batching/approve",             // /<id>
      REBACK:             "/resource/batching/reback",              // /<id>
      REJECT:             "/resource/batching/reject",              // /<id>
      DELETE:             "/resource/batching/delete",              // /<id>
      HISTORY:            "/resource/batching/history",             // /<id>
      MY_APPROVAL_STATUS: "/resource/batching/my-approval-status",  // /<id>
      APPROVED_PW_ORDERS: "/resource/batching/approved-pw-orders",  // ?projectCode
      VENDOR_FROM_ORDER:  "/resource/batching/vendor-from-order",   // /<pwOrderId>
      GET_BY_UUID:        "/resource/batching/uuid",                // /<uuid>
    },
    MANPOWER: {
      VENDOR_DROPDOWN: "/master/ledger/dropdown", // GET — returns id, ledgerCode, ledgerName
      LABOUR_ID: {
        LIST:       "/resource/manpower/list",    // GET
        CREATE:     "/resource/manpower/create",  // POST multipart/form-data
        GET_BY_ID:  "/resource/manpower",         // /:workerId GET
        UPDATE:     "/resource/manpower/update",  // /:workerId PUT multipart/form-data
      },
      DLR: {
        LIST:               "/resource/dlr/list",
        CREATE:             "/resource/dlr/create",
        GET_BY_ID:          "/resource/dlr/details",
        UPDATE:             "/resource/dlr/edit",
        SUBMIT:             "/resource/dlr/submit",
        APPROVE:            "/resource/dlr/approve",
        REBACK:             "/resource/dlr/reback",
        REJECT:             "/resource/dlr/reject",
        HISTORY:            "/resource/dlr/history",
        MY_APPROVAL_STATUS: "/resource/dlr/my-approval-status",
        SUMMARY:            "/resource/dlr/summary",
        LABOUR_BY_SUPPLIER: "/resource/dlr/labour-by-supplier",
        VENDOR_ORDERS:      "/resource/dlr/pw-orders-by-supplier",
      },
    },
  },
  SUPPLIER: {
    LIST:               "/master/supplier/list",             // GET ?supplierType= ?supplierName=
    CREATE:             "/master/supplier/create",           // POST
    GET_BY_ID:          "/master/supplier",                  // GET  /<supplierId>
    UPDATE:             "/master/supplier/update",           // PUT  /<supplierId>
    DELETE:             "/master/supplier/delete",           // DELETE /<supplierId>
    LINK_LEDGER:        "/master/supplier",                  // POST /<supplierId>/link-ledger
    UNLINK_LEDGER:      "/master/supplier",                  // DELETE /<supplierId>/unlink-ledger/<ledgerId>
    NATURE_OF_SERVICE:  "/master/supplier/nature-of-service",// GET  /<supplierType>
    BULK_ASSIGN_PROJECTS: "/master/supplier/bulk-assign-projects", // POST
  },

  //project-management/register/concrete
  PROJECT: {
    OG_SALE_ORDER: {
      LIST:               "/project-mgmt/og-sale-order/list",                       // GET ?projectCode&workflowStatus&search
      CREATE:             "/project-mgmt/og-sale-order/create",                     // POST multipart/form-data
      GET_BY_ID:          "/project-mgmt/og-sale-order/",                           // /:id GET
      UPDATE:             "/project-mgmt/og-sale-order/edit/",                      // /:id PUT multipart/form-data
      SUBMIT:             "/project-mgmt/og-sale-order/submit/",                    // /:id POST
      APPROVE:            "/project-mgmt/og-sale-order/approve/",                   // /:id POST
      REBACK:             "/project-mgmt/og-sale-order/reback/",                    // /:id POST
      REJECT:             "/project-mgmt/og-sale-order/reject/",                    // /:id POST
      HISTORY:            "/project-mgmt/og-sale-order/history/",                   // /:id GET
      MY_APPROVAL_STATUS: "/project-mgmt/og-sale-order/my-approval-status/",        // /:id GET
      GET_BY_UUID:        "/project-mgmt/og-sale-order/uuid/",                      // /:uuid GET no-auth
    },
    SALE_CLAIM_BILL: {
      LIST:               "/project-mgmt/billing/list",                             // GET ?projectCode&mode=sale_order_bill
      CREATE:             "/project-mgmt/billing/create",                           // POST
      GET_BY_ID:          "/project-mgmt/billing/",                                 // /:id GET
      GET_BY_UUID:        "/project-mgmt/billing/uuid/",                            // /:uuid GET no-auth
      UPDATE:             "/project-mgmt/billing/edit/",                            // /:id PUT
      SUBMIT:             "/project-mgmt/billing/submit/",                          // /:id POST
      APPROVE:            "/project-mgmt/billing/approve/",                         // /:id POST
      REBACK:             "/project-mgmt/billing/reback/",                          // /:id POST
      REJECT:             "/project-mgmt/billing/reject/",                          // /:id POST
      HISTORY:            "/project-mgmt/billing/history/",                         // /:id GET
      MY_APPROVAL_STATUS: "/project-mgmt/billing/my-approval-status/",              // /:id GET
      ORDER_LOOKUP:       "/project-mgmt/billing/order-lookup",                     // GET ?ogSaleOrderNo&projectCode&mode
    },
    EXTRA_WORK: {
      LIST:               "/project-mgmt/extra-work/",                              // GET ?projectCode&workflowStatus&search
      CREATE:             "/project-mgmt/extra-work/create",                        // POST multipart/form-data
      GET_BY_ID:          "/project-mgmt/extra-work/",                              // /:id GET
      UPDATE:             "/project-mgmt/extra-work/edit/",                         // /:id PUT multipart/form-data
      SUBMIT:             "/project-mgmt/extra-work/submit/",                       // /:id POST
      APPROVE:            "/project-mgmt/extra-work/approve/",                      // /:id POST
      REBACK:             "/project-mgmt/extra-work/reback/",                       // /:id POST
      REJECT:             "/project-mgmt/extra-work/reject/",                       // /:id POST
      HISTORY:            "/project-mgmt/extra-work/history/",                      // /:id GET
      MY_APPROVAL_STATUS: "/project-mgmt/extra-work/my-approval-status/",           // /:id GET
      GET_BY_UUID:        "/project-mgmt/extra-work/uuid/",                         // /:uuid GET no-auth
    },
    SALE_CERTIFIED_BILL: {
      LIST:               "/project-mgmt/billing/list",                             // GET ?projectCode&mode=certified_bill
      CREATE:             "/project-mgmt/billing/create",                           // POST
      GET_BY_ID:          "/project-mgmt/billing/",                                 // /:id GET
      GET_BY_UUID:        "/project-mgmt/billing/uuid/",                            // /:uuid GET no-auth
      UPDATE:             "/project-mgmt/billing/edit/",                            // /:id PUT
      SUBMIT:             "/project-mgmt/billing/submit/",                          // /:id POST
      APPROVE:            "/project-mgmt/billing/approve/",                         // /:id POST
      REBACK:             "/project-mgmt/billing/reback/",                          // /:id POST
      REJECT:             "/project-mgmt/billing/reject/",                          // /:id POST
      HISTORY:            "/project-mgmt/billing/history/",                         // /:id GET
      MY_APPROVAL_STATUS: "/project-mgmt/billing/my-approval-status/",              // /:id GET
      ORDER_LOOKUP:       "/project-mgmt/billing/order-lookup",                     // GET ?ogSaleOrderNo&projectCode&mode
    },
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
        MY_APPROVAL_STATUS: "/project-mgmt/register/concrete-registry/my-approval-status", // /:id GET
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
        MY_APPROVAL_STATUS: "/project-mgmt/register/drawing-register/my-approval-status", // /:id GET
      },
      HINDRANCE_REGISTER: {
        CREATE:             "/project-mgmt/register/hindrance-register/create",             // POST multipart/form-data
        LIST:               "/project-mgmt/register/hindrance-register/list",               // GET ?projectCode
        GET_BY_ID:          "/project-mgmt/register/hindrance-register/details",            // /:id GET
        GET_BY_UUID:        "/project-mgmt/register/hindrance-register/uuid",               // /:uuid GET no-auth
        UPDATE:             "/project-mgmt/register/hindrance-register/edit",               // /:id PUT multipart/form-data
        SUBMIT:             "/project-mgmt/register/hindrance-register/submit",             // /:id POST
        APPROVE:            "/project-mgmt/register/hindrance-register/approve",            // /:id POST
        REBACK:             "/project-mgmt/register/hindrance-register/reback",             // /:id POST
        REJECT:             "/project-mgmt/register/hindrance-register/reject",             // /:id POST
        DELETE:             "/project-mgmt/register/hindrance-register/delete",             // /:id DELETE
        HISTORY:            "/project-mgmt/register/hindrance-register/history",            // /:id GET
        MY_APPROVAL_STATUS: "/project-mgmt/register/hindrance-register/my-approval-status", // /:id GET
      },
      BBS_REGISTER: {
        CREATE:             "/project-mgmt/register/bbs-register/create",              // POST multipart/form-data
        LIST:               "/project-mgmt/register/bbs-register/list",               // GET ?projectCode
        GET_BY_ID:          "/project-mgmt/register/bbs-register/details",            // /:id GET
        GET_BY_UUID:        "/project-mgmt/register/bbs-register/uuid",               // /:uuid GET — no auth
        UPDATE:             "/project-mgmt/register/bbs-register/edit",               // /:id PUT multipart/form-data
        SUBMIT:             "/project-mgmt/register/bbs-register/submit",             // /:id POST
        APPROVE:            "/project-mgmt/register/bbs-register/approve",            // /:id POST
        REBACK:             "/project-mgmt/register/bbs-register/reback",             // /:id POST
        REJECT:             "/project-mgmt/register/bbs-register/reject",             // /:id POST
        DELETE:             "/project-mgmt/register/bbs-register/delete",             // /:id DELETE
        HISTORY:            "/project-mgmt/register/bbs-register/history",            // /:id GET
        MY_APPROVAL_STATUS: "/project-mgmt/register/bbs-register/my-approval-status", // /:id GET
      },
    },
  },
  FINANCE: {
    SALE_BILL: {
      CERTIFIED_BILLS:      "/finance/sale-bill/certified-bills",        // GET ?ogSaleOrderNo&projectCode
      CERTIFIED_BILL_ITEMS: "/finance/sale-bill/certified-bill-items",   // GET ?certifiedBillId&projectCode
      CREATE:               "/finance/sale-bill/create",                  // POST JSON
      LIST:                 "/finance/sale-bill/list",                    // GET ?projectCode&mode&workflowStatus&search
      GET_BY_ID:            "/finance/sale-bill/",                        // /:id GET
      EDIT:                 "/finance/sale-bill/edit/",                   // /:id PUT JSON
      SUBMIT:               "/finance/sale-bill/submit/",                 // /:id POST
      APPROVE:              "/finance/sale-bill/approve/",                // /:id POST
      REBACK:               "/finance/sale-bill/reback/",                 // /:id POST
      REJECT:               "/finance/sale-bill/reject/",                 // /:id POST
      HISTORY:              "/finance/sale-bill/history/",                // /:id GET
      MY_APPROVAL_STATUS:   "/finance/sale-bill/my-approval-status/",     // /:id GET
      GET_BY_UUID:          "/finance/sale-bill/uuid/",                   // /:uuid GET no-auth
    },
    PURCHASE_BILL: {
      VENDOR_ORDERS: "/finance/purchase-bill/vendor-orders",             // GET ?vendorId&projectCode&orderType
      BRR_LIST:      "/finance/purchase-bill/brr-list",                  // GET ?orderId&orderType&projectCode
      BRR_ITEMS:     "/finance/purchase-bill/brr-items",                 // GET ?brrId&projectCode
      CREATE:        "/finance/purchase-bill/create",                    // POST JSON
      LIST:          "/finance/purchase-bill/list",                      // GET ?projectCode&mode&workflowStatus&vendorId&search
      GET_BY_ID:     "/finance/purchase-bill/",                          // /:id GET
      EDIT:          "/finance/purchase-bill/edit/",                     // /:id PUT JSON
      SUBMIT:        "/finance/purchase-bill/submit/",                   // /:id POST
      APPROVE:       "/finance/purchase-bill/approve/",                  // /:id POST
      REBACK:        "/finance/purchase-bill/reback/",                   // /:id POST
      REJECT:        "/finance/purchase-bill/reject/",                   // /:id POST
      HISTORY:       "/finance/purchase-bill/history/",                  // /:id GET
      MY_APPROVAL_STATUS: "/finance/purchase-bill/my-approval-status/",  // /:id GET
      GET_BY_UUID:   "/finance/purchase-bill/uuid/",                     // /:uuid GET no-auth
    },
    PURCHASE_VOUCHER: {
      CREATE:        "/finance/purchase-voucher/create",                 // POST JSON
      LIST:          "/finance/purchase-voucher/list",                   // GET ?projectCode&vendorId&workflowStatus&search
      GET_BY_ID:     "/finance/purchase-voucher/",                       // /:id GET
      EDIT:          "/finance/purchase-voucher/edit/",                  // /:id PUT JSON
      SUBMIT:        "/finance/purchase-voucher/submit/",                // /:id POST
      APPROVE:       "/finance/purchase-voucher/approve/",               // /:id POST
      REBACK:        "/finance/purchase-voucher/reback/",                // /:id POST
      REJECT:        "/finance/purchase-voucher/reject/",                // /:id POST
      HISTORY:       "/finance/purchase-voucher/history/",               // /:id GET
      MY_APPROVAL_STATUS: "/finance/purchase-voucher/my-approval-status/", // /:id GET
      GET_BY_UUID:   "/finance/purchase-voucher/uuid/",                  // /:uuid GET no-auth
    },
    SALE_RECEIPT: {
      OG_SALE_ORDERS: "/finance/sale-receipt/og-sale-orders",            // GET ?projectCode — Approved OG Sale Orders
      CREATE:         "/finance/sale-receipt/create",                    // POST JSON
      LIST:           "/finance/sale-receipt/list",                      // GET ?projectCode&search
      GET_BY_ID:      "/finance/sale-receipt/",                          // /:id GET (returns parent + billings summary)
      EDIT:           "/finance/sale-receipt/edit/",                     // /:id PUT JSON
      DELETE:         "/finance/sale-receipt/delete/",                   // /:id DELETE (blocked if any child not Rejected)
    },
    SALE_RECEIPT_BILLING: {
      CERTIFIED_BILLS:    "/finance/sale-receipt-billing/certified-bills",     // GET ?ogSaleOrderNo&projectCode
      RECEIPT_ITEMS:      "/finance/sale-receipt-billing/receipt-items",       // GET ?certifiedBillId&projectCode
      INVOICE_LOOKUP:     "/finance/sale-receipt-billing/invoice-lookup",      // GET ?invoiceNo&projectCode
      CREATE:             "/finance/sale-receipt-billing/create",              // POST JSON (needs receiptId)
      LIST:               "/finance/sale-receipt-billing/list",                // GET ?receiptId&projectCode&workflowStatus
      GET_BY_ID:          "/finance/sale-receipt-billing/",                    // /:id GET
      EDIT:               "/finance/sale-receipt-billing/edit/",               // /:id PUT JSON (Draft/Reback only)
      SUBMIT:             "/finance/sale-receipt-billing/submit/",             // /:id POST
      APPROVE:            "/finance/sale-receipt-billing/approve/",            // /:id POST { comments }
      REBACK:             "/finance/sale-receipt-billing/reback/",             // /:id POST { comments }
      REJECT:             "/finance/sale-receipt-billing/reject/",             // /:id POST { comments }
      HISTORY:            "/finance/sale-receipt-billing/history/",            // /:id GET
      MY_APPROVAL_STATUS: "/finance/sale-receipt-billing/my-approval-status/", // /:id GET
      GET_BY_UUID:        "/finance/sale-receipt-billing/uuid/",               // /:uuid GET no-auth
    },
    DEBIT_NOTE: {
      CREATE:             "/finance/debit-note/create",                 // POST JSON
      LIST:               "/finance/debit-note/list",                   // GET ?projectCode&workflowStatus&search
      GET_BY_ID:          "/finance/debit-note/",                       // /:id GET
      EDIT:               "/finance/debit-note/edit/",                  // /:id PUT JSON (Draft/Reback only)
      SUBMIT:             "/finance/debit-note/submit/",                // /:id POST
      APPROVE:            "/finance/debit-note/approve/",               // /:id POST { comments }
      REBACK:             "/finance/debit-note/reback/",                // /:id POST { comments }
      REJECT:             "/finance/debit-note/reject/",                // /:id POST { comments }
      HISTORY:            "/finance/debit-note/history/",               // /:id GET
      MY_APPROVAL_STATUS: "/finance/debit-note/my-approval-status/",    // /:id GET
      GET_BY_UUID:        "/finance/debit-note/uuid/",                  // /:uuid GET no-auth
    },
    CREDIT_NOTE: {
      CREATE:             "/finance/credit-note/create",                 // POST JSON
      LIST:               "/finance/credit-note/list",                   // GET ?projectCode&workflowStatus&search
      GET_BY_ID:          "/finance/credit-note/",                       // /:id GET
      EDIT:               "/finance/credit-note/edit/",                  // /:id PUT JSON (Draft/Reback only)
      SUBMIT:             "/finance/credit-note/submit/",                // /:id POST
      APPROVE:            "/finance/credit-note/approve/",               // /:id POST { comments }
      REBACK:             "/finance/credit-note/reback/",                // /:id POST { comments }
      REJECT:             "/finance/credit-note/reject/",                // /:id POST { comments }
      HISTORY:            "/finance/credit-note/history/",               // /:id GET
      MY_APPROVAL_STATUS: "/finance/credit-note/my-approval-status/",    // /:id GET
      GET_BY_UUID:        "/finance/credit-note/uuid/",                  // /:uuid GET no-auth
    },
    PAYMENT_VOUCHER: {
      APPROVED_PURCHASE_VOUCHERS: "/finance/payment-voucher/approved-purchase-vouchers", // GET ?projectCode
      PURCHASE_VOUCHER_ITEMS:     "/finance/payment-voucher/purchase-voucher-items/",    // /<pv_id> GET
      CREATE:             "/finance/payment-voucher/create",                // POST JSON
      LIST:               "/finance/payment-voucher/list",                  // GET ?projectCode&workflowStatus&vendorId&search
      GET_BY_ID:          "/finance/payment-voucher/",                      // /<pvm_id> GET
      GET_BY_UUID:        "/finance/payment-voucher/uuid/",                 // /<uuid> GET no-auth
      EDIT:               "/finance/payment-voucher/edit/",                 // /<pvm_id> PUT JSON
      SUBMIT:             "/finance/payment-voucher/submit/",               // /<pvm_id> POST
      APPROVE:            "/finance/payment-voucher/approve/",              // /<pvm_id> POST { comments }
      REBACK:             "/finance/payment-voucher/reback/",               // /<pvm_id> POST { comments }
      REJECT:             "/finance/payment-voucher/reject/",               // /<pvm_id> POST { comments }
      HISTORY:            "/finance/payment-voucher/history/",              // /<pvm_id> GET
      MY_APPROVAL_STATUS: "/finance/payment-voucher/my-approval-status/",   // /<pvm_id> GET
    },
    BILL_PAYMENT: {
      APPROVED_PURCHASE_BILLS: "/finance/bill-payment/approved-purchase-bills", // GET ?projectCode&vendorId
      PURCHASE_BILL_ITEMS:     "/finance/bill-payment/purchase-bill-items/",    // /<bill_id> GET
      CREATE:             "/finance/bill-payment/create",                   // POST JSON
      LIST:               "/finance/bill-payment/list",                     // GET ?projectCode&workflowStatus&vendorId&search
      GET_BY_ID:          "/finance/bill-payment/",                         // /<receipt_id> GET
      GET_BY_UUID:        "/finance/bill-payment/uuid/",                    // /<uuid> GET no-auth
      EDIT:               "/finance/bill-payment/edit/",                    // /<receipt_id> PUT JSON
      SUBMIT:             "/finance/bill-payment/submit/",                  // /<receipt_id> POST
      APPROVE:            "/finance/bill-payment/approve/",                 // /<receipt_id> POST { comments }
      REBACK:             "/finance/bill-payment/reback/",                  // /<receipt_id> POST { comments }
      REJECT:             "/finance/bill-payment/reject/",                  // /<receipt_id> POST { comments }
      HISTORY:            "/finance/bill-payment/history/",                 // /<receipt_id> GET
      MY_APPROVAL_STATUS: "/finance/bill-payment/my-approval-status/",      // /<receipt_id> GET
    },
    CONTRA_ENTRY: {
      CREATE:             "/finance/contra-entry/create",                // POST JSON
      LIST:               "/finance/contra-entry/list",                  // GET ?projectCode&search&fromDate&toDate&workflowStatus
      GET_BY_ID:          "/finance/contra-entry/",                      // /:id GET
      GET_BY_UUID:        "/finance/contra-entry/uuid/",                 // /:uuid GET no-auth
      EDIT:               "/finance/contra-entry/edit/",                 // /:id PUT JSON
      SUBMIT:             "/finance/contra-entry/submit/",               // /:id POST
      APPROVE:            "/finance/contra-entry/approve/",              // /:id POST { comments }
      REBACK:             "/finance/contra-entry/reback/",               // /:id POST { comments }
      REJECT:             "/finance/contra-entry/reject/",               // /:id POST { comments }
      HISTORY:            "/finance/contra-entry/history/",              // /:id GET
      MY_APPROVAL_STATUS: "/finance/contra-entry/my-approval-status/",   // /:id GET
    },
    JOURNAL_ENTRY: {
      CREATE:             "/finance/journal-entry/create",               // POST JSON
      LIST:               "/finance/journal-entry/list",                 // GET ?projectCode&search&fromDate&toDate&workflowStatus
      GET_BY_ID:          "/finance/journal-entry/",                     // /:id GET
      GET_BY_UUID:        "/finance/journal-entry/uuid/",                // /:uuid GET no-auth
      EDIT:               "/finance/journal-entry/edit/",                // /:id PUT JSON
      SUBMIT:             "/finance/journal-entry/submit/",              // /:id POST
      APPROVE:            "/finance/journal-entry/approve/",             // /:id POST { comments }
      REBACK:             "/finance/journal-entry/reback/",              // /:id POST { comments }
      REJECT:             "/finance/journal-entry/reject/",              // /:id POST { comments }
      HISTORY:            "/finance/journal-entry/history/",             // /:id GET
      MY_APPROVAL_STATUS: "/finance/journal-entry/my-approval-status/",  // /:id GET
    },
    JOURNAL_VOUCHERING: {
      BASE:              "/finance/journal-entry/journal-voucher",
      LIST:              "/finance/journal-entry/journal-voucher/list",               // GET ?projectCode&page&pageSize&workflowStatus&fundSource
      CREATE:            "/finance/journal-entry/journal-voucher/create",             // POST multipart { projectCode, fundSource, lines(JSON) }
      GET_BY_ID:         "/finance/journal-entry/journal-voucher/",                   // /:id GET
      GET_BY_UUID:       "/finance/journal-entry/journal-voucher/uuid/",              // /:uuid GET no-auth
      EDIT:              "/finance/journal-entry/journal-voucher/edit/",                   // /:id/ PUT multipart
      SUBMIT:            "/finance/journal-entry/journal-voucher/submit/",                   // /:id/ POST
      APPROVE:           "/finance/journal-entry/journal-voucher/approve",                    // /:id POST {comments}
      REBACK:            "/finance/journal-entry/journal-voucher/reback",                    // /:id POST {comments}
      REJECT:            "/finance/journal-entry/journal-voucher/reject",                    // /:id POST {comments}
      HISTORY:           "/finance/journal-entry/journal-voucher/history/",                   // /:id/ GET
      MY_APPROVAL_STATUS: "/finance/journal-entry/journal-voucher/my-approval-status/",  // /:id GET
      AVAILABLE_DOCKETS: "/finance/journal-entry/journal-voucher/available-dockets",  // GET ?projectCode&fundSource=Cash|Bank/UPI
    },
    JOURNAL_ACCOUNTING: {
      BASE:              "/finance/journal-entry/journal-accounting",
      APPROVED_VOUCHERS: "/finance/journal-entry/journal-accounting/approved-vouchers", // GET ?projectCode
      CREATE:            "/finance/journal-entry/journal-accounting/create",            // POST multipart
      LIST:              "/finance/journal-entry/journal-accounting/list",              // GET ?projectCode&page&pageSize
      GET_BY_ID:         "/finance/journal-entry/journal-accounting/",                  // /:id GET
      GET_BY_UUID:       "/finance/journal-entry/journal-accounting/uuid/",             // /:uuid GET no-auth
      EDIT:              "/finance/journal-entry/journal-accounting/edit/",                  // /:id PUT multipart
      SUBMIT:            "/finance/journal-entry/journal-accounting/submit/",                  // /:id POST
      APPROVE:           "/finance/journal-entry/journal-accounting/approve",           // /:id POST
      REBACK:            "/finance/journal-entry/journal-accounting/reback",            // /:id POST
      REJECT:            "/finance/journal-entry/journal-accounting/reject",            // /:id POST
      HISTORY:           "/finance/journal-entry/journal-accounting/history/",                  // /:id GET
      MY_APPROVAL_STATUS: "/finance/journal-entry/journal-accounting/my-approval-status/",  // /:id GET
    },
    VENDOR_LEDGER: {
      GET:      "/finance/vendor-ledger",           // GET ?vendorId&projectCode&fromDate&toDate (JWT)
      GET_BY_UUID: "/finance/vendor-ledger/uuid/",  // /:vendor_uuid GET (public)
    },
    MY_LEDGER: {
      GET: "/finance/my-ledger",                    // GET ?projectCode&fromDate&toDate (JWT)
    },
    PETTY_CASH: {
      LEDGER: {
        LIST:          "/finance/petty-cash/ledger/list",      // GET ?projectCode[&workflowStatus&fromDate&toDate]
        BUDGET_DETAIL: "/finance/petty-cash/ledger/budget/",   // /:budget_id GET
      },
      BUDGET: {
        LIST:               "/finance/petty-cash/budget/list",                // GET ?projectCode[&workflowStatus&search&fromDate&toDate]
        CREATE:             "/finance/petty-cash/budget/create",              // POST multipart (details JSON string + attachment file)
        GET_BY_ID:          "/finance/petty-cash/budget/",                    // /:id GET
        GET_BY_UUID:        "/finance/petty-cash/budget/uuid/",               // /:uuid GET no-auth
        UPDATE:             "/finance/petty-cash/budget/edit/",               // /:id PUT multipart
        SUBMIT:             "/finance/petty-cash/budget/submit/",             // /:id POST (no body)
        APPROVE:            "/finance/petty-cash/budget/approve/",            // /:id POST { comments }
        REBACK:             "/finance/petty-cash/budget/reback/",             // /:id POST { comments } required
        REJECT:             "/finance/petty-cash/budget/reject/",             // /:id POST { comments } required
        HISTORY:            "/finance/petty-cash/budget/history/",            // /:id GET
        MY_APPROVAL_STATUS: "/finance/petty-cash/budget/my-approval-status/", // /:id GET
        REVISE:             "/finance/petty-cash/budget/revise/",             // /:id PUT { revisions:[{detailRowId,newAmount,remark}] }
        REVISION_HISTORY:   "/finance/petty-cash/budget/revision-history/",  // /:id GET
      },
      DOCKET_VOUCHER: {
        LIST:               "/finance/petty-cash/docket-voucher/list",                // GET ?projectCode[&workflowStatus&search&fromDate&toDate]
        CREATE:             "/finance/petty-cash/docket-voucher/create",              // POST multipart (details JSON string + attachment file)
        GET_BY_ID:          "/finance/petty-cash/docket-voucher/",                    // /:id GET
        GET_BY_UUID:        "/finance/petty-cash/docket-voucher/uuid/",               // /:uuid GET no-auth
        UPDATE:             "/finance/petty-cash/docket-voucher/edit/",               // /:id PUT multipart
        SUBMIT:             "/finance/petty-cash/docket-voucher/submit/",             // /:id POST (no body)
        APPROVE:            "/finance/petty-cash/docket-voucher/approve/",            // /:id POST { comments }
        REBACK:             "/finance/petty-cash/docket-voucher/reback/",             // /:id POST { comments } required
        REJECT:             "/finance/petty-cash/docket-voucher/reject/",             // /:id POST { comments } required
        DELETE:             "/finance/petty-cash/docket-voucher/delete/",             // /:id DELETE
        HISTORY:            "/finance/petty-cash/docket-voucher/history/",            // /:id GET
        MY_APPROVAL_STATUS: "/finance/petty-cash/docket-voucher/my-approval-status/", // /:id GET
        BUDGET_ROWS:        "/finance/petty-cash/docket-voucher/budget-rows/",        // /:budgetId GET — pre-fill helper
      },
    },
  },
};

export default API_BASE_URL;

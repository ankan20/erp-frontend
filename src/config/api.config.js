const API_BASE_URL = "https://erpbackend-production.up.railway.app"; //change here later

export const API_ENDPOINTS = {
    LOGIN: "/auth/login",
    GET_COMPANIES:"/compny/my-companies",//only for super admin
    SETTINGS :{
        CREATE_COMPANY:"/compny/company", //used for update also
        GET_COMPANY_DETAILS_BY_ID:"/compny/company",
        GET_ALL_USERS : "/setting/users",
        GET_USER_BY_ID:"/setting/user", //get /put
        CREATE_USER :"/setting/create-user", //used for update also,
        GET_ALL_PROJECTS :"/setting/project-list",
        CREATE_PROJECT:"/setting/create-project",
        GET_PROJECT_BY_ID:"/setting/project",//get and put for update
        ADD_DESIGNATION:"/setting/designation",
        UPDATE_PROJECT_ROLES:"/setting/project-role" //project code also used for get 

    },
    MASTER :{
        CREATE_GROUP:"/master/group/create",
        UPDATE_GROUP_BY_ID:"/master/group/update",//id
        GET_ALL_GROUP:"/master/group/list",
        CREATE_CATEGORY:"/master/category/create",
        UPDATE_CATEGORY_BY_ID:"/master/category/update",
        GET_ALL_CATEGORY:"/master/category/list",
        GET_ALL_CC_CODE:"/master/cc-code/list",
        GET_CC_CODE_BY_ID:"/master/cc-code",
        CREATE_CC_CODE:"/master/cc-code/create",
        UPDATE_CC_CODE_BY_ID:"/master/cc-code/update",
        //ledger
        GET_ALL_LEDGER:"/master/ledger/list",
        CREATE_LEDGER:"/master/ledger/create",
        GET_LEDGER_BY_ID:"/master/ledger",
        UPDATE_LEDGER_BY_ID:"/master/ledger/update",
        //item
        GET_ALL_ITEM:"/master/item/list",
        GET_ITEM_BY_ID:"/master/item",
        UPDATE_ITEM_BY_ID:"/master/item/update",
        CREATE_ITEM:"/master/item/create",
        //asset
        GET_ALL_ASSET:"/master/asset/list",
        GET_ASSET_BY_ID:"/master/asset",
        UPDATE_ASSET_BY_ID:"/master/asset/update",
        CREATE_ASSET:"/master/asset/create",
    },
    // resource/indent
    RESOURCE:{
        INDENT:{
            GET_ALL_INDENT:"/resource/indent"
        }
    }
    
};

export default API_BASE_URL;
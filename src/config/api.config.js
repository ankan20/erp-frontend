const API_BASE_URL = "https://erpbackend-production.up.railway.app"; //change here later

export const API_ENDPOINTS = {
    LOGIN: "/auth/login",
    SETTINGS :{
        CREATE_COMPANY:"/compny/company", //used for update also
        GET_COMPANY_DETAILS_BY_ID:"/compny/company",
        GET_ALL_USERS : "/setting/users",
        GET_USER_BY_ID:"/setting/user", //get /put
        CREATE_USER :"/setting/create-user", //used for update also,
        GET_ALL_PROJECTS :"/setting/project-list",
        CREATE_PROJECT:"/setting/create-project",
        GET_PROJECT_BY_ID:"/setting/project",//get and put for update
    }
    
};

export default API_BASE_URL;
export const appRequest = async (endpoint, method, headers, payload) => {
    if (!endpoint) {
        return {
            success: false,
            message: "endpoint is missing from request"
        }
    }
    

    let baseUrl;
    if (import.meta.env.VITE_CURRENT_ENVIRONMENT == "localenvironment") {
        baseUrl = "http://localhost:8888/.netlify/functions";
    } else {
        baseUrl = "https://cvmaster-jy.netlify.app/.netlify/functions";
    }

    if (!baseUrl) return {
        success: false,
        error: "VITE_CURRENT_ENVIRONMENT not set"
    }

    let requestUrl = `${baseUrl}${endpoint}`;

    const requestData = {
        method,
        headers,
        body: JSON.stringify(payload)
    }

    response = await fetch(requestUrl, requestData);

    return response;
    
}
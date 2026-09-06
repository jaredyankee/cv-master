import { fnRegistry } from "../../private/registry/registry";

/**
 *  @fn resume-dump 
 *  - expected request contains
 * 
 *  Headers
 *      - 'x-api-key' => anthropic API key, this is self serve
 *      - 'x-request-type' => @todo - define enum
 *          'get', 'post', 'put'
 */
export async function handler (event, context) {
    console.log("resumne-dump");
    const headers = event.headers;
    const method = event.httpMethod;

    /**
     * The functions on these endpoints will never take params as function
     *  instead, derive the value needed for the params or add the keys to payload matching the shape required for the fn
     */
    const params = event.queryStringParameters;

    if (method == "GET") {
        // pending
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Request was successful but there is nothing to get!"
            })
        };
    } else if (method == "DELETE") {
        // delete doesn't come with body so group it here
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Request was successful but there is nothing to delete!"
            })
        };
    }
    // apiKey is required for POST and PUT requests because they go through anthropic api
    if (!headers["x-api-key"]) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: "No API key in request" })
        }
    }
    if (!event?.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No body found in POST/PUT request" })
        }
    }
    const body = JSON.parse(event?.body);

    if (method == "POST") {
        // new resume dump
        let fn = fnRegistry('registry-dump:POST');
        try {
            const repsonse = await fn(apiKey, payload);
            
        } catch (err) {
            console.error("An error occurred...", err);
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: err
                })
            };
        }
        
    } else if (method == "PUT") {

    } 


}
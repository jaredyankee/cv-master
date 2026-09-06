export const CORS = (event, page = null) => {
    //console.log('[CORS]');
    // check key

    // for internal use
    const allowed = [
        'http://localhost:5173',
        'http://localhost:5174'
    ];

    console.log("Origin: ", event.headers.origin);

    if (page !== null) allowed.push(page);
    // Set allowedOrigin to origin if in 'allowed'
    const origin = event.headers.origin ?? event.headers.referer;
    const allowOrigin = allowed.includes(origin) ? origin : null; 

    // Allows requests from node
    const cors = {
        ...allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {},
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': event.headers['access-control-request-headers'] || 'Content-Type',
        'Content-Type': 'application/json',
        'Vary': 'Origin',
    };
    //console.log("COORS: ", cors);

    //console.log('Cors check', authToken, process.env.SEYONA_KEY, '\nCheck result: ',  authToken !== process.env.SEYONA_KEY)

    // Return right away for OPTIONS calls
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: cors,
            body: '',
        }
    }
    // Return 403 for not allowed'
    if (!allowOrigin) {
        return {
            statusCode: 403,
            headers: cors,
            body: JSON.stringify({
                error: 'Origin not allowed:', origin
            })
        }
    }

    // return the headers
    return cors;
}
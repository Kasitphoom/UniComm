import { toAbsoluteUrl } from "./clientUrlHandler";

export const APICallHandler = async (endpoint: string, method: string, body?: any) => {
    const url = toAbsoluteUrl(endpoint)
    const isBodyAllowed = !/^(GET|HEAD)$/i.test(method)
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: isBodyAllowed && body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        let errorMessage = 'API call failed'
        try {
            const errorData = await response.json()
            errorMessage = errorData.message || errorData.msg || errorMessage
        } catch {
            // ignore JSON parse error
        }
        throw new Error(errorMessage)
    }

    return response.json();
};

export default APICallHandler;
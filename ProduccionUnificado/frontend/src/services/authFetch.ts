import { getToken } from './authStorage';

export const authFetch = async (url: string, options: any = {}) => {
    const token = await getToken();
    let headers = options.headers || {};
    if (token) {
        headers = { ...headers, Authorization: `Bearer ${token}` };
    }
    return globalThis.fetch(url, { ...options, headers });
};

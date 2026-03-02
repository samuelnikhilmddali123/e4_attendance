import axios from 'axios';

// Force hardcode the backend URL to prevent relative path mapping in production
const API_URL = 'https://e4-attendance-2uoj.vercel.app/api/';
console.log('[API] Final Backend URL:', API_URL);

const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to fix URL joining and include the JWT token
api.interceptors.request.use(
    (config) => {
        // Fix: If URL starts with '/', Axios baseURL joining replaces the whole path.
        // Stripping the leading slash makes it relative to the baseURL.
        if (config.url.startsWith('/')) {
            config.url = config.url.substring(1);
        }

        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Only redirect if we're not already on the login page to avoid loops/hiding errors
            if (!window.location.pathname.includes('/login')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

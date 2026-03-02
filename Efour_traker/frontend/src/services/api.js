import axios from 'axios';

// Force hardcode the backend URL to prevent relative path mapping in production
const API_URL = 'https://e4-attendance-2uoj.vercel.app/api/';
console.log('[API] Final Backend URL:', API_URL);

const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    withCredentials: true,
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

// --- Token Refresh Logic ---
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 Unauthorized and we haven't already tried to refresh the token
        if (error.response && error.response.status === 401 && !originalRequest._retry) {

            // Skip refresh attempt if the failed request was a login or a refresh call itself
            if (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // If a refresh is already in progress, queue this request
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch(err => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Silent network call to generate a new Access Token using the HttpOnly refresh token cookie
                const response = await axios.post(`${API_URL}auth/refresh`, {}, { withCredentials: true });
                const { token } = response.data;

                console.log('[API] Silent Token Refresh Successful');

                // Save new token
                localStorage.setItem('token', token);

                // Update original request headers and retry
                originalRequest.headers.Authorization = `Bearer ${token}`;
                processQueue(null, token);

                return api(originalRequest);
            } catch (refreshError) {
                console.warn('[API] Silent Token Refresh Failed (Session truly expired)');
                processQueue(refreshError, null);

                if (!window.location.pathname.includes('/login')) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;

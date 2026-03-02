import React, { createContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentSsid, setCurrentSsid] = useState(null);

    useEffect(() => {
        // --- Native messaging for SSID ---
        const handleMessage = (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                console.log('[AUTH] Native Message Received:', data.type);

                if (data.type === 'WIFI_SSID') {
                    setCurrentSsid(data.ssid);
                    console.log('[AUTH] SSID captured from native:', data.ssid);
                }
            } catch (e) {
                // Not a JSON message or not for us
            }
        };

        window.addEventListener('message', handleMessage);
        document.addEventListener('message', handleMessage);

        // --- Session Restoration via HttpOnly Cookie ---
        const checkSession = async () => {
            try {
                // Check if our persistent HttpOnly cookie is still alive and recognized by the server
                // This will trigger the Axios interceptor to refresh the Access Token if needed
                const response = await api.get('/auth/me');
                if (response.data && response.data.user) {
                    const userData = { ...response.data.user, isRestricted: response.data.isRestricted };
                    setUser(userData);
                    localStorage.setItem('user', JSON.stringify(userData));
                }
            } catch (error) {
                // If we reach here, both the Access Token and the Refresh Token are dead/invalid.
                setUser(null);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            } finally {
                setLoading(false);
            }
        };

        checkSession();

        return () => {
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('message', handleMessage);
        };
    }, []);

    const [socket, setSocket] = useState(null);

    useEffect(() => {
        let newSocket = null;
        if (user && user.emp_no) {
            // NOTE: Sockets are disabled because the backend is hosted on Vercel Serverless
            // which does not support persistent WebSockets, causing 404 polling errors.
            // newSocket = io('https://e4-attendance-2uoj.vercel.app');
            // setSocket(newSocket);
            // newSocket.emit('join_room', user.emp_no);
            // newSocket.on('force_logout', (data) => {
            //     alert(data.message);
            //     localStorage.removeItem('token');
            //     localStorage.removeItem('user');
            //     setUser(null);
            //     window.location.href = '/login?reason=concurrent_login';
            // });
        }

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [user]);

    const login = async (emp_no, password) => {
        console.log('[AUTH] Attempting login for:', emp_no);
        try {
            const response = await api.post('/auth/login', {
                emp_no,
                password,
                wifi_ssid: currentSsid // Send SSID captured from native layer
            });
            console.log('[AUTH] Login response received:', response.status);
            const { token, user: loggedInUser, isRestricted } = response.data;
            const userData = { ...loggedInUser, isRestricted };

            // We do NOT save to localStorage or state here. 
            // This prevents App.jsx from re-rendering and unmounting the Login Camera.
            return {
                success: true,
                role: loggedInUser.role,
                isRestricted,
                user: loggedInUser,
                token: token,
                userData: userData // Pass full data to be finalized later
            };
        } catch (error) {
            console.error('[AUTH] Login Error Details:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url
            });
            // Store data for UI debug display
            window.lastErrorData = error.response?.data;
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed: ' + error.message,
                data: error.response?.data
            };
        }
    };

    const finalizeLogin = (token, userData) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = async () => {
        try {
            if (socket) socket.disconnect();

            // Record logout attendance
            if (user && user.role === 'employee') {
                const response = await api.post('/auth/logout');
                const duration = response.data?.duration;
                if (duration) {
                    alert(`Logout successful!\nYou were logged in for: ${duration.formatted}`);
                } else {
                    alert('Logged out successfully');
                }
            } else {
                alert('Logged out successfully');
            }
        } catch (error) {
            console.error('Logout attendance recording failed:', error);
            alert('Logged out successfully');
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            window.location.href = '/login';
        }
    };

    const updateUser = (updatedUserData) => {
        const updatedUser = { ...user, ...updatedUserData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, finalizeLogin, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

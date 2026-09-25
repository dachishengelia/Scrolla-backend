import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:3000",
  withCredentials: true,
});

console.log("Axios Base URL:", import.meta.env.VITE_API_BASE || "http://localhost:3000");

// Request interceptor to add Authorization header
axiosInstance.interceptors.request.use(
  (config) => {
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

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("Axios Error during log-in/log-out:", error.response || error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
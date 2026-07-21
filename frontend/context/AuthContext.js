"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { getLandingRoute } from "@/lib/roles";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  const loadUser = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await api.get("/accounts/profile/");
      setUser(response.data);
      if (response.data.must_change_password) {
        router.replace("/change-password");
      }
      return response.data;
    } catch (error) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async ({ email, password }) => {
    try {
      const response = await api.post("/accounts/login/", {
        email,
        password,
      });

      localStorage.setItem("accessToken", response.data.access);
      localStorage.setItem("refreshToken", response.data.refresh);

      const loggedInUser = await loadUser();

      toast.success("Login successful");
      router.push(
        loggedInUser?.must_change_password
          ? "/change-password"
          : getLandingRoute(loggedInUser)
      );
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        (error.response
          ? "Login failed. Please check your email and password."
          : "Cannot connect to the server. Make sure the backend is running.");

      toast.error(message);
      throw error;
    }
  };

  const register = async (formData) => {
    try {
      await api.post("/accounts/register/", formData);

      toast.success("Registration successful. Please login.");
      router.push("/login");
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Registration failed.");
      }

      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    toast.success("Logged out");
    router.push("/login");
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

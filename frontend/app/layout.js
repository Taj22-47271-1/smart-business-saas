import { Toaster } from "react-hot-toast";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "Smart Business SaaS",
  description:
    "Manage products, stock, sales, expenses, customers and reports from one app.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Smart Business",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `
(function () {
  try {
    var savedTheme = localStorage.getItem("smart-business-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = savedTheme || (prefersDark ? "dark" : "light");

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (error) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>

      <body>
        <AuthProvider>{children}</AuthProvider>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: "14px",
              background: "var(--bg-surface)",
              color: "var(--text-main)",
              border: "1px solid var(--border-main)",
              boxShadow: "var(--shadow-card)",
              fontWeight: 700,
            },
          }}
        />
      </body>
    </html>
  );
}

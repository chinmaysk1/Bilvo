// pages/login.tsx
"use client";

import { useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Footer from "@/components/LandingFooter";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      // Redirect signed-in users straight to the dashboard
      router.replace("/protected/dashboard");
    }
  }, [status, router]);

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white">
        <div className="bg-white/90 backdrop-blur-md p-10 rounded-2xl shadow-lg w-full max-w-md text-center border border-green-100">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">B</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Bilvo</span>
          </div>
          <div>
            <p className="text-gray-600 mb-10 mt-10">
              Username/Password Coming Soon
            </p>
            <p className="text-gray-600 mb-10 mt-10">
              Sign in to your account with Google
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-3 px-6 py-3 bg-emerald-600 text-white rounded-full font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-all w-full shadow-md"
          >
            {/* Google logo */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5"
            >
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3A11.97 11.97 0 0 1 12 24a12 12 0 0 1 20.5-8.5l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8A11.97 11.97 0 0 1 24 12a11.97 11.97 0 0 1 8.5 3.5l5.7-5.7A20 20 0 0 0 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.4 0 10.4-2.1 14.1-5.9l-6.5-5.5A11.96 11.96 0 0 1 12 24h-6.7l-6.6 4.8A20 20 0 0 0 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.5 5.5A19.9 19.9 0 0 0 44 24c0-1.2-.1-2.3-.4-3.5z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          <p className="mt-8 text-sm text-gray-500">
            By signing in, you agree to our{" "}
            <a href="#" className="text-emerald-600 hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-emerald-600 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
        <p className="mt-6 text-sm text-gray-400">
          © {new Date().getFullYear()} Bilvo. All rights reserved.
        </p>
      </main>

      {/* Reusable footer */}
      <Footer />
    </>
  );
}

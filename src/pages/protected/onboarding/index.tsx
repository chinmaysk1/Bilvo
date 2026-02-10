import { Home, Users } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome to Bilvo!
            </h1>
            <p className="text-gray-600">Let's get your household set up.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Create Household Card */}
            <button
              onClick={() => router.push("/onboarding/create")}
              className="group bg-green-500 hover:bg-green-600 text-white rounded-2xl p-8 text-left transition-all shadow-lg hover:shadow-xl"
            >
              <div className="bg-green-400 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <Home className="w-7 h-7 text-white" />
              </div>

              <h2 className="text-2xl font-bold mb-3">Create a Household</h2>

              <p className="text-green-50 leading-relaxed">
                Start a new home, invite your roommates, and connect your
                utilities.
              </p>
            </button>

            {/* Join Household Card */}
            <button
              onClick={() => router.push("/onboarding/join")}
              className="group bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-2xl p-8 text-left transition-all shadow-sm hover:shadow-md"
            >
              <div className="bg-gray-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-gray-700" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Join a Household
              </h2>

              <p className="text-gray-600 leading-relaxed">
                Got an invite code? Join your roommates and manage shared bills.
              </p>
            </button>
          </div>

          <p className="text-center text-gray-500 text-sm mt-8">
            You can always create or join another household later.
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-green-500 rounded w-6 h-6 flex items-center justify-center">
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <span className="text-sm text-gray-600">
              © 2026 Bilvo. All rights reserved.
            </span>
          </div>

          <div className="flex gap-6 text-sm">
            <a href="#" className="text-gray-600 hover:text-gray-900">
              Terms of Service
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900">
              Privacy Policy
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900">
              Security
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

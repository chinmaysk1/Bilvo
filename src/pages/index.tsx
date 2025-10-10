import React, { useState } from "react";
import {
  ArrowRight,
  Users,
  Split,
  CreditCard,
  Receipt,
  CheckCircle,
  Mail,
  Zap,
} from "lucide-react";

export default function BilvoLanding() {
  const [email, setEmail] = useState("");

  const handleGoogleSignIn = () => {
    alert("Google sign-in would redirect to OAuth flow");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-green-600">Bilvo</div>
            </div>
            <button
              onClick={handleGoogleSignIn}
              className="px-6 py-2 bg-white border-2 border-green-500 text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
            Split Bills with
            <span className="text-green-600"> Roommates</span>
            <br />
            <span className="text-green-600">Effortlessly</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Pull utility bills from your inbox, split them fairly, charge
            everyone automatically, and pay your provider on time. No more
            chasing roommates.
          </p>
          <button
            onClick={handleGoogleSignIn}
            className="inline-flex items-center px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Continue with Google
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
          <p className="text-sm text-gray-500 mt-4">
            Free to get started • No credit card required
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How Bilvo Works
            </h2>
            <p className="text-xl text-gray-600">
              Four simple steps to never worry about bills again
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                1. Create Household
              </h3>
              <p className="text-gray-600">
                Invite roommates and parents by phone or email
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Split className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Set Split Rules</h3>
              <p className="text-gray-600">
                Equal or custom percentages. Everyone confirms once
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Connect Bills</h3>
              <p className="text-gray-600">
                Link Gmail or upload PDFs. We parse automatically
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">4. Enable Autopay</h3>
              <p className="text-gray-600">
                Charges run automatically. Funds go to bill payer
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-green-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Built for Real Households
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to manage shared expenses
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
              <CreditCard className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Smart Payment Flow</h3>
              <p className="text-gray-600">
                ACH first for free, card backup with clear fees. No surprises
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
              <Users className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Parent Payments</h3>
              <p className="text-gray-600">
                Let parents cover a roommate's share directly. Perfect for
                students
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
              <Receipt className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Complete Transparency
              </h3>
              <p className="text-gray-600">
                Full ledger of every bill, charge, and payout. Export to CSV
                anytime
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
              <CheckCircle className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Automatic Parsing</h3>
              <p className="text-gray-600">
                We read your Gmail bills or PDFs and extract all the details
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
              <Zap className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Smart Retries</h3>
              <p className="text-gray-600">
                Failed payment? We retry automatically and notify the right
                person
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
              <Mail className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Stay Informed</h3>
              <p className="text-gray-600">
                Email and SMS notifications for every important event
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            Why Roommates Love Bilvo
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">$0</div>
              <p className="text-gray-600">Platform fees with ACH</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">
                3 days
              </div>
              <p className="text-gray-600">Advance notice before charges</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">100%</div>
              <p className="text-gray-600">Transparent ledger</p>
            </div>
          </div>

          <div className="bg-green-50 p-8 rounded-lg border border-green-100">
            <p className="text-lg text-gray-700 italic mb-4">
              "Finally stopped chasing my roommates for Venmo. Bilvo just
              handles everything automatically and everyone knows exactly what
              they owe."
            </p>
            <p className="text-gray-600 font-medium">— Early Beta User</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-green-600 to-green-700 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Stop Chasing Roommates?
          </h2>
          <p className="text-xl text-green-100 mb-8">
            Set up your household in under 5 minutes
          </p>
          <button
            onClick={handleGoogleSignIn}
            className="inline-flex items-center px-8 py-4 bg-white text-green-600 text-lg font-semibold rounded-lg hover:bg-green-50 transition-colors shadow-lg"
          >
            Continue with Google
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-2xl font-bold text-white mb-4">Bilvo</div>
              <p className="text-sm">
                Split bills with roommates, effortlessly.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-sm text-center">
            <p>&copy; 2025 Bilvo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

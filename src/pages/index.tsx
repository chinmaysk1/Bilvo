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
  Shield,
  Clock,
} from "lucide-react";

export default function BilvoLanding() {
  const [email, setEmail] = useState("");

  const handleGoogleSignIn = () => {
    alert("Google sign-in would redirect to OAuth flow");
  };

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");

        .gradient-text {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-glow {
          box-shadow: 0 0 80px rgba(16, 185, 129, 0.15);
        }

        .card-hover {
          transition: all 0.3s ease;
        }

        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
        }

        .mockup-container {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border-radius: 24px;
          padding: 40px;
          position: relative;
          overflow: hidden;
        }

        .mockup-container::before {
          content: "";
          position: absolute;
          top: -50%;
          right: -50%;
          width: 100%;
          height: 100%;
          background: radial-gradient(
            circle,
            rgba(16, 185, 129, 0.1) 0%,
            transparent 70%
          );
          animation: pulse 4s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        .floating {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .nav-blur {
          backdrop-filter: blur(12px);
          background: rgba(255, 255, 255, 0.8);
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed w-full z-50 nav-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Bilvo</span>
            </div>
            <button
              onClick={handleGoogleSignIn}
              className="px-6 py-3 bg-gray-900 text-white rounded-full font-semibold hover:bg-gray-800 transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Animation */}
      <section className="pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto mt-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              {/* <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full mb-6">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-green-700">
                  Trusted by 1,000+ households
                </span>
              </div> */}

              <h1 className="text-6xl lg:text-7xl font-black text-gray-900 mb-6 leading-tight">
                Split utilities.
                <br />
                <span className="gradient-text">Zero drama.</span>
              </h1>

              <p className="text-xl text-gray-600 mb-8 leading-relaxed font-medium">
                Automatic bill splitting for roommates. Connect your inbox, set
                your split, and never chase payments again.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={handleGoogleSignIn}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-gray-900 text-white text-lg font-semibold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                >
                  Get Early Access
                </button>
                <button className="px-8 py-4 border-2 border-gray-300 text-gray-900 text-lg font-semibold rounded-full hover:border-gray-400 transition-all">
                  Watch Demo
                </button>
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Bank-level security</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="font-medium">5-min setup</span>
                </div>
              </div>
            </div>

            {/* Animated Mockup */}
            <div className="relative">
              <div className="mockup-container hero-glow">
                <div className="bg-white rounded-2xl shadow-2xl p-6 floating relative z-10">
                  {/* Bill Card */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 mb-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Zap className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">
                            PG&E Electric
                          </div>
                          <div className="text-sm text-gray-500">
                            Due Oct 15
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-gray-900">
                          $248.00
                        </div>
                        <div className="text-xs text-green-600 font-semibold">
                          Auto-pay on
                        </div>
                      </div>
                    </div>

                    {/* Split Preview */}
                    <div className="space-y-2 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">
                            A
                          </div>
                          <span className="font-medium text-gray-700">
                            Alex
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">$62.00</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                            J
                          </div>
                          <span className="font-medium text-gray-700">
                            Jordan
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">$62.00</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                            S
                          </div>
                          <span className="font-medium text-gray-700">Sam</span>
                        </div>
                        <span className="font-bold text-gray-900">$62.00</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-700">
                            T
                          </div>
                          <span className="font-medium text-gray-700">
                            Taylor
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">$62.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Charging in 3 days
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-xl text-gray-600 font-medium">
              Four steps to automatic bill splitting
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Users,
                title: "Invite household",
                desc: "Add roommates via phone or email. Parents can pay too.",
                color: "blue",
              },
              {
                icon: Split,
                title: "Set your split",
                desc: "Equal or custom %. Everyone confirms once.",
                color: "purple",
              },
              {
                icon: Mail,
                title: "Connect bills",
                desc: "Gmail auto-import or manual PDF upload.",
                color: "green",
              },
              {
                icon: Zap,
                title: "Enable autopay",
                desc: "We charge shares and pay the bill payer.",
                color: "orange",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="card-hover bg-white rounded-2xl p-8 border border-gray-100"
              >
                <div
                  className={`w-14 h-14 bg-${step.color}-100 rounded-2xl flex items-center justify-center mb-6`}
                >
                  <step.icon className={`w-7 h-7 text-${step.color}-600`} />
                </div>
                <div className="text-sm font-bold text-gray-400 mb-2">
                  STEP {i + 1}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-gray-900 mb-4">
              Built for real life
            </h2>
            <p className="text-xl text-gray-600 font-medium">
              Everything you need, nothing you don't
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: CreditCard,
                title: "Smart payments",
                desc: "ACH is free. Card backup has clear fees. Your choice.",
                gradient: "from-blue-500 to-blue-600",
              },
              {
                icon: Users,
                title: "Parent pay",
                desc: "Let mom or dad cover your share. Perfect for students.",
                gradient: "from-purple-500 to-purple-600",
              },
              {
                icon: Receipt,
                title: "Full transparency",
                desc: "Complete ledger. Export CSV anytime. No black boxes.",
                gradient: "from-green-500 to-green-600",
              },
              {
                icon: CheckCircle,
                title: "Auto-parsing",
                desc: "We extract bill details from Gmail or PDFs automatically.",
                gradient: "from-orange-500 to-orange-600",
              },
              {
                icon: Zap,
                title: "Smart retries",
                desc: "Payment failed? We retry and notify the right person.",
                gradient: "from-pink-500 to-pink-600",
              },
              {
                icon: Shield,
                title: "Bank security",
                desc: "Encrypted data. Never store raw card info. SOC 2 ready.",
                gradient: "from-gray-700 to-gray-800",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="card-hover bg-white rounded-2xl p-8 border border-gray-100"
              >
                <div
                  className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6`}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-16">
            <div className="text-center">
              <div className="text-5xl font-black mb-2 gradient-text">$0</div>
              <p className="text-gray-400 font-medium">ACH fees</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black mb-2 gradient-text">80%+</div>
              <p className="text-gray-400 font-medium">First-try success</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black mb-2 gradient-text">
                5 min
              </div>
              <p className="text-gray-400 font-medium">Average setup</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-3xl p-10 border border-gray-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full"></div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-lg text-gray-300 leading-relaxed mb-4">
                  "Game changer. No more awkward Venmo requests or forgetting
                  who owes what. Everything just happens automatically and
                  everyone's happy."
                </p>
                <div>
                  <div className="font-bold text-white">Sarah Chen</div>
                  <div className="text-sm text-gray-400">
                    SF Bay Area • 4-person household
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-green-500 to-green-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-5xl lg:text-6xl font-black text-white mb-6">
            Stop chasing roommates
          </h2>
          <p className="text-xl text-green-50 mb-10 font-medium">
            Join 1,000+ households splitting bills on autopilot
          </p>
          <button
            onClick={handleGoogleSignIn}
            className="inline-flex items-center gap-3 px-10 py-5 bg-white text-gray-900 text-lg font-bold rounded-full hover:bg-gray-50 transition-all shadow-2xl"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Get Started Free
            <ArrowRight className="w-6 h-6" />
          </button>
          <p className="text-green-100 mt-6 text-sm font-medium">
            No credit card required • Free forever for ACH
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
                <span className="text-2xl font-bold text-white">Bilvo</span>
              </div>
              <p className="text-sm leading-relaxed mb-4">
                Split bills with roommates, automatically. Bank-level security,
                zero drama.
              </p>
              <div className="text-xs text-gray-500">
                © 2025 Bilvo. All rights reserved.
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Compliance
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

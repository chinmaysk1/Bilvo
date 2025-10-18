// src/components/Footer.tsx
import Link from "next/link";

type FooterProps = {
  className?: string;
  companyName?: string;
  year?: number;
};

export default function Footer({
  className = "",
  companyName = "Bilvo",
  year = new Date().getFullYear(),
}: FooterProps) {
  return (
    <footer className={`bg-gray-900 text-gray-400 py-16 ${className}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-5 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="text-2xl font-bold text-white">
                {companyName}
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              Split bills with roommates, automatically. Bank-level security,
              zero drama.
            </p>
            <div className="text-xs text-gray-500">
              © {year} {companyName}. All rights reserved.
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Product</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  How it Works
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Security
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Compliance
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

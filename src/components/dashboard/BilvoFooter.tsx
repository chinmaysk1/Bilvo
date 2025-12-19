import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

export function BilvoFooter() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState("");

  const handleLinkClick = (title: string, content: string) => {
    setModalTitle(title);
    setModalContent(content);
    setModalOpen(true);
  };

  const links = [
    {
      label: "Terms of Service",
      title: "Terms of Service",
      content:
        "By using Bilvo, you agree to our terms of service. Full terms and conditions coming soon.",
    },
    {
      label: "Privacy Policy",
      title: "Privacy Policy",
      content:
        "We take your privacy seriously. Your data is encrypted and never shared without your permission. Full privacy policy coming soon.",
    },
    {
      label: "Security",
      title: "Security",
      content:
        "Bilvo uses bank-level encryption to protect your information. All payment data is securely processed through our certified payment partners.",
    },
    {
      label: "Contact",
      title: "Contact Us",
      content:
        "Need help? Email us at support@bilvo.com or visit our help center. We typically respond within 24 hours.",
    },
  ];

  return (
    <>
      <footer
        className="w-full px-8 py-6 mt-auto border-t"
        style={{
          backgroundColor: "white",
          borderColor: "var(--border-light)",
        }}
      >
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          {/* Left: Copyright */}
          <p
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--gray-400)",
            }}
          >
            © 2025 Bilvo. All rights reserved.
          </p>

          {/* Right: Links */}
          <div className="flex items-center gap-6">
            {links.map((link) => (
              <button
                key={link.label}
                onClick={() => handleLinkClick(link.title, link.content)}
                className="transition-colors cursor-pointer"
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--gray-400)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--bilvo-green)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--gray-400)";
                }}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </footer>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--gray-900)",
              }}
            >
              {modalTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p style={{ fontSize: "14px", color: "var(--gray-600)" }}>
              {modalContent}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

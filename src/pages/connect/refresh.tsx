import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function ConnectRefreshPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    const run = async () => {
      try {
        // Optional: allow ?to=... to preserve a destination
        const toParam = router.query.to;
        const to =
          typeof toParam === "string" && toParam.startsWith("/")
            ? toParam
            : "/protected/dashboard/utilities";

        const res = await fetch("/api/payments/stripe/connect/account-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // If your endpoint supports passing return destination, include it.
          body: JSON.stringify({ to }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.error || "Failed to restart onboarding");

        if (!data?.url) throw new Error("Missing Stripe onboarding URL");

        window.location.href = data.url;
      } catch (e: any) {
        setError(e?.message ?? "Could not restart Stripe onboarding.");
      }
    };

    run();
  }, [router.isReady, router.query.to]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Restarting Stripe setup…
        </h1>
        <p style={{ color: "#6B7280", marginBottom: 16 }}>
          Redirecting you back to Stripe.
        </p>

        {error ? (
          <div
            style={{
              border: "1px solid #FCA5A5",
              background: "#FEF2F2",
              padding: 12,
              borderRadius: 12,
              color: "#991B1B",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Could not restart
            </div>
            <div style={{ fontSize: 14 }}>{error}</div>
            <div style={{ marginTop: 12 }}>
              <a
                href="/protected/dashboard/utilities"
                style={{
                  color: "#111827",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Back to Utilities
              </a>
            </div>
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              padding: 12,
              borderRadius: 12,
              color: "#374151",
              fontSize: 14,
            }}
          >
            Creating a fresh onboarding link…
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

type StatusResponse = {
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  // if status endpoint returns more, ignore it
};

export default function ConnectReturnPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    const run = async () => {
      try {
        // Optional: support ?to=/somewhere (we can also store this later)
        const toParam = router.query.to;
        const fallback = "/protected/dashboard/utilities";
        const destination =
          typeof toParam === "string" && toParam.startsWith("/")
            ? toParam
            : fallback;

        // 1) Hit Stripe once server-side to refresh DB
        const res = await fetch("/api/payments/stripe/connect/status", {
          method: "GET",
        });
        const data = (await res
          .json()
          .catch(() => ({}))) as Partial<StatusResponse>;

        if (!res.ok) {
          throw new Error(
            (data as any)?.error || "Failed to refresh Stripe status"
          );
        }

        // 2) Route back
        router.replace(destination);
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong finishing Stripe setup.");
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
          Finishing Stripe setup…
        </h1>
        <p style={{ color: "#6B7280", marginBottom: 16 }}>
          Please don’t close this tab.
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
              Setup not completed
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
            Syncing your verification status…
          </div>
        )}
      </div>
    </div>
  );
}

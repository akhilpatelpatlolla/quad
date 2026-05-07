import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { API_URL } from "../config";
import { messageFromApiError, readResponseJson } from "../utils/apiError";

type CatalogPack = {
  packId: string;
  credits: number;
  amountPaise: number;
  label: string;
};

type CatalogPayload = {
  configured: boolean;
  keyId: string | null;
  packs: CatalogPack[];
};

type OrderPayload = {
  orderId: string;
  amount: number;
  currency: string;
  credits: number;
  keyId: string;
};

type RazorpaySuccessPayload = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-quad-rzp="1"]');
    if (existing) {
      if (window.Razorpay) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.quadRzp = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay script failed"));
    document.body.append(script);
  });
}

type CreditsPurchaseModalProps = {
  open: boolean;
  onClose: () => void;
  token: string;
  userEmail: string | null | undefined;
  userName: string | null | undefined;
  balanceHint: number;
  onCreditsUpdated?: (creditBalance: number) => void;
};

export default function CreditsPurchaseModal({
  open,
  onClose,
  token,
  userEmail,
  userName,
  balanceHint,
  onCreditsUpdated
}: CreditsPurchaseModalProps) {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [busyPack, setBusyPack] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!token || !open) return;
    setHint("");
    setError("");
    try {
      const response = await fetch(`${API_URL}/payments/credits/catalog`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await readResponseJson(response);
      if (!response.ok) {
        throw new Error(messageFromApiError(payload));
      }
      setCatalog(payload as CatalogPayload);
      if (!(payload as CatalogPayload).configured) {
        setHint("Payments are disabled until the API has RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET set.");
      }
    } catch (e) {
      setCatalog(null);
      setError((e as Error).message);
    }
  }, [token, open]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function startCheckout(packId: string) {
    if (!catalog?.configured) return;
    setError("");
    setBusyPack(packId);
    try {
      await loadRazorpayScript();

      const orderRes = await fetch(`${API_URL}/payments/credits/order`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ packId })
      });
      const orderPayload = await readResponseJson(orderRes);
      if (!orderRes.ok) {
        throw new Error(messageFromApiError(orderPayload));
      }
      const order = orderPayload as OrderPayload;
      const key = order.keyId;
      if (!key) {
        throw new Error("Razorpay key missing from server response.");
      }
      const Razorpay = window.Razorpay;
      if (!Razorpay) {
        throw new Error("Razorpay Checkout did not initialize.");
      }

      const razorpay = new Razorpay({
        key,
        amount: order.amount,
        currency: order.currency ?? "INR",
        order_id: order.orderId,
        name: "QUAD",
        description: `${order.credits} credits`,
        prefill: {
          email: userEmail ?? undefined,
          name: userName ?? undefined
        },
        theme: { color: "#6366f1" },
        modal: {
          backdropclose: false,
          ondismiss: () => {
            setBusyPack(null);
          }
        },
        handler: async (response: RazorpaySuccessPayload) => {
          try {
            const verifyRes = await fetch(`${API_URL}/payments/credits/verify`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyPayload = await readResponseJson(verifyRes);
            if (!verifyRes.ok) {
              throw new Error(messageFromApiError(verifyPayload));
            }
            const body = verifyPayload as { creditBalance: number };
            onCreditsUpdated?.(body.creditBalance);
            onClose();
          } catch (verErr) {
            setError((verErr as Error).message);
          } finally {
            setBusyPack(null);
          }
        }
      });

      razorpay.on("payment.failed", () => {
        setError("Payment was cancelled or failed. You were not charged.");
        setBusyPack(null);
      });

      razorpay.open();
    } catch (checkoutErr) {
      setError((checkoutErr as Error).message);
      setBusyPack(null);
    }
  }

  if (!open) return null;

  const content = (
    <div className="credits-modal-overlay" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget) {
        if (!busyPack) onClose();
      }
    }}>
      <div className="credits-modal-panel" role="dialog" aria-modal="true" aria-labelledby="credits-modal-title">
        <div className="credits-modal-panel-head">
          <div>
            <p className="caps credits-modal-tag">Credits</p>
            <h2 id="credits-modal-title">Add QUAD credits</h2>
            <p className="subtle credits-modal-note">
              Checkout opens Razorpay. Credits apply to your account after payment succeeds (server-verified).
            </p>
            <p className="credits-modal-balance">Current balance: <strong>{balanceHint}</strong></p>
          </div>
          <button type="button" className="credits-modal-close" aria-label="Close" onClick={() => (!busyPack ? onClose() : null)} disabled={Boolean(busyPack)}>
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {hint ? <p className="credits-modal-banner">{hint}</p> : null}
        {error ? <p className="error credits-modal-banner">{error}</p> : null}

        <div className="credits-pack-grid">
          {(catalog?.packs ?? []).map((pack) => (
            <div key={pack.packId} className="credits-pack-card">
              <p className="credits-pack-credits">{pack.credits}</p>
              <p className="credits-pack-label subtle">credits</p>
              <p className="credits-pack-price">{pack.label}</p>
              <button
                type="button"
                className="btn btn-primary credits-pack-buy"
                disabled={!catalog?.configured || Boolean(busyPack)}
                onClick={() => startCheckout(pack.packId)}
              >
                {busyPack === pack.packId ? "Opening…" : "Buy"}
              </button>
            </div>
          ))}
        </div>

        {!catalog && !error ? <p className="subtle">Loading packs…</p> : null}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

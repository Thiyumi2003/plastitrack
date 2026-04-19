import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export default function ReceiptViewRedirect() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!id || !token) {
      navigate("/", { replace: true });
      return;
    }

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!apiBaseUrl) {
      navigate("/", { replace: true });
      return;
    }

    const receiptUrl = `${apiBaseUrl}/api/dashboard/payments/${id}/receipt-view?token=${encodeURIComponent(token)}`;
    window.location.replace(receiptUrl);
  }, [id, navigate, searchParams]);

  return (
    <div style={{ padding: "32px", textAlign: "center" }}>
      Opening receipt...
    </div>
  );
}

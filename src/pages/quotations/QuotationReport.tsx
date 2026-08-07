import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import { QuotationDocument } from "@/components/quotations/QuotationDocument";
import { Loader2 } from "lucide-react";

export default function QuotationReport() {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const autoDownload = searchParams.get("download") === "true";
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        

        const qRes = await apiFetch(`/api/quotations/${id}`, {});
        if (!qRes.ok) throw new Error("Failed to load quotation");
        const quotationData = await qRes.json();

        const itemsRes = await apiFetch(`/api/quotations/${id}/items`, {});
        if (!itemsRes.ok) throw new Error("Failed to load quotation items");
        const items = await itemsRes.json();

        setQuotation({
          ...quotationData,
          customer: quotationData.customers,
          quotation_items: items
      });
      } catch (err: any) {
        console.error("Report load error:", err);
        setError(err.message || "Failed to load quotation");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  if (loading) return (
    <div style={{ background: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  if (error || !quotation) return (
    <div style={{ color: 'red', padding: '40px', background: 'white', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Failed to load quotation.</h2>
      <p>ID: {id}</p>
      <pre style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', color: '#d32f2f' }}>{error}</pre>
    </div>
  );

  return (
    <QuotationDocument 
      quotation={quotation} 
      onClose={() => nav("/quotations")} 
      autoDownload={autoDownload}
    />
  );
}

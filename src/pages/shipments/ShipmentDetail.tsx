import { apiFetch } from "@/lib/api";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, MapPin, Ship, Container as ContainerIcon, Anchor, Truck as TruckIcon,
  CheckCircle2, Loader2, Package, FileText, Plus, Clock, Shield, FileCheck,
  MessageSquare, AlertCircle, Calendar, ChevronDown, Pencil, X, QrCode
      } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared/FormShell";
import { StatusBadge } from "@/components/shared/StatusBadge";

import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
      } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
      } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

/* ─── Types ─────────────────────────────────────────────────── */
type ShipmentEvent = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  location: string | null;
  created_at: string;
  created_by_name?: string;
};

type Container = {
  id: string;
  container_number: string;
  container_type: string;
  weight_kg: number | null;
  status: string;
};

type Shipment = {
  id: string;
  shipment_number: string;
  customer_name: string;
  carrier: string;
  origin_port: string;
  destination_port: string;
  departure_date: string | null;
  eta: string | null;
  status: string;
  created_at: string;
  company_id: string;
  export_orders?: any;
};

/* ─── Event type meta ────────────────────────────────────────── */
const EVENT_TYPES = [
  { value: "status_change",      label: "Status Change",        icon: CheckCircle2,   color: "text-emerald-400" },
  { value: "port_departure",     label: "Port Departure",       icon: Anchor,         color: "text-blue-400" },
  { value: "port_arrival",       label: "Port Arrival",         icon: Anchor,         color: "text-violet-400" },
  { value: "customs_clearance",  label: "Customs Clearance",    icon: Shield,         color: "text-amber-400" },
  { value: "container_loaded",   label: "Container Loaded",     icon: ContainerIcon,  color: "text-cyan-400" },
  { value: "document_uploaded",  label: "Document Uploaded",    icon: FileCheck,      color: "text-indigo-400" },
  { value: "note",               label: "Note / Update",        icon: MessageSquare,  color: "text-slate-400" },
];

const STATUSES = ["Pending", "Processing", "In Transit", "Delivered"];

const STATUS_STEPS = [
  { status: "Pending",    icon: Clock,          label: "Order Booked" },
  { status: "Processing", icon: ContainerIcon,  label: "Container Stuffed" },
  { status: "In Transit", icon: Ship,           label: "At Sea" },
  { status: "Delivered",  icon: TruckIcon,      label: "Delivered" },
];

/* ─── Helpers ────────────────────────────────────────────────── */
function daysUntil(date: string | null) {
  if (!date) return null;
  const diff = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
  return diff;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      });
}

/* ─── Event icon component ───────────────────────────────────── */
function EventIcon({ type }: { type: string }) {
  const meta = EVENT_TYPES.find((e) => e.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
  const Icon = meta.icon;
  return (
    <span
      className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-background bg-card shrink-0 ${meta.color}`}
    >
      <Icon className="w-4 h-4" />
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════ */
export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [addEventOpen, setAddEventOpen] = useState(false);

  /* ── Shipment ── */
  const {
    data: shipment,
    isLoading: shipLoading
      } = useQuery<Shipment>({
    queryKey: ["shipment", id],
    queryFn: async () => {
      const res = await apiFetch(`/api/finance/export_shipments/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch shipment");
      const shipmentData = await res.json();
      if (shipmentData && shipmentData.order_id) {
        const orderRes = await apiFetch(`/api/finance/export_orders/${shipmentData.order_id}`, { credentials: 'include' });
        if (orderRes.ok) {
          shipmentData.export_orders = await orderRes.json();
        }
      }
      return shipmentData as Shipment;
    },
    enabled: !!id, retry: false
      });

  /* ── Containers ── */
  const { data: containers = [] } = useQuery<Container[]>({
    queryKey: ["shipment_containers", id],
    queryFn: async () => {
      const res = await apiFetch(`/api/finance/export_containers?shipment_id=${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch containers");
      const data = await res.json();
      return (data ?? []) as Container[];
    },
    enabled: !!id, retry: false
      });

  /* ── Linked barcodes ── */
  const { data: linkedBarcodes = [] } = useQuery({
    queryKey: ["shipment_barcodes", id],
    queryFn: async () => {
      try {
        const res = await apiFetch(`/api/barcodes?shipment_id=${id}`, { credentials: 'include' });
        if (!res.ok) return [];
        const json = await res.json();
        return (json?.data ?? []) as any[];
      } catch { return []; }
    },
    enabled: !!id,
    refetchInterval: 20_000
      });

  /* ── Events timeline ── */
  const { data: events = [], isLoading: eventsLoading } = useQuery<ShipmentEvent[]>({
    queryKey: ["shipment_events", id],
    queryFn: async () => {
      try {
        const res = await apiFetch(`/api/shipments/events?shipment_id=${id}`, { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return (data ?? []) as ShipmentEvent[];
      } catch { return []; }
    },
    enabled: !!id,
    refetchInterval: 15_000, // poll every 15 s
  });

  /* ── Update shipment status ── */
  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      // const error = new Error('VpsDb removed');
      // if (error) throw error;

      // Log automatic status-change event
      await apiFetch(`/api/shipment_events`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_id: id, event_type: "status_change", title: "Shipment status updated", description: "Updated to " + (formData?.status || "new status"), location: formData?.vessel_name || "", date: new Date().toISOString().split('T')[0] }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipment", id] });
      qc.invalidateQueries({ queryKey: ["shipment_events", id] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status")
      });

  /* ── Update container status ── */
  const updateContainer = useMutation({
    mutationFn: async ({ cid, status }: { cid: string; status: string }) => {
      const res = await apiFetch(`/api/finance/export_containers/${cid}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update container");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipment_containers", id] });
      toast.success("Container status updated");
    }
      });

  if (shipLoading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!shipment) return <div className="p-12 text-center text-muted-foreground">Shipment not found.</div>;

  /* ── Step tracker ── */
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.status === shipment.status);
  const etaDays = daysUntil(shipment.eta);
  const order = Array.isArray(shipment.export_orders)
    ? shipment.export_orders[0]
    : shipment.export_orders;

  return (
    <div>
      <PageHeader
        title={shipment.shipment_number}
        description={`${shipment.customer_name ?? "—"}  ·  ${shipment.carrier ?? "—"}`}
        breadcrumbs={[{ label: "Shipments", to: "/shipments" }, { label: shipment.shipment_number }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => nav(`/documents/invoices/${id}`)}>
              <FileText className="h-4 w-4 mr-1.5 text-primary" /> Generate PI
            </Button>
            <Button size="sm" className="btn-gold" onClick={() => setAddEventOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Event
            </Button>
            <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
          </div>
        }
      />

      {/* ── Step tracker bar ── */}
      <div className="erp-card mb-4">
        <div className="flex items-center justify-between relative">
          {/* line */}
          <div className="absolute top-5 left-0 right-0 h-px bg-border mx-10 z-0" />
          {STATUS_STEPS.map((step, idx) => {
            const done = idx <= currentStepIdx;
            const current = idx === currentStepIdx;
            const Icon = step.icon;
            return (
              <div key={step.status} className="flex flex-col items-center gap-2 z-10 flex-1">
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all
                    ${done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                    }
                    ${current ? "ring-4 ring-primary/20 scale-110" : ""}
                  `}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className={`text-[11px] text-center font-medium ${done ? "text-primary" : "text-muted-foreground"}`}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ───── LEFT: Timeline + Containers ───── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Cargo Barcodes - Professional 7-Field Table */}
          <Section title={
            <span className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Professional Cargo Tracking
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                {linkedBarcodes.length} Items Packed
              </Badge>
            </span>
          }>
            {linkedBarcodes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed rounded-2xl bg-muted/5">
                <QrCode className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No Scanned Cargo</p>
                <p className="text-xs opacity-70">Link barcodes to this shipment via the <strong>Scan QR</strong> module.</p>
              </div>
            ) : (
              <div className="border border-white/5 rounded-xl overflow-hidden bg-card shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-primary/5 border-b border-white/5">
                      <tr>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-muted-foreground">Product / SKU</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-muted-foreground">Carton #</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-muted-foreground">Weight</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-muted-foreground">Packing Date</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-muted-foreground text-right">Barcode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {linkedBarcodes.map((b: any) => (
                        <tr 
                          key={b.id} 
                          className="hover:bg-primary/5 cursor-pointer transition-colors"
                          onClick={() => nav(`/barcodes/${b.id}`)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-primary">{b.batch?.product?.name || "Generic Cargo"}</div>
                            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{b.sku_code || "—"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="font-mono bg-white/5 border-white/10 text-[10px]">
                              {b.box_number} / {b.carton_number_total || "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-500">
                            {b.net_weight ? `${b.net_weight} Kg` : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {b.packing_date || "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-mono text-[9px] text-primary-glow">{b.code}</div>
                            <div className="mt-1 flex items-center justify-end gap-2">
                              <StatusBadge status={b.current_location} className="scale-75 origin-right" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Section>

          {/* Container Breakdown */}
          <Section title={`Containers (${containers.length})`}>
            {containers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No containers linked to this shipment.</p>
            ) : (
              <div className="space-y-2">
                {containers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ContainerIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold font-mono truncate">{c.container_number || "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.container_type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.weight_kg != null && (
                        <span className="text-xs text-muted-foreground">{c.weight_kg.toLocaleString()} kg</span>
                      )}
                      <Select
                        value={c.status ?? "Pending"}
                        onValueChange={(val) => updateContainer.mutate({ cid: c.id, status: val })}
                      >
                        <SelectTrigger className="h-7 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Pending", "Loaded", "Gate-Out", "At Sea", "Delivered"].map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Events Timeline */}
          <Section title="Tracking Timeline">
            {eventsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No events yet. Click <strong>Add Event</strong> to log the first milestone.
              </div>
            ) : (
              <ol className="relative space-y-5">
                {events.map((ev, i) => (
                  <li key={ev.id} className="flex items-start gap-4">
                    <EventIcon type={ev.event_type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{ev.title}</span>
                        {ev.location && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {ev.location}
                          </span>
                        )}
                      </div>
                      {ev.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.description}</p>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">{fmtDateTime(ev.created_at)}</div>
                    </div>
                    {i < events.length - 1 && (
                      <div className="absolute left-[15px] top-10 w-px bg-border" style={{ height: "calc(100% - 2.5rem)" }} />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* ───── RIGHT: Status + Info cards ───── */}
        <div className="space-y-4">
          {/* Status control */}
          <Section title="Voyage Status">
            <div className="space-y-3">
              <StatusBadge status={shipment.status} />
              <div className="border-t border-border pt-3">
                <label className="text-xs font-medium text-muted-foreground block mb-2">Change Status</label>
                <Select
                  value={shipment.status}
                  onValueChange={(v) => updateStatus.mutate(v)}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* ETA Card */}
          <Section title="Schedule">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> ETD
                </dt>
                <dd className="font-medium">{fmtDate(shipment.departure_date)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> ETA
                </dt>
                <dd className="font-medium">{fmtDate(shipment.eta)}</dd>
              </div>
              {etaDays !== null && shipment.status !== "Delivered" && (
                <div className="mt-1 pt-2 border-t border-border">
                  {etaDays >= 0 ? (
                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/5">
                      <Clock className="h-3 w-3 mr-1" />
                      {etaDays === 0 ? "Arriving today" : `${etaDays} day${etaDays !== 1 ? "s" : ""} to arrival`}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {Math.abs(etaDays)} day{Math.abs(etaDays) !== 1 ? "s" : ""} overdue
                    </Badge>
                  )}
                </div>
              )}
              {shipment.status === "Delivered" && (
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/5">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Delivered
                </Badge>
              )}
            </dl>
          </Section>

          {/* Route */}
          <Section title="Route">
            <div className="space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Origin</div>
                  <div className="font-medium">{shipment.origin_port}</div>
                </div>
              </div>
              <div className="ml-2 h-6 border-l border-dashed border-muted-foreground" />
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Destination</div>
                  <div className="font-medium">{shipment.destination_port}</div>
                </div>
              </div>
            </div>
          </Section>

          {/* Linked order */}
          {order && (
            <Section title="Linked Order">
              <dl className="space-y-2 text-sm">
                {[
                  ["Order Ref", <span className="font-mono">{order.order_number || "—"}</span>],
                  ["Product", order.product || "—"],
                  ["Quantity", `${order.quantity ?? "—"} ${order.unit ?? ""}`],
                  ["Value", order.total_amount ? `${order.currency ?? "USD"} ${Number(order.total_amount).toLocaleString()}` : "—"],
                  ["Incoterms", order.incoterms || "—"],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground shrink-0">{label}</dt>
                    <dd className="text-right">{val}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
        </div>
      </div>

      {/* ── Add Event Dialog ── */}
      <AddEventDialog
        open={addEventOpen}
        onClose={() => setAddEventOpen(false)}
        shipmentId={id!}
        companyId={shipment.company_id}
        profileId={profile?.id}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["shipment_events", id] });
          setAddEventOpen(false);
          toast.success("Event logged");
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Add Event Dialog
═══════════════════════════════════════════════════════════════ */
function AddEventDialog({
  open, onClose, shipmentId, companyId, profileId, onSuccess
      }: {
  open: boolean;
  onClose: () => void;
  shipmentId: string;
  companyId: string;
  profileId?: string;
  onSuccess: () => void;
}) {
  const [eventType, setEventType] = useState("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEventType("note"); setTitle(""); setDescription(""); setLocation("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/shipment_events`, { 
        method: 'POST', 
        credentials: 'include', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          shipment_id: id, 
          event_type: eventType, 
          title: title, 
          description: description, 
          location: location, 
          date: new Date().toISOString().split('T')[0] 
        }) 
      });
      if (!res.ok) throw new Error("Failed to save event");
      // if (error) throw error;
      reset();
      onSuccess();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to log event");
    } finally {
      setSaving(false);
    }
  };

  const selectedMeta = EVENT_TYPES.find((e) => e.value === eventType)!;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Log Shipment Event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Event type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Event type</label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((et) => {
                  const Icon = et.icon;
                  return (
                    <SelectItem key={et.value} value={et.value}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${et.color}`} />
                        {et.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title <span className="text-destructive">*</span></label>
            <Input
              placeholder={`e.g. ${selectedMeta.label}…`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Location (optional)</label>
            <Input
              placeholder="e.g. Mundra Port, India"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <Textarea
              rows={3}
              placeholder="Add any relevant details…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button className="btn-gold" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Log Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

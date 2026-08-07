import { apiFetch } from "@/lib/api";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableInput } from "@/components/ui/SearchableInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { Search, Plus, Edit2, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

const initialFormState = {
  id: "",
  batch_number: "",
  product_name: "",
  total_quantity: "",
  remaining_quantity: "",
  unit: "kg",
  received_date: new Date().toISOString().slice(0, 10),
  expiry_date: new Date().toISOString().slice(0, 10),
  status: "approved",
  warehouse: "",
  notes: "",
};

const statusColorMap: Record<string, string> = {
  "approved": "bg-green-50 text-green-800 border-green-200",
  "pending_qc": "bg-yellow-50 text-yellow-800 border-yellow-200",
  "reserved": "bg-blue-50 text-blue-800 border-blue-200",
  "shipped": "bg-purple-50 text-purple-800 border-purple-200",
  "damaged": "bg-red-50 text-red-800 border-red-200",
  "rejected": "bg-red-100 text-red-900 border-red-300",
  "consumed": "bg-gray-50 text-gray-800 border-gray-200",
};

export default function BatchWiseStock() {
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-list', profile?.company_id],
    queryFn: async () => {
      const headers = session?.access_token ? { 'Authorization': `Bearer ${session?.access_token}` } : undefined;
      const res = await apiFetch('/api/warehouse/warehouses', { headers });
      if (!res.ok) throw new Error('Failed to fetch warehouses');
      const data = await res.json();
      return (data || []).filter((w: any) => !w.is_deleted && (!profile?.company_id || w.company_id === profile.company_id));
    }
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list', profile?.company_id],
    queryFn: async () => {
      const headers = session?.access_token ? { 'Authorization': `Bearer ${session?.access_token}` } : undefined;
      const res = await apiFetch('/api/products', { headers });
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      return (data || []).filter((p: any) => p.is_active && !p.is_deleted && (!profile?.company_id || p.company_id === profile.company_id));
    }
  });

  const { data: rawBatches = [], isLoading: isBatchesLoading } = useQuery({
    queryKey: ["inventory-batches", profile?.company_id],
    queryFn: async () => {
      const headers = session?.access_token ? { 'Authorization': `Bearer ${session?.access_token}` } : undefined;
      const res = await apiFetch('/api/inventory/inventory_batches', { headers });
      if (!res.ok) throw new Error('Failed to fetch batches');
      const data = await res.json();
      return (data || []).filter((b: any) => !b.is_deleted && (!profile?.company_id || b.company_id === profile.company_id));
    },
  });

  const batches = useMemo(() => {
    return rawBatches.map((b: any) => {
      const prod = products.find((p: any) => p.id === b.product_id);
      const wh = warehouses.find((w: any) => w.id === b.warehouse_id);
      return {
        ...b,
        batch_number: b.lot_number,
        product_name: prod ? prod.name : 'Unknown Product',
        total_quantity: b.quantity_kg,
        remaining_quantity: b.quantity_remaining_kg,
        unit: prod ? prod.unit : 'kg',
        warehouse: wh ? wh.name : 'Unknown Warehouse',
        notes: b.damaged_notes || ''
      };
    });
  }, [rawBatches, products, warehouses]);

  const uniqueProducts = useMemo(() => {
    const seen = new Map<string, any>();
    for (const p of products) {
      const key = (p.name || '').toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.set(key, p);
      }
    }
    return Array.from(seen.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [products]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const headers = session?.access_token ? {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      } : { 'Content-Type': 'application/json' };

      let company_id = profile?.company_id;

      const body = {
        company_id,
        lot_number: payload.batch_number,
        product_id: products.find((p: any) => p.name === payload.product_name)?.id,
        warehouse_id: warehouses.find((w: any) => w.name === payload.warehouse)?.id,
        quantity_kg: Number(payload.total_quantity),
        quantity_remaining_kg: Number(payload.remaining_quantity),
        status: payload.status,
        received_date: payload.received_date,
        expiry_date: payload.expiry_date,
        damaged_notes: payload.notes || null,
        is_deleted: false
      };

      if (payload.id) {
        const res = await apiFetch(`/api/inventory/inventory_batches/${payload.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body)
        });
        if (!res.ok) {
           const errData = await res.json().catch(() => ({}));
           throw new Error(errData.error || 'Update failed');
        }
      } else {
        const res = await apiFetch(`/api/inventory/inventory_batches`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        if (!res.ok) {
           const errData = await res.json().catch(() => ({}));
           throw new Error(errData.error || 'Insert failed');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-batches"] });
      setIsModalOpen(false);
      setSelectedBatch(null);
      setFormState(initialFormState);
      toast.success("Batch saved successfully.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save batch."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = session?.access_token ? { 'Authorization': `Bearer ${session?.access_token}` } : undefined;
      const res = await apiFetch(`/api/inventory/inventory_batches/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-batches"] });
      toast.success("Batch deleted successfully.");
      setIsConfirmOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete batch."),
  });

  const today = new Date();

  const filteredBatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return (batches || []).filter((batch: any) => {
      const batchNum = batch.batch_number?.toLowerCase() || "";
      const productName = batch.product_name?.toLowerCase() || "";
      const statusMatch = statusFilter === "all" || batch.status === statusFilter;
      const searchMatch = !query || batchNum.includes(query) || productName.includes(query);
      return statusMatch && searchMatch;
    });
  }, [batches, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const totalBatches = (batches || []).length;
    const inStockCount = (batches || []).filter((b: any) => b.status === "approved" || b.status === "pending_qc").length;
    const expiringCount = (batches || []).filter((b: any) => {
      if (!b.expiry_date) return false;
      const daysUntilExpiry = differenceInDays(parseISO(b.expiry_date), today);
      return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
    }).length;
    const lowStockCount = (batches || []).filter((b: any) => {
      const percentRemaining = (Number(b.remaining_quantity) / Number(b.total_quantity)) * 100;
      return percentRemaining < 20;
    }).length;

    return { totalBatches, inStockCount, expiringCount, lowStockCount };
  }, [batches, today]);

  const openAddModal = () => {
    setSelectedBatch(null);
    setFormState(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (batch: any) => {
    setSelectedBatch(batch);
    setFormState({
      id: batch.id,
      batch_number: batch.batch_number || "",
      product_name: batch.product_name || "",
      total_quantity: String(batch.total_quantity || ""),
      remaining_quantity: String(batch.remaining_quantity || ""),
      unit: batch.unit || "kg",
      received_date: batch.received_date || new Date().toISOString().slice(0, 10),
      expiry_date: batch.expiry_date || new Date().toISOString().slice(0, 10),
      status: batch.status || "approved",
      warehouse: batch.warehouse || "",
      notes: batch.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formState.batch_number || !formState.product_name || !formState.total_quantity || !formState.remaining_quantity) {
      toast.error("Please fill in all required fields.");
      return;
    }

    mutation.mutate({
      ...formState,
      total_quantity: Number(formState.total_quantity),
      remaining_quantity: Number(formState.remaining_quantity),
    });
  };

  const openConfirm = (id: string) => {
    setConfirmTargetId(id);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!confirmTargetId) return;
    deleteMutation.mutate(confirmTargetId);
  };

  const isLowStock = (batch: any) => {
    const percentRemaining = (Number(batch.remaining_quantity) / Number(batch.total_quantity)) * 100;
    return percentRemaining < 20;
  };

  const isExpiringBatch = (batch: any) => {
    if (!batch.expiry_date) return false;
    const daysUntilExpiry = differenceInDays(parseISO(batch.expiry_date), today);
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  };

  const isExpired = (batch: any) => {
    if (!batch.expiry_date) return false;
    return differenceInDays(parseISO(batch.expiry_date), today) < 0;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch-wise Stock Tracking"
        description="Track inventory by individual batches"
        breadcrumbs={[{ label: "Inventory", to: "/inventory" }, { label: "Batch-wise Stock Tracking" }]}
        actions={
          <Button onClick={openAddModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Batch
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Batches</p>
            <p className="text-3xl font-bold">{summary.totalBatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">In Stock Batches</p>
            <p className="text-3xl font-bold">{summary.inStockCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Expiring Soon</p>
            <p className="text-3xl font-bold text-amber-500">{summary.expiringCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Low Stock Batches</p>
            <p className="text-3xl font-bold text-red-500">{summary.lowStockCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by batch number or product name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending_qc">Pending QC</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch No</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead className="text-right">Remaining Qty</TableHead>
                <TableHead>Received Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isBatchesLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading batches...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredBatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No batches found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBatches.map((batch: any) => (
                  <TableRow
                    key={batch.id}
                    className={cn(
                      "hover:bg-muted/50",
                      isLowStock(batch) && "bg-red-50/30",
                      isExpired(batch) && "bg-red-100/50"
                    )}
                  >
                    <TableCell className="font-mono font-semibold">{batch.batch_number}</TableCell>
                    <TableCell className="font-medium">{batch.product_name}</TableCell>
                    <TableCell className="text-right">{Number(batch.total_quantity).toLocaleString()} {batch.unit}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {Number(batch.remaining_quantity).toLocaleString()} {batch.unit}
                    </TableCell>
                    <TableCell>{batch.received_date ? format(parseISO(batch.received_date), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>
                      {batch.expiry_date ? (
                        <div className="flex items-center gap-2">
                          <span>{format(parseISO(batch.expiry_date), "MMM d, yyyy")}</span>
                          {isExpiringBatch(batch) && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          {isExpired(batch) && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border px-2", statusColorMap[batch.status] || statusColorMap["approved"])}>
                        {batch.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditModal(batch)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openConfirm(batch.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedBatch ? "Edit Batch" : "Add New Batch"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Batch Number *</Label>
                <Input
                  value={formState.batch_number}
                  onChange={(e) => setFormState((prev) => ({ ...prev, batch_number: e.target.value }))}
                  placeholder="e.g., BATCH-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Select
                  value={formState.product_name}
                  onValueChange={(val) => setFormState((prev) => ({ ...prev, product_name: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueProducts.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No products available</div>
                    ) : (
                      uniqueProducts.map((p: any) => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Total Quantity *</Label>
                <Input
                  type="number"
                  min="0"
                  value={formState.total_quantity}
                  onChange={(e) => setFormState((prev) => ({ ...prev, total_quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Remaining Quantity *</Label>
                <Input
                  type="number"
                  min="0"
                  value={formState.remaining_quantity}
                  onChange={(e) => setFormState((prev) => ({ ...prev, remaining_quantity: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={formState.unit}
                  onChange={(e) => setFormState((prev) => ({ ...prev, unit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name and Location</Label>
                <SearchableInput
                    placeholder="Type or select warehouse..."
                    value={formState.warehouse}
                    onChange={(val) => setFormState((prev) => ({ ...prev, warehouse: val }))}
                    options={warehouses.map((w: any) => ({
                      id: w.id,
                      name: w.name,
                      description: [w.location, w.city].filter(Boolean).join(", ")
                    }))}
                  />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Received Date</Label>
                <Input
                  type="date"
                  value={formState.received_date}
                  onChange={(e) => setFormState((prev) => ({ ...prev, received_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={formState.expiry_date}
                  onChange={(e) => setFormState((prev) => ({ ...prev, expiry_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formState.status} onValueChange={(value) => setFormState((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending_qc">Pending QC</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="consumed">Consumed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={4}
                  value={formState.notes}
                  onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={mutation.isLoading}>
              {mutation.isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Archive Batch"
        description="Are you sure you want to archive this batch? It will be hidden from the active list but kept for historical records."
        onConfirm={handleConfirm}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}

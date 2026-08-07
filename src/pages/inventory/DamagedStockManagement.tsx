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
import { Search, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

const initialFormState = {
  id: "",
  product_name: "",
  batch_number: "",
  quantity: "",
  unit: "kg",
  damage_type: "Pest",
  damage_date: new Date().toISOString().slice(0, 10),
  reported_by: "",
  warehouse: "",
  estimated_loss: "",
  action_taken: "Under Review",
  notes: "",
};

const damageTypeColors: Record<string, string> = {
  Pest: "bg-purple-50 text-purple-800 border-purple-200",
  Weather: "bg-blue-50 text-blue-800 border-blue-200",
  Handling: "bg-orange-50 text-orange-800 border-orange-200",
  Expiry: "bg-red-50 text-red-800 border-red-200",
  Other: "bg-gray-50 text-gray-800 border-gray-200",
};

const actionTakenColors: Record<string, string> = {
  "Under Review": "bg-yellow-50 text-yellow-800 border-yellow-200",
  Disposed: "bg-red-50 text-red-800 border-red-200",
  "Written Off": "bg-gray-50 text-gray-800 border-gray-200",
  "Returned to Supplier": "bg-blue-50 text-blue-800 border-blue-200",
};

export default function DamagedStockManagement() {
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [damageTypeFilter, setDamageTypeFilter] = useState("all");
  const [actionTakenFilter, setActionTakenFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);

  const { data: records = [], isLoading: isRecordsLoading } = useQuery({
    queryKey: ["damaged-stock"],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/inventory/damaged_stock', {
          headers: { }
        });
        if (!res.ok) throw new Error('Failed to fetch damaged stock');
        const rows = await res.json();
        return (rows || []).filter((r: any) => !r.is_deleted);
      } catch (err) {
        console.error('Error fetching damaged stock:', err);
        return [];
      }
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const res = await apiFetch('/api/products', {
        headers: { }
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      return (data || []).filter((p: any) => p.is_active).sort((a: any, b: any) => a.name.localeCompare(b.name));
    }
  });

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

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await apiFetch('/api/inventory/warehouses', {
        headers: { }
      });
      if (!res.ok) throw new Error('Failed to fetch warehouses');
      const data = await res.json();
      return (data || []).filter((w: any) => !w.is_deleted).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const body = {
        product_name: payload.product_name,
        batch_number: payload.batch_number || null,
        quantity: payload.quantity,
        unit: payload.unit || 'kg',
        damage_type: payload.damage_type,
        damage_date: payload.damage_date,
        reported_by: payload.reported_by || null,
        warehouse: payload.warehouse || null,
        estimated_loss: payload.estimated_loss || null,
        action_taken: payload.action_taken || 'Under Review',
        notes: payload.notes || null,
        company_id: profile?.company_id || null,
        updated_at: new Date().toISOString(),
      };
      if (payload.id) {
        const res = await apiFetch(`/api/inventory/damaged_stock/${payload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Update failed'); }
      } else {
        const res = await apiFetch('/api/inventory/damaged_stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Insert failed'); }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damaged-stock"] });
      setIsModalOpen(false);
      setSelectedRecord(null);
      setFormState(initialFormState);
      toast.success("Record saved successfully.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save record."),
  });



  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/inventory/damaged_stock/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: profile?.id || null })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Delete failed'); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damaged-stock"] });
      toast.success("Record hidden successfully.");
      setIsConfirmOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete record."),
  });

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return (records || []).filter((record: any) => {
      const productMatch = record.product_name?.toLowerCase().includes(query) || false;
      const batchMatch = record.batch_number?.toLowerCase().includes(query) || false;
      const damageTypeMatch = damageTypeFilter === "all" || record.damage_type === damageTypeFilter;
      const actionTakenMatch = actionTakenFilter === "all" || record.action_taken === actionTakenFilter;

      let dateMatch = true;
      if (startDate || endDate) {
        const recordDate = parseISO(record.damage_date);
        if (startDate && recordDate < parseISO(startDate)) dateMatch = false;
        if (endDate && recordDate > parseISO(endDate)) dateMatch = false;
      }

      return (productMatch || batchMatch) && damageTypeMatch && actionTakenMatch && dateMatch;
    });
  }, [records, searchTerm, damageTypeFilter, actionTakenFilter, startDate, endDate]);

  const summary = useMemo(() => {
    const totalRecords = (records || []).length;
    const totalQuantity = (records || []).reduce((sum, r: any) => sum + Number(r.quantity || 0), 0);
    const totalLoss = (records || []).reduce((sum, r: any) => sum + Number(r.estimated_loss || 0), 0);
    const pendingReview = (records || []).filter((r: any) => r.action_taken === "Under Review").length;

    return { totalRecords, totalQuantity, totalLoss, pendingReview };
  }, [records]);

  const openAddModal = () => {
    setSelectedRecord(null);
    setFormState(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (record: any) => {
    setSelectedRecord(record);
    setFormState({
      id: record.id,
      product_name: record.product_name || "",
      batch_number: record.batch_number || "",
      quantity: String(record.quantity || ""),
      unit: record.unit || "kg",
      damage_type: record.damage_type || "Pest",
      damage_date: record.damage_date || new Date().toISOString().slice(0, 10),
      reported_by: record.reported_by || "",
      warehouse: record.warehouse || "",
      estimated_loss: String(record.estimated_loss || ""),
      action_taken: record.action_taken || "Under Review",
      notes: record.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formState.product_name || !formState.quantity || !formState.damage_type) {
      toast.error("Please fill in all required fields.");
      return;
    }

    mutation.mutate({
      ...formState,
      quantity: Number(formState.quantity),
      estimated_loss: formState.estimated_loss ? Number(formState.estimated_loss) : 0,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Damaged Stock Management"
        description="Record and manage damaged stock"
        breadcrumbs={[{ label: "Inventory", to: "/inventory" }, { label: "Damaged Stock Management" }]}
        actions={
          <Button onClick={openAddModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Report Damage
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Damaged Records</p>
            <p className="text-3xl font-bold">{summary.totalRecords}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Quantity Damaged</p>
            <p className="text-3xl font-bold">{Number(summary.totalQuantity).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Estimated Loss</p>
            <p className="text-3xl font-bold text-red-500">₹{Number(summary.totalLoss).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending Review</p>
            <p className="text-3xl font-bold text-amber-500">{summary.pendingReview}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by product or batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={damageTypeFilter} onValueChange={setDamageTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Damage Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Damage Types</SelectItem>
                <SelectItem value="Pest">Pest</SelectItem>
                <SelectItem value="Weather">Weather</SelectItem>
                <SelectItem value="Handling">Handling</SelectItem>
                <SelectItem value="Expiry">Expiry</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionTakenFilter} onValueChange={setActionTakenFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="Under Review">Under Review</SelectItem>
                <SelectItem value="Disposed">Disposed</SelectItem>
                <SelectItem value="Written Off">Written Off</SelectItem>
                <SelectItem value="Returned to Supplier">Returned to Supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Batch No</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Damage Type</TableHead>
                <TableHead>Damage Date</TableHead>
                <TableHead>Reported By</TableHead>
                <TableHead className="text-right">Est. Loss (₹)</TableHead>
                <TableHead>Action Taken</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRecordsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <div className="flex items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading records...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record: any) => (
                  <TableRow key={record.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{record.product_name}</TableCell>
                    <TableCell className="font-mono text-sm">{record.batch_number || "-"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {Number(record.quantity).toLocaleString()} {record.unit}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border px-2 ${damageTypeColors[record.damage_type] || damageTypeColors.Other}`}>
                        {record.damage_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(parseISO(record.damage_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm">{record.reported_by || "-"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {record.estimated_loss ? `₹${Number(record.estimated_loss).toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border px-2 ${actionTakenColors[record.action_taken] || actionTakenColors["Under Review"]}`}>
                        {record.action_taken}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditModal(record)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openConfirm(record.id)}>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRecord ? "Edit Damage Report" : "Report Damage"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="space-y-2">
                <Label>Batch Number</Label>
                <Input
                  value={formState.batch_number}
                  onChange={(e) => setFormState((prev) => ({ ...prev, batch_number: e.target.value }))}
                  placeholder="e.g., BATCH-001"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="0"
                  value={formState.quantity}
                  onChange={(e) => setFormState((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={formState.unit}
                  onChange={(e) => setFormState((prev) => ({ ...prev, unit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Damage Type *</Label>
                <Select value={formState.damage_type} onValueChange={(value) => setFormState((prev) => ({ ...prev, damage_type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pest">Pest</SelectItem>
                    <SelectItem value="Weather">Weather</SelectItem>
                    <SelectItem value="Handling">Handling</SelectItem>
                    <SelectItem value="Expiry">Expiry</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Damage Date *</Label>
                <Input
                  type="date"
                  value={formState.damage_date}
                  onChange={(e) => setFormState((prev) => ({ ...prev, damage_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reported By</Label>
                <Input
                  value={formState.reported_by}
                  onChange={(e) => setFormState((prev) => ({ ...prev, reported_by: e.target.value }))}
                  placeholder="e.g., John Doe"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Warehouse</Label>
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
              <div className="space-y-2">
                <Label>Estimated Loss (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formState.estimated_loss}
                  onChange={(e) => setFormState((prev) => ({ ...prev, estimated_loss: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Action Taken *</Label>
              <Select value={formState.action_taken} onValueChange={(value) => setFormState((prev) => ({ ...prev, action_taken: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Disposed">Disposed</SelectItem>
                  <SelectItem value="Written Off">Written Off</SelectItem>
                  <SelectItem value="Returned to Supplier">Returned to Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={4}
                value={formState.notes}
                onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional details about the damage..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={mutation.isLoading}>
              {mutation.isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Delete Record"
        description="Are you sure you want to delete this damage record? This action cannot be undone."
        onConfirm={handleConfirm}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}

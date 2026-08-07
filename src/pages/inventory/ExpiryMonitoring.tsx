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
  product_name: "",
  batch_number: "",
  quantity: "",
  unit: "kg",
  manufacture_date: new Date().toISOString().slice(0, 10),
  expiry_date: new Date().toISOString().slice(0, 10),
  warehouse: "",
  status: "Active",
  notes: "",
};

const statusColorMap: Record<string, string> = {
  Active: "bg-green-50 text-green-800 border-green-200",
  "Expiring Soon": "bg-orange-50 text-orange-800 border-orange-200",
  Expired: "bg-red-50 text-red-800 border-red-200",
  Disposed: "bg-gray-50 text-gray-800 border-gray-200",
};

export default function ExpiryMonitoring() {
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);

  const today = new Date();

  const { data: items = [], isLoading: isItemsLoading } = useQuery({
    queryKey: ["expiry-monitoring"],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/inventory/expiry_monitoring', {
          headers: { }
        });
        if (!res.ok) throw new Error('Failed to fetch expiry monitoring');
        const rows = await res.json();
        return (rows || []).filter((r: any) => !r.is_deleted);
      } catch (err) {
        console.error('Error fetching expiry monitoring:', err);
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
        manufacture_date: payload.manufacture_date || null,
        expiry_date: payload.expiry_date,
        warehouse: payload.warehouse || null,
        status: payload.status || 'Active',
        notes: payload.notes || null,
        company_id: profile?.company_id || null,
        updated_at: new Date().toISOString(),
      };
      if (payload.id) {
        const res = await apiFetch(`/api/inventory/expiry_monitoring/${payload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Update failed'); }
      } else {
        const res = await apiFetch('/api/inventory/expiry_monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Insert failed'); }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expiry-monitoring"] });
      setIsModalOpen(false);
      setSelectedItem(null);
      setFormState(initialFormState);
      toast.success("Item saved successfully.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save item."),
  });



  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/inventory/expiry_monitoring/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: profile?.id || null })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Delete failed'); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expiry-monitoring"] });
      toast.success("Item hidden successfully.");
      setIsConfirmOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete item."),
  });

  const calculateDaysRemaining = (expiryDateStr: string) => {
    if (!expiryDateStr) return 9999;
    try {
      return differenceInDays(parseISO(expiryDateStr), today);
    } catch {
      return 9999;
    }
  };

  const calculateStatus = (daysRemaining: number, storedStatus: string) => {
    if (storedStatus === "Disposed") return "Disposed";
    if (daysRemaining < 0) return "Expired";
    if (daysRemaining <= 7) return "Expiring Soon";
    return "Active";
  };

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return (items || []).filter((item: any) => {
      const daysRemaining = calculateDaysRemaining(item.expiry_date);
      const computedStatus = calculateStatus(daysRemaining, item.status);

      const productMatch = item.product_name?.toLowerCase().includes(query) || false;
      const batchMatch = item.batch_number?.toLowerCase().includes(query) || false;
      const statusMatch =
        statusFilter === "all" ||
        item.status === statusFilter ||
        computedStatus === statusFilter;

      let dateMatch = true;
      if ((startDate || endDate) && item.expiry_date) {
        const itemDate = item.expiry_date ? parseISO(item.expiry_date) : null;
        if (itemDate && startDate && itemDate < parseISO(startDate)) dateMatch = false;
        if (itemDate && endDate && itemDate > parseISO(endDate)) dateMatch = false;
      }

      return (productMatch || batchMatch) && statusMatch && dateMatch;
    });
  }, [items, searchTerm, statusFilter, startDate, endDate, today]);

  const summary = useMemo(() => {
    const totalItems = (items || []).length;
    const expiringWithin7 = (items || []).filter((item: any) => {
      const days = calculateDaysRemaining(item.expiry_date);
      return days >= 0 && days <= 7;
    }).length;
    const expiringWithin30 = (items || []).filter((item: any) => {
      const days = calculateDaysRemaining(item.expiry_date);
      return days > 7 && days <= 30;
    }).length;
    const expired = (items || []).filter((item: any) => {
      const days = calculateDaysRemaining(item.expiry_date);
      return days < 0;
    }).length;

    return { totalItems, expiringWithin7, expiringWithin30, expired };
  }, [items, today]);

  const criticalCount = summary.expiringWithin7 + summary.expired;
  const showAlertBanner = criticalCount > 0;

  const openAddModal = () => {
    setSelectedItem(null);
    setFormState(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setSelectedItem(item);
    setFormState({
      id: item.id,
      product_name: item.product_name || "",
      batch_number: item.batch_number || "",
      quantity: String(item.quantity || ""),
      unit: item.unit || "kg",
      manufacture_date: item.manufacture_date || new Date().toISOString().slice(0, 10),
      expiry_date: item.expiry_date || new Date().toISOString().slice(0, 10),
      warehouse: item.warehouse || "",
      status: item.status || "Active",
      notes: item.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formState.product_name || !formState.quantity || !formState.expiry_date) {
      toast.error("Please fill in all required fields.");
      return;
    }

    mutation.mutate({
      ...formState,
      quantity: Number(formState.quantity),
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

  const getRowHighlight = (daysRemaining: number) => {
    if (daysRemaining < 0) return "bg-red-950/20";
    if (daysRemaining <= 7) return "bg-red-950/20";
    if (daysRemaining <= 30) return "bg-orange-950/20";
    return "";
  };

  const getDaysRemainingBadge = (daysRemaining: number) => {
    if (daysRemaining < 0) {
      return <Badge className="bg-red-600 text-white">Expired</Badge>;
    }
    if (daysRemaining <= 7) {
      return <Badge className="bg-red-600 text-white">{daysRemaining} days</Badge>;
    }
    if (daysRemaining <= 30) {
      return <Badge className="bg-orange-600 text-white">{daysRemaining} days</Badge>;
    }
    return <Badge className="bg-green-600 text-white">{daysRemaining} days</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry Monitoring"
        description="Monitor stock expiration dates and alerts"
        breadcrumbs={[{ label: "Inventory", to: "/inventory" }, { label: "Expiry Monitoring" }]}
        actions={
          <Button onClick={openAddModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        }
      />

      {showAlertBanner && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Action Required</p>
            <p className="text-sm text-red-800">
              {criticalCount} item{criticalCount !== 1 ? "s" : ""} ha{criticalCount !== 1 ? "ve" : "s"} expired or {criticalCount !== 1 ? "are" : "is"} expiring soon — immediate action needed
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Items Tracked</p>
            <p className="text-3xl font-bold">{summary.totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Expiring Within 7 Days</p>
            <p className="text-3xl font-bold text-red-500">{summary.expiringWithin7}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Expiring Within 30 Days</p>
            <p className="text-3xl font-bold text-orange-500">{summary.expiringWithin30}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Already Expired</p>
            <p className="text-3xl font-bold text-red-700">{summary.expired}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:gap-4 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by product or batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Disposed">Disposed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:gap-4 md:grid-cols-3 items-end">
            <div className="space-y-2">
              <Label className="text-xs">Expiry From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Expiry To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setStartDate("");
                setEndDate("");
              }}
              className="w-full"
            >
              Reset Filters
            </Button>
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
                <TableHead>Manufacture Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Days Remaining</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isItemsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <div className="flex items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading items...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    No items found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item: any) => {
                  const daysRemaining = calculateDaysRemaining(item.expiry_date);
                  const computedStatus = calculateStatus(daysRemaining, item.status);

                  return (
                    <TableRow
                      key={item.id}
                      className={cn("hover:bg-muted/50", getRowHighlight(daysRemaining))}
                    >
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.batch_number || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(item.quantity).toLocaleString()} {item.unit}
                      </TableCell>
                      <TableCell>
                        {item.manufacture_date ? format(parseISO(item.manufacture_date), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {item.expiry_date ? format(parseISO(item.expiry_date), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>{getDaysRemainingBadge(daysRemaining)}</TableCell>
                      <TableCell className="text-sm">{item.warehouse || "-"}</TableCell>
                      <TableCell>
                        <Badge className={`border px-2 ${statusColorMap[computedStatus] || statusColorMap.Active}`}>
                          {computedStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openConfirm(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit Item" : "Add New Item"}</DialogTitle>
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Manufacture Date</Label>
                <Input
                  type="date"
                  value={formState.manufacture_date}
                  onChange={(e) => setFormState((prev) => ({ ...prev, manufacture_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date *</Label>
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
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Disposed">Disposed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
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
              Save Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Delete Item"
        description="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={handleConfirm}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}

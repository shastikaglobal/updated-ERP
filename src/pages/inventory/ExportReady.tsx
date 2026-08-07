import { apiFetch } from "@/lib/api";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { Search, Plus, Download, Edit2, Check, Eye, Trash2, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

const initialFormState = {
  id: "",
  product_id: "",
  warehouse_id: "",
  export_ready_quantity: "",
  certificate_number: "",
  clearance_date: new Date().toISOString().slice(0, 10),
  destination_country: "",
  status: "pending_clearance",
  notes: "",
};

const statusBadgeMap: Record<string, string> = {
  cleared: "bg-green-50 text-green-800 border-green-200",
  pending_clearance: "bg-amber-50 text-amber-800 border-amber-200",
  shipped: "bg-blue-50 text-blue-800 border-blue-200",
};

export default function ExportReady() {
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "ship" | null>(null);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const rowsPerPage = 10;

  const { data: inventory = [], isLoading: isInventoryLoading } = useQuery({
    queryKey: ["export-ready-inventory"],
    queryFn: async () => {
      try {

        const res = await apiFetch('/api/inventory/export_ready_inventory', {
          headers: { }
        });
        if (!res.ok) throw new Error('Failed to fetch export ready inventory');
        const rows = await res.json();
        // VPS table uses product_name/grade/warehouse_name as text fields directly
        return (rows || []).filter((r: any) => !r.is_deleted).map((r: any) => ({
          ...r,
          products: { name: r.product_name || null, grade: r.grade || null },
          warehouses: { name: r.warehouse_name || null },
        }));
      } catch (err) {
        console.error('Error fetching export ready inventory:', err);
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
      // Deduplicate products by name only
      const seen = new Map<string, any>();
      for (const product of (data || [])) {
        const key = (product.name || '').toLowerCase().trim();
        if (!seen.has(key)) {
          seen.set(key, product);
        }
      }
      return Array.from(seen.values());
    }
  });

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
        grade: payload.grade || null,
        warehouse_name: payload.warehouse_name,
        export_ready_quantity: payload.export_ready_quantity,
        certificate_number: payload.certificate_number,
        clearance_date: payload.clearance_date,
        destination_country: payload.destination_country || null,
        status: payload.status || 'pending_clearance',
        notes: payload.notes || null,
        company_id: profile?.company_id || null,
        updated_at: new Date().toISOString(),
      };
      if (payload.id) {
        // UPDATE via VPS API
        const res = await apiFetch(`/api/inventory/export_ready_inventory/${payload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Update failed'); }
      } else {
        // INSERT via VPS API
        const res = await apiFetch('/api/inventory/export_ready_inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Insert failed'); }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["export-ready-inventory"] });
      setIsModalOpen(false);
      setSelectedItem(null);
      setFormState(initialFormState);
      toast.success("Export ready record saved successfully.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save record."),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiFetch(`/api/inventory/export_ready_inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to update record'); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["export-ready-inventory"] });
      toast.success("Record updated successfully.");
      setIsConfirmOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update record."),
  });

  const filteredInventory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return (inventory || []).filter((item: any) => {
      const productName = item.products?.name?.toLowerCase() || "";
      const warehouseName = item.warehouses?.name?.toLowerCase() || "";
      const certificate = item.certificate_number?.toLowerCase() || "";
      const statusMatch =
        statusFilter === "all" || item.status === statusFilter;
      const warehouseMatch = warehouseFilter === "all" || item.warehouse_id === warehouseFilter;
      const searchMatch =
        !query ||
        productName.includes(query) ||
        warehouseName.includes(query) ||
        certificate.includes(query);
      return statusMatch && warehouseMatch && searchMatch;
    });
  }, [inventory, searchTerm, warehouseFilter, statusFilter]);

  const paginatedInventory = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredInventory.slice(start, start + rowsPerPage);
  }, [filteredInventory, page]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / rowsPerPage));

  const summary = useMemo(() => {
    const totalExportReady = (inventory || []).reduce((sum: number, item: any) => sum + Number(item.export_ready_quantity || 0), 0);
    const productCount = new Set((inventory || []).map((item: any) => item.product_id)).size;
    const warehouseCount = new Set((inventory || []).map((item: any) => item.warehouse_id)).size;
    const pendingShipmentCount = (inventory || []).filter((item: any) => item.status !== "shipped").length;
    return { totalExportReady, productCount, warehouseCount, pendingShipmentCount };
  }, [inventory]);

  const openNewModal = () => {
    setSelectedItem(null);
    setFormState(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setSelectedItem(item);
    setFormState({
      id: item.id,
      product_id: item.product_id || "",
      warehouse_id: item.warehouses?.name || item.warehouse_name || item.warehouse_id || "",
      export_ready_quantity: String(item.export_ready_quantity || ""),
      certificate_number: item.certificate_number || "",
      clearance_date: item.clearance_date || new Date().toISOString().slice(0, 10),
      destination_country: item.destination_country || "",
      status: item.status || "pending_clearance",
      notes: item.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formState.product_id || !formState.warehouse_id || !formState.export_ready_quantity || !formState.certificate_number) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Resolve product/warehouse UUIDs to names for the VPS table
    const selectedProduct = products.find((p: any) => p.id === formState.product_id);
    const selectedWarehouse = warehouses.find((w: any) => w.id === formState.warehouse_id || w.name === formState.warehouse_id);

    mutation.mutate({
      ...formState,
      product_name: selectedProduct?.name || "",
      grade: selectedProduct?.grade || null,
      warehouse_name: selectedWarehouse?.name || formState.warehouse_id,
      export_ready_quantity: Number(formState.export_ready_quantity),
    });
  };

  const openConfirm = (action: "ship" | "delete", id: string) => {
    setConfirmAction(action);
    setConfirmTargetId(id);
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmAction || !confirmTargetId) return;
    if (confirmAction === "ship") {
      actionMutation.mutate({ id: confirmTargetId, status: "shipped" });
    } else {
      try {

        // Soft delete via VPS API
        const res = await apiFetch(`/api/inventory/export_ready_inventory/${confirmTargetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: profile?.id || null,
          })
        });
        if (!res.ok) throw new Error('Failed to delete record');
        queryClient.invalidateQueries({ queryKey: ["export-ready-inventory"] });
        toast.success("Record hidden successfully.");
        setIsConfirmOpen(false);
      } catch (err: any) {
        toast.error(err.message || "Failed to delete record.");
      }
    }
  };

  const exportCsv = () => {
    if (!filteredInventory || filteredInventory.length === 0) {
      toast.info("No data available to export");
      return;
    }

    const headers = [
      "Product",
      "Warehouse",
      "Export Ready Quantity (kg)",
      "Certificate Number",
      "Clearance Date",
      "Destination Country",
      "Status",
      "Notes",
    ];
    const rows = filteredInventory.map((item: any) => [
      item.products?.name || "",
      item.warehouses?.name || "",
      item.export_ready_quantity,
      item.certificate_number || "",
      item.clearance_date || "",
      item.destination_country || "",
      item.status || "",
      item.notes || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `export_ready_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Export Ready Inventory"
        description="Manage and view stock ready for export"
        breadcrumbs={[{ label: "Inventory", to: "/inventory" }, { label: "Export Ready Inventory" }]}
        actions={
          <Button onClick={openNewModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Export Stock
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Export Ready</p>
            <p className="text-3xl font-bold">{summary.totalExportReady.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Products</p>
            <p className="text-3xl font-bold">{summary.productCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Warehouses</p>
            <p className="text-3xl font-bold">{summary.warehouseCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending Shipment</p>
            <p className="text-3xl font-bold">{summary.pendingShipmentCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-96">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by product, warehouse, or certificate number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((warehouse: any) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} - {[warehouse.location, warehouse.city].filter(Boolean).join(", ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="pending_clearance">Pending Clearance</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={exportCsv}
                className="whitespace-nowrap"
                disabled={isInventoryLoading}
              >
                <Download className="h-4 w-4" /> Export
              </Button>
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
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Export Ready Quantity (kg)</TableHead>
                <TableHead>Certificate No.</TableHead>
                <TableHead>Clearance Date</TableHead>
                <TableHead>Destination Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInventoryLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading inventory...
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No export-ready stock found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInventory.map((item: any) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="font-semibold">{item.products?.name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{item.products?.grade || ""}</div>
                    </TableCell>
                    <TableCell>{item.warehouses?.name || "-"}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(item.export_ready_quantity || 0).toLocaleString()}</TableCell>
                    <TableCell>{item.certificate_number || "-"}</TableCell>
                    <TableCell>{item.clearance_date ? format(parseISO(item.clearance_date), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>{item.destination_country || "-"}</TableCell>
                    <TableCell>
                      <Badge className={cn("border px-2", statusBadgeMap[item.status] || statusBadgeMap.pending_clearance)}>
                        {item.status === "pending_clearance" ? "Pending Clearance" : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditModal(item)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openConfirm("ship", item.id)} disabled={item.status === "shipped"}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.info(item.certificate_number ? `Certificate: ${item.certificate_number}` : "No document available") }>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openConfirm("delete", item.id)}>
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
        <p>
          Showing {Math.min((page - 1) * rowsPerPage + 1, filteredInventory.length)} to {Math.min(page * rowsPerPage, filteredInventory.length)} of {filteredInventory.length}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
            Next
          </Button>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit Export Ready Stock" : "Add Export Stock"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={formState.product_id || undefined} onValueChange={(value) => setFormState((prev) => ({ ...prev, product_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">No products available.</div>
                    ) : (
                      products.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} {product.grade ? `(${product.grade})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <SearchableInput
                    placeholder="Type or select warehouse..."
                    value={formState.warehouse_id}
                    onChange={(val) => setFormState((prev) => ({ ...prev, warehouse_id: val }))}
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
                <Label>Export Ready Quantity (kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formState.export_ready_quantity}
                  onChange={(e) => setFormState((prev) => ({ ...prev, export_ready_quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Certificate Number</Label>
                <Input
                  value={formState.certificate_number}
                  onChange={(e) => setFormState((prev) => ({ ...prev, certificate_number: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Clearance Date</Label>
                <Input
                  type="date"
                  value={formState.clearance_date}
                  onChange={(e) => setFormState((prev) => ({ ...prev, clearance_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Destination Country</Label>
                <Input
                  value={formState.destination_country}
                  onChange={(e) => setFormState((prev) => ({ ...prev, destination_country: e.target.value }))}
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
                    <SelectItem value="cleared">Cleared</SelectItem>
                    <SelectItem value="pending_clearance">Pending Clearance</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
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
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={confirmAction === "ship" ? "Mark as Shipped" : "Delete Export Record"}
        description={
          confirmAction === "ship"
            ? "Mark this export-ready stock item as shipped."
            : "Delete this export-ready inventory record permanently."
        }
        onConfirm={handleConfirm}
        isLoading={actionMutation.isLoading}
      />
    </div>
  );
}

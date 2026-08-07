import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { Search, Plus, Download, Edit2, CheckCircle2, XCircle, Eye, Loader2, Trash2 } from "lucide-react";
import { format, isBefore, parseISO } from "date-fns";

const initialFormState = {
  id: "",
  product_id: "",
  warehouse_id: "",
  reserved_quantity: "",
  order_reference: "",
  reserved_date: new Date().toISOString().slice(0, 10),
  expected_release_date: new Date().toISOString().slice(0, 10),
  status: "active",
  notes: "",
};

const statusBadgeMap: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  released: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  overdue: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function ReservedStock() {
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [formState, setFormState] = useState(initialFormState);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"release" | "cancel" | "delete" | null>(null);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);

  const { data: reservations = [], isLoading: isReservationsLoading } = useQuery({
    queryKey: ["reserved-stock"],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/inventory/reserved_stock', {
          headers: { }
        });
        if (!res.ok) throw new Error('Failed to fetch reserved stock');
        const rows = await res.json();
        // VPS table uses product_name/grade/warehouse_name as text fields directly
        return (rows || []).map((r: any) => ({
          ...r,
          products: { name: r.product_name || null, grade: r.grade || null },
          warehouses: { name: r.warehouse_name || null },
        }));
      } catch (err) {
        console.error('Error fetching reserved stock:', err);
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
      return (data || []).filter((w: any) => w.is_active && !w.is_deleted).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        // UPDATE via VPS API
        const __res_upd = await apiFetch(`/api/inventory/reserved_stock/${payload.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product_name: payload.product_name,
            grade: payload.grade || null,
            warehouse_name: payload.warehouse_name,
            reserved_quantity: payload.reserved_quantity,
            order_reference: payload.order_reference,
            reserved_date: payload.reserved_date,
            expected_release_date: payload.expected_release_date || null,
            status: payload.status || 'active',
            notes: payload.notes || null,
            updated_at: new Date().toISOString(),
          })
        });
        if (!__res_upd.ok) {
          const errData = await __res_upd.json().catch(() => ({}));
          throw new Error(errData.error || 'Update failed');
        }
      } else {
        const company_id = profile?.company_id;
        const __res_ins = await apiFetch(`/api/inventory/reserved_stock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{
            product_name: payload.product_name,
            grade: payload.grade || null,
            warehouse_name: payload.warehouse_name,
            reserved_quantity: payload.reserved_quantity,
            order_reference: payload.order_reference,
            reserved_date: payload.reserved_date,
            expected_release_date: payload.expected_release_date || null,
            status: payload.status || 'active',
            notes: payload.notes || null,
            company_id: company_id || null,
          }])
        });
        if (!__res_ins.ok) {
          const errData = await __res_ins.json().catch(() => ({}));
          throw new Error(errData.error || 'Insert failed');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reserved-stock"] });
      setIsModalOpen(false);
      setSelectedReservation(null);
      setFormState(initialFormState);
      toast.success("Reservation saved successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save reservation");
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      
      if (status === "delete") {
        const res = await apiFetch(`/api/inventory/reserved_stock/${id}`, {
          method: 'DELETE',
          headers: { }
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to delete reservation');
        }
      } else {
        const res = await apiFetch(`/api/inventory/reserved_stock/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update reservation');
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reserved-stock"] });
      setIsConfirmOpen(false);
      if (variables.status === "delete") {
        toast.success("Reservation deleted successfully");
      } else {
        toast.success("Reservation updated successfully");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update reservation");
    },
  });

  const today = new Date();

  const enhancedReservations = useMemo(
    () =>
      reservations.map((reservation: any) => {
        const isOverdue =
          reservation.status === "active" &&
          reservation.expected_release_date &&
          isBefore(parseISO(reservation.expected_release_date), today);

        // Resolve warehouse name and ID
        let resolvedWarehouseId = reservation.warehouse_id;
        let resolvedWarehouseName = reservation.warehouse_name || reservation.warehouses?.name;

        if (!resolvedWarehouseId && resolvedWarehouseName) {
          const wh = warehouses.find(
            (w: any) => w.name?.trim().toLowerCase() === resolvedWarehouseName?.trim().toLowerCase()
          );
          if (wh) resolvedWarehouseId = wh.id;
        } else if (resolvedWarehouseId && !resolvedWarehouseName) {
          const wh = warehouses.find((w: any) => w.id === resolvedWarehouseId);
          if (wh) resolvedWarehouseName = wh.name;
        }

        // Resolve product name, grade, and ID
        let resolvedProductId = reservation.product_id;
        let resolvedProductName = reservation.product_name || reservation.products?.name;
        let resolvedProductGrade = reservation.grade || reservation.products?.grade;

        if (!resolvedProductId && resolvedProductName) {
          const prod = products.find(
            (p: any) => p.name?.trim().toLowerCase() === resolvedProductName?.trim().toLowerCase()
          );
          if (prod) {
            resolvedProductId = prod.id;
            if (!resolvedProductGrade) resolvedProductGrade = prod.grade;
          }
        } else if (resolvedProductId && !resolvedProductName) {
          const prod = products.find((p: any) => p.id === resolvedProductId);
          if (prod) {
            resolvedProductName = prod.name;
            if (!resolvedProductGrade) resolvedProductGrade = prod.grade;
          }
        }

        return {
          ...reservation,
          warehouse_id: resolvedWarehouseId,
          warehouse_name: resolvedWarehouseName,
          product_id: resolvedProductId,
          product_name: resolvedProductName,
          grade: resolvedProductGrade,
          products: { name: resolvedProductName, grade: resolvedProductGrade },
          warehouses: { name: resolvedWarehouseName },
          displayStatus: isOverdue ? "overdue" : reservation.status || "active",
        };
      }),
    [reservations, warehouses, products, today]
  );

  const filteredReservations = useMemo(() => {
    return enhancedReservations.filter((reservation: any) => {
      const query = searchTerm.trim().toLowerCase();
      const productName = reservation.products?.name?.toLowerCase() || "";
      const warehouseName = reservation.warehouses?.name?.toLowerCase() || "";
      const orderRef = reservation.order_reference?.toLowerCase() || "";

      const matchesSearch =
        !query ||
        productName.includes(query) ||
        warehouseName.includes(query) ||
        orderRef.includes(query);

      const matchesWarehouse = warehouseFilter === "all" || reservation.warehouse_id === warehouseFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && reservation.status === "active") ||
        (statusFilter === "released" && reservation.status === "released") ||
        (statusFilter === "cancelled" && reservation.status === "cancelled");

      return matchesSearch && matchesWarehouse && matchesStatus;
    });
  }, [enhancedReservations, searchTerm, warehouseFilter, statusFilter]);

  const summary = useMemo(() => {
    const totalReserved = enhancedReservations.reduce((sum: number, reservation: any) => sum + Number(reservation.reserved_quantity || 0), 0);
    const totalOrders = new Set(enhancedReservations.map((reservation: any) => reservation.order_reference || "")).size;
    const productCount = new Set(enhancedReservations.map((reservation: any) => reservation.product_id)).size;
    const pendingCount = enhancedReservations.filter((reservation: any) => reservation.status === "active").length;

    return {
      totalReserved,
      totalOrders,
      productCount,
      pendingCount,
    };
  }, [enhancedReservations]);

  const openAddModal = () => {
    setSelectedReservation(null);
    setFormState(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (reservation: any) => {
    setSelectedReservation(reservation);
    setFormState({
      id: reservation.id,
      product_id: reservation.product_id || "",
      warehouse_id: reservation.warehouses?.name || reservation.warehouse_name || reservation.warehouse_id || "",
      reserved_quantity: String(reservation.reserved_quantity || ""),
      order_reference: reservation.order_reference || "",
      reserved_date: reservation.reserved_date || new Date().toISOString().slice(0, 10),
      expected_release_date: reservation.expected_release_date || new Date().toISOString().slice(0, 10),
      status: reservation.status || "active",
      notes: reservation.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formState.product_id || !formState.warehouse_id || !formState.reserved_quantity || !formState.order_reference) {
      toast.error("Please fill in required fields.");
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
      reserved_quantity: Number(formState.reserved_quantity),
      expected_release_date: formState.expected_release_date || null,
      notes: formState.notes || null,
    });
  };

  const startConfirm = (action: "release" | "cancel" | "delete", reservationId: string) => {
    setConfirmAction(action);
    setConfirmTargetId(reservationId);
    setIsConfirmOpen(true);
  };

  const confirmActionHandler = () => {
    if (!confirmAction || !confirmTargetId) return;
    actionMutation.mutate({
      id: confirmTargetId,
      status: confirmAction === "release" ? "released" : confirmAction === "delete" ? "delete" : "cancelled",
    });
  };

  const exportCsv = () => {
    const headers = [
      "Reservation ID",
      "Product",
      "Warehouse",
      "Reserved Quantity (kg)",
      "Order Reference",
      "Reserved Date",
      "Expected Release Date",
      "Status",
      "Notes",
    ];

    const rows = filteredReservations.map((reservation: any) => [
      reservation.id,
      reservation.products?.name || "-",
      reservation.warehouses?.name || "-",
      reservation.reserved_quantity,
      reservation.order_reference,
      reservation.reserved_date || "-",
      reservation.expected_release_date || "-",
      reservation.displayStatus,
      reservation.notes || "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map((cell: any) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reserved_stock_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reserved Stock Tracking"
        description="Track stock reserved for pending orders"
        breadcrumbs={[{ label: "Inventory", to: "/inventory" }, { label: "Reserved Stock Tracking" }]}
        actions={
          <Button onClick={openAddModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Reserve Stock
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Reserved Stock</p>
            <p className="text-3xl font-bold">{summary.totalReserved.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Orders Reserved</p>
            <p className="text-3xl font-bold">{summary.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Products Reserved</p>
            <p className="text-3xl font-bold">{summary.productCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending Release</p>
            <p className="text-3xl font-bold">{summary.pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-96">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product, order number, or warehouse..."
                className="pl-10"
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
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name} - {[warehouse.location, warehouse.city].filter(Boolean).join(", ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={exportCsv} className="whitespace-nowrap">
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
                <TableHead>Reservation ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Reserved Quantity (kg)</TableHead>
                <TableHead>Order Reference</TableHead>
                <TableHead>Reserved Date</TableHead>
                <TableHead>Expected Release</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isReservationsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <div className="flex items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading reservations...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredReservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    No reserved stock records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredReservations.map((reservation: any) => (
                  <TableRow key={reservation.id} className="hover:bg-muted/50">
                    <TableCell>{reservation.id}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{reservation.products?.name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{reservation.products?.grade || "-"}</div>
                    </TableCell>
                    <TableCell>{reservation.warehouses?.name || "-"}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(reservation.reserved_quantity || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      {reservation.order_reference ? (
                        <a
                          href={`/orders/${reservation.order_reference}`}
                          className="text-primary hover:underline"
                        >
                          {reservation.order_reference}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{reservation.reserved_date ? format(parseISO(reservation.reserved_date), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>{reservation.expected_release_date ? format(parseISO(reservation.expected_release_date), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>
                      <Badge className={cn("border px-2", statusBadgeMap[reservation.displayStatus] || statusBadgeMap[reservation.status] || statusBadgeMap.active)}>
                        {reservation.displayStatus.charAt(0).toUpperCase() + reservation.displayStatus.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => openEditModal(reservation)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startConfirm("release", reservation.id)}
                        disabled={reservation.status !== "active"}
                        title={reservation.status !== "active" ? "Only active reservations can be released" : "Release Stock"}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startConfirm("cancel", reservation.id)}
                        disabled={reservation.status !== "active"}
                        title={reservation.status !== "active" ? "Only active reservations can be cancelled" : "Cancel"}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => window.open(`/orders/${reservation.order_reference || "#"}`, "_blank")}
                        title="View Order Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startConfirm("delete", reservation.id)}
                        title="Delete Record"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
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
            <DialogTitle>{selectedReservation ? "Edit Reservation" : "Reserve Stock"}</DialogTitle>
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
                <Label>Reserved Quantity (kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formState.reserved_quantity}
                  onChange={(event) => setFormState((prev) => ({ ...prev, reserved_quantity: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Order Reference</Label>
                <Input
                  value={formState.order_reference}
                  onChange={(event) => setFormState((prev) => ({ ...prev, order_reference: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Reserved Date</Label>
                <Input
                  type="date"
                  value={formState.reserved_date}
                  onChange={(event) => setFormState((prev) => ({ ...prev, reserved_date: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Expected Release Date</Label>
                <Input
                  type="date"
                  value={formState.expected_release_date}
                  onChange={(event) => setFormState((prev) => ({ ...prev, expected_release_date: event.target.value }))}
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="released">Released</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={4}
                  value={formState.notes}
                  onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={mutation.isLoading}>
              {mutation.isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={
          confirmAction === "release" ? "Release Reserved Stock" : 
          confirmAction === "delete" ? "Delete Reservation" : 
          "Cancel Reservation"
        }
        description={
          confirmAction === "release"
            ? "Release this reserved stock and mark the reservation as released."
            : confirmAction === "delete"
            ? "Permanently delete this reservation record. This cannot be undone."
            : "Cancel this reservation and free the reserved stock."
        }
        onConfirm={confirmActionHandler}
        isLoading={actionMutation.isLoading}
      />
    </div>
  );
}

import { apiFetch } from "@/lib/api";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableInput } from "@/components/ui/SearchableInput";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, Plus, Download, Edit2, History, Package,
  LayoutGrid, AlertTriangle, ArrowUpDown, Building2
} from "lucide-react";
import { format } from "date-fns";

const getStockHealth = (available: number, minimum: number) => {
  if (available <= minimum * 0.25) return 'critical';
  if (available <= minimum) return 'low';
  return 'healthy';
};

const defaultProducts = [
  { sku: "AGRI-CCN-TND", name: "Tender Coconut", category: "Coconuts", unit: "Piece", is_active: true },
  { sku: "AGRI-CCN-GRN", name: "Green Coconut", category: "Coconuts", unit: "Piece", is_active: true },
  { sku: "AGRI-CCN-HSK", name: "Husked Coconut", category: "Coconuts", unit: "Piece", is_active: true },
  { sku: "AGRI-CCN-SHK", name: "Semi-Husked Coconut", category: "Coconuts", unit: "Piece", is_active: true },
  { sku: "AGRI-CCN-DHK", name: "Dehusked Coconut", category: "Coconuts", unit: "Piece", is_active: true },
  { sku: "AGRI-CCN-ORG", name: "Fresh Organic Coconut", category: "Coconuts", unit: "Piece", is_active: true },
  { sku: "AGRI-TOM-001", name: "Tomato", category: "Vegetables", unit: "Ton", is_active: true },
  { sku: "AGRI-WML-REG", name: "Watermelon", category: "Fruits", unit: "Ton", is_active: true },
  { sku: "AGRI-WML-BLK", name: "Black Diamond Watermelon", category: "Fruits", unit: "Ton", is_active: true },
  { sku: "AGRI-PMK-YEL", name: "Yellow Pumpkin", category: "Vegetables", unit: "Ton", is_active: true },
  { sku: "AGRI-PMK-WHT", name: "White Pumpkin", category: "Vegetables", unit: "Ton", is_active: true },
  { sku: "AGRI-CUC-YEL", name: "Yellow Cucumber", category: "Vegetables", unit: "Ton", is_active: true },
  { sku: "AGRI-BAN-CAV", name: "Cavendish Banana", category: "Bananas", unit: "Ton", is_active: true },
  { sku: "AGRI-BAN-BBY", name: "Baby Banana", category: "Bananas", unit: "Ton", is_active: true },
  { sku: "AGRI-BAN-NEN", name: "Nendran Banana", category: "Bananas", unit: "Ton", is_active: true },
  { sku: "AGRI-BAN-RED", name: "Red Banana", category: "Bananas", unit: "Ton", is_active: true },
];

export default function AvailableStock() {
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Selected items
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [hasSeededDefaultProducts, setHasSeededDefaultProducts] = useState(false);

  // Forms
  const [editForm, setEditForm] = useState({
    product_id: "",
    warehouse_id: "",
    available_quantity: 0,
    minimum_stock_level: 0,
    notes: ""
  });

  const [adjustForm, setAdjustForm] = useState({
    type: "add",
    quantity: 0,
    reason: "Purchase received",
    notes: ""
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list', profile?.company_id],
    queryFn: async () => {
      const res = await apiFetch('/api/products', {
        headers: { }
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      return (data || []).filter((p: any) => p.is_active);
    }
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-list', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const res = await apiFetch('/api/inventory/warehouses', {
        headers: {
          }
      });
      if (!res.ok) throw new Error('Failed to fetch warehouses');
      const data = await res.json();
      return (data || []).filter((w: any) => w.is_active && !w.is_deleted && (!profile?.company_id || w.company_id === profile.company_id));
    }
  });

  const { data: stockData = [], isLoading } = useQuery({
    queryKey: ['available-stock', products.length, warehouses.length],
    enabled: true,
    queryFn: async () => {
      const res = await apiFetch(`/api/inventory/available_stock`, {
        headers: {
          }
      });
      if (!res.ok) throw new Error('Failed to fetch available stock');
      const rows = await res.json();
      
      return rows.map((item: any) => {
        const prod = products.find(
          (p: any) => p.name?.trim().toLowerCase() === item.product_name?.trim().toLowerCase()
        );
        const wh = warehouses.find(
          (w: any) => w.name?.trim().toLowerCase() === item.warehouse?.trim().toLowerCase()
        );
        return {
          ...item,
          product_id: prod?.id || "",
          warehouse_id: wh?.id || "",
          available_quantity: Number(item.available_quantity) || 0,
          minimum_stock_level: Number(item.minimum_level) || 0,
          products: {
            name: item.product_name,
            category: prod?.category || "",
            grade: prod?.grade || ""
          },
          warehouses: {
            name: item.warehouse
          },
          updated_at: item.last_updated || item.created_at
        };
      });
    }
  });

  const { data: historyLogs = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ['stock-history', selectedStock?.id],
    enabled: !!selectedStock && isHistoryModalOpen,
    queryFn: async () => {
      const res = await apiFetch(`/api/inventory/inventory_movements`, {
        headers: {
          }
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      const allRows = await res.json();
      
      // Filter by the selected product's SKU or Name and Warehouse
      const sku = selectedStock?.products?.name || selectedStock?.product_name || '';
      const warehouse = selectedStock?.warehouses?.name || selectedStock?.warehouse || '';
      
      return allRows.filter((row: any) => row.sku === sku && row.warehouse === warehouse)
                    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  });

  useEffect(() => {
    if (!profile?.company_id || products.length > 0 || hasSeededDefaultProducts) return;

    const seedProducts = async () => {
      try {
        const records = defaultProducts.map(product => ({
          ...product,
          company_id: profile.company_id
        }));
        
        // Remove duplicates checking logic if upsert is supported with unique constraint,
        // or just insert since most likely it's handled.
        await apiFetch('/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            },
          body: JSON.stringify(records)
        });
        
        queryClient.invalidateQueries({ queryKey: ['products-list', profile.company_id] });
      } catch (err) {
        console.error('Failed to seed default products:', err);
      } finally {
        setHasSeededDefaultProducts(true);
      }
    };

    seedProducts();
  }, [profile?.company_id, products.length, hasSeededDefaultProducts, queryClient]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalAvail = 0;
    const prodSet = new Set();
    const whSet = new Set();
    let lowStock = 0;

    stockData.forEach(item => {
      totalAvail += Number(item.available_quantity) || 0;
      if (item.product_id) prodSet.add(item.product_id);
      if (item.warehouse_id) whSet.add(item.warehouse_id);

      const health = getStockHealth(item.available_quantity, item.minimum_stock_level || 0);
      if (health !== 'healthy') lowStock++;
    });

    return {
      totalAvailable: totalAvail,
      totalProducts: prodSet.size,
      totalWarehouses: whSet.size,
      lowStockItems: lowStock
    };
  }, [stockData]);

  // Filtering
  const filteredData = useMemo(() => {
    return stockData.filter(item => {
      const pName = item.products?.name?.toLowerCase() || "";
      const wName = item.warehouses?.name?.toLowerCase() || "";
      const matchSearch = pName.includes(searchTerm.toLowerCase()) || wName.includes(searchTerm.toLowerCase());
      const matchWarehouse = warehouseFilter === "all" || item.warehouse_id === warehouseFilter;
      const matchProduct = productFilter === "all" || item.products?.name === productFilter;

      return matchSearch && matchWarehouse && matchProduct;
    });
  }, [stockData, searchTerm, warehouseFilter, productFilter]);

  const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const productOptions = products.length > 0 ? products : defaultProducts;
  const uniqueProducts = Array.from(new Set(productOptions.map((p: any) => p.name).filter(Boolean))).sort();

  const uniqueProductObjects = useMemo(() => {
    const seen = new Map<string, any>();
    for (const p of products) {
      const key = (p.name || '').toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.set(key, p);
      }
    }
    return Array.from(seen.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [products]);

  // Mutations
  const saveStockMutation = useMutation({
    mutationFn: async (data: any) => {
      const prod = products.find((p: any) => p.id === data.product_id);
      const wh = warehouses.find((w: any) => w.id === data.warehouse_id || w.name === data.warehouse_id);
      
      const payload = {
        product_name: prod?.name || "",
        warehouse: wh?.name || data.warehouse_id,
        available_quantity: Number(data.available_quantity),
        minimum_level: Number(data.minimum_stock_level),
        notes: data.notes || "",
        unit: prod?.unit || "kg",
        last_updated: new Date().toISOString().slice(0, 10)
      };


      if (selectedStock?.id) {
        const __res_upd = await apiFetch(`/api/inventory/available_stock/${selectedStock.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!__res_upd.ok) throw new Error('Update failed');
      } else {
        const __res_ins = await apiFetch(`/api/inventory/available_stock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([payload])
        });
        if (!__res_ins.ok) throw new Error('Insert failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-stock'] });
      toast.success("Stock record saved successfully");
      setIsEditModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message)
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (adjustment) => {
      if (!selectedStock) return;
      const current = Number(selectedStock.available_quantity) || 0;
      const adj = Number(adjustForm.quantity) || 0;
      const newQty = adjustForm.type === 'add' ? current + adj : current - adj;

      if (newQty < 0) throw new Error("Quantity cannot be negative.");


      const res = await apiFetch(`/api/inventory/available_stock/${selectedStock.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          available_quantity: newQty,
          last_updated: new Date().toISOString().slice(0, 10)
        })
      });
      if (!res.ok) throw new Error('Adjustment failed');

      // Also log to inventory_movements
      const prodName = selectedStock?.products?.name || selectedStock?.product_name || "Unknown";
      const whName = selectedStock?.warehouses?.name || selectedStock?.warehouse || "Unknown";
      const moveRes = await apiFetch(`/api/inventory/inventory_movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          qty: adj,
          date: new Date().toISOString(),
          warehouse: whName,
          direction: adjustForm.type === 'add' ? 'in' : 'out',
          sku: prodName, // using product name as tracking key here
          reference: adjustForm.reason
        }])
      });
      if (!moveRes.ok) console.warn("Failed to log inventory movement.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-stock'] });
      toast.success("Stock adjusted successfully");
      setIsAdjustModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message)
  });

  // Handlers
  const handleOpenEdit = (item: any = null) => {
    setSelectedStock(item);
    if (item) {
      setEditForm({
        product_id: item.product_id || "",
        warehouse_id: item.warehouses?.name || item.warehouse || item.warehouse_id || "",
        available_quantity: item.available_quantity || 0,
        minimum_stock_level: item.minimum_stock_level || 0,
        notes: item.notes || ""
      });
    } else {
      setEditForm({ product_id: "", warehouse_id: "", available_quantity: 0, minimum_stock_level: 0, notes: "" });
    }
    setIsEditModalOpen(true);
  };

  const handleOpenAdjust = (item: any) => {
    setSelectedStock(item);
    setAdjustForm({ type: "add", quantity: 0, reason: "Purchase received", notes: "" });
    setIsAdjustModalOpen(true);
  };

  const handleOpenHistory = (item: any) => {
    setSelectedStock(item);
    setIsHistoryModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = ["Product,Warehouse,Available,Minimum,Health,Last Updated\n"];
    const rows = filteredData.map(item => {
      const pName = item.products?.name ? `"${item.products.name}"` : "";
      const wName = item.warehouses?.name ? `"${item.warehouses.name}"` : "";
      const health = getStockHealth(item.available_quantity, item.minimum_stock_level || 0);
      return `${pName},${wName},${item.available_quantity},${item.minimum_stock_level || 0},${health},"${item.updated_at}"`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "available_stock.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Inventory &gt; Available Stock Management
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Available Stock Management</h1>
          <p className="text-muted-foreground">Manage and track currently available stock directly.</p>
        </div>
        <Button onClick={() => handleOpenEdit()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Stock
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 pb-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Total Available</h3>
            </div>
            <div className="text-2xl font-bold">{stats.totalAvailable.toLocaleString()} kg</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 pb-2">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Total Products</h3>
            </div>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 pb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Warehouses Active</h3>
            </div>
            <div className="text-2xl font-bold">{stats.totalWarehouses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 pb-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Low/Critical Items</h3>
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.lowStockItems}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search product or warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>{w.name} - {[w.location, w.city].filter(Boolean).join(", ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {uniqueProducts.map((p: any) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExportCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Available (kg)</TableHead>
                <TableHead className="text-right">Minimum Level</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">No stock found</TableCell></TableRow>
              ) : (
                paginatedData.map((item) => {
                  const health = getStockHealth(item.available_quantity, item.minimum_stock_level || 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.products?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.products?.category} {item.products?.grade ? `- ${item.products.grade}` : ''}
                        </div>
                      </TableCell>
                      <TableCell>{item.warehouses?.name || 'Unassigned'}</TableCell>
                      <TableCell className="text-right font-medium">{Number(item.available_quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.minimum_stock_level || 0}</TableCell>
                      <TableCell>
                        {health === 'healthy' && <Badge className="bg-green-50 text-green-800 hover:bg-green-100 border-none">Healthy</Badge>}
                        {health === 'low' && <Badge className="bg-amber-50 text-amber-800 hover:bg-amber-100 border-none">Low Stock</Badge>}
                        {health === 'critical' && <Badge className="bg-red-50 text-red-800 hover:bg-red-100 border-none">Critical</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.updated_at ? format(new Date(item.updated_at), "MMM d, yyyy HH:mm") : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenAdjust(item)} title="Adjust Stock">
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)} title="Edit Configuration">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenHistory(item)} title="View History">
                            <History className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t">
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, filteredData.length)} of {filteredData.length} entries
            </span>
            <div className="flex gap-2">
              <Button disabled={page === 1} variant="outline" size="sm" onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button disabled={page === totalPages} variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit/Add Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedStock ? "Edit Stock Definition" : "Add Initial Stock"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={editForm.product_id || undefined}
                onValueChange={(val) => setEditForm(p => ({ ...p, product_id: val }))}
              >
                <SelectTrigger><SelectValue placeholder="Select Product" /></SelectTrigger>
                <SelectContent>
                  {uniqueProductObjects.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No products found. Run the seed script or add products first.</div>
                  ) : (
                    uniqueProductObjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Warehouse</Label>
              <SearchableInput
                  placeholder="Type or select warehouse..."
                  value={editForm.warehouse_id}
                  onChange={(val) => setEditForm(p => ({ ...p, warehouse_id: val }))}
                  options={warehouses.map((w: any) => ({
                    id: w.id,
                    name: w.name,
                    description: [w.location, w.city].filter(Boolean).join(", ")
                  }))}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Available (kg)</Label>
                <Input
                  type="number"
                  value={editForm.available_quantity}
                  onChange={e => setEditForm(p => ({ ...p, available_quantity: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Min. Level (kg)</Label>
                <Input
                  type="number"
                  value={editForm.minimum_stock_level}
                  onChange={e => setEditForm(p => ({ ...p, minimum_stock_level: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={() => saveStockMutation.mutate(editForm)} disabled={saveStockMutation.isPending}>
              {saveStockMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Modal */}
      <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock Inventory</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-between p-3 bg-muted rounded-md mb-2">
              <span className="text-sm font-medium">Current Available:</span>
              <span className="text-sm font-bold">{selectedStock?.available_quantity || 0} kg</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adjustment Type</Label>
                <Select value={adjustForm.type || undefined} onValueChange={(val) => setAdjustForm(prev => ({ ...prev, type: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add (+)</SelectItem>
                    <SelectItem value="subtract">Subtract (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity (kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={adjustForm.quantity || ''}
                  onChange={e => setAdjustForm(p => ({ ...p, quantity: Math.abs(parseFloat(e.target.value) || 0) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={adjustForm.reason || undefined} onValueChange={(val) => setAdjustForm(prev => ({ ...prev, reason: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Purchase received">Purchase received</SelectItem>
                  <SelectItem value="Return">Return</SelectItem>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Audit adjustment">Audit adjustment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={adjustForm.notes}
                onChange={e => setAdjustForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Details for adjustment..."
              />
            </div>

            <div className="p-3 bg-blue-50 text-blue-800 rounded-md mt-2 text-sm">
              New quantity will be: <span className="font-bold">
                {adjustForm.type === 'add'
                  ? ((Number(selectedStock?.available_quantity) || 0) + (Number(adjustForm.quantity) || 0))
                  : ((Number(selectedStock?.available_quantity) || 0) - (Number(adjustForm.quantity) || 0))} kg
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustModalOpen(false)}>Cancel</Button>
            <Button onClick={() => adjustStockMutation.mutate(adjustForm as any)} disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? "Confirming..." : "Confirm Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Stock Adjustment History</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="mb-4">
              <span className="font-semibold">{selectedStock?.products?.name || selectedStock?.product_name}</span> at <span className="font-semibold">{selectedStock?.warehouses?.name || selectedStock?.warehouse}</span>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHistoryLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4">Loading history...</TableCell></TableRow>
                ) : historyLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No adjustments recorded yet.</TableCell></TableRow>
                ) : (
                  historyLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>{format(new Date(log.date), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell>
                        {log.direction === 'in' ? (
                          <Badge className="bg-green-50 text-green-700 border-none">Added</Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-700 border-none">Removed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {log.direction === 'in' ? '+' : '-'}{log.qty} {selectedStock?.unit || 'kg'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.reference || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

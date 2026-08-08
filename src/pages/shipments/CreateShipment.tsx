import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Section, FormGrid, FormRow } from "@/components/shared/FormShell";

import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function CreateShipment() {
  const nav = useNavigate();
  const { profile , session } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // State
  const [orders, setOrders] = useState<any[]>([]);
  const [carriersList, setCarriersList] = useState<any[]>([]);
  const [portsList, setPortsList] = useState<any[]>([]);
  const [containerTypesList, setContainerTypesList] = useState<any[]>([]);

  const [orderId, setOrderId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [originPort, setOriginPort] = useState("");
  const [destinationPort, setDestinationPort] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [eta, setEta] = useState("");
  const [containerCount, setContainerCount] = useState("1");
  const [containerType, setContainerType] = useState("");

  // New Port State
  const [isPortModalOpen, setIsPortModalOpen] = useState(false);
  const [newPortName, setNewPortName] = useState("");
  const [newPortCountry, setNewPortCountry] = useState("");
  const [newPortCode, setNewPortCode] = useState("");
  const [savingPort, setSavingPort] = useState(false);

  // New Container Type State
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [newContainerName, setNewContainerName] = useState("");
  const [newContainerDesc, setNewContainerDesc] = useState("");
  const [savingContainer, setSavingContainer] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session?.access_token}`;

      const [ordersRes, carriersRes, portsRes, containersRes] = await Promise.all([
        apiFetch(`/api/finance/export_orders?company_id=${profile?.company_id}`, { headers  }),
        apiFetch('/api/finance/shipping_carriers', { headers  }),
        apiFetch('/api/finance/shipping_ports', { headers  }),
        apiFetch('/api/finance/container_types', { headers  })
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const activeOrders = ordersData.filter((o: any) => o.is_deleted !== true);
        const sorted = activeOrders.sort((a: any, b: any) => new Date(b.created_at || b.order_date).getTime() - new Date(a.created_at || a.order_date).getTime());
        setOrders(sorted || []);
      } else {
        console.error("Failed to fetch export orders:", await ordersRes.text());
      }

      if (carriersRes.ok) {
        const carriersData = await carriersRes.json();
        setCarriersList(carriersData.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }

      if (portsRes.ok) {
        const portsData = await portsRes.json();
        setPortsList(portsData.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }

      if (containersRes.ok) {
        const containersData = await containersRes.json();
        setContainerTypesList(containersData.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.company_id) fetchData();
  }, [profile?.company_id]);

  const selectedOrder = orders.find(o => o.id === orderId);

  const handleAddPort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortName || !newPortCode) return toast.error("Port name and code are required");
    
    setSavingPort(true);
    try {
      
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session?.access_token}`;

      const res = await apiFetch('/api/finance/shipping_ports', { method: 'POST',
        headers,
        body: JSON.stringify({
          name: newPortName,
          country: newPortCountry,
          code: newPortCode.toUpperCase()
         })
      });
      if (!res.ok) throw new Error(await res.text() || "Failed to add port");

      toast.success("New port added successfully");
      setIsPortModalOpen(false);
      setNewPortName("");
      setNewPortCountry("");
      setNewPortCode("");
      fetchData(); // Refresh the dropdowns
    } catch (err: any) {
      toast.error(err.message || "Failed to add port");
    } finally {
      setSavingPort(false);
    }
  };

  const handleAddContainerType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContainerName) return toast.error("Container type name is required");
    
    setSavingContainer(true);
    try {
      
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session?.access_token}`;

      const res = await apiFetch('/api/finance/container_types', { method: 'POST',
        headers,
        body: JSON.stringify({
          name: newContainerName,
          description: newContainerDesc
         })
      });
      if (!res.ok) throw new Error(await res.text() || "Failed to add container type");

      toast.success("New container type added successfully");
      setIsContainerModalOpen(false);
      setNewContainerName("");
      setNewContainerDesc("");
      fetchData(); // Refresh the dropdowns
    } catch (err: any) {
      toast.error(err.message || "Failed to add container type");
    } finally {
      setSavingContainer(false);
    }
  };

  const handleSave = async () => {
    if (!orderId || !carrier || !originPort || !destinationPort || !containerType) {
      return toast.error("Please fill in all required fields");
    }

    setSaving(true);
    try {
      
      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session?.access_token}`;

      // 1. Check and create Carrier on-the-fly
      const trimmedCarrier = carrier.trim();
      const existingCarrier = carriersList.find(c => c.name.toLowerCase() === trimmedCarrier.toLowerCase());
      if (!existingCarrier) {
        const newCode = trimmedCarrier.substring(0, 3).toUpperCase();
        await apiFetch('/api/finance/shipping_carriers', { method: 'POST',
          headers,
          body: JSON.stringify({ name: trimmedCarrier, code: newCode  })
        });
      }

      // 2. Check and create Origin Port on-the-fly
      const trimmedOrigin = originPort.trim();
      const existingOrigin = portsList.find(p => p.name.toLowerCase() === trimmedOrigin.toLowerCase());
      if (!existingOrigin) {
        const rand = Math.floor(Math.random() * 9000 + 1000);
        const newCode = `PRT-${rand}`;
        await apiFetch('/api/finance/shipping_ports', { method: 'POST',
          headers,
          body: JSON.stringify({
            name: trimmedOrigin,
            country: 'Unknown',
            code: newCode
           })
        });
      }

      // 3. Check and create Destination Port on-the-fly
      const trimmedDest = destinationPort.trim();
      const existingDest = portsList.find(p => p.name.toLowerCase() === trimmedDest.toLowerCase());
      if (!existingDest && trimmedDest.toLowerCase() !== trimmedOrigin.toLowerCase()) {
        const rand = Math.floor(Math.random() * 9000 + 1000);
        const newCode = `PRT-${rand}`;
        await apiFetch('/api/finance/shipping_ports', { method: 'POST',
          headers,
          body: JSON.stringify({
            name: trimmedDest,
            country: 'Unknown',
            code: newCode
           })
        });
      }

      // 4. Check and create Container Type on-the-fly
      const trimmedType = containerType.trim();
      const existingType = containerTypesList.find(c => c.name.toLowerCase() === trimmedType.toLowerCase());
      if (!existingType) {
        await apiFetch('/api/finance/container_types', { method: 'POST',
          headers,
          body: JSON.stringify({
            name: trimmedType,
            description: 'Automatically created container type'
           })
        });
      }

      const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const shipmentNumber = `SHP-${new Date().getFullYear()}-${rand}`;

      // Calculate weight per container
      const totalWeight = Number(selectedOrder?.quantity) || 0;
      const count = parseInt(containerCount) || 1;
      
      if (count > 50) {
        setSaving(false);
        return toast.error('Maximum 50 containers allowed per shipment. Please check the container count input.');
      }
      
      const weightPerContainer = totalWeight / count;

      // Insert shipment
      const shipRes = await apiFetch('/api/finance/export_shipments', { method: 'POST',
        headers,
        body: JSON.stringify({
          company_id: profile!.company_id,
          order_id: orderId,
          shipment_number: shipmentNumber,
          customer_name: selectedOrder?.customer_name,
          carrier: trimmedCarrier,
          origin_port: trimmedOrigin,
          destination_port: trimmedDest,
          departure_date: departureDate || null,
          eta: eta || null,
          total_cartons: selectedOrder?.total_cartons,
          unit_net_weight: selectedOrder?.unit_net_weight,
          status: 'Pending',
          created_by: profile!.id
         })
      });

      if (!shipRes.ok) throw new Error(await shipRes.text() || "Failed to create shipment");
      const shipment = await shipRes.json();

      // Insert containers with pre-filled weights
      const containersToInsert = Array.from({ length: count }).map((_, i) => ({
        company_id: profile!.company_id,
        shipment_id: shipment.id,
        container_number: `TBD-${i+1}`,
        container_type: trimmedType,
        weight_kg: weightPerContainer,
        status: 'Pending'
      }));

      const contRes = await apiFetch('/api/finance/export_containers', { method: 'POST',
        headers,
        body: JSON.stringify(containersToInsert)
       });
      if (!contRes.ok) throw new Error(await contRes.text() || "Failed to create containers");

      // Auto-generate a tracking entry (cargo/barcode) for this shipment
      const barcodeValue = shipment.shipment_number || `SHP-${shipment.id}`;
      const bRes = await apiFetch('/api/barcodes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch_number: barcodeValue, barcode_data: barcodeValue, shipment_id: shipment.id, created_by: profile?.id }) });
      const barcodeError = bRes.ok ? null : new Error('Failed');
      
      if (barcodeError) {
        console.error("Failed to create barcode tracking:", barcodeError);
      }

      toast.success("Shipment created with automatic tracking and weight distribution!");
      nav("/shipments");
    } catch (err: any) {
      toast.error(err.message || "Failed to create shipment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Create Shipment" breadcrumbs={[{ label: "Shipments", to: "/shipments" }, { label: "New" }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-1.5" />Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save Shipment
          </Button>
        </>}
      />
      
      {/* Port Creation Modal */}
      <Dialog open={isPortModalOpen} onOpenChange={setIsPortModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Shipping Port</DialogTitle></DialogHeader>
          <form onSubmit={handleAddPort} className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Port Name *</Label><Input value={newPortName} onChange={e => setNewPortName(e.target.value)} placeholder="e.g., Los Angeles" required /></div>
            <div className="space-y-2"><Label>Country</Label><Input value={newPortCountry} onChange={e => setNewPortCountry(e.target.value)} placeholder="e.g., USA" /></div>
            <div className="space-y-2"><Label>Port Code *</Label><Input value={newPortCode} onChange={e => setNewPortCode(e.target.value)} placeholder="e.g., USLAX" required /></div>
            <Button type="submit" disabled={savingPort} className="w-full">
              {savingPort && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Port
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Container Type Creation Modal */}
      <Dialog open={isContainerModalOpen} onOpenChange={setIsContainerModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Container Type</DialogTitle></DialogHeader>
          <form onSubmit={handleAddContainerType} className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Container Name/Type *</Label><Input value={newContainerName} onChange={e => setNewContainerName(e.target.value)} placeholder="e.g., 40ft Flat Rack, Box, Carton" required /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={newContainerDesc} onChange={e => setNewContainerDesc(e.target.value)} placeholder="Optional description" /></div>
            <Button type="submit" disabled={savingContainer} className="w-full">
              {savingContainer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Container Type
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4 max-w-4xl">
        <Section title="Order Selection">
          <FormGrid>
            <FormRow label="Select Export Order" required>
              <div className="flex gap-2">
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={loading ? "Loading orders..." : "Select an order"} />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center">No orders found</div>
                    ) : (
                      orders.map(o => (
                        <SelectItem key={o.id} value={o.id}>
                          <div className="flex flex-col py-0.5">
                            <span className="font-bold">{o.order_number} — {o.product}</span>
                            <span className="text-[10px] text-muted-foreground">{o.customer_name} · {o.quantity} {o.unit}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={(e) => {
                    e.preventDefault();
                    fetchData();
                  }}
                  disabled={loading}
                  title="Refresh Orders"
                >
                  <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </FormRow>
          </FormGrid>

          {selectedOrder && (
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Product to Ship</p>
                <p className="text-sm font-bold text-primary">{selectedOrder.product}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Order Quantity</p>
                <p className="text-sm font-bold">{selectedOrder.quantity} {selectedOrder.unit}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Cartons</p>
                <p className="text-sm font-bold">{selectedOrder.total_cartons || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Net Wt / Box</p>
                <p className="text-sm font-bold">{selectedOrder.unit_net_weight || '—'} Kg</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Customer</p>
                <p className="text-sm font-bold">{selectedOrder.customer_name}</p>
              </div>
            </div>
          )}
        </Section>

        <Section title="Carrier & Logistics">
          <FormGrid>
            <FormRow label="Shipping Line / Carrier" required>
              <Input
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                placeholder="Type or select carrier..."
                list="carriers-datalist"
              />
              <datalist id="carriers-datalist">
                {carriersList.map(c => <option key={c.id || c.name} value={c.name} />)}
              </datalist>
            </FormRow>
          </FormGrid>
        </Section>
        <Section title="Route">
          <FormGrid>
            <FormRow label="Port of loading" required>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={originPort}
                  onChange={e => setOriginPort(e.target.value)}
                  placeholder="Type or select port..."
                  list="ports-datalist"
                />
                <datalist id="ports-datalist">
                  {portsList.map(p => <option key={p.id || p.code} value={p.name} />)}
                </datalist>
                <Button variant="outline" size="icon" onClick={() => setIsPortModalOpen(true)} title="Add new port">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormRow>
            <FormRow label="Port of discharge" required>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={destinationPort}
                  onChange={e => setDestinationPort(e.target.value)}
                  placeholder="Type or select port..."
                  list="ports-datalist"
                />
                <Button variant="outline" size="icon" onClick={() => setIsPortModalOpen(true)} title="Add new port">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormRow>
            <FormRow label="Departure date"><Input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} /></FormRow>
            <FormRow label="ETA"><Input type="date" value={eta} onChange={e => setEta(e.target.value)} /></FormRow>
          </FormGrid>
        </Section>
        <Section title="Containers">
          <FormGrid>
            <FormRow label="Number of containers"><Input type="number" min="1" value={containerCount} onChange={e => setContainerCount(e.target.value)} /></FormRow>
            <FormRow label="Container type" required>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={containerType}
                  onChange={e => setContainerType(e.target.value)}
                  placeholder="Type or select container type..."
                  list="containers-datalist"
                />
                <datalist id="containers-datalist">
                  {containerTypesList.map(c => <option key={c.id || c.name} value={c.name} />)}
                </datalist>
                <Button variant="outline" size="icon" onClick={() => setIsContainerModalOpen(true)} title="Add new container type">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormRow>
          </FormGrid>
        </Section>
      </div>
    </div>
  );
}

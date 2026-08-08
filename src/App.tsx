import DelayedLoader from "@/components/ui/DelayedLoader";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const ForceReset = lazy(() => import("./pages/ForceReset"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const LeadActivities = lazy(() => import("./pages/crm/Activities"));
const LeadsList = lazy(() => import("./pages/crm/LeadsList"));
const FollowUps = lazy(() => import("./pages/crm/FollowUps"));
import { FollowUpReminders } from "./components/crm/FollowUpReminders";
const LeadDetail = lazy(() => import("./pages/crm/LeadDetail"));
const LeadPipeline = lazy(() => import("./pages/crm/Pipeline"));
const EmailIntegration = lazy(() => import("./pages/crm/EmailIntegration"));
// CRM (New Modules)
const CrmDashboard = lazy(() => import("./pages/crm/Dashboard"));
const CrmTasks = lazy(() => import("./pages/crm/Tasks"));
const CrmSecurity = lazy(() => import("./pages/crm/Security"));
const CrmClientAcquisition = lazy(() => import("./pages/crm/ClientAcquisition"));
const CrmAdvancedSecurity = lazy(() => import("./pages/crm/AdvancedSecurity"));
const CrmReports = lazy(() => import("./pages/crm/Reports"));
const CrmPerformance = lazy(() => import("./pages/crm/Performance"));
const CrmRevenue = lazy(() => import("./pages/crm/RevenueAnalytics"));
const CrmCommunication = lazy(() => import("./pages/crm/Communication"));
const CrmCustomerDatabase = lazy(() => import("./pages/crm/CustomerDatabase"));
const CrmEmployeeActivity = lazy(() => import("./pages/crm/EmployeeActivity"));
const CrmConvert = lazy(() => import("./pages/crm/Convert"));
const CrmCustomersList = lazy(() => import("./pages/crm/CustomersList"));
// Mobile CRM (commented out – sidebar section disabled)
// import MobileLogin from "./pages/mobile/MobileLogin";
// import PushNotifications from "./pages/mobile/PushNotifications";
// import CallLogging from "./pages/mobile/CallLogging";
// import GPSTracking from "./pages/mobile/GPSTracking";
// import IPTracking from "./pages/mobile/IPTracking";
// import DeviceAuthorization from "./pages/mobile/DeviceAuthorization";

const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const WaitingApproval = lazy(() => import("./pages/WaitingApproval"));
const Pending = lazy(() => import("./pages/Pending"));
const InvoicePreview = lazy(() => import("./pages/documents/InvoicePreview"));
const PackingListPreview = lazy(() => import("./pages/documents/PackingListPreview"));
const CertificatePreview = lazy(() => import("./pages/documents/CertificatePreview"));
// Dashboards
const Executive = lazy(() => import("./pages/dashboards/Executive"));
const SalesAnalytics = lazy(() => import("./pages/dashboards/SalesAnalytics"));
const ShipmentAnalytics = lazy(() => import("./pages/dashboards/ShipmentAnalytics"));
const FinancialOverview = lazy(() => import("./pages/dashboards/FinancialOverview"));
const EmployeeProductivity = lazy(() => import("./pages/dashboards/EmployeeProductivity"));
const FinanceTally = lazy(() => import("./pages/dashboards/FinanceTally"));
const BdeDashboard = lazy(() => import("./pages/dashboards/BdeDashboard"));
// Farmers
const FarmersList = lazy(() => import("./pages/farmers/FarmersList"));
const CreateFarmer = lazy(() => import("./pages/farmers/CreateFarmer"));
const FarmerDetail = lazy(() => import("./pages/farmers/FarmerDetail"));
const ConvertToCustomer = lazy(() => import("./pages/farmers/ConvertToCustomer"));
const FarmerVerification = lazy(() => import("./pages/farmers/FarmerVerification"));
const FarmerKYC = lazy(() => import("./pages/farmers/KYC"));
const FarmVisits = lazy(() => import("./pages/farmers/FarmVisits"));
const ContractFarming = lazy(() => import("./pages/farmers/ContractFarming"));
const SupplyCommitments = lazy(() => import("./pages/farmers/SupplyCommitments"));
const GoodsCollection = lazy(() => import("./pages/farmers/GoodsCollection"));
const FarmerRating = lazy(() => import("./pages/farmers/FarmerRating"));
const FarmerPayouts = lazy(() => import("./pages/farmers/FarmerPayouts"));
const FarmerSupport = lazy(() => import("./pages/farmers/FarmerSupport"));
const FarmerDocuments = lazy(() => import("./pages/farmers/FarmerDocuments"));
import { FarmerProvider } from "@/context/FarmerContext";

// Procurement (live)
const PurchaseOrdersListLive = lazy(() => import("./pages/procurement/PurchaseOrdersListLive"));
const PurchaseOrderDetailLive = lazy(() => import("./pages/procurement/PurchaseOrderDetailLive"));
const CreatePOLive = lazy(() => import("./pages/procurement/CreatePOLive"));
const SuppliersList = lazy(() => import("./pages/procurement/SuppliersList"));
const SupplierDetail = lazy(() => import("./pages/procurement/SupplierDetail"));
const ProcurementDashboard = lazy(() => import("./pages/procurement/ProcurementDashboard"));
const InspectionsList = lazy(() => import("./pages/qc/InspectionsList"));
const ContainerLoading = lazy(() => import("./pages/inventory/ContainerLoading"));
const CreateInspection = lazy(() => import("./pages/qc/CreateInspection"));
const QCApprovals = lazy(() => import("./pages/qc/QCApprovals"));
// Barcode & Tracking
const BarcodesList = lazy(() => import("./pages/barcodes/BarcodesList"));
const GenerateBarcode = lazy(() => import("./pages/barcodes/GenerateBarcode"));
const ScanBarcode = lazy(() => import("./pages/barcodes/ScanBarcode"));
const BarcodeDetail = lazy(() => import("./pages/barcodes/BarcodeDetail"));
// Inventory
const ProductCatalog = lazy(() => import("./pages/inventory/ProductCatalog"));
const CreateProduct = lazy(() => import("./pages/inventory/CreateProduct"));
const InventoryBatches = lazy(() => import("./pages/inventory/InventoryBatches"));
const StockMovements = lazy(() => import("./pages/inventory/StockMovements"));
const Warehouses = lazy(() => import("./pages/inventory/Warehouses"));
const LowStockAlerts = lazy(() => import("./pages/inventory/LowStockAlerts"));
const DamagedStock = lazy(() => import("./pages/inventory/DamagedStock"));
const AvailableStock = lazy(() => import("./pages/inventory/AvailableStock"));
const ReservedStock = lazy(() => import("./pages/inventory/ReservedStock"));
const ExportReady = lazy(() => import("./pages/inventory/ExportReady"));
const BatchWiseStock = lazy(() => import("./pages/inventory/BatchWiseStock"));
const DamagedStockManagement = lazy(() => import("./pages/inventory/DamagedStockManagement"));
const ExpiryMonitoring = lazy(() => import("./pages/inventory/ExpiryMonitoring"));
const MultiWarehouse = lazy(() => import("./pages/inventory/MultiWarehouse"));
// Warehouse
const WarehouseDashboard = lazy(() => import("./pages/warehouse/WarehouseDashboard"));
const WarehouseRacks = lazy(() => import("./pages/warehouse/WarehouseRacks"));
const WarehouseZones = lazy(() => import("./pages/warehouse/WarehouseZones"));
const ReceivingGoods = lazy(() => import("./pages/warehouse/ReceivingGoods"));
const PackingManagement = lazy(() => import("./pages/warehouse/PackingManagement"));
// Reports
const ReportsHub = lazy(() => import("./pages/reports/ReportsHub"));
const StockSummaryReport = lazy(() => import("./pages/reports/StockSummaryReport"));
const BatchTrackingReport = lazy(() => import("./pages/reports/BatchTrackingReport"));
const DispatchReport = lazy(() => import("./pages/reports/DispatchReport"));
const ContainerLoadingReport = lazy(() => import("./pages/reports/ContainerLoadingReport"));
const DamageWastageReport = lazy(() => import("./pages/reports/DamageWastageReport"));
const InventoryAgingReport = lazy(() => import("./pages/reports/InventoryAgingReport"));
const ExportReadyStockReport = lazy(() => import("./pages/reports/ExportReadyStockReport"));
// Quotations
const QuotationsList = lazy(() => import("./pages/quotations/QuotationsList"));
const CreateQuotation = lazy(() => import("./pages/quotations/CreateQuotation"));
const QuotationPreview = lazy(() => import("./pages/quotations/QuotationPreview"));
const PublicQuotationView = lazy(() => import("./pages/quotations/PublicQuotationView"));
const QuotationApprovals = lazy(() => import("./pages/quotations/Approvals"));
const QuotationReport = lazy(() => import("./pages/quotations/QuotationReport"));
const ConvertQuotation = lazy(() => import("./pages/quotations/Convert"));
const EditQuotation = lazy(() => import("./pages/quotations/EditQuotation"));
// Orders
const OrdersList = lazy(() => import("./pages/orders/OrdersList"));
const OrderDetail = lazy(() => import("./pages/orders/OrderDetail"));
const CreateOrder = lazy(() => import("./pages/orders/CreateOrder"));
const OrderStatus = lazy(() => import("./pages/orders/OrderStatus"));
const Fulfillment = lazy(() => import("./pages/orders/Fulfillment"));
// Shipments
const ShipmentsList = lazy(() => import("./pages/shipments/ShipmentsList"));
const CreateShipment = lazy(() => import("./pages/shipments/CreateShipment"));
const ShipmentDetail = lazy(() => import("./pages/shipments/ShipmentDetail"));
const ContainerTracking = lazy(() => import("./pages/shipments/ContainerTracking"));
const DeliveryStatus = lazy(() => import("./pages/shipments/DeliveryStatus"));
const Dispatch = lazy(() => import("./pages/shipments/Dispatch"));
// Documents
const Invoices = lazy(() => import("./pages/documents/Invoices"));
const CommercialInvoices = lazy(() => import("./pages/documents/CommercialInvoices"));
const PackingLists = lazy(() => import("./pages/documents/PackingLists"));
const Certificates = lazy(() => import("./pages/documents/Certificates"));
const CreateCertificate = lazy(() => import("./pages/documents/CreateCertificate"));
const DocumentViewer = lazy(() => import("./pages/documents/DocumentViewer"));
const InvoiceReport = lazy(() => import("./pages/documents/InvoiceReport"));
const CreateInvoice = lazy(() => import("./pages/documents/CreateInvoice"));
// Payments
const PaymentsRegister = lazy(() => import("./pages/payments/PaymentsRegister"));
const OverduePayments = lazy(() => import("./pages/payments/OverduePayments"));
const Ledger = lazy(() => import("./pages/payments/Ledger"));
const FinancialReports = lazy(() => import("./pages/payments/FinancialReports"));
// Employees
const EmployeeDirectory = lazy(() => import("./pages/employees/EmployeeDirectory"));
const Attendance = lazy(() => import("./pages/employees/Attendance"));
const SalaryReport = lazy(() => import("./pages/employees/SalaryReport"));
const Payslips = lazy(() => import("./pages/employees/Payslips"));
const LeaveManagement = lazy(() => import("./pages/employees/LeaveManagement"));
const RolesPermissions = lazy(() => import("./pages/employees/RolesPermissions"));
import FaceAttendanceGuard from '@/guards/FaceAttendanceGuard';
const FaceAttendance = lazy(() => import("./pages/FaceAttendance.tsx"));
const RegisterFace = lazy(() => import("./pages/RegisterFace.tsx"));
// System
const Notifications = lazy(() => import("./pages/system/Notifications"));
const ActivityLogs = lazy(() => import("./pages/system/ActivityLogs"));
const AuditLogs = lazy(() => import("./pages/system/AuditLogs"));
const Subscriptions = lazy(() => import("./pages/system/Subscriptions"));
const Settings = lazy(() => import("./pages/system/Settings"));
const AccountSettings = lazy(() => import("./pages/system/AccountSettings"));
const Maintenance = lazy(() => import("./pages/system/Maintenance"));
const ZohoIntegration = lazy(() => import("./pages/system/ZohoIntegration"));
const Mailbox = lazy(() => import("./pages/system/Mailbox"));
const TallyIndex = lazy(() => import("./pages/Tally/index"));
const JournalEntry = lazy(() => import("./pages/Tally/JournalEntry"));
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

const DashboardRedirect = () => {
  const { roleSlugs, profile } = useAuth();
  const slugs = Array.from(roleSlugs).map(s => s.toLowerCase());
  const isAdmin = slugs.includes("admin");
  const isSecretary = slugs.includes("secretary");
  const isBde = slugs.includes("bd") ||
    slugs.includes("bde") ||
    (profile?.requested_role && ["bd", "bde"].includes(profile.requested_role.toLowerCase()));

  if (isAdmin) return <Navigate to="/dashboards/executive" replace />;
  if (isSecretary) return <Navigate to="/dashboards/finance-tally" replace />;
  if (isBde) return <Navigate to="/dashboards/bde" replace />;
  return <Navigate to="/dashboards/executive" replace />;
};

const RootRedirect = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const code = searchParams.get("code");
  const hash = location.hash;

  if (code || hash.includes("access_token") || hash.includes("error")) {
    return <Navigate to={`/auth/callback${location.search}${location.hash}`} replace />;
  }

  return <Navigate to="/auth" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FollowUpReminders />
          <Suspense fallback={<DelayedLoader />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/force-reset" element={<ForceReset />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/pending" element={<Pending />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/waiting-approval" element={<WaitingApproval />} />
            <Route path="/select-profile" element={<Navigate to="/dashboard" replace />} />

            {/* Public / Standalone Preview Routes (no AppLayout) */}
            <Route path="/invoices/:id/preview" element={<InvoicePreview />} />
            <Route path="/packing-lists/:id/preview" element={<PackingListPreview />} />
            <Route path="/documents/packing-lists/:id/preview" element={<PackingListPreview />} />
            <Route path="/documents/commercial-invoices/:id/preview" element={<InvoicePreview />} />
            <Route path="/certificates/:id/preview" element={<CertificatePreview />} />
            <Route path="/share/quote/:id" element={<PublicQuotationView />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/approvals" element={<Navigate to="/employees/roles" replace />} />

              {/* Dashboards */}
              <Route path="/dashboards/executive" element={<Executive />} />
              <Route path="/dashboards/finance-tally" element={<FinanceTally />} />
              <Route path="/dashboards/bde" element={<BdeDashboard />} />
              <Route path="/dashboards/sales" element={<SalesAnalytics />} />
              <Route path="/dashboards/shipments" element={<ShipmentAnalytics />} />
              <Route path="/dashboards/financial" element={<FinancialOverview />} />
              <Route path="/dashboards/employees" element={<EmployeeProductivity />} />

              {/* Farmers */}
              <Route path="/farmers/*" element={
                <FarmerProvider>
                  <Routes>
                    <Route path="/" element={<FarmersList />} />
                    <Route path="/create" element={<CreateFarmer />} />
                    <Route path="/verification" element={<FarmerVerification />} />
                    <Route path="/kyc" element={<FarmerKYC />} />
                    <Route path="/farm-visits" element={<FarmVisits />} />
                    <Route path="/contracts" element={<ContractFarming />} />
                    <Route path="/commitments" element={<SupplyCommitments />} />
                    <Route path="/collections" element={<GoodsCollection />} />
                    <Route path="/payouts" element={<FarmerPayouts />} />
                    <Route path="/rating" element={<FarmerRating />} />
                    <Route path="/documents" element={<FarmerDocuments />} />
                    <Route path="/support" element={<FarmerSupport />} />
                    <Route path="/convert" element={<ConvertToCustomer />} />
                    <Route path="/:id" element={<FarmerDetail />} />
                  </Routes>
                </FarmerProvider>
              } />

              {/* Procurement */}

              <Route path="/procurement/orders" element={<PurchaseOrdersListLive />} />
              <Route path="/procurement/orders/create" element={<CreatePOLive />} />
              <Route path="/procurement/orders/edit/:id" element={<PurchaseOrderDetailLive />} />
              <Route path="/procurement/suppliers" element={<SuppliersList />} />
              <Route path="/procurement/suppliers/:id" element={<SupplierDetail />} />
              <Route path="/procurement/dashboard" element={<ProcurementDashboard />} />
              <Route path="/procurement/analytics" element={<Navigate to="/procurement/dashboard" replace />} />

              {/* Quality Control */}
              <Route path="/qc/inspections" element={<InspectionsList />} />
              <Route path="/qc/inspections/create" element={<CreateInspection />} />
              <Route path="/qc/approvals" element={<QCApprovals />} />
              <Route path="/warehouse/container-loading" element={<ContainerLoading />} />

              {/* Barcode & Tracking */}
              <Route path="/barcodes" element={<BarcodesList />} />
              <Route path="/barcodes/generate" element={<GenerateBarcode />} />
              <Route path="/barcodes/scan" element={<ScanBarcode />} />
              <Route path="/barcodes/:id" element={<BarcodeDetail />} />

              {/* Inventory */}
              <Route path="/inventory/products" element={<ProductCatalog />} />
              <Route path="/inventory/products/create" element={<CreateProduct />} />
              <Route path="/inventory/stock" element={<InventoryBatches />} />
              <Route path="/inventory/movements" element={<StockMovements />} />
              <Route path="/inventory/warehouses" element={<Warehouses />} />
              <Route path="/inventory/alerts" element={<LowStockAlerts />} />
              <Route path="/inventory/damaged" element={<DamagedStock />} />
              <Route path="/inventory/available-stock" element={<AvailableStock />} />
              <Route path="/inventory/reserved-stock" element={<ReservedStock />} />
              <Route path="/inventory/export-ready" element={<ExportReady />} />
              <Route path="/inventory/batch-wise" element={<BatchWiseStock />} />
              <Route path="/inventory/damaged-stock-management" element={<DamagedStockManagement />} />
              <Route path="/inventory/expiry-monitoring" element={<ExpiryMonitoring />} />
              <Route path="/inventory/multi-warehouse" element={<MultiWarehouse />} />

              {/* Warehouse */}
              <Route path="/warehouse/dashboard" element={<WarehouseDashboard />} />
              <Route path="/warehouse/racks" element={<WarehouseRacks />} />
              <Route path="/warehouse/zones" element={<WarehouseZones />} />
              <Route path="/warehouse/receiving" element={<ReceivingGoods />} />
              <Route path="/warehouse/packing" element={<PackingManagement />} />
              <Route path="/warehouse" element={<Navigate to="/warehouse/dashboard" replace />} />

              {/* Reports */}
              <Route path="/reports" element={<ReportsHub />} />
              <Route path="/reports/stock-summary" element={<StockSummaryReport />} />
              <Route path="/reports/batch-tracking" element={<BatchTrackingReport />} />
              <Route path="/reports/dispatch" element={<DispatchReport />} />
              <Route path="/reports/container-loading" element={<ContainerLoadingReport />} />
              <Route path="/reports/damage-wastage" element={<DamageWastageReport />} />
              <Route path="/reports/inventory-aging" element={<InventoryAgingReport />} />
              <Route path="/reports/export-ready" element={<ExportReadyStockReport />} />

              {/* Quotations */}
              <Route path="/quotations" element={<QuotationsList />} />
              <Route path="/quotations/create" element={<CreateQuotation />} />
              <Route path="/quotations/edit/:id" element={<EditQuotation />} />
              <Route path="/quotations/approvals" element={<QuotationApprovals />} />
              <Route path="/quotations/convert" element={<ConvertQuotation />} />
              <Route path="/quotations/:id" element={<QuotationPreview />} />
              <Route path="/quotations/:id/report" element={<QuotationReport />} />

              {/* CRM */}
              <Route path="/crm" element={<Navigate to="/crm/dashboard" replace />} />
              <Route path="/crm/dashboard" element={<CrmDashboard />} />
              <Route path="/crm/activities" element={<LeadActivities />} />
              <Route path="/crm/leads" element={<LeadsList />} />
              <Route path="/crm/follow-ups" element={<FollowUps />} />
              <Route path="/crm/leads/:id" element={<LeadDetail />} />
              <Route path="/crm/pipeline" element={<LeadPipeline />} />
              <Route path="/crm/email" element={<EmailIntegration />} />
              <Route path="/crm/tasks" element={<CrmTasks />} />
              <Route path="/crm/security" element={<CrmSecurity />} />
              <Route path="/crm/client-acquisition" element={<CrmClientAcquisition />} />
              <Route path="/crm/advanced-security" element={<CrmAdvancedSecurity />} />
              <Route path="/crm/reports" element={<CrmReports />} />
              <Route path="/crm/performance" element={<CrmPerformance />} />
              <Route path="/crm/revenue" element={<CrmRevenue />} />
              <Route path="/crm/communication" element={<CrmCommunication />} />
              <Route path="/crm/customer-database" element={<CrmCustomerDatabase />} />
              <Route path="/crm/employee-activity" element={<CrmEmployeeActivity />} />
              <Route path="/crm/convert" element={<CrmConvert />} />
              <Route path="/crm/customers" element={<CrmCustomersList />} />

              {/* Mobile pages – commented out, sidebar section disabled
              /mobile/login -> MobileLogin
              /mobile/push-notifications -> PushNotifications
              /mobile/call-logging -> CallLogging
              /mobile/gps-tracking -> GPSTracking
              /mobile/ip-tracking -> IPTracking
              /mobile/device-authorization -> DeviceAuthorization
              */}

              {/* Orders */}
              <Route path="/orders" element={<OrdersList />} />
              <Route path="/orders/create" element={<CreateOrder />} />
              <Route path="/orders/status" element={<OrderStatus />} />
              <Route path="/orders/fulfillment" element={<Fulfillment />} />
              <Route path="/orders/:id" element={<OrderDetail />} />

              {/* Shipments */}
              <Route path="/shipments" element={<ShipmentsList />} />
              <Route path="/shipments/create" element={<CreateShipment />} />
              <Route path="/shipments/:id" element={<ShipmentDetail />} />
              <Route path="/shipments/containers" element={<ContainerTracking />} />
              <Route path="/shipments/delivery" element={<DeliveryStatus />} />
              <Route path="/shipments/dispatch" element={<Dispatch />} />

              {/* Documents */}
              <Route path="/documents" element={<Navigate to="/documents/invoices" replace />} />
              <Route path="/documents/invoices" element={<Invoices />} />
              <Route path="/documents/invoices/create" element={<CreateInvoice />} />
              <Route path="/documents/invoices/:id" element={<InvoiceReport />} />
              <Route path="/documents/packing-lists" element={<PackingLists />} />
              <Route path="/documents/commercial-invoices" element={<CommercialInvoices />} />
              <Route path="/documents/certificates" element={<Certificates />} />
              <Route path="/certificates/create" element={<CreateCertificate />} />
              <Route path="/documents/viewer" element={<DocumentViewer />} />

              {/* Payments */}
              <Route path="/payments" element={<PaymentsRegister />} />
              <Route path="/payments/overdue" element={<OverduePayments />} />
              <Route path="/payments/ledger" element={<Ledger />} />
              <Route path="/payments/reports" element={<FinancialReports />} />

              {/* Tally */}
              <Route path="/tally/*" element={<TallyIndex />} />
              <Route path="/journal" element={<JournalEntry />} />
              <Route path="/gst-reports" element={<Navigate to="/tally/gst-reports" replace />} />

              {/* Employees */}
              <Route path="/employees" element={<EmployeeDirectory />} />
              <Route path="/employees/roles" element={<RolesPermissions />} />
              <Route path="/employees/attendance" element={<Attendance />} />
              <Route path="/employees/salary" element={<SalaryReport />} />
              <Route path="/hr-employees/payslips" element={<Payslips />} />
              <Route path="/employees/leaves" element={<LeaveManagement />} />
              <Route path="/employees/face-attendance" element={<FaceAttendanceGuard><FaceAttendance /></FaceAttendanceGuard>} />
              <Route path="/employees/register-face" element={<RegisterFace />} />

              {/* System */}
              <Route path="/system/notifications" element={<Notifications />} />
              <Route path="/system/logs" element={<ActivityLogs />} />
              <Route path="/system/audit-logs" element={<AuditLogs />} />
              <Route path="/system/subscriptions" element={<Subscriptions />} />
              <Route path="/system/settings" element={<Settings />} />
              <Route path="/system/account" element={<AccountSettings />} />
              <Route path="/system/maintenance" element={<Maintenance />} />
              <Route path="/system/integrations/zoho" element={<ZohoIntegration />} />
              <Route path="/system/mailbox" element={<Mailbox />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
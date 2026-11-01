import { lazy as reactLazy, type ComponentType, type ReactNode } from "react";

// Ghi loader theo đường dẫn để tải đúng chunk của URL hiện tại ngay khi bundle chạy
// (song song với phiên đăng nhập), và tải các trang còn lại khi trình duyệt rảnh.
const routeLoaders: Array<() => Promise<unknown>> = [];
const routeEntries: Array<{ path: string; exact: boolean; load: () => Promise<unknown> }> = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazy = <T extends ComponentType<any>>(
  path: string | string[],
  loader: () => Promise<{ default: T }>,
  exact = false,
) => {
  routeLoaders.push(loader);
  for (const item of Array.isArray(path) ? path : [path]) {
    routeEntries.push({ path: item, exact, load: loader });
  }
  return reactLazy(loader);
};
const routeMatches = (pathname: string, entry: (typeof routeEntries)[number]) =>
  entry.exact
    ? pathname === entry.path
    : pathname === entry.path || pathname.startsWith(`${entry.path}/`);

export const preloadCurrentRoute = (pathname = typeof window === "undefined" ? "/" : window.location.pathname) => {
  const match = routeEntries
    .filter((entry) => routeMatches(pathname, entry))
    .sort((a, b) => b.path.length - a.path.length || Number(b.exact) - Number(a.exact))[0];
  if (match) void match.load().catch(() => undefined);
};

export const preloadRoutes = async () => {
  // Không tranh băng thông với dữ liệu trang: bỏ qua khi tiết kiệm dữ liệu / mạng 2G,
  // và tải TUẦN TỰ từng chunk thay vì bắn 50 request cùng lúc.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /2g/.test(conn?.effectiveType ?? "")) return;
  for (const load of routeLoaders) {
    await load().catch(() => undefined);
  }
};
import { Navigate } from "react-router-dom";

import {
  RequireAuth,
  RequireCompany,
  RequireModule,
  RequireStaffPath,
  RequirePlatformAdmin,
} from "./components/auth/route-guards";
import { PageSuspense } from "./components/layout/page-suspense";
import NotFound from "./pages/NotFound";

const Index = lazy("/", () => import("./pages/Index"), true);
const Login = lazy("/login", () => import("./pages/Login"), true);
const ResetPassword = lazy("/dat-lai-mat-khau", () => import("./pages/ResetPassword"));
const Employees = lazy("/employees", () => import("./pages/Employees"), true);
const Onboarding = lazy("/hoi-nhap", () => import("./pages/Onboarding"));
const EmployeeProfilePage = lazy("/employees", () => import("./pages/EmployeeProfile"));
const Insurance = lazy("/bao-hiem", () => import("./pages/Insurance"));
const CompanyPicker = lazy("/cong-ty", () => import("./pages/CompanyPicker"));
const SetupWizard = lazy("/bat-dau", () => import("./pages/onboarding-wizard/SetupWizard"));
const JoinCompany = lazy("/tham-gia", () => import("./pages/JoinCompany"));
const OrgStructure = lazy("/cai-dat/co-cau-to-chuc", () => import("./pages/settings/OrgStructure"));
const HomeWidgets = lazy("/cai-dat/widget-trang-chu", () => import("./pages/settings/HomeWidgets"));
const OnboardingChecklist = lazy(
  "/cai-dat/checklist-hoi-nhap",
  () => import("./pages/settings/OnboardingChecklist"),
);
const ContractTemplates = lazy("/cai-dat/mau-hop-dong", () => import("./pages/settings/ContractTemplates"));
const DocumentChecklist = lazy(
  "/cai-dat/checklist-ho-so",
  () => import("./pages/settings/DocumentChecklist"),
);
const WorkforceReport = lazy("/bao-cao", () => import("./pages/bao-cao/WorkforceReport"));
const Headcount = lazy("/hoach-dinh", () => import("./pages/planning/Headcount"));
const CheckIn = lazy(["/cham-cong", "/toi/cham-cong"], () => import("./pages/attendance/CheckIn"));
const Timesheet = lazy("/cham-cong/bang-cong", () => import("./pages/attendance/Timesheet"));
const Schedule = lazy("/cham-cong/lich-lam-viec", () => import("./pages/attendance/Schedule"));
const Shifts = lazy("/cai-dat/ca-lam-viec", () => import("./pages/attendance/Shifts"));
const ShiftAssignments = lazy(
  "/cham-cong/phan-ca",
  () => import("./pages/attendance/ShiftAssignments"),
);
const AttendanceSettings = lazy(
  "/cai-dat/cham-cong",
  () => import("./pages/attendance/AttendanceSettings"),
);
const AttendanceQrDisplay = lazy("/cai-dat/ma-qr-cham-cong", () => import("./pages/attendance/AttendanceQrDisplay"));
const EmployeeQrScanPage = lazy("/toi/quet-qr", () => import("./pages/me/EmployeeQrScan"));
const AttendanceDevices = lazy("/cai-dat/thiet-bi-cham-cong", () => import("./pages/attendance/Devices"));
const AttendanceLog = lazy("/cham-cong/nhat-ky", () => import("./pages/attendance/AttendanceLog"));
const EmployeeProfile = lazy(["/toi", "/toi/ho-so"], () => import("./pages/me/EmployeeProfile"));
const EmployeeDevicesPage = lazy("/toi/thiet-bi", () => import("./pages/me/EmployeeDevices"));
const EmployeeTimesheetPage = lazy(
  "/toi/bang-cong",
  () => import("./pages/me/EmployeeTimesheet"),
);
const EmployeeEvaluationsPage = lazy("/toi/danh-gia", () => import("./pages/me/EmployeeEvaluations"));
const EmployeePayslip = lazy("/toi/phieu-luong", () => import("./pages/me/EmployeePayslip"));
const EmployeeNewsPage = lazy("/toi/tin-tuc", () => import("./pages/me/EmployeeNews"));
const EmployeeSurveysPage = lazy("/toi/khao-sat", () => import("./pages/me/EmployeeSurveys"));
const EmployeeDocumentsPage = lazy("/toi/tai-lieu", () => import("./pages/me/EmployeeDocuments"));
const EmployeeWorkPage = lazy("/cong-viec", () => import("./pages/me/EmployeeWork"));
const EmployeeAppsPage = lazy("/ung-dung", () => import("./pages/me/EmployeeApps"));
const MobilePreview = lazy("/xem-truoc-nhan-vien", () => import("./pages/me/MobilePreview"));
const Contracts = lazy("/hop-dong", () => import("./pages/Contracts"));
const Assets = lazy("/tai-san", () => import("./pages/Assets"));
const News = lazy("/tin-tuc", () => import("./pages/News"));
const PayrollParameters = lazy(
  "/cai-dat/tham-so-luong",
  () => import("@/pages/payroll/PayrollParameters"),
);
const EvaluationTemplates = lazy(
  "/cai-dat/bieu-mau-danh-gia",
  () => import("@/pages/evaluations/EvaluationTemplates"),
);
const Payroll = lazy("/tinh-luong", () => import("./pages/payroll/Payroll"));
const Workspaces = lazy("/cai-dat/he-thong/workspace", () => import("./pages/admin/Workspaces"));
const ServicePlans = lazy("/cai-dat/he-thong/goi-dich-vu", () => import("./pages/admin/ServicePlans"));
const PermissionGroups = lazy("/cai-dat/he-thong/phan-quyen", () => import("./pages/admin/PermissionGroups"));
const Requests = lazy("/don-tu", () => import("./pages/requests/Requests"), true);
const ActivityLogPage = lazy("/cai-dat/nhat-ky-hoat-dong", () => import("./pages/settings/ActivityLog"));
const PerformanceOverview = lazy("/danh-gia", () => import("./pages/evaluations/PerformanceOverview"));
const WorkCalendarPage = lazy("/cai-dat/lich-lam-viec", () => import("./pages/settings/WorkCalendar"));
const RequestTypes = lazy("/cai-dat/loai-don", () => import("./pages/requests/RequestTypes"));
const LeavePolicies = lazy(
  ["/nghi-phep", "/cai-dat/chinh-sach-phep"],
  () => import("./pages/requests/LeavePolicies"),
);
const ApprovalWorkflow = lazy(
  "/cai-dat/quy-trinh-duyet",
  () => import("./pages/requests/ApprovalWorkflow"),
);
const RecruitmentOverview = lazy(
  "/tuyen-dung",
  () => import("./pages/recruitment/RecruitmentOverview"),
  true,
);
const JobDescriptions = lazy(
  "/tuyen-dung/mo-ta",
  () => import("./pages/recruitment/JobDescriptions"),
);
const Campaigns = lazy("/tuyen-dung/chien-dich", () => import("./pages/recruitment/Campaigns"));
const Candidates = lazy("/tuyen-dung/ung-vien", () => import("./pages/recruitment/Candidates"), true);
const CandidateProfile = lazy(
  "/tuyen-dung/ung-vien",
  () => import("./pages/recruitment/CandidateProfile"),
);
const Interviews = lazy("/tuyen-dung/lich-hen", () => import("./pages/recruitment/Interviews"));
const PublicApplyForm = lazy(
  "/ung-tuyen",
  () => import("./pages/recruitment/PublicApplyForm"),
);
const Members = lazy("/cai-dat/thanh-vien", () => import("./pages/Members"));
const SettingsHome = lazy("/cai-dat", () => import("./pages/settings/SettingsHome"), true);
const EmailSettings = lazy("/cai-dat/email", () => import("./pages/settings/email/EmailSettings"));

const authenticated = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>;
const platformOnly = (node: ReactNode) => authenticated(<RequirePlatformAdmin>{node}</RequirePlatformAdmin>);

const companyScoped = (node: ReactNode, moduleKey?: string) => (
  <RequireAuth>
    <RequireCompany>
      <RequireStaffPath>
        {moduleKey ? (
          <RequireModule moduleKey={moduleKey}>{node}</RequireModule>
        ) : (
          node
        )}
      </RequireStaffPath>
    </RequireCompany>
  </RequireAuth>
);

export const routers = [
  {
    path: "/m",
    name: "employee-start",
    element: <Navigate to="/" replace />,
  },
  {
    path: "/xem-truoc-nhan-vien",
    name: "employee-mobile-preview",
    element: (
      <PageSuspense>
        <MobilePreview />
      </PageSuspense>
    ),
  },
  {
    path: "/",
    name: "dashboard",
    element: companyScoped(
      <PageSuspense>
        <Index />
      </PageSuspense>,
    ),
  },
  {
    path: "/login",
    name: "login",
    element: (
      <PageSuspense>
        <Login />
      </PageSuspense>
    ),
  },
  {
    path: "/dat-lai-mat-khau",
    name: "reset-password",
    element: (
      <PageSuspense>
        <ResetPassword />
      </PageSuspense>
    ),
  },
  {
    path: "/employees",
    name: "employees",
    element: companyScoped(
      <PageSuspense>
        <Employees />
      </PageSuspense>,
      "employees",
    ),
  },
  {
    path: "/employees/:id",
    name: "employee-profile",
    element: companyScoped(
      <PageSuspense>
        <EmployeeProfilePage />
      </PageSuspense>,
      "employees",
    ),
  },
  { path: "/khao-sat", name: "surveys-alias", element: <Navigate to="/toi/khao-sat" replace /> },
  { path: "/tai-lieu", name: "documents-alias", element: <Navigate to="/toi/tai-lieu" replace /> },
  {
    path: "/attendance",
    name: "attendance-legacy",
    element: <Navigate to="/cham-cong" replace />,
  },
  {
    path: "/leave",
    name: "leave-legacy",
    element: <Navigate to="/nghi-phep" replace />,
  },
  {
    path: "/bao-hiem",
    name: "insurance",
    element: companyScoped(
      <PageSuspense>
        <Insurance />
      </PageSuspense>,
      "insurance",
    ),
  },
  {
    path: "/cham-cong",
    name: "check-in",
    element: companyScoped(
      <PageSuspense>
        <CheckIn />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/cham-cong/bang-cong",
    name: "timesheet",
    element: companyScoped(
      <PageSuspense>
        <Timesheet />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/cham-cong/lich-lam-viec",
    name: "work-schedule",
    element: companyScoped(
      <PageSuspense>
        <Schedule />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/cai-dat/ca-lam-viec",
    name: "work-shifts",
    element: companyScoped(
      <PageSuspense>
        <Shifts />
      </PageSuspense>,
      "shifts",
    ),
  },
  {
    path: "/cham-cong/phan-ca",
    name: "shift-assignments",
    element: companyScoped(
      <PageSuspense>
        <ShiftAssignments />
      </PageSuspense>,
      "shifts",
    ),
  },
  {
    path: "/cai-dat/he-thong/workspace",
    name: "workspaces",
    element: platformOnly(
      <PageSuspense>
        <Workspaces />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/he-thong/phan-quyen",
    name: "permission-groups",
    element: platformOnly(
      <PageSuspense>
        <PermissionGroups />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/he-thong/goi-dich-vu",
    name: "service-plans",
    element: platformOnly(
      <PageSuspense>
        <ServicePlans />
      </PageSuspense>,
    ),
  },
  {
    path: "/hoi-nhap",
    name: "onboarding",
    element: companyScoped(
      <PageSuspense>
        <Onboarding />
      </PageSuspense>,
      "onboarding",
    ),
  },
  {
    path: "/tuyen-dung",
    name: "recruitment",
    element: companyScoped(
      <PageSuspense>
        <RecruitmentOverview />
      </PageSuspense>,
      "recruitment",
    ),
  },
  {
    path: "/tuyen-dung/mo-ta",
    name: "job-descriptions",
    element: companyScoped(
      <PageSuspense>
        <JobDescriptions />
      </PageSuspense>,
      "recruitment",
    ),
  },
  {
    path: "/tuyen-dung/chien-dich",
    name: "recruitment-campaigns",
    element: companyScoped(
      <PageSuspense>
        <Campaigns />
      </PageSuspense>,
      "recruitment",
    ),
  },
  {
    path: "/tuyen-dung/ung-vien",
    name: "candidates",
    element: companyScoped(
      <PageSuspense>
        <Candidates />
      </PageSuspense>,
      "recruitment",
    ),
  },
  {
    path: "/tuyen-dung/ung-vien/:id",
    name: "candidate-profile",
    element: companyScoped(
      <PageSuspense>
        <CandidateProfile />
      </PageSuspense>,
      "recruitment",
    ),
  },
  {
    path: "/tuyen-dung/lich-hen",
    name: "recruitment-interviews",
    element: companyScoped(
      <PageSuspense>
        <Interviews />
      </PageSuspense>,
      "recruitment",
    ),
  },
  {
    path: "/tinh-luong",
    name: "payroll",
    element: companyScoped(
      <PageSuspense>
        <Payroll />
      </PageSuspense>,
      "payroll",
    ),
  },
  {
    path: "/cai-dat/tham-so-luong",
    name: "payroll-parameters",
    element: companyScoped(
      <PageSuspense>
        <PayrollParameters />
      </PageSuspense>,
      "payroll",
    ),
  },
  {
    path: "/tin-tuc",
    name: "news",
    element: companyScoped(
      <PageSuspense>
        <News />
      </PageSuspense>,
      "news",
    ),
  },
  {
    path: "/danh-gia",
    name: "performance-overview",
    element: companyScoped(
      <PageSuspense>
        <PerformanceOverview />
      </PageSuspense>,
      "evaluations",
    ),
  },
  {
    path: "/cai-dat/bieu-mau-danh-gia",
    name: "evaluation-templates",
    element: companyScoped(
      <PageSuspense>
        <EvaluationTemplates />
      </PageSuspense>,
      "evaluations",
    ),
  },
  {
    path: "/tai-san",
    name: "assets",
    element: companyScoped(
      <PageSuspense>
        <Assets />
      </PageSuspense>,
      "assets",
    ),
  },
  {
    path: "/hop-dong",
    name: "contracts",
    element: companyScoped(
      <PageSuspense>
        <Contracts />
      </PageSuspense>,
      "contracts",
    ),
  },
  {
    path: "/don-tu",
    name: "requests",
    element: companyScoped(
      <PageSuspense>
        <Requests />
      </PageSuspense>,
      "requests",
    ),
  },
  {
    path: "/nghi-phep",
    name: "leave-management",
    element: companyScoped(
      <PageSuspense>
        <LeavePolicies />
      </PageSuspense>,
      "leave",
    ),
  },
  {
    path: "/cai-dat/quy-trinh-duyet",
    name: "approval-workflow",
    element: companyScoped(
      <PageSuspense>
        <ApprovalWorkflow />
      </PageSuspense>,
      "requests",
    ),
  },
  {
    path: "/cai-dat/chinh-sach-phep",
    name: "leave-policies",
    element: companyScoped(
      <PageSuspense>
        <LeavePolicies />
      </PageSuspense>,
      "leave",
    ),
  },
  {
    path: "/cai-dat/nhat-ky-hoat-dong",
    name: "activity-log",
    element: companyScoped(
      <PageSuspense>
        <ActivityLogPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/lich-lam-viec",
    name: "work-calendar",
    element: companyScoped(
      <PageSuspense>
        <WorkCalendarPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/loai-don",
    name: "request-types",
    element: companyScoped(
      <PageSuspense>
        <RequestTypes />
      </PageSuspense>,
      "requests",
    ),
  },
  {
    path: "/cong-viec",
    name: "employee-work",
    element: companyScoped(
      <PageSuspense>
        <EmployeeWorkPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/ung-dung",
    name: "employee-apps",
    element: companyScoped(
      <PageSuspense>
        <EmployeeAppsPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/toi",
    name: "me",
    element: companyScoped(
      <PageSuspense>
        <EmployeeProfile />
      </PageSuspense>,
    ),
  },
  {
    path: "/toi/ho-so",
    name: "me-profile",
    element: companyScoped(
      <PageSuspense>
        <EmployeeProfile infoOnly />
      </PageSuspense>,
    ),
  },
  {
    path: "/toi/thiet-bi",
    name: "me-devices",
    element: companyScoped(
      <PageSuspense>
        <EmployeeDevicesPage />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/toi/cham-cong",
    name: "me-check-in",
    element: companyScoped(
      <PageSuspense>
        <CheckIn personal />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/toi/bang-cong",
    name: "me-timesheet",
    element: companyScoped(
      <PageSuspense>
        <EmployeeTimesheetPage />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/toi/phieu-luong",
    name: "me-payslip",
    element: companyScoped(
      <PageSuspense>
        <EmployeePayslip />
      </PageSuspense>,
    ),
  },
  {
    path: "/toi/danh-gia",
    name: "me-evaluations",
    element: companyScoped(
      <PageSuspense>
        <EmployeeEvaluationsPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/toi/khao-sat",
    name: "me-surveys",
    element: companyScoped(
      <PageSuspense>
        <EmployeeSurveysPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/toi/tai-lieu",
    name: "me-documents",
    element: companyScoped(
      <PageSuspense>
        <EmployeeDocumentsPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/toi/tin-tuc",
    name: "me-news",
    element: companyScoped(
      <PageSuspense>
        <EmployeeNewsPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/ma-qr-cham-cong",
    name: "attendance-qr-display",
    element: companyScoped(
      <PageSuspense>
        <AttendanceQrDisplay />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/toi/quet-qr",
    name: "me-qr-scan",
    element: companyScoped(
      <PageSuspense>
        <EmployeeQrScanPage />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/thiet-bi-cham-cong",
    name: "attendance-devices",
    element: companyScoped(
      <PageSuspense>
        <AttendanceDevices />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/cham-cong/nhat-ky",
    name: "attendance-log",
    element: companyScoped(
      <PageSuspense>
        <AttendanceLog />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/cai-dat/cham-cong",
    name: "attendance-settings",
    element: companyScoped(
      <PageSuspense>
        <AttendanceSettings />
      </PageSuspense>,
      "attendance",
    ),
  },
  {
    path: "/bao-cao/nhan-su",
    name: "workforce-report",
    element: companyScoped(
      <PageSuspense>
        <WorkforceReport />
      </PageSuspense>,
    ),
  },
  {
    path: "/hoach-dinh/dinh-bien",
    name: "headcount",
    element: companyScoped(
      <PageSuspense>
        <Headcount />
      </PageSuspense>,
      "planning",
    ),
  },
  {
    path: "/cai-dat/thanh-vien",
    name: "members",
    element: companyScoped(
      <PageSuspense>
        <Members />
      </PageSuspense>,
      "members",
    ),
  },
  {
    path: "/cai-dat/widget-trang-chu",
    name: "home-widgets",
    element: companyScoped(
      <PageSuspense>
        <HomeWidgets />
      </PageSuspense>,
      "settings",
    ),
  },
  {
    path: "/cai-dat/co-cau-to-chuc",
    name: "org-structure",
    element: companyScoped(
      <PageSuspense>
        <OrgStructure />
      </PageSuspense>,
      "settings",
    ),
  },
  {
    path: "/cai-dat/checklist-hoi-nhap",
    name: "onboarding-checklist",
    element: companyScoped(
      <PageSuspense>
        <OnboardingChecklist />
      </PageSuspense>,
      "settings",
    ),
  },
  {
    path: "/cai-dat/mau-hop-dong",
    name: "contract-templates",
    element: companyScoped(
      <PageSuspense>
        <ContractTemplates />
      </PageSuspense>,
      "contracts",
    ),
  },
  {
    path: "/cai-dat/checklist-ho-so",
    name: "document-checklist",
    element: companyScoped(
      <PageSuspense>
        <DocumentChecklist />
      </PageSuspense>,
      "settings",
    ),
  },
  {
    path: "/ung-tuyen/:token",
    name: "public-apply",
    element: (
      <PageSuspense>
        <PublicApplyForm />
      </PageSuspense>
    ),
  },
  {
    path: "/bat-dau",
    name: "setup-wizard",
    element: authenticated(
      <PageSuspense>
        <SetupWizard />
      </PageSuspense>,
    ),
  },
  {
    path: "/cong-ty",
    name: "company-picker",
    element: authenticated(
      <PageSuspense>
        <CompanyPicker />
      </PageSuspense>,
    ),
  },
  {
    path: "/tham-gia/:token",
    name: "join-company",
    element: authenticated(
      <PageSuspense>
        <JoinCompany />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat",
    name: "settings-home",
    element: companyScoped(
      <PageSuspense>
        <SettingsHome />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/email/:tab",
    name: "settings-email",
    element: companyScoped(
      <PageSuspense>
        <EmailSettings />
      </PageSuspense>,
    ),
  },
  { path: "/cai-dat/email", name: "settings-email-root", element: <Navigate to="/cai-dat/email/mau" replace /> },
  /* URL cũ trước khi gom về CÀI ĐẶT */
  { path: "/cham-cong/ca-lam-viec", name: "legacy-cham-cong-ca-lam-viec", element: <Navigate to="/cai-dat/ca-lam-viec" replace /> },
  { path: "/quan-tri", name: "legacy-quan-tri", element: <Navigate to="/cai-dat/he-thong/workspace" replace /> },
  { path: "/quan-tri/phan-quyen", name: "legacy-quan-tri-phan-quyen", element: <Navigate to="/cai-dat/he-thong/phan-quyen" replace /> },
  { path: "/quan-tri/goi-dich-vu", name: "legacy-quan-tri-goi-dich-vu", element: <Navigate to="/cai-dat/he-thong/goi-dich-vu" replace /> },
  { path: "/tinh-luong/tham-so", name: "legacy-tinh-luong-tham-so", element: <Navigate to="/cai-dat/tham-so-luong" replace /> },
  { path: "/danh-gia/bieu-mau", name: "legacy-danh-gia-bieu-mau", element: <Navigate to="/cai-dat/bieu-mau-danh-gia" replace /> },
  { path: "/don-tu/quy-trinh-duyet", name: "legacy-don-tu-quy-trinh-duyet", element: <Navigate to="/cai-dat/quy-trinh-duyet" replace /> },
  { path: "/don-tu/chinh-sach-phep", name: "legacy-don-tu-chinh-sach-phep", element: <Navigate to="/cai-dat/chinh-sach-phep" replace /> },
  { path: "/don-tu/loai-don", name: "legacy-don-tu-loai-don", element: <Navigate to="/cai-dat/loai-don" replace /> },
  { path: "/cham-cong/thiet-bi", name: "legacy-cham-cong-thiet-bi", element: <Navigate to="/cai-dat/thiet-bi-cham-cong" replace /> },
  { path: "/cham-cong/cai-dat", name: "legacy-cham-cong-cai-dat", element: <Navigate to="/cai-dat/cham-cong" replace /> },
  { path: "/thanh-vien", name: "legacy-thanh-vien", element: <Navigate to="/cai-dat/thanh-vien" replace /> },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;

if (typeof window !== "undefined") preloadCurrentRoute();

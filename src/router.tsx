import { lazy as reactLazy, type ComponentType, type ReactNode } from "react";

// Ghi lại loader của mọi trang lazy để tải trước khi rảnh: chuyển trang sau đó không
// còn bị Suspense hiện màn chờ toàn màn hình (cảm giác như tải lại).
const routeLoaders: Array<() => Promise<unknown>> = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazy = <T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) => {
  routeLoaders.push(loader);
  return reactLazy(loader);
};
export const preloadRoutes = () => {
  routeLoaders.forEach((load) => void load().catch(() => undefined));
};
import { Navigate } from "react-router-dom";

import {
  RequireAuth,
  RequireCompany,
  RequireModule,
} from "./components/auth/route-guards";
import { PageSuspense } from "./components/layout/page-suspense";
import NotFound from "./pages/NotFound";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Employees = lazy(() => import("./pages/Employees"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const EmployeeProfilePage = lazy(() => import("./pages/EmployeeProfile"));
const Insurance = lazy(() => import("./pages/Insurance"));
const CompanyPicker = lazy(() => import("./pages/CompanyPicker"));
const JoinCompany = lazy(() => import("./pages/JoinCompany"));
const OrgStructure = lazy(() => import("./pages/settings/OrgStructure"));
const HomeWidgets = lazy(() => import("./pages/settings/HomeWidgets"));
const OnboardingChecklist = lazy(
  () => import("./pages/settings/OnboardingChecklist"),
);
const DocumentChecklist = lazy(
  () => import("./pages/settings/DocumentChecklist"),
);
const Headcount = lazy(() => import("./pages/planning/Headcount"));
const CheckIn = lazy(() => import("./pages/attendance/CheckIn"));
const Timesheet = lazy(() => import("./pages/attendance/Timesheet"));
const Schedule = lazy(() => import("./pages/attendance/Schedule"));
const Shifts = lazy(() => import("./pages/attendance/Shifts"));
const ShiftAssignments = lazy(
  () => import("./pages/attendance/ShiftAssignments"),
);
const AttendanceSettings = lazy(
  () => import("./pages/attendance/AttendanceSettings"),
);
const AttendanceDevices = lazy(() => import("./pages/attendance/Devices"));
const AttendanceLog = lazy(() => import("./pages/attendance/AttendanceLog"));
const EmployeeProfile = lazy(() => import("./pages/me/EmployeeProfile"));
const EmployeeDevicesPage = lazy(() => import("./pages/me/EmployeeDevices"));
const EmployeeTimesheetPage = lazy(
  () => import("./pages/me/EmployeeTimesheet"),
);
const EmployeePayslip = lazy(() => import("./pages/me/EmployeePayslip"));
const EmployeeNewsPage = lazy(() => import("./pages/me/EmployeeNews"));
const MobilePreview = lazy(() => import("./pages/me/MobilePreview"));
const Contracts = lazy(() => import("./pages/Contracts"));
const Assets = lazy(() => import("./pages/Assets"));
const News = lazy(() => import("./pages/News"));
const PayrollParameters = lazy(
  () => import("@/pages/payroll/PayrollParameters"),
);
const EvaluationTemplates = lazy(
  () => import("@/pages/evaluations/EvaluationTemplates"),
);
const Payroll = lazy(() => import("./pages/payroll/Payroll"));
const Workspaces = lazy(() => import("./pages/admin/Workspaces"));
const ServicePlans = lazy(() => import("./pages/admin/ServicePlans"));
const PermissionGroups = lazy(() => import("./pages/admin/PermissionGroups"));
const Requests = lazy(() => import("./pages/requests/Requests"));
const RequestTypes = lazy(() => import("./pages/requests/RequestTypes"));
const LeavePolicies = lazy(() => import("./pages/requests/LeavePolicies"));
const ApprovalWorkflow = lazy(
  () => import("./pages/requests/ApprovalWorkflow"),
);
const RecruitmentOverview = lazy(
  () => import("./pages/recruitment/RecruitmentOverview"),
);
const JobDescriptions = lazy(
  () => import("./pages/recruitment/JobDescriptions"),
);
const Campaigns = lazy(() => import("./pages/recruitment/Campaigns"));
const Candidates = lazy(() => import("./pages/recruitment/Candidates"));
const CandidateProfile = lazy(
  () => import("./pages/recruitment/CandidateProfile"),
);
const Interviews = lazy(() => import("./pages/recruitment/Interviews"));
const PublicApplyForm = lazy(
  () => import("./pages/recruitment/PublicApplyForm"),
);
const Members = lazy(() => import("./pages/Members"));
const SettingsHome = lazy(() => import("./pages/settings/SettingsHome"));
const EmailSettings = lazy(() => import("./pages/settings/email/EmailSettings"));

const authenticated = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>;

const companyScoped = (node: ReactNode, moduleKey?: string) => (
  <RequireAuth>
    <RequireCompany>
      {moduleKey ? (
        <RequireModule moduleKey={moduleKey}>{node}</RequireModule>
      ) : (
        node
      )}
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
    element: authenticated(
      <PageSuspense>
        <Workspaces />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/he-thong/phan-quyen",
    name: "permission-groups",
    element: authenticated(
      <PageSuspense>
        <PermissionGroups />
      </PageSuspense>,
    ),
  },
  {
    path: "/cai-dat/he-thong/goi-dich-vu",
    name: "service-plans",
    element: authenticated(
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
    path: "/toi/tin-tuc",
    name: "me-news",
    element: companyScoped(
      <PageSuspense>
        <EmployeeNewsPage />
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

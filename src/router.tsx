import { lazy, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { RequireAuth, RequireCompany, RequireModule } from "./components/auth/route-guards";
import { PageSuspense } from "./components/layout/page-suspense";
import NotFound from "./pages/NotFound";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Employees = lazy(() => import("./pages/Employees"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const EmployeeProfile = lazy(() => import("./pages/EmployeeProfile"));
const Insurance = lazy(() => import("./pages/Insurance"));
const CompanyPicker = lazy(() => import("./pages/CompanyPicker"));
const JoinCompany = lazy(() => import("./pages/JoinCompany"));
const OrgStructure = lazy(() => import("./pages/settings/OrgStructure"));
const OnboardingChecklist = lazy(() => import("./pages/settings/OnboardingChecklist"));
const DocumentChecklist = lazy(() => import("./pages/settings/DocumentChecklist"));
const Headcount = lazy(() => import("./pages/planning/Headcount"));
const CheckIn = lazy(() => import("./pages/attendance/CheckIn"));
const Timesheet = lazy(() => import("./pages/attendance/Timesheet"));
const Schedule = lazy(() => import("./pages/attendance/Schedule"));
const Shifts = lazy(() => import("./pages/attendance/Shifts"));
const ShiftAssignments = lazy(() => import("./pages/attendance/ShiftAssignments"));
const AttendanceSettings = lazy(() => import("./pages/attendance/AttendanceSettings"));
const Contracts = lazy(() => import("./pages/Contracts"));
const Assets = lazy(() => import("./pages/Assets"));
const News = lazy(() => import("./pages/News"));
const Payroll = lazy(() => import("./pages/payroll/Payroll"));
const Workspaces = lazy(() => import("./pages/admin/Workspaces"));
const ServicePlans = lazy(() => import("./pages/admin/ServicePlans"));
const PermissionGroups = lazy(() => import("./pages/admin/PermissionGroups"));
const Requests = lazy(() => import("./pages/requests/Requests"));
const RequestTypes = lazy(() => import("./pages/requests/RequestTypes"));
const LeavePolicies = lazy(() => import("./pages/requests/LeavePolicies"));
const ApprovalWorkflow = lazy(() => import("./pages/requests/ApprovalWorkflow"));
const RecruitmentOverview = lazy(() => import("./pages/recruitment/RecruitmentOverview"));
const JobDescriptions = lazy(() => import("./pages/recruitment/JobDescriptions"));
const Campaigns = lazy(() => import("./pages/recruitment/Campaigns"));
const Candidates = lazy(() => import("./pages/recruitment/Candidates"));
const CandidateProfile = lazy(() => import("./pages/recruitment/CandidateProfile"));
const Interviews = lazy(() => import("./pages/recruitment/Interviews"));
const PublicApplyForm = lazy(() => import("./pages/recruitment/PublicApplyForm"));
const Members = lazy(() => import("./pages/Members"));

const authenticated = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>;

const companyScoped = (node: ReactNode, moduleKey?: string) => (
  <RequireAuth>
    <RequireCompany>
      {moduleKey ? <RequireModule moduleKey={moduleKey}>{node}</RequireModule> : node}
    </RequireCompany>
  </RequireAuth>
);

export const routers = [
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
        <EmployeeProfile />
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
    path: "/cham-cong/ca-lam-viec",
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
    path: "/quan-tri",
    name: "workspaces",
    element: authenticated(
      <PageSuspense>
        <Workspaces />
      </PageSuspense>,
    ),
  },
  {
    path: "/quan-tri/phan-quyen",
    name: "permission-groups",
    element: authenticated(
      <PageSuspense>
        <PermissionGroups />
      </PageSuspense>,
    ),
  },
  {
    path: "/quan-tri/goi-dich-vu",
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
    path: "/don-tu/quy-trinh-duyet",
    name: "approval-workflow",
    element: companyScoped(
      <PageSuspense>
        <ApprovalWorkflow />
      </PageSuspense>,
      "requests",
    ),
  },
  {
    path: "/don-tu/chinh-sach-phep",
    name: "leave-policies",
    element: companyScoped(
      <PageSuspense>
        <LeavePolicies />
      </PageSuspense>,
      "leave",
    ),
  },
  {
    path: "/don-tu/loai-don",
    name: "request-types",
    element: companyScoped(
      <PageSuspense>
        <RequestTypes />
      </PageSuspense>,
      "requests",
    ),
  },
  {
    path: "/cham-cong/cai-dat",
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
    path: "/thanh-vien",
    name: "members",
    element: companyScoped(
      <PageSuspense>
        <Members />
      </PageSuspense>,
      "members",
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

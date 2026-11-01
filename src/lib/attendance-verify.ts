import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const PHOTO_BUCKET = "attendance-photos";

/* ------------------------------- Types -------------------------------- */

export interface AttendancePolicy {
  company_id: string;
  require_photo: boolean;
  require_gps: boolean;
  gps_mode: "flag" | "reject";
  max_accuracy_m: number;
  require_device: boolean;
  max_devices: number;
  auto_approve_first_device: boolean;
}

export const DEFAULT_POLICY: Omit<AttendancePolicy, "company_id"> = {
  require_photo: true,
  require_gps: true,
  gps_mode: "reject",
  max_accuracy_m: 150,
  require_device: true,
  max_devices: 1,
  auto_approve_first_device: true,
};

export interface AttendanceLocation {
  id: string;
  company_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  active: boolean;
}

export type DeviceStatus = "pending" | "approved" | "revoked" | "rejected";

export interface EmployeeDevice {
  id: string;
  company_id: string;
  employee_id: string;
  device_hash: string;
  device_name: string | null;
  platform: string | null;
  model: string | null;
  browser: string | null;
  status: DeviceStatus;
  approved_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface PunchLog {
  id: string;
  employee_id: string;
  action: string;
  session: string | null;
  reason: string;
  device_id: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  created_at: string;
}

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  revoked: "Đã thu hồi",
  rejected: "Từ chối",
};

export const FLAG_LABELS: Record<string, string> = {
  out_of_zone: "Vào: ngoài vùng",
  out_of_zone_out: "Ra: ngoài vùng",
  unregistered_device: "Vào: thiết bị chưa đăng ký",
  unregistered_device_out: "Ra: thiết bị chưa đăng ký",
  ua_changed: "Vào: trình duyệt khác lúc đăng ký máy",
  ua_changed_out: "Ra: trình duyệt khác lúc đăng ký máy",
};

/* ------------------------------ Thiết bị ------------------------------ */

const DEVICE_KEY = "onhrm.attendance.device-id";

const randomId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

/** Mã thiết bị ngẫu nhiên lưu bền trong trình duyệt; chỉ gửi bản băm SHA-256 lên máy chủ. */
export const getDeviceHash = async () => {
  let raw = localStorage.getItem(DEVICE_KEY);
  if (!raw) {
    raw = randomId();
    localStorage.setItem(DEVICE_KEY, raw);
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`onhrm:${raw}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

export interface DeviceInfo {
  platform: string;
  model: string;
  browser: string;
  userAgent: string;
  suggestedName: string;
}

export const describeDevice = async (): Promise<DeviceInfo> => {
  const ua = navigator.userAgent;
  let platform = "Khác";
  let model = "";
  if (/iPhone/.test(ua)) {
    platform = "iOS";
    model = "iPhone";
  } else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    platform = "iPadOS";
    model = "iPad";
  } else if (/Android/.test(ua)) {
    platform = "Android";
    model = ua.match(/Android [\d.]+; (?:[a-z]{2}-[a-z]{2}; )?([^;)]+?)(?: Build|\))/i)?.[1]?.trim() ?? "";
  } else if (/Windows/.test(ua)) platform = "Windows";
  else if (/Mac OS X/.test(ua)) platform = "macOS";
  else if (/Linux/.test(ua)) platform = "Linux";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaData = (navigator as any).userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const hints = await uaData.getHighEntropyValues(["model", "platformVersion"]);
      if (hints.model) model = hints.model;
      if (hints.platform) platform = `${hints.platform}${hints.platformVersion ? ` ${hints.platformVersion.split(".")[0]}` : ""}`;
    } catch {
      /* bỏ qua */
    }
  }

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /CriOS|Chrome\//.test(ua)
      ? "Chrome"
      : /FxiOS|Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Trình duyệt khác";

  return {
    platform,
    model,
    browser,
    userAgent: ua,
    suggestedName: [model || platform, browser].filter(Boolean).join(" · "),
  };
};

export const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const listMyDevices = async (employeeId: string): Promise<EmployeeDevice[]> => {
  const { data, error } = await db
    .from("employee_devices")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được thiết bị.");
  return (data ?? []) as EmployeeDevice[];
};

export const listCompanyDevices = async (companyId: string): Promise<EmployeeDevice[]> => {
  const { data, error } = await db
    .from("employee_devices")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được thiết bị.");
  return (data ?? []) as EmployeeDevice[];
};

export const registerDevice = async (companyId: string, name: string) => {
  const [hash, info] = await Promise.all([getDeviceHash(), describeDevice()]);
  const { data, error } = await db.rpc("register_attendance_device", {
    p_company_id: companyId,
    p_device_hash: hash,
    p_device_name: name || info.suggestedName,
    p_platform: info.platform,
    p_model: info.model,
    p_browser: info.browser,
    p_user_agent: info.userAgent,
  });
  if (error) throw new Error(error.message ?? "Không đăng ký được thiết bị.");
  return data as EmployeeDevice;
};

export const reviewDevice = async (deviceId: string, action: "approve" | "revoke" | "reject" | "delete") => {
  const { error } = await db.rpc("review_attendance_device", { p_device: deviceId, p_action: action });
  if (error) throw new Error(error.message ?? "Không cập nhật được thiết bị.");
};

/** Nhân viên tự huỷ yêu cầu thiết bị đang chờ duyệt của chính mình. */
export const cancelMyDevice = async (deviceId: string) => {
  const { error } = await db.rpc("cancel_my_attendance_device", { p_device: deviceId });
  if (error) throw new Error(error.message ?? "Không huỷ được yêu cầu.");
};

export const resetEmployeeDevices = async (employeeId: string) => {
  const { error } = await db.rpc("reset_employee_devices", { p_employee: employeeId });
  if (error) throw new Error(error.message ?? "Không đặt lại được thiết bị.");
};

/* ------------------------------ Cấu hình ------------------------------ */

export const getPolicy = async (companyId: string): Promise<AttendancePolicy> => {
  const { data, error } = await db.from("attendance_policies").select("*").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message ?? "Không tải được cấu hình chấm công.");
  return { company_id: companyId, ...DEFAULT_POLICY, ...(data ?? {}) } as AttendancePolicy;
};

export const savePolicy = async (policy: AttendancePolicy) => {
  const { error } = await db
    .from("attendance_policies")
    // Chặn cứng: luôn bắt buộc GPS, đúng vùng và đúng thiết bị.
    .upsert({ ...policy, gps_mode: "reject", require_gps: true, require_device: true, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
  if (error) throw new Error(error.message ?? "Không lưu được cấu hình.");
};

export const listLocations = async (companyId: string): Promise<AttendanceLocation[]> => {
  const { data, error } = await db
    .from("attendance_locations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được địa điểm.");
  return (data ?? []) as AttendanceLocation[];
};

export const saveLocation = async (location: Partial<AttendanceLocation> & { company_id: string }) => {
  const { id, ...values } = location;
  const query = id ? db.from("attendance_locations").update(values).eq("id", id) : db.from("attendance_locations").insert(values);
  const { error } = await query;
  if (error) throw new Error(error.message ?? "Không lưu được địa điểm.");
};

export const deleteLocation = async (id: string) => {
  const { error } = await db.from("attendance_locations").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được địa điểm.");
};

export const listPunchLogs = async (companyId: string, from: string, to: string): Promise<PunchLog[]> => {
  const { data, error } = await db
    .from("attendance_punch_logs")
    .select("*")
    .eq("company_id", companyId)
    .gte("created_at", `${from}T00:00:00+07:00`)
    .lte("created_at", `${to}T23:59:59+07:00`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message ?? "Không tải được nhật ký.");
  return (data ?? []) as PunchLog[];
};

/* ------------------------------ GPS ------------------------------ */

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const getGpsFix = () =>
  new Promise<GpsFix>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Thiết bị không hỗ trợ định vị."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Bạn chưa cho phép truy cập vị trí. Hãy bật quyền Vị trí cho trang này."
              : error.code === error.TIMEOUT
                ? "Lấy vị trí quá lâu, hãy ra chỗ thoáng và thử lại."
                : "Không lấy được vị trí GPS.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });

export const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const rad = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
};

export const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

/* ------------------------------ Ảnh ------------------------------ */

/** Chụp khung hình hiện tại của video, thu nhỏ cạnh dài ~640px, JPEG. */
export const captureFrame = (video: HTMLVideoElement, maxSize = 640, quality = 0.75) =>
  new Promise<Blob>((resolve, reject) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      reject(new Error("Camera chưa sẵn sàng."));
      return;
    }
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Không xử lý được ảnh."));
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không xử lý được ảnh."))), "image/jpeg", quality);
  });

export const uploadAttendancePhoto = async (companyId: string, employeeId: string, blob: Blob) => {
  const path = `${companyId}/${employeeId}/${Date.now()}-${randomId().slice(0, 8)}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message ?? "Không tải được ảnh lên.");
  return path;
};

export const signedPhotoUrl = async (path: string) => {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 600);
  if (error) throw new Error(error.message ?? "Không mở được ảnh.");
  return data.signedUrl;
};

/* ------------------------------ Chấm công ------------------------------ */

export interface PunchInput {
  companyId: string;
  action: "in" | "out";
  session: string;
  gps: GpsFix | null;
  photoPath: string | null;
  /** Mã QR đã quét — chỉ là điều kiện THÊM, server vẫn kiểm đủ thiết bị/GPS/ảnh. */
  qrToken?: string | null;
}

export type PunchResult = { ok: true; record: Record<string, unknown> } | { ok: false; reason: string };

export const punchAttendance = async (input: PunchInput): Promise<PunchResult> => {
  const hash = await getDeviceHash();
  const { data, error } = await db.rpc(input.qrToken ? "attendance_punch_qr" : "attendance_punch", {
    ...(input.qrToken ? { p_qr_token: input.qrToken } : {}),
    p_company_id: input.companyId,
    p_action: input.action,
    p_session: input.session,
    p_device_hash: hash,
    p_latitude: input.gps?.latitude ?? null,
    p_longitude: input.gps?.longitude ?? null,
    p_accuracy: input.gps?.accuracy ?? null,
    p_photo_path: input.photoPath,
  });
  if (error) throw new Error(error.message ?? "Không chấm công được.");
  return data as PunchResult;
};

/* ------------------------------ QR chấm công ------------------------------ */

export const QR_PREFIX = "HRMQR1.";
export const isAttendanceQr = (text: string) => /^HRMQR1\.[0-9a-f-]{36}\.[0-9]{1,12}\.[0-9a-f]{24}$/.test(text.trim());

export const issueAttendanceQr = async (locationId: string) => {
  const { data, error } = await db.rpc("attendance_qr_issue", { p_location_id: locationId });
  if (error) throw new Error(error.message ?? "Không tạo được mã QR.");
  return data as { token: string; expires_at: string; location_name: string };
};

export const rotateAttendanceQr = async (locationId: string) => {
  const { error } = await db.rpc("attendance_qr_rotate", { p_location_id: locationId });
  if (error) throw new Error(error.message ?? "Không đổi được khoá QR.");
};

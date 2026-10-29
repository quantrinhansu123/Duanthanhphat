import { NextResponse } from "next/server";
import {
  catalogGroups,
  defaultPermissions,
  permissionRoles,
  type RolePermissions,
  defaultSystemSettings,
  initialAccounts,
  sharedCatalogs,
  type CatalogItem,
  type InitialAccount,
  type StoredSystemConfiguration,
  type SystemSettings,
} from "@/data/systemConfig";
import { WELD_TYPE_OPTIONS } from "@/data/weldTypes";
import { formatSupabaseError } from "@/lib/supabase/env";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";
import { syncPermissionsToDb } from "@/lib/server/syncPermissions";
import { requireAccess } from "@/lib/server/requireAccess";

const FILE_PATH = "system-configuration.json";
const groupSet = new Set<string>(catalogGroups);

const defaults: StoredSystemConfiguration = {
  catalogs: sharedCatalogs,
  settings: defaultSystemSettings,
  accounts: initialAccounts,
};

const WELD_TYPE_GROUP = "Loại mối hàn";

/** Cấu hình đã lưu từ trước có thể thiếu loại mối hàn mới — bổ sung theo mã và xếp đúng thứ tự chuẩn. */
function withRequiredWeldTypes(catalogs: CatalogItem[]): CatalogItem[] {
  const others = catalogs.filter((item) => item.group !== WELD_TYPE_GROUP);
  const weldTypes = catalogs.filter((item) => item.group === WELD_TYPE_GROUP);
  const existingCodes = new Set(weldTypes.map((item) => item.code.toLocaleUpperCase("vi")));
  const missing = sharedCatalogs.filter(
    (item) => item.group === WELD_TYPE_GROUP && !existingCodes.has(item.code.toLocaleUpperCase("vi")),
  );
  const rank = (item: CatalogItem) => {
    const index = (WELD_TYPE_OPTIONS as readonly string[]).indexOf(item.name);
    return index === -1 ? WELD_TYPE_OPTIONS.length : index;
  };
  return [...others, ...[...weldTypes, ...missing].sort((a, b) => rank(a) - rank(b))];
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validate(body: unknown): StoredSystemConfiguration {
  if (!body || typeof body !== "object") throw new Error("Dữ liệu cấu hình không hợp lệ.");
  const input = body as Partial<StoredSystemConfiguration>;
  if (!Array.isArray(input.catalogs) || !input.settings || !Array.isArray(input.accounts)) {
    throw new Error("Thiếu dữ liệu cấu hình cần lưu.");
  }

  const catalogs = input.catalogs.filter((item) => item?.group !== "Nhà máy").slice(0, 500).map((raw, index) => {
    const item = raw as CatalogItem;
    const code = cleanText(item.code, 80);
    const name = cleanText(item.name, 200);
    if (!code || !name || !groupSet.has(item.group)) {
      throw new Error(`Danh mục dòng ${index + 1} không hợp lệ.`);
    }
    return {
      id: cleanText(item.id, 120) || `catalog-${Date.now()}-${index}`,
      code,
      name,
      group: item.group,
      active: Boolean(item.active),
    };
  });

  const duplicate = catalogs.find((item, index) =>
    catalogs.findIndex((other) =>
      other.group === item.group && other.code.toLocaleLowerCase("vi") === item.code.toLocaleLowerCase("vi"),
    ) !== index,
  );
  if (duplicate) throw new Error(`Mã ${duplicate.code} đang bị trùng trong nhóm ${duplicate.group}.`);

  const settings: SystemSettings = {
    companyName: cleanText(input.settings.companyName, 300),
    systemEmail: cleanText(input.settings.systemEmail, 300),
    certWarningDays: Math.max(1, Math.round(Number(input.settings.certWarningDays) || 1)),
    defaultProductionTarget: Math.max(0, Math.round(Number(input.settings.defaultProductionTarget) || 0)),
    timezone: cleanText(input.settings.timezone, 120),
    sessionTimeoutMinutes: Math.max(30, Math.round(Number(input.settings.sessionTimeoutMinutes) || 30)),
  };

  const accounts = input.accounts.slice(0, 500).map((raw, index) => {
    const account = raw as InitialAccount;
    const username = cleanText(account.username, 120);
    if (!username) throw new Error(`Tài khoản dòng ${index + 1} chưa có tên đăng nhập.`);
    return {
      id: cleanText(account.id, 120) || `account-${Date.now()}-${index}`,
      username,
      fullName: cleanText(account.fullName, 200),
      email: cleanText(account.email, 300),
      role: (permissionRoles as readonly string[]).includes(account.role) ? account.role : "Nhân viên",
      status: account.status === "Khóa" ? "Khóa" : "Hoạt động",
      createdAt: cleanText(account.createdAt, 10),
      note: cleanText(account.note, 1000),
    } satisfies InitialAccount;
  });

  const rawPerms = (input.permissions ?? {}) as Record<string, Record<string, Partial<Record<string, unknown>>> | undefined>;
  const permissions: RolePermissions = {};
  for (const role of permissionRoles) {
    permissions[role] = {};
    for (const tabId of Object.keys(defaultPermissions[role])) {
      const d = defaultPermissions[role][tabId];
      const r = rawPerms[role]?.[tabId];
      permissions[role][tabId] = r
        ? { view: Boolean(r.view), edit: Boolean(r.edit), delete: Boolean(r.delete) }
        : d;
    }
  }

  return { catalogs, settings, accounts, permissions, updatedAt: new Date().toISOString() };
}

export async function GET() {
  const denied = await requireAccess(null);
  if (denied) return denied;
  try {
    const stored = await readPrivateJson<StoredSystemConfiguration>(FILE_PATH);
    const configuration = stored ?? defaults;
    return NextResponse.json({
      ...configuration,
      permissions: configuration.permissions ?? defaultPermissions,
      catalogs: withRequiredWeldTypes(configuration.catalogs.filter((item) => item.group !== "Nhà máy")),
    });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await requireAccess("cau-hinh", "edit");
  if (denied) return denied;
  try {
    const configuration = validate(await request.json());
    await writePrivateJson(FILE_PATH, configuration);
    const syncWarning = await syncPermissionsToDb(configuration);
    return NextResponse.json({ ...configuration, syncWarning });
  } catch (error) {
    const message = error instanceof Error ? error.message : formatSupabaseError(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

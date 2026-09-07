import { NextResponse } from "next/server";
import {
  catalogGroups,
  defaultSystemSettings,
  initialAccounts,
  sharedCatalogs,
  type CatalogItem,
  type InitialAccount,
  type StoredSystemConfiguration,
  type SystemSettings,
} from "@/data/systemConfig";
import { formatSupabaseError } from "@/lib/supabase/env";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";

const FILE_PATH = "system-configuration.json";
const groupSet = new Set<string>(catalogGroups);

const defaults: StoredSystemConfiguration = {
  catalogs: sharedCatalogs,
  settings: defaultSystemSettings,
  accounts: initialAccounts,
};

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validate(body: unknown): StoredSystemConfiguration {
  if (!body || typeof body !== "object") throw new Error("Dữ liệu cấu hình không hợp lệ.");
  const input = body as Partial<StoredSystemConfiguration>;
  if (!Array.isArray(input.catalogs) || !input.settings || !Array.isArray(input.accounts)) {
    throw new Error("Thiếu dữ liệu cấu hình cần lưu.");
  }

  const catalogs = input.catalogs.slice(0, 500).map((raw, index) => {
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
      role: account.role === "Quản trị" ? "Quản trị" : "Nhân viên",
      status: account.status === "Khóa" ? "Khóa" : "Hoạt động",
      createdAt: cleanText(account.createdAt, 10),
      note: cleanText(account.note, 1000),
    } satisfies InitialAccount;
  });

  return { catalogs, settings, accounts, updatedAt: new Date().toISOString() };
}

export async function GET() {
  try {
    const stored = await readPrivateJson<StoredSystemConfiguration>(FILE_PATH);
    return NextResponse.json(stored ?? defaults);
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const configuration = validate(await request.json());
    await writePrivateJson(FILE_PATH, configuration);
    return NextResponse.json(configuration);
  } catch (error) {
    const message = error instanceof Error ? error.message : formatSupabaseError(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

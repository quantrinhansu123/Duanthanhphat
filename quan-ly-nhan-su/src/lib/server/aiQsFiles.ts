import "server-only";

import { access, readdir, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { knowledgeRootDir } from "./knowledgeFiles";

export type AiQsDocKind =
  | "Hợp đồng"
  | "HSTT / IPC"
  | "Phụ lục"
  | "Tạm ứng"
  | "Bản vẽ"
  | "Quyết toán"
  | "Bảng theo dõi"
  | "Khác";

export type AiQsNode = {
  id: string;
  name: string;
  kind: "folder" | "file";
  path: string;
  relative: string;
  depth: number;
  children?: AiQsNode[];
  size?: number;
  modifiedAt?: string;
  ext?: string;
  docKind?: AiQsDocKind;
  side?: "A" | "B" | null;
  files?: number;
  folders?: number;
};

function underRoot(root: string, full: string) {
  const rel = relative(root, full);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function classifyAiQsDoc(name: string): AiQsDocKind {
  const n = name.normalize("NFC");
  if (/^~\$/.test(n)) return "Khác";
  if (/\.(xlsx|xls|csv)$/i.test(n) && /theo\s*dõi|theo doi/i.test(n)) return "Bảng theo dõi";
  if (/bản\s*vẽ|ban\s*ve|thiet\s*ke|thiết\s*kế/i.test(n)) return "Bản vẽ";
  if (/tạm\s*ứng|tam\s*ung|đề\s*nghị\s*tạm|de\s*nghi\s*tu/i.test(n)) return "Tạm ứng";
  if (/quyết\s*toán|quyet\s*toan/i.test(n)) return "Quyết toán";
  if (/\bPL\b|PLHĐ|phụ\s*lục|phu\s*luc|^PL[-_\s0-9]/i.test(n)) return "Phụ lục";
  if (/\bIPC\b|HSTT|hồ\s*sơ\s*thanh\s*toán|ho\s*so\s*thanh\s*toan|thanh\s*lý|thanh\s*ly/i.test(n)) return "HSTT / IPC";
  if (/hợp\s*đồng|hop\s*dong|\bHĐ\b|\bHD\b|HĐT|HĐKT|HĐTC|HĐ-|\bHĐ\s/i.test(n)) return "Hợp đồng";
  if (/\.(xlsx|xls)$/i.test(n)) return "Bảng theo dõi";
  return "Khác";
}

function detectSide(segments: string[]): "A" | "B" | null {
  const top = segments[0] || "";
  if (/bên\s*A|ben\s*A/i.test(top)) return "A";
  if (/bên\s*B|ben\s*B/i.test(top)) return "B";
  return null;
}

async function exists(path: string) {
  try { await access(path); return true; } catch { return false; }
}

/** Ưu tiên CHAT_CONTRACT_DIR; nếu thiếu thì tìm bản trong thư mục Tri thức. */
export async function resolveAiQsRoot(): Promise<{ root: string; knowledgeRelative: string; knowledgeRoot: string }> {
  const knowledgeRoot = knowledgeRootDir();
  const configured = process.env.CHAT_CONTRACT_DIR?.trim();
  if (configured && await exists(configured)) {
    const full = resolve(configured);
    const rel = underRoot(knowledgeRoot, full) ? relative(knowledgeRoot, full).split(sep).join("/") : "";
    return { root: full, knowledgeRelative: rel, knowledgeRoot };
  }

  // Bản đã nạp vào Tri thức (zip giải nén)
  const entries = await readdir(knowledgeRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!/AI_QS|Hồ sơ phục vụ AI/i.test(entry.name)) continue;
    const nested = join(knowledgeRoot, entry.name, "20. Hồ sơ phục vụ AI_QS");
    if (await exists(nested)) {
      return {
        root: nested,
        knowledgeRelative: relative(knowledgeRoot, nested).split(sep).join("/"),
        knowledgeRoot,
      };
    }
    const direct = join(knowledgeRoot, entry.name);
    return {
      root: direct,
      knowledgeRelative: relative(knowledgeRoot, direct).split(sep).join("/"),
      knowledgeRoot,
    };
  }

  const fallback = join(knowledgeRoot, "20. Hồ sơ phục vụ AI_QS");
  if (await exists(fallback)) {
    return {
      root: fallback,
      knowledgeRelative: "20. Hồ sơ phục vụ AI_QS",
      knowledgeRoot,
    };
  }

  throw new Error("Không tìm thấy thư mục «20. Hồ sơ phục vụ AI_QS». Đặt CHAT_CONTRACT_DIR hoặc đưa bản sao vào Tri thức.");
}

async function walk(dir: string, root: string, depth: number): Promise<AiQsNode[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nodes: AiQsNode[] = [];

  const sorted = [...entries].sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, "vi", { numeric: true, sensitivity: "base" });
  });

  for (const entry of sorted) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("~$")) continue;
    const full = join(dir, entry.name);
    const rel = relative(root, full).split(sep).join("/");
    const segments = rel.split("/").filter(Boolean);
    const side = detectSide(segments);

    if (entry.isDirectory()) {
      const children = await walk(full, root, depth + 1);
      const files = children.reduce((n, c) => n + (c.kind === "file" ? 1 : (c.files ?? 0)), 0);
      const folders = children.reduce((n, c) => n + (c.kind === "folder" ? 1 + (c.folders ?? 0) : 0), 0);
      nodes.push({
        id: rel || entry.name,
        name: entry.name,
        kind: "folder",
        path: full,
        relative: rel,
        depth,
        children,
        side,
        files,
        folders,
      });
    } else if (entry.isFile()) {
      const info = await stat(full);
      nodes.push({
        id: rel,
        name: entry.name,
        kind: "file",
        path: full,
        relative: rel,
        depth,
        size: info.size,
        modifiedAt: info.mtime.toISOString(),
        ext: extname(entry.name).replace(/^\./, "").toLowerCase(),
        docKind: classifyAiQsDoc(entry.name),
        side,
      });
    }
  }
  return nodes;
}

export async function listAiQsTree() {
  const { root, knowledgeRelative, knowledgeRoot } = await resolveAiQsRoot();
  const tree = await walk(root, root, 0);
  const totalFiles = tree.reduce((n, c) => n + (c.kind === "file" ? 1 : (c.files ?? 0)), 0);
  const totalFolders = tree.reduce((n, c) => n + (c.kind === "folder" ? 1 + (c.folders ?? 0) : 0), 0);
  const byKind: Record<string, number> = {};
  const countKinds = (nodes: AiQsNode[]) => {
    for (const node of nodes) {
      if (node.kind === "file" && node.docKind) byKind[node.docKind] = (byKind[node.docKind] ?? 0) + 1;
      if (node.children) countKinds(node.children);
    }
  };
  countKinds(tree);
  return {
    root,
    rootName: basename(root),
    knowledgeRoot,
    knowledgeRelative,
    totalFiles,
    totalFolders,
    byKind,
    tree,
  };
}

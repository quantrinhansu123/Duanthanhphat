import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { google } from "googleapis";

const HOST = "127.0.0.1";
const PORT = 53682;
const CALLBACK_PATH = "/oauth2callback";
const REDIRECT_URI = `http://${HOST}:${PORT}${CALLBACK_PATH}`;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const ENV_PATH = path.resolve(process.cwd(), ".env.local");

const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

if (!clientId || !clientSecret || !folderId) {
  console.error(
    "Thiếu GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET hoặc GOOGLE_DRIVE_FOLDER_ID trong .env.local.",
  );
  process.exit(1);
}

if (!fs.existsSync(ENV_PATH)) {
  console.error("Không tìm thấy .env.local trong thư mục ứng dụng.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
const state = crypto.randomBytes(32).toString("hex");
const authorizationUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  include_granted_scopes: true,
  scope: [DRIVE_SCOPE],
  state,
});

function upsertEnvValue(key, value) {
  const current = fs.readFileSync(ENV_PATH, "utf8");
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(current)
    ? current.replace(pattern, line)
    : `${current}${current.endsWith("\n") ? "" : "\n"}${line}\n`;
  fs.writeFileSync(ENV_PATH, next, { encoding: "utf8", mode: 0o600 });
}

let timeout;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", REDIRECT_URI);
    if (url.pathname !== CALLBACK_PATH) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    if (url.searchParams.get("state") !== state) {
      throw new Error("OAuth state không hợp lệ; yêu cầu đã bị từ chối.");
    }

    const oauthError = url.searchParams.get("error");
    if (oauthError) throw new Error(`Google OAuth từ chối: ${oauthError}`);

    const code = url.searchParams.get("code");
    if (!code) throw new Error("Google OAuth không trả về authorization code.");

    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error(
        "Google không trả về refresh token. Hãy thu hồi quyền ứng dụng trong tài khoản Google rồi chạy lại.",
      );
    }

    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const folder = await drive.files.get({
      fileId: folderId,
      fields: "id,mimeType,trashed,capabilities(canAddChildren)",
      supportsAllDrives: true,
    });

    if (folder.data.trashed || folder.data.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error("GOOGLE_DRIVE_FOLDER_ID không trỏ tới một thư mục Google Drive hợp lệ.");
    }
    if (!folder.data.capabilities?.canAddChildren) {
      throw new Error("Tài khoản vừa đăng nhập không có quyền thêm file vào thư mục đã cấu hình.");
    }

    upsertEnvValue("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", tokens.refresh_token);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h2>Đã kết nối Google Drive thành công.</h2><p>Bạn có thể đóng tab này.</p>");
    console.log("AUTHENTICATED=true");
    console.log("FOLDER_ACCESSIBLE=true");
    console.log("Refresh token đã được lưu vào .env.local; token không được in ra màn hình.");
    clearTimeout(timeout);
    server.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Kết nối thất bại: ${message}`);
    console.error(`Kết nối thất bại: ${message}`);
    clearTimeout(timeout);
    server.close(() => {
      process.exitCode = 1;
    });
  }
});

server.on("error", (error) => {
  console.error(`Không thể mở máy chủ OAuth tại ${REDIRECT_URI}: ${error.message}`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log("Mở đường dẫn sau trong trình duyệt và đăng nhập tài khoản Google sở hữu thư mục:");
  console.log(authorizationUrl);
  console.log(`Callback URI dùng cho OAuth Desktop app: ${REDIRECT_URI}`);
});

timeout = setTimeout(() => {
  console.error("Hết thời gian chờ đăng nhập OAuth (5 phút). Hãy chạy lại lệnh.");
  server.close(() => {
    process.exitCode = 1;
  });
}, 5 * 60 * 1000);

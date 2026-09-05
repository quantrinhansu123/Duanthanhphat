import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

const ALLOWED_FOLDERS = new Set(["thanhphat/certificates", "thanhphat/trainings"]);

export async function POST(req: NextRequest) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error:
          "Cloudinary chưa được cấu hình (cần CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trên server).",
      },
      { status: 503 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const folder = typeof body.folder === "string" ? body.folder.trim() : "";
    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: "Thư mục Cloudinary không được phép." }, { status: 400 });
    }
    const timestamp = Math.round(new Date().getTime() / 1000);

    const paramsToSign = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi ký upload Cloudinary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

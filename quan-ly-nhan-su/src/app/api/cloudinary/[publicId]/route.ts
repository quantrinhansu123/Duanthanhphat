import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

type RouteParams = {
  params: Promise<{ publicId: string }>;
};

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Cloudinary chưa cấu hình" }, { status: 503 });
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  try {
    const { publicId } = await params;
    const decodedId = decodeURIComponent(publicId);
    if (!/^thanhphat\/(certificates|trainings)\/[A-Za-z0-9_-]+$/.test(decodedId)) {
      return NextResponse.json({ error: "Cloudinary public ID không hợp lệ." }, { status: 400 });
    }
    const result = await cloudinary.uploader.destroy(decodedId);
    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi xóa asset Cloudinary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

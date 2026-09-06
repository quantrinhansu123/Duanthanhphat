import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

type RouteParams = {
  params: Promise<{ publicId: string }>;
};

export async function DELETE(req: NextRequest, { params }: RouteParams) {
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
    if (!/^thanhphat\/(certificates|trainings|machines|vehicles)\/[A-Za-z0-9_.-]+$/.test(decodedId)) {
      return NextResponse.json({ error: "Cloudinary public ID không hợp lệ." }, { status: 400 });
    }
    const requestedType = req.nextUrl.searchParams.get("resourceType");
    const resourceType = requestedType === "video" || requestedType === "raw" ? requestedType : "image";
    const result = await cloudinary.uploader.destroy(decodedId, { resource_type: resourceType });
    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi xóa asset Cloudinary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

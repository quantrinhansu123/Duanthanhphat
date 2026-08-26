import { redirect } from "next/navigation";

/** http://localhost:3010/ → chuyển tới Hồ sơ nhân sự */
export default function Home() {
  redirect("/ho-so-nhan-su");
}

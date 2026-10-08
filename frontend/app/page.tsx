import { redirect } from "next/navigation";

// Home page par koi content nahi hai - seedha login par bhej do.
// (Login ke baad user ko dashboard par bheja jaata hai.)
export default function Home() {
  redirect("/login");
}

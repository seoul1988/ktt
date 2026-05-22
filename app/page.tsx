import { supabase } from "../lib/supabase";
import dynamic from "next/dynamic";

const BusinessMap = dynamic(
  () => import("./components/BusinessMap"),
  {
    ssr: false,
  }
);

export default async function Home() {
  const { data: spots } = await supabase
    .from("businesses")
    .select("*")
    .order("id", { ascending: true });

  return (
    <main className="min-h-screen">
      <BusinessMap spots={spots || []} />
    </main>
  );
}
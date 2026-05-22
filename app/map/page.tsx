import { supabase } from "../../lib/supabase";
import MapWrapper from "../components/MapWrapper";

export default async function MapPage() {
  const { data: spots } = await supabase
    .from("businesses")
    .select("*")
    .order("id", { ascending: true });

  return (
    <main className="min-h-screen">
      <MapWrapper spots={spots || []} />
    </main>
  );
}
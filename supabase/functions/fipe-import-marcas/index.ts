import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIPE_BASE = "https://fipe.parallelum.com.br/api/v2";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FipeBrand {
  code: string;
  name: string;
}
interface FipeModel {
  code: string;
  name: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FIPE API ${res.status}: ${url}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tipos: string[] = body.tipos ?? ["cars"];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let totalInserted = 0;
    const errors: string[] = [];

    for (const tipo of tipos) {
      console.log(`Fetching brands for ${tipo}...`);
      let brands: FipeBrand[];
      try {
        brands = await fetchJson<FipeBrand[]>(`${FIPE_BASE}/${tipo}/brands`);
      } catch (e) {
        errors.push(`${tipo}/brands: ${e.message}`);
        continue;
      }

      const rows: { marca: string; modelo: string }[] = [];

      for (const brand of brands) {
        await delay(300);
        try {
          const models = await fetchJson<FipeModel[]>(
            `${FIPE_BASE}/${tipo}/brands/${brand.code}/models`
          );
          for (const model of models) {
            rows.push({
              marca: brand.name.toUpperCase(),
              modelo: model.name.toUpperCase(),
            });
          }
        } catch (e) {
          errors.push(`${tipo}/${brand.name}: ${e.message}`);
        }
      }

      if (rows.length > 0) {
        // Insert in batches of 500
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await supabase
            .from("marcas_modelos")
            .upsert(batch, { onConflict: "marca,modelo", ignoreDuplicates: true });
          if (error) {
            errors.push(`insert batch ${tipo}: ${error.message}`);
          } else {
            totalInserted += batch.length;
          }
        }
      }

      console.log(`${tipo}: ${rows.length} rows processed`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalInserted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

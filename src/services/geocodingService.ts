import { supabase } from "@/integrations/supabase/client";

interface EnderecoParaGeocodificar {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  success: boolean;
}

/**
 * Geocodifica um endereço chamando a edge function
 * Retorna as coordenadas latitude e longitude
 * Executa em background - não bloqueia a UI
 */
export async function geocodificarEndereco(
  endereco: EnderecoParaGeocodificar
): Promise<GeocodeResult> {
  try {
    // Verificar se temos dados mínimos para geocodificar
    if (!endereco.logradouro && !endereco.cep && !endereco.cidade) {
      console.log("[Geocode] Dados insuficientes para geocodificação");
      return { latitude: null, longitude: null, success: false };
    }

    const { data, error } = await supabase.functions.invoke("geocode-endereco", {
      body: {
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        cep: endereco.cep,
      },
    });

    if (error) {
      console.error("[Geocode] Erro na edge function:", error);
      return { latitude: null, longitude: null, success: false };
    }

    if (data?.success) {
      console.log("[Geocode] Coordenadas obtidas:", data.latitude, data.longitude);
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        success: true,
      };
    }

    return { latitude: null, longitude: null, success: false };
  } catch (error) {
    console.error("[Geocode] Erro ao geocodificar:", error);
    return { latitude: null, longitude: null, success: false };
  }
}

/**
 * Atualiza as coordenadas de uma vistoria (em background)
 */
export async function atualizarCoordenadasVistoria(
  vistoriaId: string,
  endereco: EnderecoParaGeocodificar
): Promise<boolean> {
  const coords = await geocodificarEndereco(endereco);
  
  if (!coords.success) {
    return false;
  }

  const { error } = await supabase
    .from("vistorias")
    .update({
      endereco_latitude: coords.latitude,
      endereco_longitude: coords.longitude,
    })
    .eq("id", vistoriaId);

  if (error) {
    console.error("[Geocode] Erro ao atualizar vistoria:", error);
    return false;
  }

  return true;
}

/**
 * Atualiza as coordenadas de uma cotação (vistoria agendada) - em background
 */
export async function atualizarCoordenadasCotacao(
  cotacaoId: string,
  endereco: EnderecoParaGeocodificar
): Promise<boolean> {
  const coords = await geocodificarEndereco(endereco);
  
  if (!coords.success) {
    return false;
  }

  const { error } = await supabase
    .from("cotacoes")
    .update({
      vistoria_endereco_latitude: coords.latitude,
      vistoria_endereco_longitude: coords.longitude,
    })
    .eq("id", cotacaoId);

  if (error) {
    console.error("[Geocode] Erro ao atualizar cotação:", error);
    return false;
  }

  return true;
}

/**
 * Geocodifica e retorna as coordenadas sem salvar (para uso em formulários)
 * Usado quando precisamos das coordenadas antes de salvar o registro
 */
export async function obterCoordenadasEndereco(
  endereco: EnderecoParaGeocodificar
): Promise<{ latitude: number | null; longitude: number | null }> {
  const result = await geocodificarEndereco(endereco);
  return {
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

/**
 * Dispara geocodificação em background (fire and forget)
 * Não espera resultado - ideal para usar após salvar registros
 */
export function geocodificarEmBackground(
  tipo: "vistoria" | "cotacao",
  id: string,
  endereco: EnderecoParaGeocodificar
): void {
  // Executar em background sem bloquear
  setTimeout(async () => {
    try {
      if (tipo === "vistoria") {
        await atualizarCoordenadasVistoria(id, endereco);
      } else if (tipo === "cotacao") {
        await atualizarCoordenadasCotacao(id, endereco);
      }
    } catch (error) {
      console.error("[Geocode Background] Erro:", error);
    }
  }, 100);
}

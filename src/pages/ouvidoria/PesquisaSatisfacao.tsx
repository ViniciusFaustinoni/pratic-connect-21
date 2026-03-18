import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, ThumbsUp, ThumbsDown, CheckCircle, Meh } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PesquisaSatisfacao() {
  const { protocolo } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manifestacao, setManifestacao] = useState<{ id: string; assunto: string; protocolo: string } | null>(null);
  const [jaAvaliado, setJaAvaliado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  
  const [nps, setNps] = useState<number | null>(null);
  const [estrelas, setEstrelas] = useState<number>(0);
  const [resolvido, setResolvido] = useState<"sim" | "parcial" | "nao" | null>(null);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    const fetchManifestacao = async () => {
      if (!protocolo) return;

      try {
        const { data, error } = await supabase
          .from("ouvidoria_manifestacoes")
          .select("id, assunto, protocolo, avaliacao_nota")
          .eq("protocolo", protocolo.toUpperCase())
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          toast.error("Protocolo não encontrado");
          return;
        }

        if (data.avaliacao_nota !== null) {
          setJaAvaliado(true);
        }

        setManifestacao(data);
      } catch (error) {
        console.error("Erro ao buscar manifestação:", error);
        toast.error("Erro ao carregar pesquisa");
      } finally {
        setIsLoading(false);
      }
    };

    fetchManifestacao();
  }, [protocolo]);

  const handleSubmit = async () => {
    if (nps === null) {
      toast.error("Por favor, selecione uma nota de 0 a 10");
      return;
    }

    if (!manifestacao) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("ouvidoria_manifestacoes")
        .update({
          avaliacao_nota: nps,
          avaliacao_comentario: JSON.stringify({
            nps,
            estrelas,
            resolvido,
            comentario,
          }),
        })
        .eq("id", manifestacao.id);

      if (error) throw error;

      setEnviado(true);
      toast.success("Avaliação enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar avaliação:", error);
      toast.error("Erro ao enviar avaliação");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!manifestacao) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Manifestação não encontrada.</p>
            <Button 
              variant="link" 
              onClick={() => navigate("/ouvidoria/consulta-protocolo")}
            >
              Voltar para consulta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (jaAvaliado || enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-800">
              {enviado ? "Obrigado pela sua avaliação!" : "Pesquisa já respondida"}
            </CardTitle>
            <CardDescription>
              {enviado 
                ? "Sua opinião é muito importante para melhorarmos nossos serviços."
                : "Esta manifestação já foi avaliada anteriormente."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/")}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Pesquisa de Satisfação</CardTitle>
            <CardDescription>
              Avalie o atendimento da sua manifestação
            </CardDescription>
            <div className="bg-gray-50 p-3 rounded-lg mt-4">
              <p className="text-sm text-muted-foreground">Protocolo</p>
              <p className="font-mono font-bold">{manifestacao.protocolo}</p>
              <p className="text-sm text-muted-foreground mt-1">{manifestacao.assunto}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* NPS */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                Em uma escala de 0 a 10, o quanto você recomendaria nossa ouvidoria?
              </Label>
              <div className="flex justify-between gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNps(n)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-sm font-medium transition-all",
                      nps === n
                        ? n <= 6
                          ? "bg-red-500 text-white"
                          : n <= 8
                          ? "bg-yellow-500 text-white"
                          : "bg-green-500 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Não recomendaria</span>
                <span>Recomendaria muito</span>
              </div>
            </div>

            {/* Estrelas */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                Como você avalia a qualidade do atendimento?
              </Label>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setEstrelas(n)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star 
                      className={cn(
                        "h-10 w-10 transition-colors",
                        n <= estrelas
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Resolvido? */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                Seu problema foi resolvido?
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => setResolvido("sim")}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                    resolvido === "sim"
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <ThumbsUp className={cn(
                    "h-8 w-8",
                    resolvido === "sim" ? "text-green-600" : "text-gray-400"
                  )} />
                  <span className="text-sm font-medium">Sim</span>
                </button>
                <button
                  onClick={() => setResolvido("parcial")}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                    resolvido === "parcial"
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Meh className={cn(
                    "h-8 w-8",
                    resolvido === "parcial" ? "text-yellow-600" : "text-gray-400"
                  )} />
                  <span className="text-sm font-medium">Parcialmente</span>
                </button>
                <button
                  onClick={() => setResolvido("nao")}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                    resolvido === "nao"
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <ThumbsDown className={cn(
                    "h-8 w-8",
                    resolvido === "nao" ? "text-red-600" : "text-gray-400"
                  )} />
                  <span className="text-sm font-medium">Não</span>
                </button>
              </div>
            </div>

            {/* Comentário */}
            <div className="space-y-2">
              <Label htmlFor="comentario">Comentários adicionais (opcional)</Label>
              <Textarea
                id="comentario"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Deixe sua sugestão, elogio ou crítica..."
                rows={4}
              />
            </div>

            <Button 
              onClick={handleSubmit} 
              className="w-full"
              disabled={isSubmitting || nps === null}
            >
              {isSubmitting ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

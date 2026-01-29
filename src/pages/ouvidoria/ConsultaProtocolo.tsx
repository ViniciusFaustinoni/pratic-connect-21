import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, FileText, Clock, MessageSquare, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ouvidoria/StatusBadge";
import { TipoBadge } from "@/components/ouvidoria/TipoBadge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ManifestacaoWithRelations, Interacao, StatusManifestacao, TipoManifestacao } from "@/types/ouvidoria";

export default function ConsultaProtocolo() {
  const navigate = useNavigate();
  const [protocolo, setProtocolo] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [manifestacao, setManifestacao] = useState<ManifestacaoWithRelations | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!protocolo.trim()) {
      toast.error("Digite o número do protocolo");
      return;
    }

    setIsSearching(true);
    setManifestacao(null);

    try {
      // Buscar manifestação
      const { data: manifestacaoData, error: manifestacaoError } = await supabase
        .from("ouvidoria_manifestacoes")
        .select("*")
        .eq("protocolo", protocolo.trim().toUpperCase())
        .maybeSingle();

      if (manifestacaoError) throw manifestacaoError;

      if (!manifestacaoData) {
        toast.error("Protocolo não encontrado");
        return;
      }

      // Buscar interações visíveis para o associado
      const { data: interacoesData, error: interacoesError } = await supabase
        .from("ouvidoria_interacoes")
        .select("*")
        .eq("manifestacao_id", manifestacaoData.id)
        .eq("visivel_associado", true)
        .order("created_at", { ascending: true });

      if (interacoesError) throw interacoesError;

      setManifestacao(manifestacaoData as ManifestacaoWithRelations);
      setInteracoes(interacoesData as Interacao[]);
    } catch (error) {
      console.error("Erro ao buscar protocolo:", error);
      toast.error("Erro ao buscar. Tente novamente.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendMessage = async () => {
    if (!novaMensagem.trim() || !manifestacao) return;

    setIsSending(true);

    try {
      const { error } = await supabase
        .from("ouvidoria_interacoes")
        .insert({
          manifestacao_id: manifestacao.id,
          tipo: "mensagem_associado",
          mensagem: novaMensagem,
          visivel_associado: true,
        });

      if (error) throw error;

      // Atualizar lista de interações
      const { data: novasInteracoes } = await supabase
        .from("ouvidoria_interacoes")
        .select("*")
        .eq("manifestacao_id", manifestacao.id)
        .eq("visivel_associado", true)
        .order("created_at", { ascending: true });

      setInteracoes(novasInteracoes as Interacao[] || []);
      setNovaMensagem("");
      toast.success("Mensagem enviada!");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-blue-900 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Search className="h-10 w-10" />
            <h1 className="text-3xl font-bold">Consulta de Protocolo</h1>
          </div>
          <p className="text-blue-200 max-w-xl mx-auto">
            Acompanhe o andamento da sua manifestação inserindo o número do protocolo
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Formulário de busca */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Digite seu protocolo</CardTitle>
            <CardDescription>
              O protocolo foi informado no momento do registro da manifestação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1">
                <Input
                  value={protocolo}
                  onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
                  placeholder="Ex: OUV-2024-00001"
                  className="font-mono text-lg"
                />
              </div>
              <Button type="submit" disabled={isSearching}>
                {isSearching ? "Buscando..." : "Consultar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultado */}
        {manifestacao && (
          <div className="space-y-6">
            {/* Card resumo */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="font-mono">{manifestacao.protocolo}</CardTitle>
                    <CardDescription>{manifestacao.assunto}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <TipoBadge tipo={manifestacao.tipo as TipoManifestacao} />
                    <StatusBadge status={manifestacao.status as StatusManifestacao} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Aberto em: {format(new Date(manifestacao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                  {manifestacao.data_encerramento && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Encerrado em: {format(new Date(manifestacao.data_encerramento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Descrição original:</Label>
                  <p className="mt-1 whitespace-pre-wrap">{manifestacao.descricao}</p>
                </div>
              </CardContent>
            </Card>

            {/* Timeline de interações */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Histórico de Interações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {interacoes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atualização ainda. Sua manifestação está sendo analisada.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {interacoes.map((interacao) => (
                      <div 
                        key={interacao.id} 
                        className={`p-4 rounded-lg ${
                          interacao.tipo === "mensagem_associado" 
                            ? "bg-blue-50 ml-8" 
                            : "bg-gray-50 mr-8"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {interacao.tipo === "mensagem_associado" ? "Você" : "Ouvidoria"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(interacao.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{interacao.mensagem}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Enviar nova mensagem */}
                {manifestacao.status !== "encerrado" && (
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium mb-2 block">
                      Adicionar informação
                    </Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={novaMensagem}
                        onChange={(e) => setNovaMensagem(e.target.value)}
                        placeholder="Digite uma mensagem ou informação adicional..."
                        rows={3}
                      />
                    </div>
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!novaMensagem.trim() || isSending}
                      className="mt-2 gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {isSending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              variant="outline" 
              onClick={() => setManifestacao(null)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Nova Consulta
            </Button>
          </div>
        )}

        {/* Link para canal de denúncia */}
        <div className="text-center mt-8">
          <p className="text-muted-foreground text-sm">
            Deseja registrar uma nova manifestação?{" "}
            <Button 
              variant="link" 
              className="p-0 h-auto text-blue-700"
              onClick={() => navigate("/ouvidoria/canal-denuncia")}
            >
              Canal de Denúncia
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}

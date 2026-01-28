import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useManifestacao,
  useAssumirManifestacao,
  useUpdateStatusManifestacao,
  useResponderManifestacao,
  useEncaminharJuridico,
  useEncaminharSetorRH,
} from "@/hooks/useOuvidoria";
import { useInteracoes, useIALogs } from "@/hooks/useOuvidoriaInteracoes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ouvidoria/StatusBadge";
import { PrioridadeBadge } from "@/components/ouvidoria/PrioridadeBadge";
import { TipoBadge } from "@/components/ouvidoria/TipoBadge";
import { InteracaoTimeline } from "@/components/ouvidoria/InteracaoTimeline";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  Send,
  Gavel,
  Bot,
  MessageSquare,
  StickyNote,
  CheckCircle,
  Trophy,
  Send as SendIcon,
} from "lucide-react";
import { CATEGORIA_LABELS, CANAL_LABELS, STATUS_LABELS, type StatusManifestacao } from "@/types/ouvidoria";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setoresElogio } from "@/constants/ouvidoria";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function ManifestacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: manifestacao, isLoading } = useManifestacao(id);
  const { data: interacoes, isLoading: isLoadingInteracoes } = useInteracoes(id);
  const { data: iaLogs } = useIALogs(id);

  const assumir = useAssumirManifestacao();
  const updateStatus = useUpdateStatusManifestacao();
  const responder = useResponderManifestacao();
  const encaminharJuridico = useEncaminharJuridico();
  const encaminharSetorRH = useEncaminharSetorRH();

  const [resposta, setResposta] = useState("");
  const [visivelAssociado, setVisivelAssociado] = useState(true);
  const [tipoResposta, setTipoResposta] = useState<"resposta_interna" | "nota_interna">(
    "resposta_interna"
  );
  const [novoStatus, setNovoStatus] = useState<StatusManifestacao | "">("");
  const [observacaoStatus, setObservacaoStatus] = useState("");
  const [dialogEncaminharOpen, setDialogEncaminharOpen] = useState(false);
  const [observacaoJuridico, setObservacaoJuridico] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!manifestacao) {
    return (
      <div className="text-center py-16">
        <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-semibold">Manifestação não encontrada</h2>
        <Button variant="link" onClick={() => navigate("/ouvidoria/manifestacoes")}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  const handleResponder = async () => {
    if (!resposta.trim() || !id) return;

    await responder.mutateAsync({
      id,
      mensagem: resposta,
      visivel_associado: visivelAssociado,
      tipo: tipoResposta,
    });

    setResposta("");
  };

  const handleUpdateStatus = async () => {
    if (!novoStatus || !id) return;

    await updateStatus.mutateAsync({
      id,
      status: novoStatus,
      observacao: observacaoStatus,
    });

    setNovoStatus("");
    setObservacaoStatus("");
  };

  const handleEncaminharJuridico = async () => {
    if (!id) return;

    await encaminharJuridico.mutateAsync({
      manifestacao_id: id,
      observacao: observacaoJuridico,
    });

    setDialogEncaminharOpen(false);
    setObservacaoJuridico("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ouvidoria/manifestacoes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight font-mono">
              {manifestacao.protocolo}
            </h1>
            <TipoBadge tipo={manifestacao.tipo} />
            <StatusBadge status={manifestacao.status} />
            <PrioridadeBadge prioridade={manifestacao.prioridade} />
          </div>
          <p className="text-muted-foreground">{manifestacao.assunto}</p>
        </div>

        {!manifestacao.responsavel_id && (
          <Button onClick={() => assumir.mutate(manifestacao.id)} disabled={assumir.isPending}>
            Assumir
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Coluna Principal */}
        <div className="md:col-span-2 space-y-6">
          {/* Descrição */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{manifestacao.descricao}</p>
            </CardContent>
          </Card>

          {/* Timeline de Interações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Interações</CardTitle>
              <CardDescription>
                {interacoes?.length || 0} interações registradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InteracaoTimeline interacoes={interacoes || []} isLoading={isLoadingInteracoes} />
            </CardContent>
          </Card>

          {/* Formulário de Resposta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Responder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={tipoResposta}
                onValueChange={(v) => setTipoResposta(v as "resposta_interna" | "nota_interna")}
              >
                <TabsList>
                  <TabsTrigger value="resposta_interna" className="gap-2">
                    <Send className="h-4 w-4" />
                    Resposta
                  </TabsTrigger>
                  <TabsTrigger value="nota_interna" className="gap-2">
                    <StickyNote className="h-4 w-4" />
                    Nota Interna
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Textarea
                placeholder={
                  tipoResposta === "resposta_interna"
                    ? "Digite sua resposta para o associado..."
                    : "Digite uma nota interna (não visível ao associado)..."
                }
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={4}
              />

              {tipoResposta === "resposta_interna" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="visivel"
                    checked={visivelAssociado}
                    onCheckedChange={setVisivelAssociado}
                  />
                  <Label htmlFor="visivel">Visível para o associado</Label>
                </div>
              )}

              <Button
                onClick={handleResponder}
                disabled={!resposta.trim() || responder.isPending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {responder.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Lateral */}
        <div className="space-y-6">
          {/* Dados do Associado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Associado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {manifestacao.anonimo ? (
                <p className="text-muted-foreground italic">Manifestação anônima</p>
              ) : manifestacao.associado ? (
                <>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{manifestacao.associado.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{manifestacao.associado.telefone}</span>
                  </div>
                  {manifestacao.associado.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{manifestacao.associado.email}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground italic">Não identificado</p>
              )}
            </CardContent>
          </Card>

          {/* Informações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Canal</span>
                <span>{CANAL_LABELS[manifestacao.canal]}</span>
              </div>
              {manifestacao.categoria && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categoria</span>
                  <span>{CATEGORIA_LABELS[manifestacao.categoria]}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>
                  {format(new Date(manifestacao.created_at), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              {manifestacao.data_contato && manifestacao.data_contato !== manifestacao.created_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data do Contato</span>
                  <span>
                    {format(new Date(manifestacao.data_contato), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              )}
              {manifestacao.data_primeira_resposta && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">1ª Resposta</span>
                  <span>
                    {format(new Date(manifestacao.data_primeira_resposta), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              )}
              {manifestacao.responsavel && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Responsável</span>
                  <span>{manifestacao.responsavel.nome}</span>
                </div>
              )}
              {manifestacao.registrado_por_nome && (
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-muted-foreground">Registrado por</span>
                  <span className="font-medium">{manifestacao.registrado_por_nome}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Detalhes do Elogio - só aparece para tipo elogio */}
          {manifestacao.tipo === 'elogio' && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-800">
                  <Trophy className="h-5 w-5 text-green-600" />
                  Detalhes do Elogio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {manifestacao.setor_elogio && (
                  <div className="flex justify-between items-center">
                    <span className="text-green-700">Setor Elogiado</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-green-800">
                        {setoresElogio.find(s => s.value === manifestacao.setor_elogio)?.label || manifestacao.setor_elogio}
                      </span>
                    </div>
                  </div>
                )}
                
                {manifestacao.colaborador_elogiado && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Colaborador Mencionado</span>
                    <span className="font-medium text-green-800">
                      {manifestacao.colaborador_elogiado}
                    </span>
                  </div>
                )}
                
                {manifestacao.data_atendimento && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Data do Atendimento</span>
                    <span className="font-medium text-green-800">
                      {format(new Date(manifestacao.data_atendimento), 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
                
                {/* Botão Encaminhar para Setor */}
                <div className="pt-3 border-t border-green-200">
                  <Button 
                    variant="outline" 
                    className="w-full border-green-300 text-green-700 hover:bg-green-100 gap-2"
                    disabled={encaminharSetorRH.isPending}
                    onClick={() => {
                      encaminharSetorRH.mutate({
                        manifestacaoId: manifestacao.id,
                        setor: manifestacao.setor_elogio,
                        colaborador: manifestacao.colaborador_elogiado,
                      });
                    }}
                  >
                    <SendIcon className="h-4 w-4" />
                    {encaminharSetorRH.isPending ? 'Encaminhando...' : 'Encaminhar para o Setor + RH'}
                  </Button>
                  <p className="text-xs text-green-600 mt-1 text-center">
                    Notifica o gestor do setor e envia cópia para RH
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Alterar Status */}
              <div className="space-y-2">
                <Label>Alterar Status</Label>
                <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as StatusManifestacao)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {novoStatus && (
                  <>
                    <Textarea
                      placeholder="Observação (opcional)"
                      value={observacaoStatus}
                      onChange={(e) => setObservacaoStatus(e.target.value)}
                      rows={2}
                    />
                    <Button
                      onClick={handleUpdateStatus}
                      disabled={updateStatus.isPending}
                      className="w-full gap-2"
                      variant="outline"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Atualizar Status
                    </Button>
                  </>
                )}
              </div>

              {/* Encaminhar Jurídico */}
              {!manifestacao.vinculo_juridico_id && (
                <Dialog open={dialogEncaminharOpen} onOpenChange={setDialogEncaminharOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full gap-2">
                      <Gavel className="h-4 w-4" />
                      Encaminhar para Jurídico
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Encaminhar para Jurídico</DialogTitle>
                      <DialogDescription>
                        Isso criará um processo jurídico vinculado a esta manifestação.
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Observação para o jurídico..."
                      value={observacaoJuridico}
                      onChange={(e) => setObservacaoJuridico(e.target.value)}
                      rows={3}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogEncaminharOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleEncaminharJuridico}
                        disabled={encaminharJuridico.isPending}
                      >
                        Encaminhar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {manifestacao.vinculo_juridico_id && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate(`/juridico/processos/${manifestacao.vinculo_juridico_id}`)}
                >
                  <Gavel className="h-4 w-4" />
                  Ver Processo Jurídico
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Logs da IA */}
          {iaLogs && iaLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Logs da IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {iaLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="text-xs bg-muted p-2 rounded">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{log.tipo_acao}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                    {log.sentimento && (
                      <span className="text-muted-foreground">Sentimento: {log.sentimento}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

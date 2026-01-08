import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  Send,
  Star,
  AlertCircle, 
  Lightbulb, 
  ThumbsUp, 
  Shield, 
  HelpCircle,
  LucideIcon,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { mockManifestacoes, mockInteracoes } from "@/mocks/ouvidoria";

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

const statusConfig: Record<string, StatusConfig> = {
  aberto: { label: 'Aberto', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  em_analise: { label: 'Em análise', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  aguardando_resposta: { label: 'Aguardando você', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  respondido: { label: 'Respondido', color: 'text-green-700', bgColor: 'bg-green-100' },
  encerrado: { label: 'Encerrado', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const tipoConfig: Record<string, { label: string; icon: LucideIcon; color: string; bgColor: string }> = {
  reclamacao: { label: 'Reclamação', icon: AlertCircle, color: 'text-red-700', bgColor: 'bg-red-100' },
  sugestao: { label: 'Sugestão', icon: Lightbulb, color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  elogio: { label: 'Elogio', icon: ThumbsUp, color: 'text-green-700', bgColor: 'bg-green-100' },
  denuncia: { label: 'Denúncia', icon: Shield, color: 'text-purple-700', bgColor: 'bg-purple-100' },
  duvida: { label: 'Dúvida', icon: HelpCircle, color: 'text-blue-700', bgColor: 'bg-blue-100' },
};

const CATEGORIA_LABELS: Record<string, string> = {
  atendimento: 'Atendimento',
  financeiro: 'Financeiro',
  sinistro: 'Sinistro',
  assistencia: 'Assistência',
  rastreamento: 'Rastreamento',
  contrato: 'Contrato',
  instalacao: 'Instalação',
  app: 'Aplicativo',
  outro: 'Outro',
};

export default function OuvidoriaDetalheApp() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [mensagem, setMensagem] = useState('');
  const [avaliacao, setAvaliacao] = useState(0);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState('');
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);

  // Mock data
  const manifestacao = mockManifestacoes.find(m => m.id === id) || mockManifestacoes[0];
  const interacoes = mockInteracoes.filter(i => i.manifestacao_id === manifestacao.id);

  const tipo = tipoConfig[manifestacao.tipo];
  const Icon = tipo.icon;
  const status = statusConfig[manifestacao.status];
  const isEncerrado = manifestacao.status === 'encerrado';

  const handleEnviarMensagem = () => {
    if (!mensagem.trim()) return;
    toast.success('Mensagem enviada!');
    setMensagem('');
  };

  const handleEnviarAvaliacao = async () => {
    if (avaliacao === 0) {
      toast.error('Selecione uma nota');
      return;
    }
    setEnviandoAvaliacao(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('Avaliação enviada! Obrigado pelo feedback.');
    setEnviandoAvaliacao(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/ouvidoria/lista')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-mono text-sm">{manifestacao.protocolo}</span>
      </div>

      {/* Card info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge className={`${tipo.bgColor} ${tipo.color} border-0 gap-1`}>
            <Icon className="h-3 w-3" />
            {tipo.label}
          </Badge>
          <Badge variant="outline" className={`${status.bgColor} ${status.color} border-0`}>
            {status.label}
          </Badge>
        </div>
        <h2 className="font-medium mb-1">{manifestacao.assunto}</h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{CATEGORIA_LABELS[manifestacao.categoria]}</span>
          <span>{format(new Date(manifestacao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>
        {manifestacao.responsavel && (
          <p className="text-xs text-muted-foreground mt-1">
            Responsável: {manifestacao.responsavel.nome}
          </p>
        )}
      </div>

      {/* Chat Timeline */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {interacoes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma interação ainda</p>
          </div>
        ) : (
          interacoes.map((interacao) => {
            const isAssociado = interacao.tipo === 'mensagem_associado';
            const isIA = interacao.tipo === 'resposta_ia';
            
            return (
              <div 
                key={interacao.id}
                className={`flex ${isAssociado ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${isAssociado ? 'order-2' : 'order-1'}`}>
                  <div 
                    className={`rounded-2xl px-4 py-2 ${
                      isAssociado 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{interacao.mensagem}</p>
                  </div>
                  <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${isAssociado ? 'justify-end' : 'justify-start'}`}>
                    <span>
                      {isAssociado ? 'Você' : isIA ? 'Assistente' : interacao.usuario?.nome || 'Ouvidoria'}
                    </span>
                    <span>•</span>
                    <span>{format(new Date(interacao.created_at), "HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {isEncerrado ? (
        <div className="p-4 border-t bg-muted/50 space-y-4">
          <div className="text-center">
            <Badge variant="outline" className="bg-gray-100 text-gray-700">
              Manifestação encerrada
            </Badge>
          </div>

          {/* Avaliação */}
          {!manifestacao.avaliacao_nota && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <p className="text-sm font-medium text-center">Como você avalia o atendimento?</p>
                
                {/* Estrelas */}
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((nota) => (
                    <button
                      key={nota}
                      type="button"
                      onClick={() => setAvaliacao(nota)}
                      className="p-1"
                    >
                      <Star 
                        className={`h-8 w-8 transition-colors ${
                          nota <= avaliacao 
                            ? 'fill-yellow-400 text-yellow-400' 
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <Textarea
                  placeholder="Deixe um comentário (opcional)"
                  value={comentarioAvaliacao}
                  onChange={(e) => setComentarioAvaliacao(e.target.value)}
                  rows={2}
                  className="resize-none"
                />

                <Button 
                  onClick={handleEnviarAvaliacao}
                  disabled={avaliacao === 0 || enviandoAvaliacao}
                  className="w-full"
                >
                  {enviandoAvaliacao ? 'Enviando...' : 'Enviar avaliação'}
                </Button>
              </CardContent>
            </Card>
          )}

          {manifestacao.avaliacao_nota && (
            <div className="text-center text-sm text-muted-foreground">
              <div className="flex justify-center gap-0.5 mb-1">
                {[1, 2, 3, 4, 5].map((nota) => (
                  <Star 
                    key={nota}
                    className={`h-5 w-5 ${
                      nota <= manifestacao.avaliacao_nota! 
                        ? 'fill-yellow-400 text-yellow-400' 
                        : 'text-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
              <p>Você avaliou com {manifestacao.avaliacao_nota} estrela(s)</p>
            </div>
          )}
        </div>
      ) : (
        <div className="sticky bottom-0 p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnviarMensagem()}
              className="flex-1"
            />
            <Button 
              size="icon"
              onClick={handleEnviarMensagem}
              disabled={!mensagem.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

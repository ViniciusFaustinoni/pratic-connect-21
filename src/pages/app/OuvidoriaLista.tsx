import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  ChevronRight, 
  Plus,
  Inbox,
  AlertCircle, 
  AlertTriangle,
  Lightbulb, 
  ThumbsUp, 
  Shield, 
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManifestacoes } from "@/hooks/useOuvidoria";

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

const tipoIcons: Record<string, { icon: LucideIcon; color: string; bgColor: string }> = {
  reclamacao: { icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  reclamacao_urgente: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
  sugestao: { icon: Lightbulb, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  elogio: { icon: ThumbsUp, color: 'text-green-600', bgColor: 'bg-green-100' },
  denuncia: { icon: Shield, color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

export default function OuvidoriaLista() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('todas');

  const manifestacoes = mockManifestacoes;

  const filteredManifestacoes = manifestacoes.filter(m => {
    if (tab === 'abertas') return m.status !== 'encerrado';
    if (tab === 'encerradas') return m.status === 'encerrado';
    return true;
  });

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/ouvidoria')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Minhas Manifestações</h1>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="todas" className="flex-1">Todas</TabsTrigger>
          <TabsTrigger value="abertas" className="flex-1">Abertas</TabsTrigger>
          <TabsTrigger value="encerradas" className="flex-1">Encerradas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {filteredManifestacoes.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">Nenhuma manifestação encontrada</p>
              <Button onClick={() => navigate('/app/ouvidoria')}>
                Criar manifestação
              </Button>
            </div>
          ) : (
            filteredManifestacoes.map((manifestacao) => {
              const tipoConfig = tipoIcons[manifestacao.tipo];
              const Icon = tipoConfig.icon;
              const status = statusConfig[manifestacao.status];

              return (
                <Card 
                  key={manifestacao.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/app/ouvidoria/${manifestacao.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Ícone do tipo */}
                      <div className={`w-10 h-10 rounded-full ${tipoConfig.bgColor} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-5 w-5 ${tipoConfig.color}`} />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {manifestacao.protocolo}
                          </span>
                          {manifestacao.temRespostaNova && (
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                          )}
                        </div>
                        
                        <p className="font-medium truncate">{manifestacao.assunto}</p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`${status.bgColor} ${status.color} border-0 text-xs`}>
                            {status.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(manifestacao.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* FAB */}
      <Button
        size="lg"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
        onClick={() => navigate('/app/ouvidoria')}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Car, FileCheck, Calendar, User, Clock, MessageCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcompanhamento } from "@/hooks/useAcompanhamento";

interface TransformedItem {
  id: string;
  nome: string;
  telefone: string;
  veiculo: string;
  placa: string;
  fase: string;
  docsAprovados: number;
  docsTotal: number;
  instalacaoData: string | null;
  vendedor: string;
  atualizadoEm: string;
}

const fases = [
  { id: "documentacao", label: "Documentação", cor: "gray" },
  { id: "analise_cadastro", label: "Análise Cadastro", cor: "yellow" },
  { id: "aprovado", label: "Aprovado", cor: "blue" },
  { id: "instalacao_agendada", label: "Instalação Agendada", cor: "purple" },
  { id: "instalacao_concluida", label: "Instalação Concluída", cor: "indigo" },
  { id: "ativacao_pendente", label: "Ativação Pendente", cor: "orange" },
  { id: "ativo", label: "Ativo ✅", cor: "green" }
];

const getColumnStyle = (cor: string) => {
  const styles: Record<string, { bg: string; border: string; badge: string }> = {
    gray: { bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-100 text-gray-700" },
    yellow: { bg: "bg-yellow-50", border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-700" },
    blue: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700" },
    indigo: { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700" },
    green: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700" }
  };
  return styles[cor] || styles.gray;
};

const formatRelativeTime = (dateStr: string) => {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  } catch {
    return dateStr;
  }
};

const AcompanhamentoCard = ({ item }: { item: TransformedItem }) => {
  const whatsappNumber = item.telefone.replace(/\D/g, "");
  
  return (
    <Card className="group cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        {/* Nome e Telefone */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{item.nome}</p>
            <a 
              href={`https://wa.me/55${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-3 w-3" />
              {item.telefone}
            </a>
          </div>
          <a
            href={`https://wa.me/55${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Veículo */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Car className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{item.veiculo}</span>
          {item.placa && item.placa !== '-' && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">
              {item.placa}
            </Badge>
          )}
        </div>

        <div className="border-t pt-2 space-y-1.5">
          {/* Documentos */}
          <div className="flex items-center gap-1 text-xs">
            <FileCheck className="h-3 w-3 text-muted-foreground" />
            <span className={item.docsAprovados === item.docsTotal && item.docsTotal > 0 ? "text-green-600" : "text-amber-600"}>
              {item.docsAprovados}/{item.docsTotal} docs aprovados
            </span>
          </div>

          {/* Instalação */}
          {item.instalacaoData && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Instalação: {new Date(item.instalacaoData).toLocaleDateString('pt-BR')}</span>
            </div>
          )}

          {/* Vendedor */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{item.vendedor}</span>
          </div>
        </div>

        {/* Tempo */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t">
          <Clock className="h-2.5 w-2.5" />
          <span>{formatRelativeTime(item.atualizadoEm)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const KanbanColumn = ({ fase, items }: { fase: typeof fases[0]; items: TransformedItem[] }) => {
  const style = getColumnStyle(fase.cor);
  
  return (
    <div className={`flex-shrink-0 w-[280px] rounded-lg border ${style.border} ${style.bg}`}>
      {/* Header */}
      <div className="p-3 border-b border-inherit">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{fase.label}</h3>
          <Badge className={`${style.badge} text-xs`}>
            {items.length}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="p-2 space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum item
            </div>
          ) : (
            items.map((item) => (
              <AcompanhamentoCard key={item.id} item={item} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const KanbanColumnSkeleton = () => (
  <div className="flex-shrink-0 w-[280px] rounded-lg border bg-muted/30">
    <div className="p-3 border-b">
      <Skeleton className="h-5 w-32" />
    </div>
    <div className="p-2 space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  </div>
);

export default function Acompanhamento() {
  const { data: items, isLoading, error } = useAcompanhamento();

  // Transformar dados da VIEW para o formato do card
  const transformedItems: TransformedItem[] = items?.map(item => ({
    id: item.lead_id,
    nome: item.nome,
    telefone: item.telefone,
    veiculo: [item.veiculo_marca, item.veiculo_modelo, item.veiculo_ano].filter(Boolean).join(' ') || 'Sem veículo',
    placa: item.veiculo_placa || '-',
    fase: item.fase_acompanhamento,
    docsAprovados: item.docs_aprovados,
    docsTotal: item.docs_total,
    instalacaoData: item.instalacao_data,
    vendedor: item.vendedor_nome || 'Não atribuído',
    atualizadoEm: item.updated_at,
  })) || [];

  const itemsPorFase = fases.reduce((acc, fase) => {
    acc[fase.id] = transformedItems.filter((item) => item.fase === fase.id);
    return acc;
  }, {} as Record<string, TransformedItem[]>);

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Acompanhamento</h1>
          <p className="text-muted-foreground">
            Acompanhe o progresso dos leads após fecharem contrato
          </p>
        </div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>Erro ao carregar dados. Tente novamente mais tarde.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Acompanhamento</h1>
        <p className="text-muted-foreground">
          Acompanhe o progresso dos leads após fecharem contrato
        </p>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4 -mx-6 px-6">
        <div className="flex gap-4" style={{ minWidth: "max-content" }}>
          {isLoading ? (
            fases.map((fase) => (
              <KanbanColumnSkeleton key={fase.id} />
            ))
          ) : (
            fases.map((fase) => (
              <KanbanColumn 
                key={fase.id} 
                fase={fase} 
                items={itemsPorFase[fase.id] || []} 
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

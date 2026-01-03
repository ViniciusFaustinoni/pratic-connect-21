import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Car, FileCheck, Calendar, User, Clock, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AcompanhamentoItem {
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

const mockAcompanhamento: AcompanhamentoItem[] = [
  {
    id: "1",
    nome: "João Silva",
    telefone: "(21) 99999-1111",
    veiculo: "Corolla 2020",
    placa: "ABC-1234",
    fase: "documentacao",
    docsAprovados: 2,
    docsTotal: 5,
    instalacaoData: null,
    vendedor: "Maria",
    atualizadoEm: "2024-01-08"
  },
  {
    id: "2",
    nome: "Maria Santos",
    telefone: "(21) 99999-2222",
    veiculo: "HB20 2021",
    placa: "DEF-5678",
    fase: "analise_cadastro",
    docsAprovados: 5,
    docsTotal: 5,
    instalacaoData: null,
    vendedor: "Carlos",
    atualizadoEm: "2024-01-09"
  },
  {
    id: "3",
    nome: "Pedro Oliveira",
    telefone: "(21) 99999-3333",
    veiculo: "Onix 2022",
    placa: "GHI-9012",
    fase: "aprovado",
    docsAprovados: 5,
    docsTotal: 5,
    instalacaoData: null,
    vendedor: "Maria",
    atualizadoEm: "2024-01-07"
  },
  {
    id: "4",
    nome: "Ana Costa",
    telefone: "(21) 99999-4444",
    veiculo: "Gol 2019",
    placa: "JKL-3456",
    fase: "instalacao_agendada",
    docsAprovados: 5,
    docsTotal: 5,
    instalacaoData: "2024-01-15",
    vendedor: "Carlos",
    atualizadoEm: "2024-01-10"
  },
  {
    id: "5",
    nome: "Lucas Ferreira",
    telefone: "(21) 99999-5555",
    veiculo: "Civic 2021",
    placa: "MNO-7890",
    fase: "instalacao_concluida",
    docsAprovados: 5,
    docsTotal: 5,
    instalacaoData: "2024-01-10",
    vendedor: "Maria",
    atualizadoEm: "2024-01-10"
  },
  {
    id: "6",
    nome: "Roberto Lima",
    telefone: "(21) 99999-6666",
    veiculo: "Kicks 2022",
    placa: "PQR-1234",
    fase: "ativacao_pendente",
    docsAprovados: 5,
    docsTotal: 5,
    instalacaoData: "2024-01-08",
    vendedor: "Carlos",
    atualizadoEm: "2024-01-11"
  },
  {
    id: "7",
    nome: "Carla Souza",
    telefone: "(21) 99999-7777",
    veiculo: "Polo 2023",
    placa: "STU-5678",
    fase: "ativo",
    docsAprovados: 5,
    docsTotal: 5,
    instalacaoData: "2024-01-05",
    vendedor: "Maria",
    atualizadoEm: "2024-01-08"
  },
  {
    id: "8",
    nome: "Fernando Alves",
    telefone: "(21) 99999-8888",
    veiculo: "T-Cross 2022",
    placa: "VWX-9012",
    fase: "ativo",
    docsAprovados: 5,
    docsTotal: 5,
    instalacaoData: "2024-01-03",
    vendedor: "Carlos",
    atualizadoEm: "2024-01-06"
  }
];

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

const AcompanhamentoCard = ({ item }: { item: AcompanhamentoItem }) => {
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
          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">
            {item.placa}
          </Badge>
        </div>

        <div className="border-t pt-2 space-y-1.5">
          {/* Documentos */}
          <div className="flex items-center gap-1 text-xs">
            <FileCheck className="h-3 w-3 text-muted-foreground" />
            <span className={item.docsAprovados === item.docsTotal ? "text-green-600" : "text-amber-600"}>
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

const KanbanColumn = ({ fase, items }: { fase: typeof fases[0]; items: AcompanhamentoItem[] }) => {
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

export default function Acompanhamento() {
  const itemsPorFase = fases.reduce((acc, fase) => {
    acc[fase.id] = mockAcompanhamento.filter((item) => item.fase === fase.id);
    return acc;
  }, {} as Record<string, AcompanhamentoItem[]>);

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
          {fases.map((fase) => (
            <KanbanColumn 
              key={fase.id} 
              fase={fase} 
              items={itemsPorFase[fase.id] || []} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

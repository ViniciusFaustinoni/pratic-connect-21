import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  AlertCircle, 
  AlertTriangle,
  Lightbulb, 
  ThumbsUp, 
  Shield, 
  ChevronRight,
  Inbox,
  Phone,
  ArrowLeft,
  Info,
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SetorElogioModal } from "@/components/ouvidoria/SetorElogioModal";

interface TipoItem {
  id: string;
  icon: LucideIcon;
  label: string;
  cor: string;
  desc: string;
}

const tipos: TipoItem[] = [
  { id: 'reclamacao', icon: AlertCircle, label: 'Reclamação', cor: 'orange', desc: 'Insatisfação com serviço' },
  { id: 'reclamacao_urgente', icon: AlertTriangle, label: 'Reclamação Urgente', cor: 'red', desc: 'Problema crítico - resposta em 4h' },
  { id: 'denuncia', icon: Shield, label: 'Denúncia', cor: 'purple', desc: 'Relatar irregularidade' },
  { id: 'sugestao', icon: Lightbulb, label: 'Sugestão', cor: 'yellow', desc: 'Ideias de melhoria' },
  { id: 'elogio', icon: ThumbsUp, label: 'Elogio', cor: 'green', desc: 'Reconhecer bom atendimento' },
];

const colorClasses: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', iconBg: 'bg-orange-100' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconBg: 'bg-red-100' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', iconBg: 'bg-yellow-100' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', iconBg: 'bg-green-100' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'bg-purple-100' },
};

export default function OuvidoriaMenu() {
  const navigate = useNavigate();
  const [showSetorModal, setShowSetorModal] = useState(false);

  const handleTipoClick = (tipoId: string) => {
    if (tipoId === 'elogio') {
      // Abre o modal de seleção de setor
      setShowSetorModal(true);
    } else {
      navigate(`/app/ouvidoria/nova?tipo=${tipoId}`);
    }
  };

  const handleSetorSelect = (setorValue: string) => {
    // Navega para o formulário já com o setor pré-selecionado
    navigate(`/app/ouvidoria/nova?tipo=elogio&setor=${setorValue}`);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Ouvidoria</h1>
      </div>

      {/* Texto explicativo */}
      <p className="text-muted-foreground">
        Canal oficial para você se comunicar com a PRATIC. Escolha o tipo de manifestação:
      </p>

      {/* Grid de tipos */}
      <div className="grid grid-cols-2 gap-3">
        {tipos.map((tipo) => {
          const colors = colorClasses[tipo.cor];
          const Icon = tipo.icon;
          const isUrgente = tipo.id === 'reclamacao_urgente';
          const isDenuncia = tipo.id === 'denuncia';
          return (
            <Card
              key={tipo.id}
              className={`cursor-pointer transition-all hover:scale-[1.02] ${colors.bg} ${colors.border} border-2 relative`}
              onClick={() => handleTipoClick(tipo.id)}
            >
              {isUrgente && (
                <Badge className="absolute top-2 right-2 bg-red-600 text-white text-[10px]">URGENTE</Badge>
              )}
              {isDenuncia && (
                <Badge variant="outline" className="absolute top-2 right-2 bg-purple-100 border-purple-300 text-purple-700 text-[10px]">Sigiloso</Badge>
              )}
              <CardContent className="p-4 space-y-2">
                <div className={`w-10 h-10 rounded-full ${colors.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${colors.text}`} />
                </div>
                <div>
                  <p className={`font-medium ${colors.text}`}>{tipo.label}</p>
                  <p className="text-xs text-muted-foreground">{tipo.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Botão ver manifestações */}
      <Button 
        variant="outline" 
        className="w-full gap-2"
        onClick={() => navigate('/app/ouvidoria/lista')}
      >
        <Inbox className="h-4 w-4" />
        Ver minhas manifestações
        <ChevronRight className="h-4 w-4 ml-auto" />
      </Button>

      {/* Card info protocolo */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-sm text-blue-800">
            Todas as manifestações recebem um número de protocolo para acompanhamento.
          </p>
        </CardContent>
      </Card>

      {/* Card 0800 */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <a href="tel:08009800001" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Central de Atendimento</p>
              <p className="text-primary font-semibold">0800 980 0001</p>
            </div>
          </a>
        </CardContent>
      </Card>

      {/* Modal de seleção de setor para elogio */}
      <SetorElogioModal
        open={showSetorModal}
        onClose={() => setShowSetorModal(false)}
        onSelect={handleSetorSelect}
      />
    </div>
  );
}

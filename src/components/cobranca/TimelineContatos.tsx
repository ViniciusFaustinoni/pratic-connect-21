import { Phone, MessageSquare, Smartphone, Mail, DollarSign, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Contato {
  id: string;
  tipo: 'ligacao' | 'whatsapp' | 'sms' | 'email';
  resultado: string;
  observacao?: string;
  promessa_data?: string;
  promessa_valor?: number;
  atendente?: { nome: string };
  created_at: string;
}

interface TimelineContatosProps {
  contatos: Contato[];
}

const tipoConfig = {
  ligacao: { icon: Phone, cor: 'bg-yellow-500', label: 'Ligação' },
  whatsapp: { icon: MessageSquare, cor: 'bg-green-500', label: 'WhatsApp' },
  sms: { icon: Smartphone, cor: 'bg-blue-500', label: 'SMS' },
  email: { icon: Mail, cor: 'bg-purple-500', label: 'E-mail' },
};

const resultadoConfig: Record<string, string> = {
  atendeu: 'bg-green-100 text-green-800',
  nao_atendeu: 'bg-red-100 text-red-800',
  promessa_pagamento: 'bg-blue-100 text-blue-800',
  enviado: 'bg-gray-100 text-gray-800',
  lido: 'bg-yellow-100 text-yellow-800',
};

const resultadoLabels: Record<string, string> = {
  atendeu: 'Atendeu',
  nao_atendeu: 'Não Atendeu',
  promessa_pagamento: 'Promessa de Pagamento',
  enviado: 'Enviado',
  lido: 'Lido',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function TimelineContatos({ contatos }: TimelineContatosProps) {
  if (!contatos || contatos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum contato registrado
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Linha vertical conectando os itens */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {contatos.map((contato) => {
          const config = tipoConfig[contato.tipo] || tipoConfig.ligacao;
          const Icon = config.icon;
          const resultadoCor = resultadoConfig[contato.resultado] || 'bg-gray-100 text-gray-800';
          const resultadoLabel = resultadoLabels[contato.resultado] || contato.resultado;

          return (
            <div key={contato.id} className="relative pl-10">
              {/* Ícone circular */}
              <div
                className={`absolute left-0 w-8 h-8 rounded-full ${config.cor} flex items-center justify-center`}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>

              {/* Conteúdo */}
              <div className="bg-card border rounded-lg p-4 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="font-medium">{config.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(contato.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                {/* Badge de resultado */}
                <div>
                  <Badge className={resultadoCor}>{resultadoLabel}</Badge>
                </div>

                {/* Observação */}
                {contato.observacao && (
                  <p className="text-sm text-muted-foreground">{contato.observacao}</p>
                )}

                {/* Card de promessa */}
                {(contato.promessa_data || contato.promessa_valor) && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <div className="flex items-center gap-4 text-sm">
                      {contato.promessa_data && (
                        <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {format(new Date(contato.promessa_data), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                      )}
                      {contato.promessa_valor && (
                        <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-medium">{formatCurrency(contato.promessa_valor)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Atendente */}
                {contato.atendente?.nome && (
                  <p className="text-xs text-muted-foreground">
                    Atendente: {contato.atendente.nome}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

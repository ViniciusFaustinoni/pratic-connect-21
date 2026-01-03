import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useInstaladorInstalacoes, useIniciarInstalacao } from '@/hooks/useInstaladorInstalacoes';
import { InstalacaoCard } from '@/components/instalador/InstalacaoCard';
import { Card, CardContent } from '@/components/ui/card';

export default function InstaladorHome() {
  const navigate = useNavigate();
  const [data] = useState(new Date());
  
  const { data: instalacoes, isLoading, error } = useInstaladorInstalacoes(data);
  const iniciarMutation = useIniciarInstalacao();

  const handleIniciar = (id: string, status: string) => {
    if (status === 'em_andamento') {
      // Já iniciada, apenas navegar
      navigate(`/instalador/instalacao/${id}`);
    } else {
      // Iniciar e navegar
      iniciarMutation.mutate(id, {
        onSuccess: () => {
          navigate(`/instalador/instalacao/${id}`);
        },
      });
    }
  };

  const dataFormatada = format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataCapitalized = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Minhas Instalações</h1>
        <div className="mt-1 flex items-center gap-2 text-slate-400">
          <CalendarDays className="h-4 w-4" />
          <span className="text-sm">{dataCapitalized}</span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-3 text-slate-400">Carregando instalações...</p>
        </div>
      ) : error ? (
        <Card className="border-red-800 bg-red-900/20">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-sm text-red-300">Erro ao carregar instalações</span>
          </CardContent>
        </Card>
      ) : instalacoes && instalacoes.length > 0 ? (
        <div className="space-y-4">
          {instalacoes.map((instalacao) => (
            <InstalacaoCard
              key={instalacao.id}
              instalacao={instalacao}
              onIniciar={() => handleIniciar(instalacao.id, instalacao.status)}
              loading={iniciarMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <Card className="border-slate-700 bg-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-semibold text-white">Tudo certo!</h3>
            <p className="mt-1 text-center text-sm text-slate-400">
              Você não tem instalações agendadas para hoje.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

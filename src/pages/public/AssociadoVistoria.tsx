import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Car, Calendar, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useContratoByToken } from '@/hooks/useContratoLink';
import { EscolhaVistoria } from '@/components/associado/EscolhaVistoria';
import { AgendarVistoria } from '@/components/associado/AgendarVistoria';
import { Autovistoria } from '@/components/associado/Autovistoria';
import { PagamentoAdesao } from '@/components/associado/PagamentoAdesao';
import { ConfirmacaoVistoria } from '@/components/associado/ConfirmacaoVistoria';

type Etapa = 'escolha' | 'agendar' | 'autovistoria' | 'pagamento' | 'confirmacao';

export default function AssociadoVistoria() {
  const { token } = useParams<{ token: string }>();
  const { data: contrato, isLoading, error } = useContratoByToken(token);
  const [etapa, setEtapa] = useState<Etapa>('escolha');
  const [vistoriaId, setVistoriaId] = useState<string | null>(null);
  const [dadosAgendamento, setDadosAgendamento] = useState<{ data: string; horario: string } | null>(null);

  // Determinar etapa baseado no estado do contrato
  useEffect(() => {
    if (contrato) {
      if (contrato.adesao_paga) {
        setEtapa('confirmacao');
      } else if (contrato.tipo_vistoria === 'agendada' && dadosAgendamento) {
        setEtapa('pagamento');
      } else if (contrato.tipo_vistoria === 'autovistoria') {
        // Verificar se todas as fotos foram enviadas
        setEtapa('autovistoria');
      }
    }
  }, [contrato, dadosAgendamento]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error || !contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 to-destructive/10 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>
              Este link de vistoria não foi encontrado ou expirou.
              Entre em contato com a associação para obter um novo link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const clienteNome = contrato.associados?.nome || contrato.leads?.nome || contrato.cliente_nome || 'Cliente';
  const veiculoInfo = contrato.veiculo_marca 
    ? `${contrato.veiculo_marca} ${contrato.veiculo_modelo || ''} - ${contrato.veiculo_placa || ''}`
    : 'Veículo não informado';
  
  // Detectar tipo de veículo baseado na marca (heurística simples)
  const MARCAS_MOTOS = ['HONDA', 'YAMAHA', 'SUZUKI', 'KAWASAKI', 'BMW MOTORRAD', 'HARLEY-DAVIDSON', 'TRIUMPH', 'DUCATI', 'KTM', 'DAFRA', 'SHINERAY', 'KASINSKI'];
  const tipoVeiculo = MARCAS_MOTOS.some(marca => contrato.veiculo_marca?.toUpperCase()?.includes(marca)) ? 'moto' : 'carro';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Car className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Vistoria do Veículo</h1>
          </div>
          <p className="text-muted-foreground">
            Olá, <strong>{clienteNome}</strong>!
          </p>
        </div>

        {/* Info do Veículo */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{veiculoInfo}</p>
                <p className="text-sm text-muted-foreground">
                  Plano: {contrato.planos?.nome || 'Não informado'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progresso */}
        <div className="flex items-center justify-center gap-2">
          {['escolha', 'vistoria', 'pagamento', 'confirmacao'].map((step, index) => {
            const isActive = 
              (step === 'escolha' && etapa === 'escolha') ||
              (step === 'vistoria' && (etapa === 'agendar' || etapa === 'autovistoria')) ||
              (step === 'pagamento' && etapa === 'pagamento') ||
              (step === 'confirmacao' && etapa === 'confirmacao');
            
            const isCompleted = 
              (step === 'escolha' && etapa !== 'escolha') ||
              (step === 'vistoria' && (etapa === 'pagamento' || etapa === 'confirmacao')) ||
              (step === 'pagamento' && etapa === 'confirmacao');

            return (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Conteúdo da Etapa */}
        {etapa === 'escolha' && (
          <EscolhaVistoria
            contratoId={contrato.id}
            onEscolher={(tipo) => {
              if (tipo === 'agendada') {
                setEtapa('agendar');
              } else {
                setEtapa('autovistoria');
              }
            }}
          />
        )}

        {etapa === 'agendar' && (
          <AgendarVistoria
            contratoId={contrato.id}
            onAgendar={(data, horario, vistoriaId) => {
              setDadosAgendamento({ data, horario });
              setVistoriaId(vistoriaId);
              setEtapa('pagamento');
            }}
            onVoltar={() => setEtapa('escolha')}
          />
        )}

        {etapa === 'autovistoria' && (
          <Autovistoria
            contratoId={contrato.id}
            tipoVeiculo={tipoVeiculo as 'carro' | 'moto'}
            onComplete={(vistoriaId) => {
              setVistoriaId(vistoriaId);
              setEtapa('pagamento');
            }}
            onVoltar={() => setEtapa('escolha')}
          />
        )}

        {etapa === 'pagamento' && (
          <PagamentoAdesao
            contratoId={contrato.id}
            valorAdesao={contrato.valor_adesao}
            clienteNome={clienteNome}
            clienteEmail={contrato.associados?.email || contrato.leads?.email || contrato.cliente_email || ''}
            clienteCpf={contrato.associados?.cpf || contrato.leads?.cpf || contrato.cliente_cpf || ''}
            onPagamentoConfirmado={() => setEtapa('confirmacao')}
          />
        )}

        {etapa === 'confirmacao' && (
          <ConfirmacaoVistoria
            tipoVistoria={contrato.tipo_vistoria as 'agendada' | 'autovistoria'}
            dadosAgendamento={dadosAgendamento}
          />
        )}
      </div>
    </div>
  );
}

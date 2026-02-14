import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Flame, AlertTriangle, FileCheck, Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface CardAnaliseIncendioProps {
  sinistro: {
    id: string;
    bombeiros_acionados?: boolean | null;
    analise_interna?: boolean | null;
    analise_interna_motivos?: string[] | null;
  };
  associadoId?: string | null;
}

const MOTIVOS_ANALISE = [
  { value: 'gnv_irregular', label: 'GNV irregular (sem documentação)' },
  { value: 'sobrecarga_eletrica', label: 'Sobrecarga elétrica (modificações/som)' },
] as const;

export function CardAnaliseIncendio({ sinistro, associadoId }: CardAnaliseIncendioProps) {
  const queryClient = useQueryClient();
  const [motivosSelecionados, setMotivosSelecionados] = useState<string[]>(
    (sinistro.analise_interna_motivos as string[]) || []
  );

  const isEmAnaliseInterna = sinistro.analise_interna === true;

  const toggleMotivo = (motivo: string) => {
    setMotivosSelecionados(prev =>
      prev.includes(motivo) ? prev.filter(m => m !== motivo) : [...prev, motivo]
    );
  };

  const encaminharMutation = useMutation({
    mutationFn: async () => {
      if (motivosSelecionados.length === 0) throw new Error('Selecione ao menos um motivo');

      const { error } = await supabase
        .from('sinistros')
        .update({
          analise_interna: true,
          analise_interna_motivos: motivosSelecionados,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistro.id);

      if (error) throw error;

      // Criar consulta jurídica para visibilidade do jurídico
      await supabase.from('consultas_juridicas').insert({
        sinistro_id: sinistro.id,
        associado_id: associadoId || undefined,
        assunto: 'Análise Interna — Incêndio',
        descricao: `Evento encaminhado para análise interna. Motivos: ${motivosSelecionados.map(m => MOTIVOS_ANALISE.find(ma => ma.value === m)?.label || m).join(', ')}`,
        prioridade: 'normal',
        departamento: 'eventos',
        status: 'pendente',
      });

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_novo: 'em_analise',
        observacao: `Encaminhado para análise interna. Motivos: ${motivosSelecionados.map(m => MOTIVOS_ANALISE.find(ma => ma.value === m)?.label || m).join(', ')}`,
      });
    },
    onSuccess: () => {
      toast.success('Sinistro encaminhado para análise interna');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistro.id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao encaminhar');
    },
  });

  return (
    <Card className={isEmAnaliseInterna ? 'border-amber-500/50' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-5 w-5" />
          Análise de Incêndio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bombeiros */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bombeiros acionados?</span>
          <Badge variant="outline" className={sinistro.bombeiros_acionados ? 'border-green-500 text-green-700' : 'border-amber-500 text-amber-700'}>
            {sinistro.bombeiros_acionados === true ? 'Sim' : sinistro.bombeiros_acionados === false ? 'Não' : 'Não informado'}
          </Badge>
        </div>

        <div className="text-sm">
          <span className="text-muted-foreground">Documento exigido: </span>
          <span className="font-medium">
            {sinistro.bombeiros_acionados === true
              ? 'Certidão de Ocorrência do Corpo de Bombeiros'
              : sinistro.bombeiros_acionados === false
              ? 'Carta reconhecida em cartório'
              : '-'}
          </span>
        </div>

        <Separator />

        {/* Badge análise interna */}
        {isEmAnaliseInterna && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">Em Análise Interna</p>
              <ul className="mt-1 space-y-0.5">
                {(sinistro.analise_interna_motivos as string[] || []).map(motivo => (
                  <li key={motivo} className="text-amber-700 dark:text-amber-400">
                    • {MOTIVOS_ANALISE.find(m => m.value === motivo)?.label || motivo}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Checkboxes de verificação */}
        {!isEmAnaliseInterna && (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Verificações Especiais
              </p>
              {MOTIVOS_ANALISE.map(motivo => (
                <div key={motivo.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={motivo.value}
                    checked={motivosSelecionados.includes(motivo.value)}
                    onCheckedChange={() => toggleMotivo(motivo.value)}
                  />
                  <Label htmlFor={motivo.value} className="text-sm cursor-pointer">
                    {motivo.label}
                  </Label>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Marcar não nega o sinistro. Encaminha para análise interna da equipe.
              </p>
            </div>

            <Button
              onClick={() => encaminharMutation.mutate()}
              disabled={motivosSelecionados.length === 0 || encaminharMutation.isPending}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {encaminharMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4 mr-2" />
              )}
              Encaminhar para Análise Interna
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

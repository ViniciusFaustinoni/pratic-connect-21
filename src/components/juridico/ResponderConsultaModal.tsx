import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Calendar, Building2, Loader2, Save, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

import { supabase } from '@/integrations/supabase/client';
import { 
  PRIORIDADE_LABELS, 
  PRIORIDADE_COLORS, 
  PrioridadePrazo,
  TIPO_CONSULTA_LABELS,
  CONCLUSAO_PARECER_LABELS,
  CONCLUSAO_PARECER_COLORS,
  RECOMENDACAO_CONSULTA_LABELS,
  TipoConsulta,
  ConclusaoParecer,
  RecomendacaoConsulta
} from '@/types/juridico';

interface ConsultaData {
  id: string;
  numero?: string | null;
  assunto: string;
  descricao: string;
  departamento?: string | null;
  prioridade?: string | null;
  parecer?: string | null;
  tipo_consulta?: string | null;
  conclusao_parecer?: string | null;
  recomendacoes?: string[] | null;
  created_at?: string | null;
  solicitante?: { id: string; nome: string } | null;
}

interface ResponderConsultaModalProps {
  open: boolean;
  onClose: () => void;
  consulta: ConsultaData;
}

const RECOMENDACOES_OPCOES: RecomendacaoConsulta[] = [
  'aprovar_cobertura',
  'negar_cobertura',
  'solicitar_laudo',
  'encaminhar_diretoria',
  'arquivar',
];

export function ResponderConsultaModal({ open, onClose, consulta }: ResponderConsultaModalProps) {
  const [parecer, setParecer] = useState('');
  const [tipoConsulta, setTipoConsulta] = useState<TipoConsulta | ''>('');
  const [conclusao, setConclusao] = useState<ConclusaoParecer | ''>('');
  const [recomendacoes, setRecomendacoes] = useState<string[]>([]);
  const [outraRecomendacao, setOutraRecomendacao] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setParecer(consulta.parecer || '');
      setTipoConsulta((consulta.tipo_consulta as TipoConsulta) || '');
      setConclusao((consulta.conclusao_parecer as ConclusaoParecer) || '');
      setRecomendacoes(consulta.recomendacoes || []);
      setOutraRecomendacao('');
    }
  }, [open, consulta]);

  const handleClose = () => {
    setParecer('');
    setTipoConsulta('');
    setConclusao('');
    setRecomendacoes([]);
    setOutraRecomendacao('');
    onClose();
  };

  const toggleRecomendacao = (rec: string) => {
    setRecomendacoes(prev => 
      prev.includes(rec) 
        ? prev.filter(r => r !== rec)
        : [...prev, rec]
    );
  };

  const salvarRascunhoMutation = useMutation({
    mutationFn: async () => {
      const finalRecomendacoes = outraRecomendacao.trim() 
        ? [...recomendacoes, outraRecomendacao.trim()]
        : recomendacoes;

      const { error } = await supabase
        .from('consultas_juridicas')
        .update({
          parecer,
          tipo_consulta: tipoConsulta || null,
          conclusao_parecer: conclusao || null,
          recomendacoes: finalRecomendacoes.length > 0 ? finalRecomendacoes : null,
          status: 'em_analise',
          updated_at: new Date().toISOString(),
        })
        .eq('id', consulta.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rascunho salvo!');
      queryClient.invalidateQueries({ queryKey: ['consultas_juridicas'] });
      handleClose();
    },
    onError: (error) => {
      toast.error('Erro ao salvar rascunho: ' + error.message);
    },
  });

  const responderMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      const finalRecomendacoes = outraRecomendacao.trim() 
        ? [...recomendacoes, outraRecomendacao.trim()]
        : recomendacoes;

      const { error } = await supabase
        .from('consultas_juridicas')
        .update({
          parecer,
          tipo_consulta: tipoConsulta || null,
          conclusao_parecer: conclusao || null,
          recomendacoes: finalRecomendacoes.length > 0 ? finalRecomendacoes : null,
          respondido_por: user.data.user?.id,
          respondido_em: new Date().toISOString(),
          status: 'respondida',
          updated_at: new Date().toISOString(),
        })
        .eq('id', consulta.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Consulta respondida com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['consultas_juridicas'] });
      handleClose();
    },
    onError: (error) => {
      toast.error('Erro ao responder consulta: ' + error.message);
    },
  });

  const parecerValido = parecer.trim().length >= 20;
  const conclusaoValida = conclusao !== '';
  const podeEnviar = parecerValido && conclusaoValida;
  const isPending = salvarRascunhoMutation.isPending || responderMutation.isPending;

  const prioridade = consulta.prioridade as PrioridadePrazo;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Responder Consulta</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Card com informações da consulta */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {consulta.numero || 'Sem número'}
                </span>
                {prioridade && PRIORIDADE_LABELS[prioridade] && (
                  <Badge className={PRIORIDADE_COLORS[prioridade]}>
                    {PRIORIDADE_LABELS[prioridade]}
                  </Badge>
                )}
              </div>

              <div>
                <h4 className="font-semibold">{consulta.assunto}</h4>
              </div>

              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {consulta.descricao}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2 border-t">
                {consulta.solicitante?.nome && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    <span>{consulta.solicitante.nome}</span>
                  </div>
                )}
                {consulta.departamento && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    <span>{consulta.departamento}</span>
                  </div>
                )}
                {consulta.created_at && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(consulta.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tipo de Consulta */}
          <div className="space-y-2">
            <Label>Tipo de Consulta</Label>
            <Select value={tipoConsulta} onValueChange={(v) => setTipoConsulta(v as TipoConsulta)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de consulta" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_CONSULTA_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parecer */}
          <div className="space-y-2">
            <Label htmlFor="parecer">Parecer Jurídico *</Label>
            <Textarea
              id="parecer"
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="Digite o parecer jurídico..."
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 20 caracteres para enviar ({parecer.trim().length}/20)
            </p>
          </div>

          {/* Conclusão do Parecer */}
          <div className="space-y-3">
            <Label>Conclusão do Parecer *</Label>
            <RadioGroup value={conclusao} onValueChange={(v) => setConclusao(v as ConclusaoParecer)}>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(CONCLUSAO_PARECER_LABELS).map(([value, label]) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value} id={`conclusao-${value}`} />
                    <Label 
                      htmlFor={`conclusao-${value}`} 
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Badge className={CONCLUSAO_PARECER_COLORS[value as ConclusaoParecer]}>
                        {label}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Recomendações */}
          <div className="space-y-3">
            <Label>Recomendações</Label>
            <div className="grid grid-cols-2 gap-2">
              {RECOMENDACOES_OPCOES.map((rec) => (
                <div key={rec} className="flex items-center space-x-2">
                  <Checkbox
                    id={`rec-${rec}`}
                    checked={recomendacoes.includes(rec)}
                    onCheckedChange={() => toggleRecomendacao(rec)}
                  />
                  <Label htmlFor={`rec-${rec}`} className="cursor-pointer text-sm">
                    {RECOMENDACAO_CONSULTA_LABELS[rec]}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="rec-outro"
                checked={recomendacoes.includes('outro') || outraRecomendacao.trim() !== ''}
                onCheckedChange={() => toggleRecomendacao('outro')}
              />
              <Label htmlFor="rec-outro" className="cursor-pointer text-sm">Outro:</Label>
              <Input
                placeholder="Especifique outra recomendação..."
                value={outraRecomendacao}
                onChange={(e) => setOutraRecomendacao(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4">
          <Button
            variant="outline"
            onClick={() => salvarRascunhoMutation.mutate()}
            disabled={isPending}
          >
            {salvarRascunhoMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar como Rascunho
          </Button>
          <Button
            onClick={() => responderMutation.mutate()}
            disabled={!podeEnviar || isPending}
          >
            {responderMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Parecer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

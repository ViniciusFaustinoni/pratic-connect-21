import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Calendar, Building2, Loader2, Save, Send } from 'lucide-react';
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

import { supabase } from '@/integrations/supabase/client';
import { PRIORIDADE_LABELS, PRIORIDADE_COLORS, PrioridadePrazo } from '@/types/juridico';

interface ConsultaData {
  id: string;
  numero?: string | null;
  assunto: string;
  descricao: string;
  departamento?: string | null;
  prioridade?: string | null;
  parecer?: string | null;
  created_at?: string | null;
  solicitante?: { id: string; nome: string } | null;
}

interface ResponderConsultaModalProps {
  open: boolean;
  onClose: () => void;
  consulta: ConsultaData;
}

export function ResponderConsultaModal({ open, onClose, consulta }: ResponderConsultaModalProps) {
  const [parecer, setParecer] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && consulta.parecer) {
      setParecer(consulta.parecer);
    } else if (open) {
      setParecer('');
    }
  }, [open, consulta.parecer]);

  const handleClose = () => {
    setParecer('');
    onClose();
  };

  const salvarRascunhoMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('consultas_juridicas')
        .update({
          parecer: parecer,
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

      const { error } = await supabase
        .from('consultas_juridicas')
        .update({
          parecer: parecer,
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
  const isPending = salvarRascunhoMutation.isPending || responderMutation.isPending;

  const prioridade = consulta.prioridade as PrioridadePrazo;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Responder Consulta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Textarea para parecer */}
          <div className="space-y-2">
            <Label htmlFor="parecer">Parecer Jurídico *</Label>
            <Textarea
              id="parecer"
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="Digite o parecer jurídico..."
              className="min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 20 caracteres para enviar ({parecer.trim().length}/20)
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
            disabled={!parecerValido || isPending}
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

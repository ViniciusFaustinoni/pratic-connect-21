import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { notificarSindicanciaAberta } from '@/components/sinistros/NotificacaoHelper';
import { format } from 'date-fns';
import { ESPECIALIDADES_LABELS } from '@/types/sindicancia';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface AtribuirSindicanteModalProps {
  sindicanciaId: string;
  sinistroId?: string;
  protocolo?: string;
  dataLimite?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AtribuirSindicanteModal({
  sindicanciaId, sinistroId, protocolo, dataLimite, open, onOpenChange, onSuccess,
}: AtribuirSindicanteModalProps) {
  const queryClient = useQueryClient();
  const [empresaId, setEmpresaId] = useState('');

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-sindicancia-ativas'],
    queryFn: async () => {
      const { data: emps, error } = await supabase
        .from('empresas_sindicancia')
        .select('id, nome_fantasia, razao_social, especialidades, profile_id')
        .eq('ativo', true)
        .order('nome_fantasia');
      if (error) throw error;

      const { data: counts } = await supabase
        .from('sindicancias')
        .select('empresa_sindicancia_id')
        .in('status', ['atribuido', 'em_andamento']);

      const countMap: Record<string, number> = {};
      (counts || []).forEach(c => {
        if (c.empresa_sindicancia_id) {
          countMap[c.empresa_sindicancia_id] = (countMap[c.empresa_sindicancia_id] || 0) + 1;
        }
      });

      return (emps || []).map(e => ({
        ...e,
        casosAtivos: countMap[e.id] || 0,
      }));
    },
    enabled: open,
  });

  const atribuirMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error('Selecione uma empresa');

      const empresa = empresas.find(e => e.id === empresaId);
      const profileId = empresa?.profile_id || null;

      const { error } = await supabase
        .from('sindicancias')
        .update({
          empresa_sindicancia_id: empresaId,
          sindicante_profile_id: profileId,
          status: 'atribuido' as any,
          data_atribuicao: new Date().toISOString(),
        })
        .eq('id', sindicanciaId);
      if (error) throw error;

      // Notify sindicante
      if (profileId && sinistroId && protocolo) {
        const prazoFormatado = dataLimite ? format(new Date(dataLimite), 'dd/MM/yyyy') : 'Não definido';
        notificarSindicanciaAberta(sinistroId, protocolo, profileId, prazoFormatado);
      }
    },
    onSuccess: () => {
      toast.success('Sindicante atribuído com sucesso');
      queryClient.invalidateQueries({ queryKey: ['sindicancias'] });
      queryClient.invalidateQueries({ queryKey: ['sindicancia', sindicanciaId] });
      setEmpresaId('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao atribuir sindicante'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir Sindicante</DialogTitle>
          <DialogDescription>
            Selecione a empresa de sindicância para este caso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Empresa de Sindicância *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2 flex-wrap">
                      {e.nome_fantasia || e.razao_social}
                      {(e.especialidades || []).slice(0, 2).map(esp => (
                        <Badge key={esp} variant="secondary" className="text-[10px] px-1 py-0">
                          {ESPECIALIDADES_LABELS[esp] || esp}
                        </Badge>
                      ))}
                      <span className="text-muted-foreground text-xs">— {e.casosAtivos} caso(s)</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={atribuirMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => atribuirMutation.mutate()}
            disabled={atribuirMutation.isPending || !empresaId}
          >
            {atribuirMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

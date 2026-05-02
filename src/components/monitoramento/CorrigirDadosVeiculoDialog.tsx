import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { isValidChassi, normalizeChassi, chassiHelperText } from '@/lib/chassi';

/**
 * Dialog focado em destravar a Aprovação do Monitoramento quando a RPC
 * `fn_validar_campos_ativacao` reclama de campos faltantes em
 * `veiculos` (chassi/placa/renavam) ou em `associados` (cpf/email/telefone).
 *
 * Mostra apenas os campos sinalizados como faltando — não é um editor
 * geral de veículo (para isso, ver `VeiculoEditDialog`).
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculoId: string;
  associadoId: string;
  camposFaltando: string[];
  onSaved?: () => void; // chamado após salvar com sucesso (para refazer aprovação)
}

interface VeiculoSnapshot {
  placa: string | null;
  chassi: string | null;
  renavam: string | null;
}
interface AssociadoSnapshot {
  cpf: string | null;
  email: string | null;
  telefone: string | null;
}

const FIELD_LABEL: Record<string, string> = {
  chassi: 'Chassi (VIN, 17 caracteres)',
  placa: 'Placa',
  renavam: 'Renavam (11 dígitos)',
  cpf: 'CPF',
  email: 'E-mail',
  telefone: 'Telefone',
};

export function CorrigirDadosVeiculoDialog({
  open,
  onOpenChange,
  veiculoId,
  associadoId,
  camposFaltando,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [veic, setVeic] = useState<VeiculoSnapshot>({ placa: '', chassi: '', renavam: '' });
  const [assoc, setAssoc] = useState<AssociadoSnapshot>({ cpf: '', email: '', telefone: '' });

  const camposVeic = camposFaltando.filter((c) => ['chassi', 'placa', 'renavam'].includes(c));
  const camposAssoc = camposFaltando.filter((c) => ['cpf', 'email', 'telefone'].includes(c));

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [{ data: v }, { data: a }] = await Promise.all([
          supabase.from('veiculos').select('placa, chassi, renavam').eq('id', veiculoId).maybeSingle(),
          supabase.from('associados').select('cpf, email, telefone').eq('id', associadoId).maybeSingle(),
        ]);
        if (!active) return;
        setVeic({ placa: v?.placa ?? '', chassi: v?.chassi ?? '', renavam: v?.renavam ?? '' });
        setAssoc({ cpf: a?.cpf ?? '', email: a?.email ?? '', telefone: a?.telefone ?? '' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, veiculoId, associadoId]);

  const chassiHelp = chassiHelperText(veic.chassi || '');
  const chassiOk = !camposVeic.includes('chassi') || isValidChassi(veic.chassi || '');
  const placaOk = !camposVeic.includes('placa') || (veic.placa || '').replace(/[^A-Z0-9]/gi, '').length >= 7;
  const renavamOk = !camposVeic.includes('renavam') ||
    (veic.renavam || '').replace(/\D/g, '').length === 11;
  const cpfOk = !camposAssoc.includes('cpf') || (assoc.cpf || '').replace(/\D/g, '').length === 11;
  const emailOk = !camposAssoc.includes('email') || /\S+@\S+\.\S+/.test(assoc.email || '');
  const telOk = !camposAssoc.includes('telefone') || (assoc.telefone || '').replace(/\D/g, '').length >= 10;

  const tudoOk = chassiOk && placaOk && renavamOk && cpfOk && emailOk && telOk;

  const handleSave = async () => {
    if (!tudoOk) return;
    setSaving(true);
    try {
      // Update veículo apenas com os campos sinalizados
      if (camposVeic.length > 0) {
        const patch: Record<string, any> = {};
        if (camposVeic.includes('chassi')) patch.chassi = normalizeChassi(veic.chassi || '');
        if (camposVeic.includes('placa')) {
          patch.placa = (veic.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
        if (camposVeic.includes('renavam')) {
          patch.renavam = (veic.renavam || '').replace(/\D/g, '');
        }
        patch.updated_at = new Date().toISOString();
        const { error } = await supabase.from('veiculos').update(patch).eq('id', veiculoId);
        if (error) throw error;
      }
      // Update associado
      if (camposAssoc.length > 0) {
        const patch: Record<string, any> = {};
        if (camposAssoc.includes('cpf')) patch.cpf = (assoc.cpf || '').replace(/\D/g, '');
        if (camposAssoc.includes('email')) patch.email = (assoc.email || '').trim();
        if (camposAssoc.includes('telefone')) patch.telefone = (assoc.telefone || '').replace(/\D/g, '');
        patch.updated_at = new Date().toISOString();
        const { error } = await supabase.from('associados').update(patch).eq('id', associadoId);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ['veiculos'] });
      qc.invalidateQueries({ queryKey: ['associados'] });
      toast.success('Dados corrigidos. Refazendo aprovação...');
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar correção');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Corrigir dados antes de aprovar</DialogTitle>
          <DialogDescription>
            A ativação está bloqueada porque alguns dados obrigatórios estão faltando ou inválidos.
            Corrija abaixo e voltamos para aprovar automaticamente.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Campos sinalizados</AlertTitle>
              <AlertDescription className="text-xs">
                {camposFaltando.map((c) => FIELD_LABEL[c] ?? c).join(' · ')}
              </AlertDescription>
            </Alert>

            {camposVeic.includes('chassi') && (
              <div className="space-y-1">
                <Label htmlFor="chassi">Chassi</Label>
                <Input
                  id="chassi"
                  value={veic.chassi || ''}
                  onChange={(e) => setVeic((s) => ({ ...s, chassi: normalizeChassi(e.target.value) }))}
                  maxLength={17}
                  className="font-mono uppercase"
                  placeholder="Ex.: 8AP372171E6086953"
                />
                {chassiHelp && (
                  <p className="text-xs text-amber-600">{chassiHelp}</p>
                )}
                {chassiOk && (veic.chassi?.length ?? 0) === 17 && (
                  <p className="text-xs text-emerald-600">Formato válido (17/17).</p>
                )}
              </div>
            )}

            {camposVeic.includes('placa') && (
              <div className="space-y-1">
                <Label htmlFor="placa">Placa</Label>
                <Input
                  id="placa"
                  value={veic.placa || ''}
                  onChange={(e) => setVeic((s) => ({ ...s, placa: e.target.value.toUpperCase() }))}
                  maxLength={8}
                  className="font-mono uppercase"
                />
              </div>
            )}

            {camposVeic.includes('renavam') && (
              <div className="space-y-1">
                <Label htmlFor="renavam">Renavam</Label>
                <Input
                  id="renavam"
                  value={veic.renavam || ''}
                  onChange={(e) => setVeic((s) => ({ ...s, renavam: e.target.value.replace(/\D/g, '') }))}
                  maxLength={11}
                  inputMode="numeric"
                />
              </div>
            )}

            {camposAssoc.includes('cpf') && (
              <div className="space-y-1">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={assoc.cpf || ''}
                  onChange={(e) => setAssoc((s) => ({ ...s, cpf: e.target.value.replace(/\D/g, '') }))}
                  maxLength={11}
                  inputMode="numeric"
                />
              </div>
            )}

            {camposAssoc.includes('email') && (
              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={assoc.email || ''}
                  onChange={(e) => setAssoc((s) => ({ ...s, email: e.target.value }))}
                />
              </div>
            )}

            {camposAssoc.includes('telefone') && (
              <div className="space-y-1">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={assoc.telefone || ''}
                  onChange={(e) => setAssoc((s) => ({ ...s, telefone: e.target.value.replace(/\D/g, '') }))}
                  maxLength={15}
                  inputMode="tel"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!tudoOk || saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar e tentar aprovar de novo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

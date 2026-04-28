import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Pencil, Save, X } from 'lucide-react';
import { normalizeChassi, isValidChassi, chassiHelperText } from '@/lib/chassi';

interface ChassiOcrEditorProps {
  vistoriaId: string;
  chassiOcrAtual: string | null;
  chassiCadastro: string | null;
  onSaved?: (novoChassi: string) => void;
}

export function ChassiOcrEditor({ vistoriaId, chassiOcrAtual, chassiCadastro, onSaved }: ChassiOcrEditorProps) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(chassiOcrAtual || '');
  const [salvando, setSalvando] = useState(false);

  const handleSave = async () => {
    setSalvando(true);
    try {
      const novoChassi = valor.trim().toUpperCase();
      const validacao = chassiCadastro
        ? (novoChassi === chassiCadastro.toUpperCase() ? 'ok' : 'divergente')
        : 'sem_referencia';

      const { error } = await supabase
        .from('vistorias')
        .update({
          chassi_ocr: novoChassi,
          chassi_validacao: validacao,
        })
        .eq('id', vistoriaId);

      if (error) throw error;
      toast.success('Chassi atualizado manualmente');
      onSaved?.(novoChassi);
      setEditing(false);
    } catch (e: any) {
      toast.error('Erro ao salvar chassi: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-3 pt-3 border-t">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="w-3 h-3 mr-2" />
          Editar chassi extraído manualmente
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <Label className="text-xs">Chassi (correção manual)</Label>
      <div className="flex gap-2">
        <Input
          value={valor}
          onChange={(e) => setValor(e.target.value.toUpperCase())}
          maxLength={17}
          placeholder="17 caracteres"
          className="font-mono uppercase"
        />
        <Button size="sm" onClick={handleSave} disabled={salvando || valor.length < 5}>
          <Save className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValor(chassiOcrAtual || ''); }}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

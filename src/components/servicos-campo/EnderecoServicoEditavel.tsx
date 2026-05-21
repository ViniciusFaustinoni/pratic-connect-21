import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, Pencil, X, Save } from 'lucide-react';

interface EnderecoFields {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface Props {
  servicoId: string;
  values: EnderecoFields;
  canEdit: boolean;
  mapsUrl?: string | null;
  localVistoria?: string | null;
}

export function EnderecoServicoEditavel({ servicoId, values, canEdit, mapsUrl, localVistoria }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EnderecoFields>(values);
  const qc = useQueryClient();

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        cep: form.cep?.trim() || null,
        logradouro: form.logradouro?.trim() || null,
        numero: form.numero?.trim() || null,
        complemento: form.complemento?.trim() || null,
        bairro: form.bairro?.trim() || null,
        cidade: form.cidade?.trim() || null,
        uf: form.uf?.trim()?.toUpperCase().slice(0, 2) || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('servicos').update(payload as any).eq('id', servicoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Endereço atualizado.');
      qc.invalidateQueries({ queryKey: ['servicos-campo-unificado'] });
      qc.invalidateQueries({ queryKey: ['servicos'] });
      qc.invalidateQueries({ queryKey: ['fila-servicos'] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Falha ao salvar endereço.'),
  });

  const cancelar = () => {
    setForm(values);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" /> Local do serviço
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Editar endereço
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReadField label="CEP" value={values.cep} mono />
          <ReadField label="Logradouro" value={values.logradouro} />
          <ReadField label="Número" value={values.numero} />
          <ReadField label="Complemento" value={values.complemento} />
          <ReadField label="Bairro" value={values.bairro} />
          <ReadField label="Cidade / UF" value={`${values.cidade || '—'} / ${values.uf || '—'}`} />
          {localVistoria && <ReadField label="Local da vistoria" value={localVistoria} />}
        </div>

        {mapsUrl && (
          <Button asChild size="sm" variant="secondary" className="gap-1.5">
            <a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin className="h-3.5 w-3.5" /> Abrir no Google Maps</a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-primary" /> Editando endereço
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={cancelar} disabled={salvar.isPending} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
          <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-1.5">
            {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <Field label="CEP" cls="col-span-2" value={form.cep || ''} onChange={(v) => setForm({ ...form, cep: v })} />
        <Field label="UF" cls="col-span-1" maxLength={2} value={form.uf || ''} onChange={(v) => setForm({ ...form, uf: v.toUpperCase() })} />
        <Field label="Cidade" cls="col-span-3" value={form.cidade || ''} onChange={(v) => setForm({ ...form, cidade: v })} />
        <Field label="Logradouro" cls="col-span-4" value={form.logradouro || ''} onChange={(v) => setForm({ ...form, logradouro: v })} />
        <Field label="Número" cls="col-span-2" value={form.numero || ''} onChange={(v) => setForm({ ...form, numero: v })} />
        <Field label="Bairro" cls="col-span-3" value={form.bairro || ''} onChange={(v) => setForm({ ...form, bairro: v })} />
        <Field label="Complemento" cls="col-span-3" value={form.complemento || ''} onChange={(v) => setForm({ ...form, complemento: v })} />
      </div>
    </div>
  );
}

function ReadField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-sm' : 'text-sm'}>{value || '—'}</div>
    </div>
  );
}

function Field({ label, value, onChange, cls, maxLength }: { label: string; value: string; onChange: (v: string) => void; cls?: string; maxLength?: number }) {
  return (
    <div className={cls}>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} />
    </div>
  );
}

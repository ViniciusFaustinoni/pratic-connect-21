import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  associadoId: string | null;
  nomeAssociado?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Campos = {
  nome: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  sexo: string;
  estado_civil: string;
  profissao: string;
  email: string;
  telefone: string;
  telefone_secundario: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cnh_numero: string;
  cnh_categoria: string;
  cnh_validade: string;
};

const EMPTY: Campos = {
  nome: '', cpf: '', rg: '', data_nascimento: '', sexo: '', estado_civil: '', profissao: '',
  email: '', telefone: '', telefone_secundario: '', whatsapp: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  cnh_numero: '', cnh_categoria: '', cnh_validade: '',
};

function norm(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function EditarDadosAssociadoDialog({ associadoId, nomeAssociado, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Campos>(EMPTY);
  const [original, setOriginal] = useState<Campos>(EMPTY);
  const [motivo, setMotivo] = useState('');

  const { data: associado, isLoading } = useQuery({
    enabled: open && !!associadoId,
    queryKey: ['associado-edicao', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('nome, cpf, rg, data_nascimento, sexo, estado_civil, profissao, email, telefone, telefone_secundario, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, uf, cnh_numero, cnh_categoria, cnh_validade')
        .eq('id', associadoId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (associado) {
      const f: Campos = {
        nome: norm(associado.nome),
        cpf: norm(associado.cpf),
        rg: norm(associado.rg),
        data_nascimento: norm(associado.data_nascimento),
        sexo: norm(associado.sexo),
        estado_civil: norm(associado.estado_civil),
        profissao: norm(associado.profissao),
        email: norm(associado.email),
        telefone: norm(associado.telefone),
        telefone_secundario: norm(associado.telefone_secundario),
        whatsapp: norm(associado.whatsapp),
        cep: norm(associado.cep),
        logradouro: norm(associado.logradouro),
        numero: norm(associado.numero),
        complemento: norm(associado.complemento),
        bairro: norm(associado.bairro),
        cidade: norm(associado.cidade),
        uf: norm(associado.uf),
        cnh_numero: norm(associado.cnh_numero),
        cnh_categoria: norm(associado.cnh_categoria),
        cnh_validade: norm(associado.cnh_validade),
      };
      setForm(f);
      setOriginal(f);
    }
  }, [associado]);

  useEffect(() => {
    if (!open) {
      setMotivo('');
      setForm(EMPTY);
      setOriginal(EMPTY);
    }
  }, [open]);

  const diffKeys = (Object.keys(form) as (keyof Campos)[]).filter((k) => form[k] !== original[k]);
  const hasChanges = diffKeys.length > 0;
  const motivoOk = motivo.trim().length >= 10;

  const mut = useMutation({
    mutationFn: async () => {
      const campos: Record<string, string | null> = {};
      diffKeys.forEach((k) => { campos[k] = form[k] === '' ? null : form[k]; });
      const { data, error } = await supabase.functions.invoke('editar-dados-associado', {
        body: { associado_id: associadoId, campos, motivo: motivo.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error === 'cpf_em_uso' ? 'CPF já usado por outro associado' : data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Dados atualizados', description: 'Alterações registradas no histórico do associado.' });
      qc.invalidateQueries({ queryKey: ['associados'] });
      qc.invalidateQueries({ queryKey: ['associado-detalhes'] });
      qc.invalidateQueries({ queryKey: ['associado-historico-completo', associadoId] });
      qc.invalidateQueries({ queryKey: ['associado-edicao', associadoId] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: 'Falha ao salvar', description: e.message, variant: 'destructive' });
    },
  });

  const set = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar dados cadastrais</DialogTitle>
          <DialogDescription>
            {nomeAssociado ? <>Associado: <strong>{nomeAssociado}</strong></> : 'Associado'}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Toda alteração é registrada no histórico do associado com autor, data/hora, valores antes/depois e motivo.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="identificacao">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                <TabsTrigger value="contato">Contato</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="cnh">CNH</TabsTrigger>
              </TabsList>

              <TabsContent value="identificacao" className="grid grid-cols-2 gap-3 pt-4">
                <Field label="Nome completo" colSpan={2}><Input value={form.nome} onChange={set('nome')} /></Field>
                <Field label="CPF"><Input value={form.cpf} onChange={set('cpf')} placeholder="11 dígitos" /></Field>
                <Field label="RG"><Input value={form.rg} onChange={set('rg')} /></Field>
                <Field label="Data de nascimento"><Input type="date" value={form.data_nascimento} onChange={set('data_nascimento')} /></Field>
                <Field label="Sexo"><Input value={form.sexo} onChange={set('sexo')} /></Field>
                <Field label="Estado civil"><Input value={form.estado_civil} onChange={set('estado_civil')} /></Field>
                <Field label="Profissão"><Input value={form.profissao} onChange={set('profissao')} /></Field>
              </TabsContent>

              <TabsContent value="contato" className="grid grid-cols-2 gap-3 pt-4">
                <Field label="E-mail" colSpan={2}><Input type="email" value={form.email} onChange={set('email')} /></Field>
                <Field label="Telefone"><Input value={form.telefone} onChange={set('telefone')} placeholder="DDD + número" /></Field>
                <Field label="Telefone secundário"><Input value={form.telefone_secundario} onChange={set('telefone_secundario')} /></Field>
                <Field label="WhatsApp" colSpan={2}><Input value={form.whatsapp} onChange={set('whatsapp')} /></Field>
              </TabsContent>

              <TabsContent value="endereco" className="grid grid-cols-6 gap-3 pt-4">
                <Field label="CEP" colSpan={2}><Input value={form.cep} onChange={set('cep')} /></Field>
                <Field label="Logradouro" colSpan={4}><Input value={form.logradouro} onChange={set('logradouro')} /></Field>
                <Field label="Número" colSpan={1}><Input value={form.numero} onChange={set('numero')} /></Field>
                <Field label="Complemento" colSpan={2}><Input value={form.complemento} onChange={set('complemento')} /></Field>
                <Field label="Bairro" colSpan={3}><Input value={form.bairro} onChange={set('bairro')} /></Field>
                <Field label="Cidade" colSpan={4}><Input value={form.cidade} onChange={set('cidade')} /></Field>
                <Field label="UF" colSpan={2}><Input value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))} /></Field>
              </TabsContent>

              <TabsContent value="cnh" className="grid grid-cols-3 gap-3 pt-4">
                <Field label="Número da CNH"><Input value={form.cnh_numero} onChange={set('cnh_numero')} /></Field>
                <Field label="Categoria"><Input value={form.cnh_categoria} onChange={set('cnh_categoria')} /></Field>
                <Field label="Validade"><Input type="date" value={form.cnh_validade} onChange={set('cnh_validade')} /></Field>
              </TabsContent>
            </Tabs>

            <div className="mt-6 space-y-2 border-t pt-4">
              <Label htmlFor="motivo">
                Motivo da alteração <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da edição (mínimo 10 caracteres)"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {hasChanges
                  ? `${diffKeys.length} campo(s) alterado(s): ${diffKeys.join(', ')}`
                  : 'Nenhum campo alterado ainda'}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Cancelar</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!hasChanges || !motivoOk || mut.isPending}
          >
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, colSpan = 1 }: { label: string; children: React.ReactNode; colSpan?: number }) {
  const cls = colSpan === 1 ? '' : `col-span-${colSpan}`;
  return (
    <div className={`space-y-1.5 ${cls}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

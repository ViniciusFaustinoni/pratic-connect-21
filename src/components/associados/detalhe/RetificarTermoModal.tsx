import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSignature, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useRetificarTermo, useRetificacoesContrato } from '@/hooks/useRetificarTermo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const schema = z.object({
  motivo: z.string().trim().min(10, 'Descreva o motivo (mínimo 10 caracteres)'),
  // associado
  nome: z.string().optional(),
  rg: z.string().optional(),
  data_nascimento: z.string().optional(),
  cnh_numero: z.string().optional(),
  cnh_categoria: z.string().optional(),
  cnh_validade: z.string().optional(),
  email: z.string().optional(),
  telefone: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // veículo
  placa: z.string().optional(),
  chassi: z.string().optional(),
  renavam: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  ano_fabricacao: z.coerce.number().optional(),
  ano_modelo: z.coerce.number().optional(),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  tipo_placa: z.string().optional(),
  // contrato
  veiculo_categoria: z.string().optional(),
  dia_vencimento: z.coerce.number().min(1).max(31).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  associado: any;
  contrato: any;
  veiculo: any;
}

export function RetificarTermoModal({ open, onOpenChange, associado, contrato, veiculo }: Props) {
  const { mutate: retificar, isPending } = useRetificarTermo();
  const { data: retificacoes } = useRetificacoesContrato(contrato?.id);
  const [aba, setAba] = useState<'editar' | 'historico'>('editar');

  const defaults: FormValues = useMemo(() => ({
    motivo: '',
    nome: associado?.nome ?? '',
    rg: associado?.rg ?? '',
    data_nascimento: associado?.data_nascimento ?? '',
    cnh_numero: associado?.cnh_numero ?? '',
    cnh_categoria: associado?.cnh_categoria ?? '',
    cnh_validade: associado?.cnh_validade ?? '',
    email: associado?.email ?? '',
    telefone: associado?.telefone ?? '',
    cep: associado?.cep ?? '',
    logradouro: associado?.logradouro ?? '',
    numero: associado?.numero ?? '',
    bairro: associado?.bairro ?? '',
    cidade: associado?.cidade ?? '',
    uf: associado?.uf ?? '',
    placa: veiculo?.placa ?? '',
    chassi: veiculo?.chassi ?? '',
    renavam: veiculo?.renavam ?? '',
    marca: veiculo?.marca ?? '',
    modelo: veiculo?.modelo ?? '',
    ano_fabricacao: veiculo?.ano_fabricacao ?? undefined,
    ano_modelo: veiculo?.ano_modelo ?? undefined,
    cor: veiculo?.cor ?? '',
    combustivel: veiculo?.combustivel ?? '',
    tipo_placa: veiculo?.tipo_placa ?? '',
    veiculo_categoria: contrato?.veiculo_categoria ?? '',
    dia_vencimento: contrato?.dia_vencimento ?? undefined,
  }), [associado, contrato, veiculo]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, associado?.id, contrato?.id, veiculo?.id]);


  const onSubmit = (v: FormValues) => {
    if (!contrato?.id) return;
    retificar({
      contrato_id: contrato.id,
      motivo: v.motivo,
      associado: {
        nome: v.nome, rg: v.rg, data_nascimento: v.data_nascimento || null,
        cnh_numero: v.cnh_numero, cnh_categoria: v.cnh_categoria,
        cnh_validade: v.cnh_validade || null,
        email: v.email, telefone: v.telefone,
        cep: v.cep, logradouro: v.logradouro, numero: v.numero,
        bairro: v.bairro, cidade: v.cidade, uf: v.uf,
      },
      veiculo: {
        placa: v.placa, chassi: v.chassi, renavam: v.renavam,
        marca: v.marca, modelo: v.modelo,
        ano_fabricacao: v.ano_fabricacao, ano_modelo: v.ano_modelo,
        cor: v.cor, combustivel: v.combustivel, tipo_placa: v.tipo_placa,
      },
      contrato: {
        veiculo_categoria: v.veiculo_categoria,
        dia_vencimento: v.dia_vencimento,
      },
    }, {
      onSuccess: () => {
        form.reset({ ...defaults, motivo: '' });
        setAba('historico');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Retificar Termo de Filiação
          </DialogTitle>
          <DialogDescription>
            Corrija os dados cadastrais e reemita o termo de filiação para assinatura.
            Cada retificação gera uma nova versão arquivada como documento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setAba('editar')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${aba === 'editar' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >Editar e reemitir</button>
          <button
            type="button"
            onClick={() => setAba('historico')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${aba === 'historico' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >Histórico ({retificacoes?.length ?? 0})</button>
        </div>

        <ScrollArea className="flex-1 pr-3">
          {aba === 'editar' && (
            <form id="retificar-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <div>
                <Label>Motivo da retificação *</Label>
                <Textarea
                  rows={3}
                  placeholder="Ex.: OCR leu RG incorreto; categoria do veículo veio como Particular mas é Táxi…"
                  {...form.register('motivo')}
                />
                {form.formState.errors.motivo && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.motivo.message}</p>
                )}
              </div>

              <Accordion type="multiple" defaultValue={['assoc', 'veic', 'contrato']}>
                <AccordionItem value="assoc">
                  <AccordionTrigger>Dados do associado</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nome" {...form.register('nome')} />
                      <Field label="RG" {...form.register('rg')} />
                      <Field label="Data de nascimento" type="date" {...form.register('data_nascimento')} />
                      <Field label="CNH (nº)" {...form.register('cnh_numero')} />
                      <Field label="CNH categoria" {...form.register('cnh_categoria')} />
                      <Field label="CNH validade" type="date" {...form.register('cnh_validade')} />
                      <Field label="E-mail" type="email" {...form.register('email')} />
                      <Field label="Telefone" {...form.register('telefone')} />
                      <Field label="CEP" {...form.register('cep')} />
                      <Field label="Logradouro" {...form.register('logradouro')} />
                      <Field label="Número" {...form.register('numero')} />
                      <Field label="Bairro" {...form.register('bairro')} />
                      <Field label="Cidade" {...form.register('cidade')} />
                      <Field label="UF" maxLength={2} {...form.register('uf')} />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="veic">
                  <AccordionTrigger>Veículo</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Placa" {...form.register('placa')} />
                      <Field label="Chassi" {...form.register('chassi')} />
                      <Field label="Renavam" {...form.register('renavam')} />
                      <Field label="Marca" {...form.register('marca')} />
                      <Field label="Modelo" {...form.register('modelo')} />
                      <Field label="Ano fabricação" type="number" {...form.register('ano_fabricacao')} />
                      <Field label="Ano modelo" type="number" {...form.register('ano_modelo')} />
                      <Field label="Cor" {...form.register('cor')} />
                      <Field label="Combustível" {...form.register('combustivel')} />
                      <div>
                        <Label>Tipo de placa</Label>
                        <Select
                          value={form.watch('tipo_placa') ?? ''}
                          onValueChange={(v) => form.setValue('tipo_placa', v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="particular">Particular</SelectItem>
                            <SelectItem value="taxi">Táxi</SelectItem>
                            <SelectItem value="aluguel">Aluguel</SelectItem>
                            <SelectItem value="leilao">Leilão</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contrato">
                  <AccordionTrigger>Contrato</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Categoria do veículo (contrato)</Label>
                        <Select
                          value={form.watch('veiculo_categoria') ?? ''}
                          onValueChange={(v) => form.setValue('veiculo_categoria', v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="particular">Particular</SelectItem>
                            <SelectItem value="taxi">Táxi</SelectItem>
                            <SelectItem value="aluguel">Aluguel</SelectItem>
                            <SelectItem value="aplicativo">Aplicativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Field label="Dia de vencimento" type="number" min={1} max={31} {...form.register('dia_vencimento')} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </form>
          )}

          {aba === 'historico' && (
            <div className="space-y-3 py-2">
              {(!retificacoes || retificacoes.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma retificação emitida para este contrato.
                </p>
              )}
              {retificacoes?.map((r: any) => (
                <div key={r.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">v{r.versao}</Badge>
                      <Badge variant={r.status === 'assinado' ? 'default' : r.status === 'erro' ? 'destructive' : 'secondary'}>
                        {r.status}
                      </Badge>
                      {r.status === 'assinado' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.created_at && format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm"><strong>Motivo:</strong> {r.motivo}</p>
                  {Array.isArray(r.campos_alterados) && r.campos_alterados.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Campos alterados: {r.campos_alterados.join(', ')}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {r.autentique_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={r.autentique_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> Link de assinatura
                        </a>
                      </Button>
                    )}
                    {r.pdf_assinado_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={r.pdf_assinado_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> PDF assinado
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Fechar
          </Button>
          {aba === 'editar' && (
            <Button type="submit" form="retificar-form" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar e enviar para assinatura
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label>{label}</Label>
      <Input {...rest} />
    </div>
  );
}

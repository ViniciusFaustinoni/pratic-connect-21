import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Server } from 'lucide-react';
import { useCreatePlataforma, useUpdatePlataforma, type PlataformaCompleta } from '@/hooks/usePlataformasCRUD';

const formSchema = z.object({
  plataforma: z.string()
    .min(2, 'Mínimo 2 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[a-z0-9_]+$/, 'Apenas letras minúsculas, números e underscore'),
  nome_exibicao: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  descricao: z.string().optional(),
  icone: z.string().optional(),
  ordem: z.coerce.number().min(0).max(999).optional(),
  api_url_sandbox: z.string().url('URL inválida').optional().or(z.literal('')),
  api_url_producao: z.string().url('URL inválida').optional().or(z.literal('')),
  auth_type: z.string().optional(),
  suporta_posicao_tempo_real: z.boolean().default(true),
  suporta_historico_trajeto: z.boolean().default(false),
  suporta_acionamento_roubo: z.boolean().default(false),
  suporta_bloqueio: z.boolean().default(false),
  suporta_webhooks: z.boolean().default(false),
  ativa: z.boolean().default(true),
  ambiente_atual: z.string().default('sandbox'),
});

type FormData = z.infer<typeof formSchema>;

interface PlataformaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plataforma?: PlataformaCompleta | null;
}

const ICONE_OPTIONS = [
  { value: 'server', label: 'Servidor' },
  { value: 'satellite', label: 'Satélite' },
  { value: 'truck', label: 'Caminhão' },
  { value: 'car', label: 'Carro' },
  { value: 'radio', label: 'Rádio' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'signal', label: 'Sinal' },
];

const AUTH_TYPE_OPTIONS = [
  { value: 'bearer_fixo', label: 'Bearer Token Fixo' },
  { value: 'oauth_jwt', label: 'OAuth JWT' },
  { value: 'api_key', label: 'API Key' },
  { value: 'basic', label: 'Basic Auth' },
];

export function PlataformaFormDialog({ open, onOpenChange, plataforma }: PlataformaFormDialogProps) {
  const isEditing = !!plataforma;
  const createMutation = useCreatePlataforma();
  const updateMutation = useUpdatePlataforma();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plataforma: '',
      nome_exibicao: '',
      descricao: '',
      icone: 'server',
      ordem: 0,
      api_url_sandbox: '',
      api_url_producao: '',
      auth_type: 'bearer_fixo',
      suporta_posicao_tempo_real: true,
      suporta_historico_trajeto: false,
      suporta_acionamento_roubo: false,
      suporta_bloqueio: false,
      suporta_webhooks: false,
      ativa: true,
      ambiente_atual: 'sandbox',
    },
  });

  useEffect(() => {
    if (plataforma) {
      form.reset({
        plataforma: plataforma.plataforma,
        nome_exibicao: plataforma.nome_exibicao,
        descricao: plataforma.descricao || '',
        icone: plataforma.icone || 'server',
        ordem: plataforma.ordem || 0,
        api_url_sandbox: plataforma.api_url_sandbox || '',
        api_url_producao: plataforma.api_url_producao || '',
        auth_type: plataforma.auth_type || 'bearer_fixo',
        suporta_posicao_tempo_real: plataforma.suporta_posicao_tempo_real ?? true,
        suporta_historico_trajeto: plataforma.suporta_historico_trajeto ?? false,
        suporta_acionamento_roubo: plataforma.suporta_acionamento_roubo ?? false,
        suporta_bloqueio: plataforma.suporta_bloqueio ?? false,
        suporta_webhooks: plataforma.suporta_webhooks ?? false,
        ativa: plataforma.ativa ?? true,
        ambiente_atual: plataforma.ambiente_atual || 'sandbox',
      });
    } else {
      form.reset({
        plataforma: '',
        nome_exibicao: '',
        descricao: '',
        icone: 'server',
        ordem: 0,
        api_url_sandbox: '',
        api_url_producao: '',
        auth_type: 'bearer_fixo',
        suporta_posicao_tempo_real: true,
        suporta_historico_trajeto: false,
        suporta_acionamento_roubo: false,
        suporta_bloqueio: false,
        suporta_webhooks: false,
        ativa: true,
        ambiente_atual: 'sandbox',
      });
    }
  }, [plataforma, form]);

  const onSubmit = async (data: FormData) => {
    const cleanedData = {
      plataforma: data.plataforma,
      nome_exibicao: data.nome_exibicao,
      descricao: data.descricao || undefined,
      icone: data.icone || undefined,
      ordem: data.ordem,
      api_url_sandbox: data.api_url_sandbox || undefined,
      api_url_producao: data.api_url_producao || undefined,
      auth_type: data.auth_type || undefined,
      suporta_posicao_tempo_real: data.suporta_posicao_tempo_real,
      suporta_historico_trajeto: data.suporta_historico_trajeto,
      suporta_acionamento_roubo: data.suporta_acionamento_roubo,
      suporta_bloqueio: data.suporta_bloqueio,
      suporta_webhooks: data.suporta_webhooks,
      ativa: data.ativa,
      ambiente_atual: data.ambiente_atual,
    };

    if (isEditing && plataforma) {
      await updateMutation.mutateAsync({ id: plataforma.id, ...cleanedData });
    } else {
      await createMutation.mutateAsync(cleanedData);
    }
    handleClose();
  };

  const handleClose = () => {
    if (!isPending) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {isEditing ? 'Editar Plataforma' : 'Nova Plataforma'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações da plataforma de rastreamento.'
              : 'Configure uma nova plataforma de rastreamento.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Informações Básicas</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plataforma"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ex: nova_plataforma"
                          {...field}
                          disabled={isEditing}
                        />
                      </FormControl>
                      <FormDescription>Identificador único (sem espaços)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nome_exibicao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de Exibição *</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: Nova Plataforma GPS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="icone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ícone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um ícone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ICONE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ordem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ordem</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={999} {...field} />
                      </FormControl>
                      <FormDescription>Ordem de exibição</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descrição da plataforma..."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Configuração de API */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Configuração de API</h4>

              <FormField
                control={form.control}
                name="auth_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Autenticação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AUTH_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="api_url_sandbox"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL API Sandbox</FormLabel>
                      <FormControl>
                        <Input placeholder="https://sandbox.api.exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="api_url_producao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL API Produção</FormLabel>
                      <FormControl>
                        <Input placeholder="https://api.exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="ambiente_atual"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambiente Ativo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="producao">Produção</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Funcionalidades */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Funcionalidades Suportadas</h4>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="suporta_posicao_tempo_real"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Posição em Tempo Real</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="suporta_historico_trajeto"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Histórico de Trajeto</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="suporta_bloqueio"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Bloqueio de Veículo</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="suporta_acionamento_roubo"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Acionamento de Roubo</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="suporta_webhooks"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Webhooks</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="ativa"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Plataforma Ativa</FormLabel>
                      <FormDescription>
                        Plataformas inativas não aparecem nos formulários
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : isEditing ? (
                  'Salvar Alterações'
                ) : (
                  'Criar Plataforma'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

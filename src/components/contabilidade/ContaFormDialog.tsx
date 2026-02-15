import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PlanoContas, useCriarConta, useAtualizarConta } from '@/hooks/useContabilidade';

const formSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  tipo: z.enum(['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa']),
  natureza: z.enum(['devedora', 'credora']),
  nivel: z.number().min(1).max(5),
  sintetica: z.boolean(),
  aceita_lancamento: z.boolean(),
  ativa: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface ContaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta?: PlanoContas | null;
  contaPai?: PlanoContas | null;
}

export function ContaFormDialog({
  open,
  onOpenChange,
  conta,
  contaPai,
}: ContaFormDialogProps) {
  const criarConta = useCriarConta();
  const atualizarConta = useAtualizarConta();
  const isEditing = !!conta;

  const defaultNivel = contaPai ? contaPai.nivel + 1 : 1;
  const defaultCodigo = contaPai ? `${contaPai.codigo}.` : '';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: conta
      ? {
          codigo: conta.codigo,
          descricao: conta.descricao,
          tipo: conta.tipo,
          natureza: conta.natureza,
          nivel: conta.nivel,
          sintetica: conta.sintetica,
          aceita_lancamento: conta.aceita_lancamento,
          ativa: conta.ativa,
        }
      : {
          codigo: defaultCodigo,
          descricao: '',
          tipo: contaPai?.tipo || 'despesa',
          natureza: contaPai?.natureza || 'devedora',
          nivel: defaultNivel,
          sintetica: false,
          aceita_lancamento: true,
          ativa: true,
        },
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing) {
        await atualizarConta.mutateAsync({ id: conta.id, ...data });
      } else {
        await criarConta.mutateAsync({
          ...data,
          conta_pai_id: contaPai?.id || null,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = criarConta.isPending || atualizarConta.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Conta' : 'Nova Conta'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {contaPai && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <span className="text-muted-foreground">Conta Pai: </span>
                <span className="font-medium">{contaPai.codigo} - {contaPai.descricao}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1.1.01.001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nivel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            Nível {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Input {...field} placeholder="Nome da conta" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="passivo">Passivo</SelectItem>
                        <SelectItem value="patrimonio_liquido">Patrimônio Social</SelectItem>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="natureza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Natureza</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="devedora">Devedora</SelectItem>
                        <SelectItem value="credora">Credora</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-wrap gap-6">
              <FormField
                control={form.control}
                name="sintetica"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Conta Sintética</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aceita_lancamento"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Aceita Lançamento</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ativa"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Ativa</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Package, Loader2 } from "lucide-react";

const formSchema = z.object({
  quantidade: z.coerce
    .number()
    .min(1, "Mínimo 1 unidade")
    .max(100, "Máximo 100 unidades por entrada"),
  plataforma: z.string().min(1, "Selecione uma plataforma"),
  nota_fiscal: z.string().optional(),
  fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EntradaEstoqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLATAFORMAS = [
  { value: "rede_veiculos", label: "Rede Veículos" },
  { value: "sascar", label: "Sascar" },
  { value: "autotrac", label: "Autotrac" },
  { value: "onixsat", label: "Onixsat" },
  { value: "outro", label: "Outro" },
];

export function EntradaEstoqueDialog({ open, onOpenChange }: EntradaEstoqueDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantidade: 1,
      plataforma: "rede_veiculos",
      nota_fiscal: "",
      fornecedor: "",
      observacoes: "",
    },
  });

  const gerarCodigoRastreador = (index: number): string => {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const dia = String(agora.getDate()).padStart(2, "0");
    const hora = String(agora.getHours()).padStart(2, "0");
    const min = String(agora.getMinutes()).padStart(2, "0");
    const seg = String(agora.getSeconds()).padStart(2, "0");
    const seq = String(index + 1).padStart(3, "0");
    const random = String(Math.floor(Math.random() * 100)).padStart(2, "0");

    return `RAT-${ano}${mes}${dia}-${hora}${min}${seg}${seq}${random}`;
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const rastreadores = [];
      for (let i = 0; i < data.quantidade; i++) {
        rastreadores.push({
          codigo: gerarCodigoRastreador(i),
          plataforma: data.plataforma,
          status: "estoque" as const,
        });
      }

      const { data: rastreadoresCriados, error: errorRast } = await supabase
        .from("rastreadores")
        .insert(rastreadores)
        .select();

      if (errorRast) throw errorRast;

      const movimentacoes = (rastreadoresCriados || []).map((rastreador) => ({
        rastreador_id: rastreador.id,
        tipo: "entrada",
        quantidade: 1,
        status_novo: "estoque",
        nota_fiscal: data.nota_fiscal || null,
        fornecedor: data.fornecedor || null,
        observacoes: data.observacoes || null,
        usuario_id: user?.id || null,
      }));

      const { error: errorMov } = await supabase
        .from("estoque_movimentacoes")
        .insert(movimentacoes);

      if (errorMov) throw errorMov;

      return rastreadoresCriados;
    },
    onSuccess: (data) => {
      const qtd = data?.length || 0;
      toast.success(
        `${qtd} rastreador${qtd > 1 ? "es" : ""} adicionado${qtd > 1 ? "s" : ""} ao estoque!`
      );

      queryClient.invalidateQueries({ queryKey: ["rastreadores"] });
      queryClient.invalidateQueries({ queryKey: ["rastreadores-metricas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });

      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar entrada:", error);
      toast.error("Erro ao registrar entrada: " + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const handleClose = () => {
    if (!mutation.isPending) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Entrada de Estoque
          </DialogTitle>
          <DialogDescription>
            Registre a entrada de novos rastreadores no estoque.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade de rastreadores *</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100} {...field} />
                  </FormControl>
                  <FormDescription>
                    Informe quantos rastreadores estão entrando (máx. 100)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="plataforma"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a plataforma" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PLATAFORMAS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
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
              name="nota_fiscal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota Fiscal</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: NF-123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fornecedor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do fornecedor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações adicionais..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Registrar Entrada
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

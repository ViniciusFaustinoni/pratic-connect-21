import { Calendar, CheckCircle2, Loader2, UserCheck } from 'lucide-react';
import type { Control } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Vendedor } from '@/hooks/useVendedores';
import type { CotacaoFormData } from '@/lib/validations';

export interface SectionComercialProps {
  control: Control<CotacaoFormData>;
  podeAtribuirVendedor: boolean;
  vendedores: Vendedor[];
  vendedoresLoading: boolean;
  diaVencimento: number | null;
  setDiaVencimento: (v: number) => void;
  opcoesVencimento: readonly number[] | number[];
}

export function SectionComercial({
  control,
  podeAtribuirVendedor,
  vendedores,
  vendedoresLoading,
  diaVencimento,
  setDiaVencimento,
  opcoesVencimento,
}: SectionComercialProps) {
  return (
    <>
      {/* Consultor Responsável */}
      {podeAtribuirVendedor && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Consultor Responsável
          </h3>

          <FormField
            control={control}
            name="vendedor_id"
            render={({ field }) => (
              <FormItem>
                <Select
                  onValueChange={(value) => field.onChange(value === '_none' ? null : value)}
                  value={field.value || '_none'}
                  disabled={vendedoresLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      {vendedoresLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SelectValue placeholder="Selecione um consultor" />
                      )}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none">Não atribuído</SelectItem>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.user_id}>
                        {v.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {podeAtribuirVendedor && <Separator />}

      {/* Data de Vencimento */}
      <div id="bloco-dia-vencimento" className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Data de Vencimento <span className="text-destructive">*</span>
        </h3>

        <p className="text-xs text-muted-foreground">
          Selecione o dia de vencimento das mensalidades
        </p>

        <div className={cn("grid gap-3", opcoesVencimento.length > 2 ? "grid-cols-3" : "grid-cols-2")}>
          {opcoesVencimento.map((dia) => (
            <div
              key={dia}
              onClick={() => setDiaVencimento(dia)}
              className={cn(
                "relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md text-center",
                diaVencimento === dia
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
            >
              <p className={cn(
                "text-2xl font-bold",
                diaVencimento === dia && "text-primary"
              )}>
                {String(dia).padStart(2, '0')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Todo dia {dia}
              </p>
              {diaVencimento === dia && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

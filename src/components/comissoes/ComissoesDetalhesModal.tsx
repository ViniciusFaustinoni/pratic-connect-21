import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ComissaoDashboardItem } from '@/hooks/useComissoesDashboard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: ComissaoDashboardItem[];
}

const formatMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const initials = (name: string) =>
  name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();

export function ComissoesDetalhesModal({ open, onOpenChange, title, items }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{items.length} lançamento(s) encontrados no período selecionado.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma comissão encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={item.usuario_avatar_url || undefined} />
                          <AvatarFallback>{initials(item.usuario_nome)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.usuario_nome}</p>
                          {item.usuario_email && <p className="text-xs text-muted-foreground truncate">{item.usuario_email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.nivel_nome || '—'}</TableCell>
                    <TableCell>{item.parcela_numero ? `${item.parcela_numero}ª` : '—'}</TableCell>
                    <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                    <TableCell className="text-right">{formatMoney(item.valor_base)}</TableCell>
                    <TableCell className="text-right">{Number(item.percentual_aplicado || 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(item.valor_total ?? item.valor_comissao)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

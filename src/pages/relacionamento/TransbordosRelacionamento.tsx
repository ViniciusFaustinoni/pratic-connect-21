import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/UserAvatar';
import { ArrowRightLeft, Search, BotOff } from 'lucide-react';
import { useTransbordosAtivos, type TransbordoAtivo } from '@/hooks/useTransbordosAtivos';

const MOTIVO_LABEL: Record<string, { label: string; tone: string }> = {
  transbordo_boleto: { label: 'Boleto vencido', tone: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' },
  transbordo_humano: { label: 'Solicitação do associado', tone: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' },
  intervencao_humana: { label: 'Intervenção humana', tone: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' },
};

function formatarTelefone(tel: string) {
  const d = tel.replace(/\D/g, '');
  const n = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return tel;
}

export default function TransbordosRelacionamento() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [motivo, setMotivo] = useState<string>('todos');

  const { data, isLoading } = useTransbordosAtivos();

  const filtradas = useMemo(() => {
    let arr = data ?? [];
    if (motivo !== 'todos') arr = arr.filter((t) => t.motivo === motivo);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      arr = arr.filter((t) =>
        (t.nome || '').toLowerCase().includes(q) ||
        (qDigits && t.telefone.includes(qDigits))
      );
    }
    return arr;
  }, [data, motivo, busca]);

  const abrirConversa = (t: TransbordoAtivo) => {
    navigate(`/eventos/chat-ia?telefone=${encodeURIComponent(t.telefone)}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ArrowRightLeft className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Transbordo</h1>
          <p className="text-sm text-muted-foreground">
            Atendimentos que a IA transferiu para humano. Clique numa linha para abrir a conversa e concluir o atendimento.
          </p>
        </div>
      </div>

      <Card className="p-3 md:p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={motivo} onValueChange={setMotivo}>
            <SelectTrigger className="w-full md:w-[240px]">
              <SelectValue placeholder="Motivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os motivos</SelectItem>
              <SelectItem value="transbordo_boleto">Boleto vencido</SelectItem>
              <SelectItem value="transbordo_humano">Solicitação do associado</SelectItem>
              <SelectItem value="intervencao_humana">Intervenção humana</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Associado</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Iniciado</TableHead>
              <TableHead>Aguardando</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <BotOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum transbordo ativo.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((t) => {
                const cfg = MOTIVO_LABEL[t.motivo] ?? { label: t.motivo, tone: 'bg-muted text-foreground' };
                return (
                  <TableRow
                    key={t.telefone}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => abrirConversa(t)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar src={t.avatar_url} name={t.nome} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.nome || 'Contato desconhecido'}</p>
                          {!t.nome && (
                            <p className="text-xs text-muted-foreground">Sem vínculo de associado</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatarTelefone(t.telefone)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cfg.tone}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(t.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNowStrict(new Date(t.created_at), { locale: ptBR, addSuffix: false })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

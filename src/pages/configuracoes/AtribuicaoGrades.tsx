import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pencil, Search, Users2, AlertCircle } from 'lucide-react';
import { useAtribuicoesComissao } from '@/hooks/useAtribuicaoComissoes';
import { AtribuirGradeModal } from '@/components/comissoes/AtribuirGradeModal';
import type { AtribuicaoLinha } from '@/types/atribuicaoComissao';

const ROLE_LABEL: Record<string, string> = {
  vendedor_clt: 'Vendedor CLT',
  vendedor_externo: 'Vendedor Externo',
  agencia: 'Agência',
  supervisor_vendas: 'Supervisor',
  gerente_comercial: 'Gerente',
};

const ROLE_BADGE: Record<string, string> = {
  vendedor_clt: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  vendedor_externo: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  agencia: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  supervisor_vendas: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  gerente_comercial: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

interface AtribuicaoGradesProps {
  gradesPath?: string;
}

export default function AtribuicaoGrades({ gradesPath = '/configuracoes/grades-comissao' }: AtribuicaoGradesProps) {
  const navigate = useNavigate();
  const { data: atribuicoes = [], isLoading } = useAtribuicoesComissao();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [editing, setEditing] = useState<AtribuicaoLinha | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const usuariosMap = useMemo(() => {
    const m = new Map<string, AtribuicaoLinha>();
    atribuicoes.forEach((a) => m.set(a.usuario.id, a));
    return m;
  }, [atribuicoes]);

  const filtered = useMemo(() => {
    return atribuicoes.filter((a) => {
      const matchSearch =
        !search ||
        a.usuario.nome.toLowerCase().includes(search.toLowerCase()) ||
        a.usuario.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'todos' || a.usuario.roles.includes(roleFilter);
      const matchStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'sem_grade' && !a.gradeAtual) ||
        (statusFilter === 'com_grade' && !!a.gradeAtual);
      return matchSearch && matchRole && matchStatus;
    });
  }, [atribuicoes, search, roleFilter, statusFilter]);

  const totalSemGrade = atribuicoes.filter((a) => !a.gradeAtual).length;

  const handleEdit = (linha: AtribuicaoLinha) => {
    setEditing(linha);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Atribuição de Grades & Hierarquia</h2>
          <p className="text-sm text-muted-foreground">
            Atribua uma grade ao usuário e defina a cadeia hierárquica. A grade aplicada ao vendedor define as comissões de vendedor, supervisor, gerente e agência conforme o plano vendido.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(gradesPath)}>
          Configurar regras das grades
        </Button>
      </div>

      {totalSemGrade > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="h-4 w-4 text-warning" />
            <p className="text-sm">
              <strong>{totalSemGrade}</strong> usuário(s) ainda sem grade atribuída — não receberão
              comissão até serem vinculados.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users2 className="h-4 w-4" /> Usuários da equipe de vendas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email"
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                {Object.entries(ROLE_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="com_grade">Com grade</SelectItem>
                <SelectItem value="sem_grade">Sem grade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Grade aplicada às vendas</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Gerente</TableHead>
                  <TableHead>Agência</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((linha) => {
                    const u = linha.usuario;
                    const initials = u.nome
                      .split(' ')
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join('')
                      .toUpperCase();
                    const sup = linha.hierarquia?.supervisor_id
                      ? usuariosMap.get(linha.hierarquia.supervisor_id)?.usuario.nome
                      : null;
                    const ger = linha.hierarquia?.gerente_id
                      ? usuariosMap.get(linha.hierarquia.gerente_id)?.usuario.nome
                      : null;
                    const ag = linha.hierarquia?.agencia_id
                      ? usuariosMap.get(linha.hierarquia.agencia_id)?.usuario.nome
                      : null;

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.avatar_url || undefined} />
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{u.nome}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles
                              .filter((r) => ROLE_LABEL[r])
                              .map((r) => (
                                <Badge
                                  key={r}
                                  variant="secondary"
                                  className={ROLE_BADGE[r] || ''}
                                >
                                  {ROLE_LABEL[r] || r}
                                </Badge>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {linha.gradeAtual?.grade ? (
                            <Badge variant="outline" className="font-normal">
                              {linha.gradeAtual.grade.nome}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sup || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ger || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ag || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(linha)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AtribuirGradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        linha={editing}
      />
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Users, Search, Edit, Hash, Phone, Mail, UserCheck, UserX, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConsultorEditSheet } from '@/components/consultores/ConsultorEditSheet';
import { useConsultores, type Consultor } from '@/hooks/useConsultores';
import { useNavigate } from 'react-router-dom';

// ROLE_LABELS removido — usando useAppRoles().getRoleLabel() via ConsultorEditSheet
// Labels curtos locais para badges compactos da tabela
const ROLE_SHORT_LABELS: Record<string, string> = {
  vendedor_clt: 'CLT',
  vendedor_externo: 'Externo',
  supervisor_vendas: 'Supervisor',
  gerente_comercial: 'Gerente',
};

const ROLE_COLORS: Record<string, string> = {
  vendedor_clt: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  vendedor_externo: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  supervisor_vendas: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  gerente_comercial: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export default function Consultores() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedConsultor, setSelectedConsultor] = useState<Consultor | null>(null);
  
  const { data: consultores, isLoading } = useConsultores();

  // Filtrar consultores
  const filteredConsultores = useMemo(() => {
    let result = consultores || [];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.nome.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      );
    }
    
    if (roleFilter !== 'all') {
      result = result.filter(c => c.roles.includes(roleFilter));
    }
    
    return result;
  }, [consultores, searchTerm, roleFilter]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Estatísticas
  const stats = useMemo(() => {
    const all = consultores || [];
    return {
      total: all.length,
      ativos: all.filter(c => c.ativo).length,
      comCodigo: all.filter(c => c.codigo_sga_voluntario).length,
    };
  }, [consultores]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/vendas/equipe-comercial')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Consultores
            </h1>
            <p className="text-muted-foreground">
              Gerencie os códigos SGA dos consultores
            </p>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Consultores</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ativos</CardDescription>
            <CardTitle className="text-3xl text-emerald-600 dark:text-emerald-400">{stats.ativos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Com Código SGA</CardDescription>
            <CardTitle className="text-3xl text-primary">{stats.comCodigo}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            <SelectItem value="vendedor_clt">Vendedor CLT</SelectItem>
            <SelectItem value="vendedor_externo">Vendedor Externo</SelectItem>
            <SelectItem value="supervisor_vendas">Supervisor</SelectItem>
            <SelectItem value="gerente_comercial">Gerente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredConsultores.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum consultor encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm || roleFilter !== 'all'
                  ? 'Tente ajustar os filtros'
                  : 'Cadastre vendedores para visualizar aqui'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Consultor</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-center">Código SGA</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConsultores.map((consultor) => (
                  <TableRow key={consultor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={consultor.avatar_url || ''} alt={consultor.nome} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(consultor.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{consultor.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {consultor.roles.map(role => (
                          <Badge 
                            key={role} 
                            variant="secondary"
                            className={ROLE_COLORS[role] || ''}
                          >
                            {ROLE_LABELS[role] || role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {consultor.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{consultor.email}</span>
                          </div>
                        )}
                        {consultor.telefone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{consultor.telefone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {consultor.codigo_sga_voluntario ? (
                        <Badge variant="outline" className="gap-1 font-mono">
                          <Hash className="h-3 w-3" />
                          {consultor.codigo_sga_voluntario}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {consultor.total_leads}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {consultor.ativo ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <UserX className="h-3 w-3 mr-1" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedConsultor(consultor)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sheet de Edição */}
      <ConsultorEditSheet
        consultor={selectedConsultor}
        open={!!selectedConsultor}
        onClose={() => setSelectedConsultor(null)}
      />
    </div>
  );
}

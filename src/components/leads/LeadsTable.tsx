import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  MoreHorizontal,
  MessageCircle,
  Eye,
  Trash2,
  Calculator,
  ArrowUpDown,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeadsEmptyState } from './LeadsEmptyState';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import { cn } from '@/lib/utils';

// Status colors
const STATUS_COLORS: Record<string, string> = {
  novo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contato: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  qualificado: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cotacao_enviada: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  negociacao: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  ganho: 'bg-green-500/20 text-green-400 border-green-500/30',
  perdido: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ORIGEM_COLORS: Record<string, string> = {
  site: 'bg-blue-500/10 text-blue-400',
  telefone: 'bg-green-500/10 text-green-400',
  whatsapp: 'bg-emerald-500/10 text-emerald-400',
  indicacao: 'bg-purple-500/10 text-purple-400',
  instagram: 'bg-pink-500/10 text-pink-400',
  facebook: 'bg-indigo-500/10 text-indigo-400',
  evento: 'bg-orange-500/10 text-orange-400',
  parceiro: 'bg-cyan-500/10 text-cyan-400',
  outro: 'bg-gray-500/10 text-gray-400',
};

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  origem: string;
  etapa: string;
  created_at: string;
  vendedor?: {
    nome: string;
  } | null;
}

interface LeadsTableProps {
  leads: Lead[];
  isLoading?: boolean;
  onSelectLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onNewLead?: () => void;
}

export function LeadsTable({
  leads,
  isLoading,
  onSelectLead,
  onDeleteLead,
  onNewLead,
}: LeadsTableProps) {
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedLeads = [...leads].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case 'nome':
        comparison = a.nome.localeCompare(b.nome);
        break;
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      default:
        comparison = 0;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando leads...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return <LeadsEmptyState onNewLead={onNewLead} />;
  }

  return (
    <ScrollArea className="h-[calc(100dvh-340px)]">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow className="hover:bg-transparent border-border">
            <TableHead
              className="w-[220px] cursor-pointer group"
              onClick={() => handleSort('nome')}
            >
              <div className="flex items-center gap-2">
                Nome
                <ArrowUpDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-colors',
                    sortColumn === 'nome' && 'text-foreground'
                  )}
                />
              </div>
            </TableHead>
            <TableHead className="w-[180px]">Telefone</TableHead>
            <TableHead className="w-[120px]">Origem</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[120px]">Responsável</TableHead>
            <TableHead
              className="w-[100px] cursor-pointer"
              onClick={() => handleSort('created_at')}
            >
              <div className="flex items-center gap-2">
                Data
                <ArrowUpDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-colors',
                    sortColumn === 'created_at' && 'text-foreground'
                  )}
                />
              </div>
            </TableHead>
            <TableHead className="w-[80px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLeads.map((lead) => (
            <TableRow
              key={lead.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onSelectLead(lead)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex items-center justify-center h-9 w-9 rounded-full text-sm font-semibold flex-shrink-0',
                      'bg-primary/10 text-primary'
                    )}
                  >
                    {lead.nome.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{lead.nome}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{formatPhone(lead.telefone)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                    onClick={(e) => handleWhatsApp(e, lead.telefone)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('font-normal', ORIGEM_COLORS[lead.origem])}
                >
                  {ORIGEM_LABELS[lead.origem as keyof typeof ORIGEM_LABELS] || lead.origem}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('font-normal', STATUS_COLORS[lead.etapa])}
                >
                  {ETAPA_LABELS[lead.etapa as EtapaLead] || lead.etapa}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {lead.vendedor?.nome || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(lead.created_at), 'dd/MM/yy', { locale: ptBR })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open quote
                    }}
                  >
                    <Calculator className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelectLead(lead)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLead(lead.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

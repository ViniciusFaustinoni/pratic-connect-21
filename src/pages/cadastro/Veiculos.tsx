import { useState } from 'react';
import { Search, Car, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const mockVeiculos = [
  {
    id: '1',
    placa: 'ABC-1234',
    marca: 'Honda',
    modelo: 'Civic',
    ano_fabricacao: 2022,
    ano_modelo: 2022,
    cor: 'Preto',
    valor_fipe: 95000,
    associado_nome: 'João Silva',
    ativo: true,
  },
  {
    id: '2',
    placa: 'DEF-5678',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano_fabricacao: 2021,
    ano_modelo: 2021,
    cor: 'Prata',
    valor_fipe: 105000,
    associado_nome: 'Maria Santos',
    ativo: true,
  },
  {
    id: '3',
    placa: 'GHI-9012',
    marca: 'Toyota',
    modelo: 'Yaris',
    ano_fabricacao: 2020,
    ano_modelo: 2020,
    cor: 'Branco',
    valor_fipe: 72000,
    associado_nome: 'Maria Santos',
    ativo: true,
  },
  {
    id: '4',
    placa: 'JKL-3456',
    marca: 'Hyundai',
    modelo: 'HB20',
    ano_fabricacao: 2023,
    ano_modelo: 2023,
    cor: 'Vermelho',
    valor_fipe: 75000,
    associado_nome: 'Pedro Oliveira',
    ativo: true,
  },
  {
    id: '5',
    placa: 'MNO-7890',
    marca: 'Chevrolet',
    modelo: 'Onix',
    ano_fabricacao: 2022,
    ano_modelo: 2022,
    cor: 'Cinza',
    valor_fipe: 68000,
    associado_nome: 'Ana Costa',
    ativo: false,
  },
];

export default function Veiculos() {
  const [search, setSearch] = useState('');

  const filteredVeiculos = mockVeiculos.filter((veiculo) => {
    return (
      veiculo.placa.toLowerCase().includes(search.toLowerCase()) ||
      veiculo.marca.toLowerCase().includes(search.toLowerCase()) ||
      veiculo.modelo.toLowerCase().includes(search.toLowerCase()) ||
      veiculo.associado_nome.toLowerCase().includes(search.toLowerCase())
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Stats
  const stats = {
    total: mockVeiculos.length,
    ativos: mockVeiculos.filter((v) => v.ativo).length,
    valorTotal: mockVeiculos.filter((v) => v.ativo).reduce((acc, v) => acc + v.valor_fipe, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Veículos</h1>
        <p className="text-muted-foreground">
          Visualize todos os veículos protegidos
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de Veículos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Car className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ativos}</p>
                <p className="text-xs text-muted-foreground">Veículos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <Car className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">Valor FIPE Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, marca, modelo ou associado..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Veículo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Valor FIPE</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVeiculos.map((veiculo) => (
                <TableRow key={veiculo.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Car className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{veiculo.marca}</p>
                        <p className="text-sm text-muted-foreground">{veiculo.modelo}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{veiculo.placa}</TableCell>
                  <TableCell>
                    {veiculo.ano_fabricacao}/{veiculo.ano_modelo}
                  </TableCell>
                  <TableCell>{veiculo.cor}</TableCell>
                  <TableCell>{formatCurrency(veiculo.valor_fipe)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {veiculo.associado_nome}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={veiculo.ativo ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}>
                      {veiculo.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

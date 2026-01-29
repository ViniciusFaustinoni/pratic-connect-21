import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Search, Image, FileText, Video, Download,
  FolderOpen, Trash2, Copy, ExternalLink
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { UploadMaterialModal } from '@/components/marketing/UploadMaterialModal';

interface Material {
  id: string;
  nome: string;
  tipo: string;
  arquivo_url?: string;
  thumbnail_url?: string;
  largura?: number;
  altura?: number;
  formato?: string;
  campanha_id?: string;
  campanha?: { id: string; nome: string } | null;
  downloads: number;
  status: string;
  created_at: string;
}

const tipoIcons: Record<string, any> = {
  imagem: Image,
  video: Video,
  documento: FileText,
};

const tipoLabels: Record<string, string> = {
  imagem: 'Imagem',
  video: 'Vídeo',
  documento: 'Documento',
  banner: 'Banner',
  post: 'Post Social',
  outro: 'Outro',
};

export default function Materiais() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [showUpload, setShowUpload] = useState(false);

  const queryClient = useQueryClient();

  const { data: materiais, isLoading } = useQuery({
    queryKey: ['materiais-marketing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materiais_marketing')
        .select('*, campanha:campanhas(id, nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Material[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('materiais_marketing')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiais-marketing'] });
      toast.success('Material excluído!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  const filteredMateriais = materiais?.filter(m => {
    const matchSearch = m.nome.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || m.tipo === tipoFilter;
    return matchSearch && matchTipo;
  });

  // Contadores por tipo
  const countByTipo = (tipo: string) => 
    materiais?.filter(m => m.tipo === tipo).length || 0;

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  const handleDownload = (url: string, nome: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.target = '_blank';
    link.click();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materiais e Criativos</h1>
          <p className="text-muted-foreground">
            Biblioteca centralizada de materiais de marketing
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Material
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materiais?.length || 0}</div>
            <p className="text-xs text-muted-foreground">materiais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Imagens</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByTipo('imagem')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vídeos</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByTipo('video')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByTipo('documento')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs por tipo */}
      <Tabs value={tipoFilter} onValueChange={setTipoFilter}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="imagem">Imagens</TabsTrigger>
          <TabsTrigger value="video">Vídeos</TabsTrigger>
          <TabsTrigger value="documento">Documentos</TabsTrigger>
          <TabsTrigger value="banner">Banners</TabsTrigger>
          <TabsTrigger value="post">Posts</TabsTrigger>
        </TabsList>

        <TabsContent value={tipoFilter} className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : filteredMateriais?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">Nenhum material encontrado</p>
                <p className="text-muted-foreground">
                  Faça upload do seu primeiro material
                </p>
                <Button className="mt-4" onClick={() => setShowUpload(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Material
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredMateriais?.map(material => {
                const Icon = tipoIcons[material.tipo] || FileText;
                return (
                  <Card key={material.id} className="overflow-hidden hover:shadow-md transition-all">
                    {/* Thumbnail */}
                    <div className="h-32 bg-muted flex items-center justify-center relative group">
                      {material.thumbnail_url || material.arquivo_url ? (
                        material.tipo === 'imagem' ? (
                          <img 
                            src={material.thumbnail_url || material.arquivo_url} 
                            alt={material.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon className="h-12 w-12 text-muted-foreground" />
                        )
                      ) : (
                        <Icon className="h-12 w-12 text-muted-foreground" />
                      )}
                      
                      {/* Overlay de ações */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {material.arquivo_url && (
                          <>
                            <Button 
                              size="icon" 
                              variant="secondary"
                              onClick={() => window.open(material.arquivo_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="secondary"
                              onClick={() => handleCopyUrl(material.arquivo_url!)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="secondary"
                              onClick={() => handleDownload(material.arquivo_url!, material.nome)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button 
                          size="icon" 
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(material.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <CardContent className="p-3">
                      <p className="font-medium text-sm line-clamp-1">{material.nome}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-xs">
                          {tipoLabels[material.tipo] || material.tipo}
                        </Badge>
                        {material.largura && material.altura && (
                          <span className="text-xs text-muted-foreground">
                            {material.largura}x{material.altura}
                          </span>
                        )}
                      </div>
                      {material.campanha && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {material.campanha.nome}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <UploadMaterialModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
      />
    </div>
  );
}

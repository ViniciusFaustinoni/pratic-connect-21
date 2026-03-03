-- Delete the 2 orphaned cotacoes that have no dependencies
DELETE FROM cotacoes WHERE id IN (
  'd1747122-5aef-4b49-850e-65c506c91257',
  'b42c0337-b488-4eb8-8a68-1782e45bb33d'
);
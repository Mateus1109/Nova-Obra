-- 0005 · Relatório de visita passa a ter 3 tipos: visita a cliente, novo cliente e aquisição de nova obra
alter type public.tipo_relatorio add value if not exists 'novo_cliente' before 'aquisicao';

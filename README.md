# consulta-pediatrica-rapida
Apoio durante consulta em pronto atendimento 

## Publicação
Os workflows do GitHub Pages publicam a branch `principal`, automaticamente no push ou manualmente. Eles preparam `dist/` apenas com os arquivos públicos do site, incluindo `pedwb/`, sem publicar testes, configurações ou documentos de edição.

Antes do upload, removem os artefatos `github-pages` de tentativas anteriores da mesma execução para permitir reexecuções sem duplicatas. O novo artefato tem retenção de um dia; artefatos de outras execuções não são removidos.

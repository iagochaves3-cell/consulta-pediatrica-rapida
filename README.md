# consulta-pediatrica-rapida
Apoio durante consulta em pronto atendimento 

## Demonstração da anamnese
O botão **Ver demonstração (dados fictícios)** abre uma visualização separada, com quatro blocos explicitamente identificados como exemplo. Não preenche nem apaga campos, respostas, antecedentes ou textos do atendimento. Fechar a demonstração (pelo botão ou pela tecla Esc) devolve o usuário ao mesmo formulário. A demonstração não possui ação de transferência ou cópia para o prontuário; os botões de cópia do atendimento continuam usando somente suas respectivas caixas de texto.

Regressão: `node --test tests/*.test.mjs`. A suíte `demo-isolation.test.mjs` verifica isolamento em formulário vazio e preenchido, repetição de abertura, preservação de textos revisados, geração após a demonstração, cópia e fallback da área de transferência.

O exame físico gera somente os achados informados por padrão. O modelo normal permanece disponível para leitura e inclusão opcional, mediante seleção explícita após exame e revisão pelo profissional; achados digitados substituem o sistema correspondente. Valores fixos de saturação, Glasgow, força muscular e enchimento capilar foram retirados do modelo: medidas e escores devem ser digitados quando obtidos. As condutas começam vazias, inclusive após limpar o formulário. Os testes também cobrem estas condições e a preservação da ordem dos sistemas.

## Publicação
Os workflows do GitHub Pages publicam a branch `principal`, automaticamente no push ou manualmente. Eles preparam `dist/` apenas com os arquivos públicos do site, incluindo `pedwb/`, sem publicar testes, configurações ou documentos de edição.

Antes do upload, removem os artefatos `github-pages` de tentativas anteriores da mesma execução para permitir reexecuções sem duplicatas. O novo artefato tem retenção de um dia; artefatos de outras execuções não são removidos.

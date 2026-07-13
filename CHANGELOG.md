# Changelog

Todas as mudancas relevantes deste projeto serao registradas aqui.

## Unreleased

### Adicionado

- Plano completo de analise e implementacao em `PLANO_DE_IMPLEMENTACAO.md`.
- Roadmap executavel em `ROADMAP_IMPLEMENTACAO.md`.
- Schema compartilhado inicial de configuracoes em `src/shared/settings.ts`.
- Constantes e helpers compartilhados de mensagens em `src/shared/messages.ts`.
- Token de sessao best-effort para mensagens entre content script e MAIN world.
- Testes com Vitest para settings e mensagens compartilhadas.
- Script `npm run clean`.
- Script `npm run package` para gerar ZIP de release a partir de `dist/`.
- Workflow de CI com install, check, test, build, verify e package.
- Estrategia testavel para escolher entre botao nativo, seek limitado e aceleracao.
- Modulo `src/content/adDom.ts` para deteccao de anuncio e controles de skip.

### Corrigido

- Reduzido risco de o player pausar sozinho por sinais antigos de outras abas.
- Restore de velocidade agora so roda quando existe velocidade pre-anuncio capturada.
- Miniplayer recebeu ajustes de stacking/z-index para ficar acima da area de comentarios.
- Listeners de video antigos agora sao removidos ao trocar o elemento de video.
- O fallback de skip nao avanca mais o video quando a duracao do anuncio e desconhecida.
- Busca textual pelo botao de pular agora fica restrita ao player do YouTube.

### Melhorado

- `mainLoop` ficou menor e tarefas visuais foram desacopladas por frequencia.
- Toolbar, miniplayer e filtros de video evitam trabalho repetido desnecessario.
- Export/import de configuracoes usa lista compartilhada de chaves conhecidas.
- Popup foi reduzido a um painel compacto de 360 px com telemetria e controles essenciais.
- Observer do botao de pular agora acompanha o player em vez da pagina inteira.
- Configuracoes agora usam um unico objeto de defaults em popup, options, runtime, reset e backup.
- Valores desconhecidos ou com tipo invalido sao descartados ao normalizar configuracoes.

### Removido

- Execucao de script personalizado por `new Function`, incompativel com o hardening esperado de Manifest V3.

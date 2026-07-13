# Plano de analise e implementacao

Data da analise: 2026-05-10

Projeto: YouTube Extension / Youtube-ad-skipper

## 1. Resumo executivo

O projeto ja tem uma base funcional e relativamente ambiciosa: uma extensao Manifest V3 para YouTube com skipper de anuncios, modo agressivo, protecao anti-adblock, popup, pagina de opcoes, controles de player, preferencias de qualidade, temas, miniplayer, toolbar, backup de configuracoes, filtros de video e comunicacao com o contexto MAIN da pagina.

O maior problema hoje nao e falta de recurso. E concentracao de responsabilidade. O arquivo `src/content.ts` tem cerca de 3.700 linhas e faz praticamente todo o runtime da extensao. `src/options.ts` tambem cresceu bastante, com mais de 1.400 linhas e muitos defaults duplicados. Isso deixa a manutencao dificil, aumenta risco de regressao e torna cada nova feature mais cara.

Minha recomendacao e transformar o projeto em um produto mais solido antes de adicionar mais funcionalidades grandes. O caminho ideal e estabilizar build, separar modulos, centralizar schema de configuracoes, adicionar testes e criar um fluxo de release confiavel.

## 2. Estado atual do repositorio

### Estrutura principal

| Area | Arquivos | Papel atual |
|---|---|---|
| Configuracao | `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.json` | Define build TypeScript/Vite, Manifest V3 e permissoes da extensao. |
| Scripts | `scripts/build-extension.mjs`, `scripts/verify-extension.mjs` | Gera os bundles IIFE e valida se o `dist/manifest.json` referencia arquivos existentes. |
| Runtime | `src/content.ts`, `src/override.ts`, `src/background.ts` | Content script, MAIN world script e service worker. |
| UI | `popup.html`, `popup.css`, `src/popup.ts`, `options.html`, `options.css`, `src/options.ts` | Popup simples e Control Center completo. |
| Build gerado | `background.js`, `content.js`, `override.js`, `popup.js`, `options.js`, `dist/` | Arquivos compilados usados para carregar a extensao. |
| Assets | `icon16*.png`, `icon48*.png`, `icon128*.png` | Icones de estado ativo, furtivo e desligado. |
| Dependencias | `node_modules/`, `package-lock.json` | Dependencias locais de desenvolvimento. |
| Documentacao | `README.md` | Guia de instalacao e explicacao geral. |

### Estado do git no momento da analise

Existem alteracoes nao commitadas nestes arquivos:

- `options.css`
- `options.html`
- `src/background.ts`
- `src/content.ts`
- `src/options.ts`
- `src/override.ts`

O diff atual indica um trabalho grande em andamento no Control Center e no runtime:

- 582 insercoes
- 103 remocoes
- 6 arquivos modificados

Nao alterei esses arquivos. Este plano foi adicionado como arquivo novo.

### Validacoes executadas

Comandos executados sem modificar build gerado:

- `npm run check`: passou.
- `node scripts/verify-extension.mjs`: passou, com `dist manifest ok: YouTube Extension v5.0.0`.
- `npm audit --audit-level=moderate`: 0 vulnerabilidades encontradas.
- `npm outdated`: ha atualizacoes disponiveis para `@types/chrome`, `vite` e `typescript`.

Observacao: nao rodei `npm run build` para evitar sobrescrever os arquivos gerados da raiz e `dist/`, ja que ha alteracoes locais em andamento.

## 3. Pontos fortes

- Manifest V3 com permissao enxuta: usa `storage` e host permission apenas para `*.youtube.com`.
- Build customizado com Vite gerando scripts IIFE adequados para extensao.
- `npm run check` ja existe e TypeScript passa.
- `scripts/verify-extension.mjs` valida os arquivos referenciados pelo manifest.
- UI de opcoes ja tem uma boa visao de produto: skipper, player, autoplay, qualidade, aparencia, cinema, toolbar, codecs, backup e scripts.
- Background script atualiza icones conforme estado da extensao.
- O runtime cobre varios cenarios reais do YouTube: SPA navigation, embeds, PiP, fullscreen, playlists, ad badges, skip buttons e dialogs anti-adblock.

## 4. Principais riscos e problemas

### P0: arquivos monoliticos demais

`src/content.ts` concentra deteccao de anuncio, skipper, anti-adblock, toolbar, miniplayer, qualidade, filtros, shortcuts, autoplay, popup player, PiP, contador, whitelist, CSS injection, mensagens e scripts customizados.

Impacto:

- Dificulta testes.
- Dificulta revisar regressao.
- Aumenta conflito de merge.
- Torna qualquer feature pequena perigosa.

### P0: defaults e schema de configuracao duplicados

Defaults aparecem em `src/content.ts`, `src/options.ts`, `src/popup.ts` e parcialmente em `PLAYER_DEFAULTS_PROFILE` / `PLANNED_DEFAULTS`.

Impacto:

- Uma configuracao pode existir na UI e nao ser aplicada no runtime.
- Migracoes ficam espalhadas.
- Reset, import, popup e content podem discordar.

### P0: risco de descompasso entre fonte e build gerado

O build escreve os bundles em dois lugares:

- raiz: `content.js`, `options.js`, etc.
- `dist/`: copia completa da extensao

Como `dist/` esta no `.gitignore` e os bundles da raiz sao versionados, existe risco de o usuario baixar o ZIP do GitHub e receber JS gerado antigo em relacao ao `src/`.

Impacto:

- Bugs dificeis de entender.
- README pode prometer recurso que nao esta no bundle versionado.
- Pull requests podem mudar `src/` sem atualizar `*.js`.

### P0: seguranca do recurso de script customizado

`src/content.ts` usa `new Function(...)` para executar codigo configuravel pelo usuario.

Riscos:

- Em Manifest V3, execucao dinamica pode ser bloqueada pela CSP da extensao dependendo do contexto.
- Se funcionar, e um recurso poderoso demais sem isolamento real.
- Pode acessar contexto da pagina/content script e causar comportamento inesperado.

Acao recomendada: validar em Chrome real. Se for manter, mover para um modelo explicitamente seguro, com confirmacao forte, escopo claro, export/import restrito e logs. Caso contrario, remover ou deixar como recurso experimental escondido.

### P0: comunicacao `window.postMessage` sem token de sessao

`src/content.ts` e `src/override.ts` usam mensagens com `source` conhecido e `targetOrigin: "*"`. Ha checagem de `event.source === window`, mas a pagina tambem consegue postar mensagens na mesma janela.

Impacto:

- Codigo da pagina pode simular mensagens esperadas.
- A superficie e pequena, mas envolve qualidade, skip e speed-through.

Acao recomendada: criar um token aleatorio por sessao no content script, enviar ao MAIN world no bootstrap e exigir esse token em todas as mensagens.

### P0: player pausando sozinho

Foi relatado que, as vezes, o player do YouTube simplesmente pausa sozinho. Esse bug precisa entrar como prioridade porque afeta a experiencia basica de assistir video, mesmo quando o skipper nao deveria interferir.

Hipoteses principais:

- Regras de autoplay/background podem estar pausando videos de forma agressiva demais.
- `pauseBackgroundTabs`, `autoplayBlockBackground`, `autoplayBlockForeground`, `autoplayDisableAll` ou `autoplayStopPreload` podem estar disparando em cenarios errados.
- A deteccao de intencao do usuario (`markUserPlaybackIntent` / `hasRecentPlaybackIntent`) pode estar curta ou incompleta.
- A deteccao de anuncio pode confundir estado normal do player e ativar cleanup/restore no momento errado.
- Eventos de navegacao SPA do YouTube podem reaplicar preferencias de player no video errado.

Acao recomendada: criar um diagnostico de playback com logs controlados, registrar quem pausou o video, e revisar toda a camada de autoplay antes de adicionar novas features.

### P0: polimento geral de funcoes quebradas ou instaveis

O projeto tem muitas funcoes grandes, com varios `catch` silenciosos e comportamento dependente do DOM interno do YouTube. Algumas features podem parecer prontas na UI, mas ainda precisam de polimento real no runtime.

Impacto:

- Usuario liga uma opcao e nao entende se ela funcionou.
- Bugs aparecem so em algumas paginas do YouTube.
- Fica dificil diferenciar bug da extensao, mudanca do YouTube e limitacao do navegador.

Acao recomendada: criar uma fase de hardening para revisar cada modulo ativo, separar features experimentais, adicionar feedback visual quando algo falha e manter logs de debug desligados por padrao.

### P1: override global no MAIN world e fragilidade

`src/override.ts` altera:

- `JSON.parse`
- `Response.prototype.json`
- `HTMLElement.prototype.addEventListener`
- propriedades nativas de media por meio de descriptors

Isso e poderoso, mas fragil.

Impacto:

- Pode quebrar se o YouTube mudar internals.
- Pode conflitar com outras extensoes.
- Pode ser dificil diagnosticar bug de pagina.

Acao recomendada: colocar cada override atras de feature flag, garantir idempotencia, guardar versao instalada e adicionar rollback seguro quando a configuracao desliga.

### P1: polling e observers podem ficar caros

O runtime roda `mainLoop` a cada 500ms e tambem usa varios listeners, MutationObservers e timeouts. O loop executa varias tarefas de DOM, CSS e player.

Impacto:

- Possivel custo de CPU em abas abertas por muito tempo.
- Possivel impacto em maquinas fracas.
- Mais chance de corrida em navegacao SPA.

Acao recomendada: separar tarefas por evento, usar scheduler com debounce/throttle, e medir tempo do loop em modo debug.

### P1: miniplayer e player ficando abaixo dos comentarios

Foi relatado que quando o usuario desce a pagina para ler comentarios, o player pode ficar abaixo dos comentarios em vez de continuar em uma posicao util. Isso aponta para problema de layout/ancora/z-index na logica de miniplayer ou toolbar.

Hipoteses principais:

- `shouldUseMiniplayer()` depende de `scrollY > 320` e `rect.bottom < 80`, mas pode escolher a ancora errada.
- O CSS do miniplayer aplica `position: fixed` no `#movie_player`, enquanto o YouTube reorganiza containers em watch page, theater mode e comentarios.
- `z-index` ou stacking context pode deixar o player atras de blocos de comentarios.
- A atualizacao por scroll/resize pode atrasar ou nao recalcular apos navegacao SPA.

Acao recomendada: revisar `getPlayerAnchor`, `shouldUseMiniplayer`, `buildMiniplayerCss` e os eventos de scroll/resize; adicionar estados de debug para mostrar a ancora escolhida e testar em watch page com comentarios longos.

### P1: TypeScript esta permissivo

`tsconfig.json` usa:

- `strict: false`
- `noUncheckedIndexedAccess: false`
- `exactOptionalPropertyTypes: false`

Impacto:

- O codigo passa no check, mas muitos erros de contrato continuam invisiveis.
- Ha muitos `any`, especialmente em `config`, `adState` e APIs do YouTube.

Acao recomendada: ativar strict aos poucos por modulo, com tipos compartilhados.

### P1: testes automatizados ausentes

Nao ha suite de testes. Hoje a confianca vem de `tsc`, build manual e verificacao de manifest.

Impacto:

- Refatorar `content.ts` e `options.ts` sera arriscado.
- Normalizadores, whitelist, atalhos e escolha de qualidade nao tem cobertura.

Acao recomendada: adicionar testes unitarios primeiro, depois smoke tests de extensao.

### P1: UI grande demais sem componentizacao

`options.html`, `options.css` e `src/options.ts` tem muitos controles e responsabilidades em um unico arquivo.

Impacto:

- Dificil saber quais controles sao finais, planejados ou experimentais.
- Dificil manter consistencia visual e de estado disabled/enabled.

Acao recomendada: separar modulos de UI por secao e mover schema de controles para dados.

### P2: identidade e documentacao de release

O manifest usa nome generico `YouTube Extension`. O README orienta baixar o ZIP da branch main. Nao ha `CHANGELOG.md`, `LICENSE` real, politica de privacidade ou guia de contribuicao.

Impacto:

- Projeto parece menos confiavel para usuarios.
- Fica dificil distribuir versoes estaveis.

Acao recomendada: definir nome do produto, licenca, changelog e releases zipadas.

## 5. Arquitetura recomendada

### Nova organizacao de fonte

Proposta de estrutura:

```text
src/
  shared/
    settings.ts
    messages.ts
    storage.ts
    youtube.ts
    dom.ts
    logger.ts
  background/
    index.ts
    icon-state.ts
  content/
    index.ts
    state.ts
    scheduler.ts
    skipper.ts
    ad-detection.ts
    anti-adblock.ts
    whitelist.ts
    player/
      playback.ts
      volume.ts
      quality.ts
      toolbar.ts
      miniplayer.ts
      pip.ts
      popup-player.ts
      autoplay.ts
    appearance/
      themes.ts
      filters.ts
      cinema.ts
      layout.ts
    shortcuts.ts
    custom-script.ts
  override/
    index.ts
    codec-filter.ts
    trusted-skip.ts
    main-world-messages.ts
  popup/
    index.ts
    render.ts
  options/
    index.ts
    controls.ts
    backup.ts
    sections/
      skipper.ts
      player.ts
      appearance.ts
      advanced.ts
```

### Modulos compartilhados prioritarios

`shared/settings.ts`

- Um unico objeto `DEFAULT_SETTINGS`.
- Tipos `ExtensionSettings`, `StoredSettings`, `SettingsKey`.
- Normalizadores centralizados.
- Migracoes versionadas.
- Lista de chaves permitidas para import/export.

`shared/messages.ts`

- Constantes de mensagens.
- Tipos de payload.
- Token de sessao para MAIN world.
- Helpers `postToMainWorld` e `isValidMainWorldMessage`.

`shared/logger.ts`

- `debug`, `warn`, `error`.
- Ativar logs detalhados apenas por configuracao.
- Evitar `catch (err) {}` silencioso em pontos criticos.

`content/scheduler.ts`

- Debounce por tarefa.
- Loop principal reduzido.
- Tarefas separadas por prioridade: ad skipper, player prefs, appearance, toolbar, miniplayer.

## 6. Roadmap de implementacao

### Milestone 0: Baseline confiavel

Objetivo: deixar o estado atual reproduzivel antes de refatorar.

Tarefas:

- Rodar `npm run build` em um momento aprovado e conferir quais bundles mudam.
- Decidir estrategia de artefatos:
  - Opcao A: manter `*.js` gerados na raiz versionados e exigir diff limpo apos build.
  - Opcao B: parar de versionar bundles e distribuir apenas `dist/` zipado em releases.
- Adicionar script `clean`.
- Adicionar script `package` para gerar ZIP de release.
- Criar CI com `npm ci`, `npm run check`, `npm run build`, `node scripts/verify-extension.mjs`.
- Adicionar checagem para falhar se `src/` mudou e bundles da raiz ficaram desatualizados.
- Atualizar README com fluxo correto de dev e release.

Resultado esperado:

- Qualquer pessoa consegue clonar, instalar, buildar e carregar a extensao.
- Build e manifest ficam sempre sincronizados.

### Milestone 1: Schema unico de configuracoes

Objetivo: eliminar divergencia entre popup, options e content.

Tarefas:

- Criar `src/shared/settings.ts`.
- Mover todos os defaults de `content.ts`, `options.ts` e `popup.ts` para o modulo compartilhado.
- Criar `normalizeSettings(raw)` e `migrateSettings(raw)`.
- Trocar `PLAYER_DEFAULTS_PROFILE` por migracoes versionadas.
- Criar tipos para chaves planejadas e definitivas.
- Adaptar backup/import para usar a whitelist de chaves do schema.
- Criar testes unitarios para normalizacao e migracao.

Resultado esperado:

- Uma configuracao nasce em um lugar so.
- Reset, import, popup e runtime usam o mesmo contrato.

### Milestone 1.5: Estabilizacao e polimento do player

Objetivo: corrigir os bugs que atrapalham assistir videos antes de avancar em features maiores.

Tarefas:

- Investigar e corrigir o caso em que o player pausa sozinho.
- Adicionar um modo de diagnostico de playback que registre o motivo de cada pausa feita pela extensao.
- Revisar as regras de autoplay/background para nunca pausar video quando houver intencao recente do usuario.
- Revisar `pauseBackgroundTabs` e sinais entre abas para evitar falso positivo.
- Separar claramente pausa feita pela extensao, pausa feita pelo YouTube e pausa feita pelo usuario.
- Corrigir o miniplayer quando o usuario desce para ler comentarios.
- Garantir que o player flutuante fique acima dos comentarios, sem cobrir controles importantes.
- Revisar z-index, stacking context e ancora usada pelo miniplayer.
- Testar watch page normal, playlist, live, shorts convertido, embed, theater mode, fullscreen e comentarios longos.
- Listar funcoes instaveis em uma tabela de QA com status: ok, precisa polir, experimental ou remover.

Resultado esperado:

- A extensao para de pausar videos indevidamente.
- O miniplayer se comporta corretamente ao rolar ate os comentarios.
- As features principais ficam mais previsiveis antes da modularizacao pesada.

### Milestone 2: Modularizacao do runtime

Objetivo: quebrar `src/content.ts` sem mudar comportamento.

Ordem sugerida:

1. Extrair helpers puros: normalizadores, shortcuts, whitelist, qualidade, URL/video id.
2. Extrair `ad-detection.ts` e `skipper.ts`.
3. Extrair `anti-adblock.ts`.
4. Extrair `player/*`.
5. Extrair `appearance/*`.
6. Criar `content/index.ts` como orquestrador.

Regras:

- Fazer em commits pequenos.
- A cada extracao, rodar `npm run check`.
- Evitar mudar comportamento junto com movimentacao.
- Preservar nomes publicos quando possivel.

Resultado esperado:

- `src/content.ts` deixa de existir como monolito ou vira apenas bootstrap.
- Cada modulo passa a ter responsabilidade clara.

### Milestone 3: Seguranca e compatibilidade

Objetivo: reduzir risco de quebra, spoofing e CSP.

Tarefas:

- Adicionar token de sessao nas mensagens `window.postMessage`.
- Criar feature flags para overrides do MAIN world.
- Tornar `src/override.ts` idempotente.
- Validar `new Function` em Chrome/Edge reais.
- Se `new Function` falhar ou for risco alto, remover ou trocar por uma execucao MAIN world com consentimento explicito e isolamento de escopo.
- Criar modo debug com logs de erro reais.
- Substituir catches silenciosos por logs controlados onde impactam feature.

Resultado esperado:

- Runtime mais previsivel.
- Menos chance de pagina ou outra extensao interferir.
- Diagnostico melhor quando o YouTube muda.

### Milestone 4: Performance e estabilidade

Objetivo: diminuir trabalho repetitivo no DOM e deixar a extensao mais leve.

Tarefas:

- Medir duracao do `mainLoop` em modo debug.
- Separar tarefas por eventos:
  - navegacao SPA
  - mudanca de storage
  - scroll/resize
  - eventos do video
  - deteccao de ad
- Debounce de `applyAppearanceFilters`, `updatePlayerToolbar` e `updateMiniplayer`.
- Garantir cleanup de observers/listeners em troca de video/navegacao.
- Reduzir `querySelectorAll` amplo dentro do loop.
- Revisar uso de CSS `:has(...)` para compatibilidade e custo.
- Criar uma lista de tarefas por frequencia: tempo real, eventos de video, navegacao SPA, scroll e storage.
- Evitar recalcular CSS e reconstruir toolbar quando a assinatura visual nao mudou.
- Medir impacto em uma aba com video tocando por 10 minutos e outra com comentarios abertos.

Resultado esperado:

- Menos CPU em abas longas.
- Menos bugs de estado duplicado apos navegacao.
- Menos travamentos e menos interferencia no player do YouTube.

### Milestone 5: Testes

Objetivo: criar rede de seguranca para evoluir.

Testes unitarios iniciais:

- `normalizeSettings`
- migracoes
- whitelist/blacklist
- parser de shortcuts
- escolha de qualidade disponivel
- URL/video id para watch, live, shorts e embed
- calculo de delay/speed

Testes de integracao/smoke:

- Build gera todos os arquivos do manifest.
- Options abre sem erro de script.
- Popup abre sem erro de script.
- Storage muda e UI reflete.
- Content bootstrap nao inicia em iframe nao suportado.

Ferramentas sugeridas:

- `vitest` para unitarios.
- `@playwright/test` para smoke de paginas locais e, quando possivel, extensao carregada em Chromium.

Resultado esperado:

- Refatoracao fica mais segura.
- Bugs de configuracao aparecem antes do browser.

### Milestone 6: UI/UX do Control Center

Objetivo: tornar a pagina de opcoes mais clara e confiavel.

Tarefas:

- Separar controles definitivos de controles experimentais.
- Adicionar estados visuais para recurso ativo, experimental e requer reload.
- Criar painel de diagnostico:
  - versao
  - estado do skipper
  - ultima deteccao de anuncio
  - ultimo erro
  - build/source version
- Melhorar acessibilidade:
  - labels explicitos
  - foco visivel
  - `aria-live` para feedbacks
  - navegacao por teclado
- Internacionalizacao real ou remover seletor de idioma ate existir suporte.
- Validar import de backup com preview antes de aplicar.

Resultado esperado:

- Menos confusao para usuario.
- Mais facil diagnosticar problema sem abrir devtools.

### Milestone 7: Produto e release

Objetivo: preparar o projeto para uso mais serio.

Tarefas:

- Definir nome final da extensao.
- Adicionar `LICENSE`.
- Adicionar `CHANGELOG.md`.
- Adicionar `PRIVACY.md` explicando uso de `chrome.storage` e ausencia/presenca de coleta.
- Criar release ZIP automatizado.
- Atualizar README para orientar instalacao via release, nao ZIP da branch.
- Documentar limitacoes: YouTube muda muito, recursos agressivos podem quebrar.

Resultado esperado:

- Distribuicao mais limpa.
- Usuario sabe o que instala e quais riscos existem.

## 7. Backlog priorizado

### P0: fazer primeiro

- Investigar e corrigir player pausando sozinho.
- Corrigir miniplayer/player ficando abaixo dos comentarios.
- Criar modo diagnostico para playback, autoplay e miniplayer.
- Criar schema unico de configuracoes.
- Decidir estrategia de build gerado.
- Adicionar CI.
- Separar `content.ts` em modulos sem mudar comportamento.
- Adicionar token nas mensagens MAIN/content.
- Validar ou remover execucao de script customizado via `new Function`.

### P1: fazer em seguida

- Ativar testes unitarios.
- Criar scheduler/debounce para tarefas do content script.
- Fazer rodada de polimento em funcoes instaveis e marcar recursos experimentais.
- Modularizar `options.ts`.
- Melhorar logs e diagnostico.
- Garantir idempotencia dos overrides.
- Criar scripts `clean` e `package`.

### P2: refinamentos

- Internacionalizacao real.
- Melhorar README, changelog, licenca e privacidade.
- Revisar design responsivo de options/popup com testes visuais.
- Melhorar acessibilidade.
- Adicionar presets de configuracao: seguro, equilibrado, agressivo.

## 8. Plano de execucao sugerido para proximas sessoes

### Sessao 1: baseline e build

- Rodar build completo.
- Verificar se bundles da raiz mudam.
- Atualizar README se necessario.
- Criar script de package.
- Criar CI.

### Sessao 2: settings compartilhado

- Criar `src/shared/settings.ts`.
- Migrar defaults do popup/options/content.
- Adaptar backup/import.
- Adicionar primeiros testes.

### Sessao 3: bugs criticos do player

- Diagnosticar e corrigir pausa espontanea.
- Diagnosticar e corrigir miniplayer abaixo dos comentarios.
- Revisar autoplay/background guards.
- Adicionar logs controlados para playback e miniplayer.

### Sessao 4: content modular, parte 1

- Extrair normalizadores, whitelist, shortcuts, video helpers.
- Extrair skipper/ad detection.
- Manter comportamento igual.

### Sessao 5: content modular, parte 2

- Extrair player controls, quality, toolbar, miniplayer, PiP.
- Extrair appearance/cinema/theme/filter.

### Sessao 6: seguranca e main world

- Tokenizar mensagens.
- Tornar override idempotente.
- Revisar custom script.
- Criar logs de debug.

### Sessao 7: QA e produto

- Adicionar smoke tests.
- Revisar UI.
- Criar changelog, privacy e release zip.

## 9. Definicao de pronto

Uma etapa so deve ser considerada pronta quando:

- `npm run check` passa.
- `npm run build` passa.
- `node scripts/verify-extension.mjs` passa.
- Se houver testes, eles passam.
- Nao ha bundles desatualizados em relacao ao `src/`.
- A extensao carrega como unpacked em Chromium.
- Popup e Options abrem sem erro no console.
- O recurso alterado foi testado manualmente no YouTube ou tem smoke test equivalente.
- Nao ha pausa indevida do player em watch page normal, comentarios, playlist e aba em primeiro plano.
- Miniplayer fica visivel e acima dos comentarios quando o usuario rola a pagina.
- README ou docs foram atualizados quando o fluxo do usuario mudou.

## 10. Decisoes que precisamos tomar antes de implementar

1. Manter bundles gerados na raiz ou migrar para releases usando apenas `dist/`.
2. Manter, esconder ou remover o recurso de script customizado.
3. Nome final da extensao.
4. Nivel de agressividade padrao: seguro, equilibrado ou agressivo.
5. Se o foco inicial sera estabilidade do skipper ou evolucao do Control Center completo.
6. Quais recursos atuais devem ser tratados como experimentais ate passarem por QA.

## 11. Recomendacao final

O melhor proximo passo e comecar pelo Milestone 0, Milestone 1 e Milestone 1.5. Eles deixam o projeto reproduzivel, unificam configuracoes e atacam os bugs mais chatos de uso real antes de modularizar pesado. Depois disso, separar o `content.ts` fica muito mais tranquilo, e ai sim vale acelerar novas features.

Minha sugestao de ordem imediata:

1. Sincronizar build e criar CI.
2. Criar schema unico de settings.
3. Corrigir pausa espontanea do player.
4. Corrigir miniplayer abaixo dos comentarios.
5. Refatorar `src/content.ts` em modulos.
6. Adicionar testes unitarios.
7. Revisar seguranca de MAIN world e scripts customizados.

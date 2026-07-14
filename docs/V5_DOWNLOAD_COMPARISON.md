# Comparacao com a pasta 5.0.0 baixada

Fonte analisada: `C:\Users\giova\Downloads\Youtube-ad-skipper-codex-tube-shield-control-center`

Data da analise: 2026-07-13

## Conclusao

A pasta baixada e uma fotografia anterior da mesma linha 5.0.0. Ela nao possui historico Git e nao deve substituir o workspace atual.

O workspace atual preserva as funcoes da pasta baixada e acrescenta correcoes de player/miniplayer, scripts em `document_start`, token de sessao para mensagens MAIN/content, helpers compartilhados, testes, CI e empacotamento.

## Diferencas principais

| Area | Pasta baixada | Workspace atual antes desta rodada |
|---|---:|---:|
| `src/content.ts` | 3.593 linhas | 4.133 linhas |
| `src/options.ts` | 1.434 linhas | 1.276 linhas |
| Testes | nenhum | 36 testes |
| Modulos compartilhados | nenhum | settings, mensagens, atalhos, qualidade, canais e YouTube |
| Content script | `document_idle` | `document_start` |
| Package/release | build e verify | build, test, verify, package e CI |

## Estrategia de anuncios encontrada

As duas versoes usavam essencialmente a mesma cadeia:

1. detectar `ad-showing`/`ad-interrupting` e elementos visuais de anuncio;
2. procurar e clicar no botao de pular;
3. acelerar o video do anuncio;
4. tentar avancar para o fim;
5. repetir as tentativas por polling e `MutationObserver`.

O principal risco era o fallback avancar centenas de segundos quando a duracao ainda era desconhecida. A busca textual tambem percorria botoes da pagina inteira.

## Decisao aplicada

- Priorizar o botao nativo do YouTube.
- Restringir seletores e busca textual ao player.
- Fazer seek apenas quando a duracao e o tempo atual forem finitos e coerentes.
- Usar aceleracao, sem seek cego, quando a duracao ainda nao estiver disponivel.
- Manter observer focado no player e polling apenas como rede de seguranca.
- Cobrir a decisao de skip com testes unitarios.

Essa estrategia e menos invasiva que tentar bloquear requisicoes de rede do YouTube e reduz o risco de interferir no video principal.

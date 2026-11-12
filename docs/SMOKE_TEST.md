# Smoke test manual da extensao

Use este roteiro depois de `npm run package` ou `npm run build`.

## Preparacao

1. Abra `chrome://extensions/`, `edge://extensions/` ou equivalente.
2. Ative o modo desenvolvedor.
3. Carregue a pasta `dist/` com "Carregar sem compactacao".
4. Abra uma aba nova do YouTube.
5. Opcional: ative logs com `localStorage.setItem("youtubeExtensionDiagnostics", "1")` no console do YouTube.

## Player normal

- Abrir um video comum.
- Assistir por pelo menos 10 minutos.
- Confirmar que o video nao pausa sozinho em primeiro plano.
- Usar play/pause pelo teclado e mouse.
- Confirmar que a extensao nao desfaz a intencao do usuario.

## Comentarios e miniplayer

- Abrir um video comum.
- Rolar ate a area de comentarios.
- Confirmar que o miniplayer fica visivel acima dos comentarios.
- Confirmar que a toolbar nao duplica.
- Voltar ao topo.
- Confirmar que o player retorna ao layout normal.

## Playlists e lives

- Abrir uma playlist.
- Confirmar que o autoplay da playlist nao e bloqueado indevidamente.
- Trocar de video dentro da playlist.
- Abrir uma live.
- Confirmar que a live nao e pausada automaticamente.

## Anuncios

- Testar anuncio pulavel.
- Confirmar que o botao nativo e usado antes dos fallbacks agressivos.
- Testar anuncio sem botao de pular.
- Confirmar que anuncios com duracao ainda desconhecida apenas aceleram e nao fazem seek cego.
- Confirmar que o som e a velocidade sao restaurados depois do anuncio.
- Confirmar que o contador sobe apenas uma vez por anuncio.

## UI da extensao

- Abrir popup.
- Confirmar que o popup cabe sem rolagem vertical e exibe totais, hoje e avisos.
- Ligar/desligar extensao.
- Abrir pagina de opcoes.
- Alterar uma configuracao de player.
- Exportar backup.
- Importar backup.

## Recursos avancados

- Testar toolbar do player.
- Testar PiP.
- Testar screenshot.
- Testar qualidade preferida.
- Testar filtros de video.
- Testar codecs com recarregamento do video.

## Criterio de aprovacao

- Nenhuma pausa indevida em video normal, playlist ou live.
- Miniplayer fica acima dos comentarios.
- Nao ha toolbar duplicada.
- Build e package passam.
- Console nao mostra erro recorrente da extensao.

## Teste automatizado no navegador (Playwright)

Carrega `dist/` num Chromium real e abre um vídeo do YouTube:

```bash
npm run build
npx playwright install chromium   # só na primeira vez
npm run e2e
```

Verifica: vídeo avança sem pausas da extensão, velocidade normal depois de anúncios,
miniplayer flutua ao descer até os comentários sem piscar, volta ao subir, e nenhum
erro da extensão no console. Variáveis úteis:

- `E2E_VIDEO=<url>` para outro vídeo (use um com anúncio para testar o skip).
- `E2E_HEADED=1` para ver a janela.
- `E2E_SETTINGS='{"miniplayerEnabled":false}'` para sobrescrever configurações.
- `E2E_NO_EXTENSION=1` roda o mesmo fluxo sem a extensão, como referência.

Observação: no Chromium automatizado o YouTube costuma mostrar "Algo deu errado" depois
de uns 40 s e descarregar o vídeo. Isso acontece também sem a extensão, por isso o teste
registra como `WARN` e não como falha.

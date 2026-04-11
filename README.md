# ⚡ YouTube Ad Skipper

Uma extensão de navegador focada na manipulação do Document Object Model (DOM) para a automação do fechamento de anúncios na plataforma YouTube. 

> **Aviso Importante:** Esta ferramenta não é um *ad blocker* convencional. Em vez de bloquear o tráfego de rede (o que muitas distribuidoras penalizam), a extensão realiza o "*skip*" de forma programática interceptando instâncias do player.

<br>

<div align="center">
  <a href="https://github.com/OtavioBiazzi/Youtube-ad-skipper/archive/refs/heads/main.zip">
    <img src="https://img.shields.io/badge/Baixar_Extens%C3%A3o_(.ZIP)-000000?style=for-the-badge&logo=github&logoColor=white" alt="Baixar Extensão" />
  </a>
</div>

<br>

## 🎯 Arquitetura e Funcionalidades

A extensão foi construída sob a ótica de usabilidade e perfomance. Abaixo detalhamos as *features* centrais do projeto:

| Componente | Descrição Técnica |
|---|---|
| ⏭️ **Skip Flow Injection** | Detecção via Query Selectors visuais, contornando falsos-positivos (`display: none`) para acionamento apenas de blocos ativos. |
| ⏱️ **Manipulação de Delays** | Customização de tempo (0s a 30s) com injeções de aceleração e reposicionamento do vetor de áudio/vídeo (`currentTime`) no *fallback*. |
| 🔇 **Mutação de Áudio** | Silenciamento autônomo durante sub-rotinas de propaganda e restauração controlada no encerramento. |
| 🎨 **Design Sistêmico Dinâmico** | Overlay e Popup injetados com suporte nativo sob demanda para temas (Clear/Dark/System), integrando com os padrões visuais da plataforma. |
| 📊 **Análise Simples** | Telemetria local por meio da API `chrome.storage.local` para controle exato das mídias evitadas e de fração de tempo livre economizado. |

## 🛠️ Como Baixar e Compilar (Instalação)

### Suporte Nativo: Chrome / Opera GX / Edge / Brave

1. **[Efetue o download do branch atual em .ZIP](https://github.com/OtavioBiazzi/Youtube-ad-skipper/archive/refs/heads/main.zip)**;
2. **Extraia todas as pastas e metadados** do arquivo baixado em um diretório não efêmero de seu sistema operacional;
3. Acesse o gerenciador do seu cliente Web:
   - Chrome: `chrome://extensions/`
   - Opera GX: `opera://extensions/`
   - Edge: `edge://extensions/`
4. Na aba de configurações, habilite o **"Modo do desenvolvedor"**;
5. Selecione a opção correspondente para **"Carregar sem compactação"** (ou *"Load unpacked"*);
6. Anexe o diretório da raiz do código da etapa 2. 
7. Pronto. O listener primário já estará em Background aguardando execuções de frame.

## 🧑‍💻 Topologia Tática

Para fins de manutenção e colaboração, o código espelha o Manifest V3 de Extensões:

```text
├── manifest.json      # Metadados do Manifest V3, host perms e contexts.
├── content.js         # Routine Script. Injetado dinamicamente (`document_idle`). Detecter e UI de Overlay.
├── override.js        # Event Proxy Module. Injetado no Main World. Promove elevação para by-pass nativo de `isTrusted`.
├── popup.html         # Arquitetura do modal principal.
├── popup.css          # Variáveis de temas nativas baseadas no UI do YouTube.
├── popup.js           # DOM Control para listeners de preferência local e stats.
```

### Explicação do Event Proxy
O *core engine* usa o **`override.js`** manipulando no mundo primário (DOM Window) a substituição prototípica do `HTMLElement.prototype.addEventListener`. Quando o listener de "pulo" é registrado, nós roteamos o evento por um `Proxy` em JavaScript, que por sua vez intercepta o Getter retornando `isTrusted: true`. Isso garante que simulações robóticas transpassem a principal defesa anti-bots de cliques em WebApps.

## 📝 Documentação & Créditos

Este repositório acadêmico/pessoal foi desenvolvido por **[OtavioBiazzi](https://github.com/OtavioBiazzi)** aplicando boas-práticas orientadas por agente de inteligência artificial (**Antigravity da Google DeepMind**). 

Houve referenciamento técnico direto do repositório *open-source* [yt-ad-autoskipper](https://github.com/squgeim/yt-ad-autoskipper) de [@squgeim](https://github.com/squgeim) para estruturação algorítmica de Proxy.

---

> Propósito puramente educacional e pessoal. Fale livremente para abrir PRs caso queira ajudar na manutenção!

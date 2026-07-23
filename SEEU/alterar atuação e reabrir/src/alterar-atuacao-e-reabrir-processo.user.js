// ==UserScript==
// @name         SEEU - Alterar Atuação e Reabrir Último (Combinado)
// @namespace    https://github.com/4Vara
// @version      2.1
// @description  Combina as funções de alterar a atuação e reabrir o último processo.
// @author       scheee & nadameu (versão combinada)
// @match        https://seeu.pje.jus.br/seeu/processo.do*
// @match        https://seeu.pje.jus.br/seeu/visualizacaoProcesso.do*
// @match        https://seeu.pje.jus.br/seeu/usuario/areaAtuacao.do*
// @match        https://seeu.pje.jus.br/seeu/historicoProcessosRecursos.do?actionType=listar
// @match        https://seeu.pje.jus.br/seeu/inicio.do*
// @grant        none
// ==/UserScript==

/*
 * Este script combina duas automações: alternar área de atuação e reabrir o último processo
 * a partir do histórico, preservando o comportamento original e documentando o fluxo.
 * A estrutura de roteamento e os pontos de integração foram mantidos.
 */

(function () {
  'use strict';

  // --- Constantes e Variáveis de ambos os scripts ---

  // Do script "Alterar Atuação"
  const RETURN_KEY = 'REABRIR_PROCESSO_DEPOIS_E_RECARREGAR';
  const BUTTON_CLASS = '_btn_v82dh_1';

  // Do script "Reabrir Último"
  const REOPEN_NAME = 'seeu-reabrir-ultimo-processo';
  const REOPEN_VALUE = 'REABRIR_ULTIMO';
  const REOPEN_BUTTON_ID = 'gm-seeu-reabrir__button';
  const REOPEN_STYLES = `#${REOPEN_BUTTON_ID}{background:hsl(333,30%,60%);border-radius:50%;padding:.4rem;margin:auto 8px}`;

  // --- Funções Auxiliares ---

  /**
   * Cria um elemento HTML com propriedades e filhos opcionais.
   * @param {string} tag Nome da tag HTML a ser criada.
   * @param {Record<string, any>|null} [props] Propriedades a serem atribuídas ao elemento.
   * @param {...Node} children Filhos a serem adicionados ao elemento.
   * @returns {HTMLElement} Elemento criado.
   */
  function h(tag, props = null, ...children) {
    const element = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        element[key] = value;
      }
    }
    element.append(...children);
    return element;
  }

  /**
   * Faz uma requisição assíncrona para obter o conteúdo de uma URL.
   * @param {string} url URL alvo da requisição.
   * @returns {Promise<Document>} Documento retornado pela requisição.
   */
  function XHR(url) {
    return new Promise((res, rej) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'document';
      xhr.onload = () => res(xhr.response);
      xhr.onerror = rej;
      xhr.send();
    });
  }

  // --- Lógica Principal por Página ---

  /**
   * Roteador principal que decide qual função executar com base na URL atual.
   */
  function router() {
    const href = window.location.href;

    // Adiciona o botão "Reabrir Último" no cabeçalho em quase todas as páginas
    addReopenButtonToHeader();

    if (href.includes('/processo.do') || href.includes('/visualizacaoProcesso.do')) {
      handleProcessoPage();
    } else if (href.includes('/areaAtuacao.do')) {
      handleAreaAtuacaoPage();
    } else if (href.includes('/historicoProcessosRecursos.do')) {
      handleHistoricoPage();
    }
  }

  /**
   * Lógica para a página do processo: Adiciona o botão "Alternar para esta área de atuação".
   */
  function handleProcessoPage() {
    const areaAtual = document.querySelector('#areaatuacao')?.textContent ?? '';
    const linkAlterar = document.querySelector('#alterarAreaAtuacao');

    const match = decodeURI(linkAlterar?.href ?? '').match(
      /^javascript:openSubmitDialog\('(\/seeu\/usuario\/areaAtuacao\.do\?_tj=[0-9a-f]+)', 'Alterar Atua[^']+o', 0, 0\);/
    );
    const urlAlterar = match?.[1];
    const informacoesProcessuais = document.querySelector('#informacoesProcessuais');
    const linhaJuizo = Array.from(informacoesProcessuais?.querySelectorAll('tr') ?? [])
      .filter(x => x.cells.length === 2)
      .find(x => (x.cells[0]?.textContent?.trim() ?? '') === 'Juízo:');
    const juizo = linhaJuizo?.cells[1]?.textContent?.trim() ?? '';

    if (!urlAlterar || areaAtual === juizo) return;

    const button = document.createElement('input');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.value = 'Alternar área de atuação';
    button.title = 'Muda a área de atuação e recarrega o processo a partir do histórico.';
    button.onclick = async evt => {
      evt.preventDefault();
      button.disabled = true;
      try {
        // Inicia o processo de alteração
        const doc = await XHR(urlAlterar);
        const links = Array.from(
          doc.querySelectorAll('a[href][target="mainFrame"]')
        ).filter(x => x.textContent?.trim() === juizo);
        if (links.length !== 1) throw new Error('Link da nova atuação não encontrado');

        const link = links[0];
        // Salva a URL do processo atual para a lógica de retorno
        localStorage.setItem(RETURN_KEY, window.location.href);
        document.body.appendChild(link);
        link.click();
      } catch (err) {
        console.error(err);
        alert(`Erro ao alternar para "${juizo}". Você tem acesso a essa área?`);
        button.disabled = false;
      }
    };
    linhaJuizo.cells[1]?.append(' ', button);
  }

  function handleAreaAtuacaoPage() {
    const voltarPara = localStorage.getItem(RETURN_KEY);
    if (voltarPara) {
      localStorage.removeItem(RETURN_KEY);
      // 1. Define o sinalizador para o script de "Reabrir Último".
      localStorage.setItem(REOPEN_NAME, REOPEN_VALUE);

      // 2. Clica no botão de histórico para iniciar o processo.
      setTimeout(() => {
        const header = document.querySelector('seeu-header')?.shadowRoot;
        const historyLink = header?.querySelector('seeu-icon[name="mdi:history"]');
        if (historyLink) {
          historyLink.click();
        } else {
          // Fallback caso o botão não seja encontrado
          console.warn('[SEEU Script Combinado] Botão de histórico não encontrado, usando fallback de URL.');
          window.top.location.href = 'https://seeu.pje.jus.br/seeu/historicoProcessosRecursos.do?actionType=listar';
        }
      }, 500); // Atraso de 500ms para garantir que a página carregou
    }
  }

  /**
   * Lógica para a página de histórico: Verifica o sinalizador e clica no último processo.
   */
  function handleHistoricoPage() {
    if (localStorage.getItem(REOPEN_NAME) === REOPEN_VALUE) {
      localStorage.removeItem(REOPEN_NAME);

      // Adiciona um atraso para garantir que a tabela de resultados esteja carregada.
      setTimeout(() => {
          const links = document.querySelectorAll(
            'table.resultTable a.link[href^="/seeu/historicoProcessosRecursos.do?"]'
          );
          if (links.length > 0) {
            links[0].click(); // Clica no primeiro processo da lista
          } else {
            console.error('Não há processos no histórico para reabrir.');
          }
      }, 500); // Atraso de 500ms para aguardar a renderização da tabela
    }
  }

  /**
   * Adiciona o botão "Reabrir Último" no cabeçalho (funcionalidade original do segundo script).
   */
  function addReopenButtonToHeader() {
    const header = document.querySelector('seeu-header');
    if (!header?.shadowRoot || header.shadowRoot.querySelector(`#${REOPEN_BUTTON_ID}`)) {
      return; // Sai se o cabeçalho não existir ou se o botão já foi adicionado
    }

    header.shadowRoot.appendChild(h('style', {}, REOPEN_STYLES));
    const historyLink = header.shadowRoot.querySelector('seeu-icon[name="mdi:history"]');
    if (!historyLink) return;

    const reopenButton = historyLink.cloneNode(true);
    reopenButton.id = REOPEN_BUTTON_ID;
    reopenButton.setAttribute('name', 'mdi:reload');
    reopenButton.dataset.tooltip = 'Reabrir último processo';
    reopenButton.addEventListener('click', evt => {
      evt.preventDefault();
      localStorage.setItem(REOPEN_NAME, REOPEN_VALUE);
      historyLink.click();
    });

    historyLink.parentElement.insertBefore(reopenButton, historyLink);
  }

  // Inicia o script
  try {
    router();
  } catch (err) {
    console.error('[SEEU Script Combinado] Ocorreu um erro:', err);
  }
})();

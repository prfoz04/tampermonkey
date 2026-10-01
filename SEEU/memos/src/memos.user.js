// ==UserScript==
// @name         SEEU - Memos
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  insere a visualização de memos
// @match        https://seeu.pje.jus.br/seeu/visualizacaoProcesso.do*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api-memos.prfoz04.workers.dev
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/prfoz04/tampermonkey/main/SEEU/memos/src/memos.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/tampermonkey/main/SEEU/memos/src/memos.user.js
// ==/UserScript==

(function () {
  'use strict';

  console.log("[SEEU Memos] Inicializando script")

  //configurações
  const URL_API = "https://api-memos.prfoz04.workers.dev/memos"
  const ID_DIV_PROCESSO = ".titulo.processo"
  const ID_TABELA = ".resultTable"
  const PROCESSO = getNumeroProcesso()
  const SEQ_MEMO = new Map() //armazena as sequencias que possuem um memo e o respectivo memo
  insertMemos()

  //estilos dos elementos
  //@ts-ignore
  GM_addStyle(`
    .memo-btn { cursor: pointer; font-size: 1.1em; margin-left:6px; display:inline-block; vertical-align:middle; }
    .memo-display { background:#fffbdd; border:1px solid #e6db55; padding:6px; border-radius:4px; margin-top:6px; white-space:pre-wrap; font-size:0.9em; }
    .memo-modal-backdrop { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:99999; display:flex; align-items:center; justify-content:center; }
    .memo-modal-content { background:#fff; padding:16px; border-radius:6px; max-width:600px; width:90%; box-shadow:0 6px 18px rgba(0,0,0,0.25); }
    .memo-modal-textarea { width:100%; height:140px; box-sizing:border-box; margin-bottom:8px; }
  `);

  /**
   * @typedef Memo
   * @property {string} processo
   * @property {number} seq
   * @property {string} descricao
   */

  /**
   * funcao generica para realizar requisicoes
  * @param {*} options 
  * @returns {Promise<*>}
  */
  function apiRequest(options) {
      return new Promise((resolve, reject) => {
          // @ts-ignore
          GM_xmlhttpRequest({
              method: options.method,
              url: options.url,
              headers: {
                  'Content-Type': 'application/json',
                  ...options.headers
              },
              data: options.body ? JSON.stringify(options.body) : undefined,
              onload: (response) => {
                  if (response.status >= 200 && response.status < 300) {
                      try {
                          const json = JSON.parse(response.responseText);
                          resolve(json);
                      } catch (e) {
                          resolve(response.responseText);
                      }
                  } else {
                      reject(new Error(`Erro HTTP ${response.status}: ${response.responseText}`));
                  }
              },
              onerror: (err) => reject(err),
              ontimeout: () => reject(new Error('Tempo limite da requisição atingido.'))
          });
      });
  }

  /**
   * consulta os memos para este processo na api que gerencia o banco
   * @returns {Promise<Memo[]>}
   */
  async function getMemos() {
    try {
      const memos = await apiRequest({
        method: "GET",
        url: `${URL_API}/get/${PROCESSO}`
      })

      console.log(`[SEEU Memos] ${memos.length} memos recebidos!`)
      return memos
    }
    catch (error) {
      console.error("[SEEU Memos] Falha ao buscar memos:", error)
      return []
    }
  }

  /**
   * @returns {string} retorna o processo limpo
   */
  function getNumeroProcesso() {
    const maskProcesso = /\d{7}-\d{2}.\d{4}.\d{1}.\d{2}.\d{4}/
    try {
      const processo = document.querySelector(ID_DIV_PROCESSO).textContent.match(maskProcesso)[0]
      console.log(`[SEEU memos] Processo ${processo} encontrado!`)
      return processo.replaceAll(".", "").replaceAll("-", "")
    } catch (error) {
      console.error("Erro ao encontrar número do processo na página", error)
    }
  }

  /**
   * insere um novo lembrete no banco
   * @param {Memo} memo 
   */
  async function setMemos(memo) {
    if (memo.descricao && memo.descricao.trim() !== "") {
      try {
        const response = await apiRequest({
          method: "POST",
          url: `${URL_API}/post`,
          body: memo
        });
        SEQ_MEMO.set(memo.seq, memo.descricao)
        console.log("[SEEU Memos] Memo salvo com sucesso:", response);
      } catch (error) {
        console.error("[SEEU Memos] Falha ao salvar memo:", error);
      }
    }
    else {
      deleteMemo(memo)
    }
  }

  /**
   * deleta um memo do banco
   * @param {Memo} memo
   */
  async function deleteMemo(memo) {
    try {
      const response = await apiRequest({
        method: "DELETE",
        url: `${URL_API}/delete/${memo.processo}/${memo.seq}`
      });
      SEQ_MEMO.set(memo.seq, "")
      console.log("[SEEU Memos] Memo excluído com sucesso:", response);
    } catch (error) {
      console.error("[SEEU Memos] Falha ao excluir memo:", error);
    }
  }

  /**
 * Cria o elemento visual onde o texto do memo é exibido.
 * @param {string} memoText - O texto a ser exibido no memo.
 * @returns {HTMLDivElement} O elemento <div> estilizado com o memo.
 */
  function createMemoElement(memoText) {
    const memoDiv = document.createElement('div');
    memoDiv.className = 'memo-display';
    memoDiv.textContent = memoText || '';
    return memoDiv;
  }

  /**
  * Cria o elemento do botão para adicionar/editar memo.
  * @param {Function} onClickCallback - Função de callback executada ao clicar no botão.
  * @returns {HTMLSpanElement} O elemento <span> com o ícone do botão e evento configurado.
  */
  function createMemoButton(onClickCallback) {
    const btn = document.createElement('span');
    btn.className = 'memo-btn';
    btn.title = 'Adicionar/Editar Memo';
    btn.textContent = '📝';
  
    if (typeof onClickCallback === 'function') {
      btn.onclick = (e) => {
        e.stopPropagation();
        onClickCallback(e);
      };
    }
    return btn;
  }

  /**
   * filtra no dom a tabela correta, a da aba movimentações
   * @returns {object}
   */
  function getTable() {
    const TABLES = document.querySelectorAll(ID_TABELA)
    for (let table of TABLES) {
      //filtra baseado no head, deve possuir as colunas Seq. e Movimentado Por
      const head = table.querySelector("thead")
      let temSeq = false
      let temMov = false
      let idSeq = -1
      let idMov = -1
      if (head) {
        head.querySelectorAll("th").forEach((column, index) => {
          let text = column.textContent.toLowerCase()
          if (text.includes("seq")) { 
            temSeq = true 
            idSeq = index
          }
          if (text.includes("movimentado")) {
            temMov = true
            idMov = index
          }
        })
        if (temSeq && temMov)
          return {
            "table": table,
            "idSeq": idSeq,
            "idMov": idMov
          }
      }
    }
    console.error("[SEEU Memos] Tabela não encontrada.")
    return null
  }

  /**
   * insere o botao de adicionar memo em cada linha e os memos recebidos na linha respectiva a sua sequencia
   */
  async function insertMemos() {
    const TABELA = getTable()
    if (TABELA) {
      const resposta = await getMemos();
      //garante que é um array válido 
      const MEMOS = Array.isArray(resposta) ? resposta.filter(memo => memo.descricao && memo.descricao.trim() !== "") : [];      
      MEMOS.forEach(memo => {
        SEQ_MEMO.set(Number(memo.seq), memo.descricao)
      })
      const LINHAS_TABELA = TABELA.table.querySelector("tbody").querySelectorAll("tr")
      let botoes = 0
      let memos = 0
      LINHAS_TABELA.forEach(tr => {
        const COLUNAS = tr.querySelectorAll("td")
        //verifica se é uma linha que possui a coluna movimentado
        if (COLUNAS.length > 1) {
          let indiceColunaVisivel = 0
          let indiceMemo = -1
          let seq = -1
          //insere na ultima coluna e guarda a sequencia
          COLUNAS.forEach((value, index) => {
            if (indiceColunaVisivel == TABELA.idSeq)
              seq = Number(value.textContent)
            if (indiceColunaVisivel == TABELA.idMov) {
              value.appendChild(createMemoButton(() => {
                showMemoModal(seq, SEQ_MEMO.get(seq), value)
              }))
              indiceMemo = index
            }
            if (value.checkVisibility()) {
              indiceColunaVisivel++
            }
          })
          //se a sequencia esta na map, insere o respectivo memo
          if (SEQ_MEMO.has(seq)) {
            COLUNAS[indiceMemo].appendChild(createMemoElement(SEQ_MEMO.get(seq)))
            memos++
          } else SEQ_MEMO.set(seq, "")
          botoes++
        }
      })
      console.log(`[SEEU Memos] ${botoes} botões inseridos na tabela!`)
      console.log(`[SEEU Memos] ${memos} memos inseridos na tabela!`)
    }
  }

  /**
   * exibe o modal para adicionar/editar/excluir memo
   * @param {number} seq 
   * @param {string} currentMemo 
   * @param {HTMLElement} cell 
   */
  function showMemoModal(seq, currentMemo, cell) {
    const existing = document.querySelector('.memo-modal-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'memo-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'memo-modal-content';
    modal.innerHTML = `
      <h3>Memo — Processo: ${PROCESSO} — Seq: ${seq}</h3>
      <textarea class="memo-modal-textarea">${currentMemo || ''}</textarea>
      <div style="text-align:right">
        <button id="memoSaveBtn">Salvar</button>
        <button id="memoDeleteBtn" style="margin-left:8px">Excluir</button>
        <button id="memoCancelBtn" style="margin-left:8px">Cancelar</button>
      </div>
    `;

    backdrop.appendChild(modal);
    (document.body || document.documentElement).appendChild(backdrop);

    /**@type {HTMLTextAreaElement} */
    const textarea = modal.querySelector('.memo-modal-textarea');

    // Aguarda o render do DOM para dar o foco e posicionar o cursor
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        // Leva o cursor para o final do texto existente (ou use textarea.select() se quiser selecionar tudo)
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });

    // @ts-ignore
    modal.querySelector('#memoCancelBtn').onclick = () => backdrop.remove();

    // @ts-ignore
    modal.querySelector('#memoSaveBtn').onclick = () => {
      setMemos({
        processo: PROCESSO,
        seq: seq,
        descricao: textarea.value.trim()
      })
      cell.querySelector('.memo-display')?.remove();
      if (textarea.value.trim() !== "") {
        cell.appendChild(createMemoElement(textarea.value.trim()));
      }
      backdrop.remove();
    };

    // @ts-ignore
    modal.querySelector('#memoDeleteBtn').onclick = () => {
      deleteMemo({
        processo: PROCESSO,
        seq: seq,
        descricao: ""
      })
      cell.querySelector('.memo-display')?.remove();
      backdrop.remove();
    };
    backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  }

})();


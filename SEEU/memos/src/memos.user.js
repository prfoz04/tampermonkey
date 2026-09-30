// ==UserScript==
// @name         SEEU - Memos - nova implementação
// @namespace    http://tampermonkey.net/
// @version      1.2.2
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
   * @param {string} processo 
   * @returns {Promise<Memo[]>}
   */
  async function getMemos(processo) {
    var processoLimpo = processo.replaceAll(".", "").replaceAll("-", "")
    try {
      const memos = await apiRequest({
        method: "GET",
        url: `${URL_API}/get/${processoLimpo}`
      })

      console.log(`[SEEU Memos] ${memos.length} memos recebidos!`)
      return memos
    }
    catch (error) {
      console.error("[SEEU Memos] Falha ao buscar memos:", error)
    }
  }

  function getNumeroProcesso() {
    const maskProcesso = /\d{7}-\d{2}.\d{4}.\d{1}.\d{2}.\d{4}/
    try {
      const processo = document.querySelector(ID_DIV_PROCESSO).textContent.match(maskProcesso)[0]
      console.log(`[SEEU memos] Processo ${processo} encontrado!`)
      return processo
    } catch (error) {
      console.error("Erro ao encontrar número do processo na página", error)
    }
  }

  async function setMemos() {

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
      const MEMOS = await getMemos(PROCESSO) 
      const SEQ_MEMO = new Map() //armazena as sequencias que possuem um memo e seu respectivo indice no vetor MEMOS
      MEMOS.forEach((memo, index) => {
        SEQ_MEMO.set(memo.seq, index)
      })
      const LINHAS_TABELA = TABELA.table.querySelector("tbody").querySelectorAll("tr")
      let i = 0
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
              seq = value.textContent
            if (indiceColunaVisivel == TABELA.idMov) {
              value.appendChild(createMemoButton(modalMemos))
              indiceMemo = index
            }
            if (value.checkVisibility()) {
              indiceColunaVisivel++
            }
          })
          //se a sequencia esta na map, insere o respectivo memo
          if (SEQ_MEMO.has(seq)) {
            COLUNAS[indiceMemo].appendChild(createMemoElement(SEQ_MEMO.get(seq)))
          }
          i++
        }
      })
      console.log(`[SEEU Memos] ${i} botões inseridos na tabela!`)
    }
  }

  function modalMemos() {
    console.log("click")
  }

})();


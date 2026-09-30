// ==UserScript==
// @name         SEEU - Memos
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
  const PROCESSO = getNumeroProcesso()

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


})();


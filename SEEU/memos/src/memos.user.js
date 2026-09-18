// ==UserScript==
// @name         SEEU - Memos
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  insere a visualização de memos
// @match        https://seeu.pje.jus.br/seeu/visualizacaoProcesso.do*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/prfoz04/tampermonkey/main/SEEU/memos/src/memos.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/tampermonkey/main/SEEU/memos/src/memos.user.js
// ==/UserScript==

(function () {
  'use strict';

  // --------------- CONFIG ----------------
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwDtLS3HtTcOXTw0yfjXDTxQJdIClRzAA01wxQ-9hsehmz5eX8UE2GlZJ34KwtkHR0J/exec';
  const DEBUG = true;
  // ----------------------------------------  //
  let memoMap = new Map();
  let memosRequestSent = false;
  let memosLoaded = false;
  let currentProcesso = null;

  GM_addStyle(`
    .memo-btn { cursor: pointer; font-size: 1.1em; margin-left:6px; display:inline-block; vertical-align:middle; }
    .memo-display { background:#fffbdd; border:1px solid #e6db55; padding:6px; border-radius:4px; margin-top:6px; white-space:pre-wrap; font-size:0.9em; }
    .memo-modal-backdrop { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:99999; display:flex; align-items:center; justify-content:center; }
    .memo-modal-content { background:#fff; padding:16px; border-radius:6px; max-width:600px; width:90%; box-shadow:0 6px 18px rgba(0,0,0,0.25); }
    .memo-modal-textarea { width:100%; height:140px; box-sizing:border-box; margin-bottom:8px; }
  `);

  function log(...args) { if (DEBUG) console.log('[SEEU-MEMOS]', ...args); }
  function warn(...args) { console.warn('[SEEU-MEMOS]', ...args); }
  function err(...args) { console.error('[SEEU-MEMOS]', ...args); }

  function fetchMemos(processo, cb) {
    const url = `${WEB_APP_URL}?action=get&processo=${encodeURIComponent(processo)}`;
    log('fetchMemos -> FAZENDO REQUISIÇÃO ÚNICA PARA O PROCESSO:', processo);
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      anonymous: true,
      headers: {
        "Accept": "application/json"
      },
      onload(resp) {
        if (resp.status >= 200 && resp.status < 400) {
          try {
            const result = JSON.parse(resp.responseText || '{}');
            if (result.debug && Array.isArray(result.debug)) {
              console.warn(`--- DEBUG INFO DO GOOGLE APPS SCRIPT ---\n${result.debug.join('\n')}`);
            }
            if (result.error) {
              err("Erro retornado pelo Apps Script:", result.error);
            }
            cb(Array.isArray(result.data) ? result.data : []);
          } catch (e) {
            err('fetchMemos parse error:', e, resp.responseText);
            cb([]);
          }
        } else {
          warn('fetchMemos HTTP error', resp.status, resp.statusText);
          cb([]);
        }
      },
      onerror(errorDetails) { warn('fetchMemos network error', errorDetails); cb([]); }
    });
  }

  function safeNormalize(s) { return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function getProcessoNumero(docContext) {
    try {
      const title = docContext.querySelector('.titulo.processo');
      if (title) {
        const txt = title.innerText.trim();
        const m = txt.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
        if (m) return m[0];
      }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('numeroUnico')) {
        let num = urlParams.get('numeroUnico');
        if (!num.includes('-')) {
          return num.replace(/(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})/, "$1-$2.$3.$4.$5.$6");
        }
        return num;
      }
    } catch (e) { log('Erro ao obter número do processo:', e); }
    return null;
  }

  function collectTables(doc) { return Array.from(doc.querySelectorAll('table')); }

  function analyzeTable(table) {
    let ths = Array.from(table.querySelectorAll('thead th'));
    if (ths.length === 0) {
      const firstHeaderRow = table.querySelector('tr');
      if (firstHeaderRow && firstHeaderRow.querySelectorAll('th').length) ths = Array.from(firstHeaderRow.querySelectorAll('th'));
    }
    const headers = ths.map(th => safeNormalize(th.textContent));
    const rows = Array.from((table.tBodies[0] ? table.tBodies[0].rows : table.querySelectorAll('tr'))).filter(r => !r.querySelectorAll('th').length);
    return { headers, rows, ths };
  }

  function findColumnIndices(headers) {
    let seqIndex = -1, actionsIndex = -1, docIndex = -1, movimentadoPorIndex = -1;
    headers.forEach((h, i) => {
      h = h.replace(/[^\w\s]/g, '');
      if (h.includes('seq') || h.includes('sequencia')) seqIndex = seqIndex === -1 ? i : seqIndex;
      if (h.includes('acao') || h.includes('acoes') || h.includes('aç')) actionsIndex = actionsIndex === -1 ? i : actionsIndex;
      if (h.includes('document') || h.includes('doc') || h.includes('arquivo')) docIndex = docIndex === -1 ? i : docIndex;
      if (h.includes('movimentado por')) movimentadoPorIndex = movimentadoPorIndex === -1 ? i : movimentadoPorIndex;
    });
    return { seqIndex, actionsIndex, docIndex, movimentadoPorIndex };
  }

  function displayMemoInCell(memoText, cell) {
    let memoDiv = cell.querySelector('.memo-display');
    if (!memoText || memoText.trim() === '') { if (memoDiv) memoDiv.remove(); return; }
    if (!memoDiv) { memoDiv = document.createElement('div'); memoDiv.className = 'memo-display'; cell.appendChild(memoDiv); }
    memoDiv.textContent = memoText;
  }

  function showMemoModal(processo, seq, currentMemo, cell) {
    const existing = document.querySelector('.memo-modal-backdrop');
    if (existing) existing.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'memo-modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'memo-modal-content';
    modal.innerHTML = `
      <h3>Memo — Processo: ${processo} — Seq: ${seq}</h3>
      <textarea class="memo-modal-textarea">${currentMemo || ''}</textarea>
      <div style="text-align:right">
        <button id="memoSaveBtn">Salvar</button>
        <button id="memoCancelBtn" style="margin-left:8px">Cancelar</button>
      </div>
    `;
    backdrop.appendChild(modal);
    (document.body || document.documentElement).appendChild(backdrop);
    modal.querySelector('#memoCancelBtn').onclick = () => backdrop.remove();
    modal.querySelector('#memoSaveBtn').onclick = () => {
      const newMemo = modal.querySelector('textarea').value;
      backdrop.remove();
      saveMemo(processo, seq, newMemo, cell);
    };
    backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
    modal.querySelector('textarea').focus();
  }

  function saveMemo(processo, seq, memo, cell) {
    const payload = { action: 'save', processo, seq, memo };
    log('saveMemo payload', payload);
    GM_xmlhttpRequest({
      method: 'POST',
      url: WEB_APP_URL,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      anonymous: true,
      onload(resp) {
        if (resp.status >= 200 && resp.status < 400) {
          try {
            const result = JSON.parse(resp.responseText || '{}');
            if (result && result.success) {
              const cleanSeq = String(seq).replace(/[^\d]/g, '');
              memoMap.set(cleanSeq, memo);
              displayMemoInCell(memo, cell);
              log('Memo salvo com sucesso. seq=', seq);
            } else {
              const msg = (result && result.message) ? result.message : `Resposta inesperada: ${resp.responseText}`;
              warn('saveMemo servidor respondeu erro:', msg);
              alert('Erro ao salvar memo: ' + msg);
            }
          } catch (e) {
            err('saveMemo parse error', e, resp.responseText);
            alert('Erro ao salvar memo (resposta inválida). Veja console.');
          }
        } else {
          warn('saveMemo HTTP error', resp.status, resp.statusText);
          alert('Erro ao salvar memo (HTTP ' + resp.status + '). Veja console.');
        }
      },
      onerror(errorDetails) {
        err('saveMemo network error', errorDetails);
        alert('Falha de rede ao salvar memo (ver console).');
      }
    });
  }

  function processSingleTable(table, processo) {
    try {
      const { headers, rows } = analyzeTable(table);
      const { seqIndex, actionsIndex, docIndex, movimentadoPorIndex } = findColumnIndices(headers);
      const documentosIndex = headers.findIndex(h => h.includes('documento') || h.includes('documentos'));

      let targetIndex = movimentadoPorIndex;
      if (documentosIndex >= 0) {
          targetIndex = documentosIndex; // se "Documentos" existir, usa ela
      }
      if (movimentadoPorIndex === -1) {
        return;
      }

      let added = 0;
      rows.forEach(row => {
        if (row.querySelector('.memo-btn')) return;

        let seqText = null;
        if (seqIndex >= 0 && row.cells[seqIndex]) {
          seqText = row.cells[seqIndex].innerText;
        } else {
          for (let c = 0; c < row.cells.length; c++) {
            const t = row.cells[c].innerText.trim();
            if (/^\d+$/.test(t)) { seqText = t; break; }
          }
        }

        if (!seqText) return;

        const seq = String(seqText).replace(/[^\d]/g, '');
        if (!seq) return;

        let buttonTargetCell = (movimentadoPorIndex >= 0) ? row.cells[movimentadoPorIndex] : (docIndex >= 0 ? row.cells[docIndex] : null);
        if (!buttonTargetCell) {
            buttonTargetCell = row.insertCell(-1);
        }

        const memoDisplayCell = row.cells[targetIndex];

        if (!buttonTargetCell || !memoDisplayCell) return;

        const btn = document.createElement('span');
        btn.className = 'memo-btn';
        btn.title = 'Adicionar/Editar Memo';
        btn.textContent = '📝';
        btn.onclick = (e) => {
          e.stopPropagation();
          const current = memoMap.get(seq) || '';
          showMemoModal(processo, seq, current, memoDisplayCell);
        };
        buttonTargetCell.appendChild(btn);
        added++;

        const memoText = memoMap.get(seq);
        if (memoText) {
          log(`Exibindo memo para Seq=${seq} na coluna 'Movimentado por'`);
          displayMemoInCell(memoText, memoDisplayCell);
        }
      });

      if (added > 0) log(`Adicionados ${added} botões na tabela.`);
    } catch (e) {
      err('Erro em processSingleTable:', e);
    }
  }

  function processAllVisibleTables(processo) {
    const tables = collectTables(document);
    tables.forEach(t => processSingleTable(t, processo));
    const iframes = Array.from(document.querySelectorAll('iframe'));
    iframes.forEach((ifr) => {
      try {
        const idoc = ifr.contentDocument || (ifr.contentWindow && ifr.contentWindow.document);
        if (idoc) collectTables(idoc).forEach(t => processSingleTable(t, processo));
      } catch (e) { /* Ignorar iframes de origem cruzada */ }
    });
  }

  function findTablesAndProcess() {
    const processo = getProcessoNumero(document);
    if (!processo) return;

    if (currentProcesso !== processo) {
      log(`Novo processo detectado: ${processo}. Buscando memos.`);
      currentProcesso = processo;
      memoMap = new Map();
      memosRequestSent = false;
      memosLoaded = false;
    }


    if (!memosRequestSent) {
      memosRequestSent = true;
      fetchMemos(processo, (memos) => {
        log(`Recebidos ${memos.length} memos para o processo ${processo}.`);
        memos.forEach(it => {
            const cleanSeq = String(it.seq).replace(/[^\d]/g, '');
            if (cleanSeq) {
                memoMap.set(cleanSeq, it.memo);
            }
        });
        memosLoaded = true;
        processAllVisibleTables(processo);
      });
    } else if (memosLoaded) {
      processAllVisibleTables(processo);
    }

  }

  function debounce(fn, wait = 300) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); };
  }

  const observer = new MutationObserver(debounce(() => {
    log('DOM alterado — reescaneando tabelas.');
    try { findTablesAndProcess(); } catch (e) { err('Erro ao reescanear o documento', e); }
  }, 500));

  function init() {
    log("Iniciando SEEU Memos v8.0");
    findTablesAndProcess();
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();


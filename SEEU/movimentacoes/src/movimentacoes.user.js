// ==UserScript==
// @name         seeu-movimentacoes
// @name:pt-BR   SEEU - Movimentações
// @namespace    https://github.com/4Vara
// @namespace    nadameu.com.br
// @version     3.0
// @author      nadameu (modificado) / Scheeee
// @description Melhoria na apresentação das movimentações do processo
// @match       https://seeu.pje.jus.br/*
// @grant       GM_addStyle
// @grant       GM_deleteValue
// @grant       GM_getValue
// @grant       GM_info
// @grant       GM_setValue
// ==/UserScript==

/*
 * Este script melhora a apresentação das movimentações do processo, removendo colunas
 * e exibindo avisos de carregamento enquanto o conteúdo é atualizado dinamicamente.
 * A documentação abaixo reforça o fluxo de observação e integração com o Ajax.
 */

(function () {
  'use strict';

  const _GM_addStyle =
    typeof GM_addStyle === 'function'
      ? GM_addStyle
      : css => {
          try {
            const s = document.createElement('style');
            s.textContent = css;
            document.head.appendChild(s);
          } catch (e) {
            console.warn('[SEEU] GM_addStyle fallback falhou', e);
          }
        };

  const classNames = {
    avisoCarregando: '_avisoCarregando_14zo8_8',
  };

  const css$1 =
    '._avisoCarregando_14zo8_8{font-size:1.0em;padding:4px 6px;border-radius:4px;background:#fff7f9;border:1px solid #f0dbe6;margin:6px 0}';
  _GM_addStyle(css$1);

  const XPATH = {
    FIRST: XPathResult.FIRST_ORDERED_NODE_TYPE,
    SNAP: XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
  };

  /**
   * Executa uma busca XPath e retorna os nós encontrados.
   * @param {string} expression Expressão XPath a ser avaliada.
   * @param {Document|Element} [context=document] Contexto da busca.
   * @returns {Element[]} Lista de elementos encontrados.
   */
  function xpathSnapshot(expression, context = document) {
    try {
      const snap = document.evaluate(expression, context, null, XPATH.SNAP, null);
      const arr = [];
      for (let i = 0; i < snap.snapshotLength; i++) arr.push(snap.snapshotItem(i));
      return arr;
    } catch (e) {
      return [];
    }
  }

  function alterarMovimentacoes() {
    try {
      const divs = xpathSnapshot("//div[starts-with(@id,'divArquivosMovimentacaoProcessomovimentacoes')]");

      if (!divs || divs.length === 0) return;

      for (const div of divs) {
        const tds = div.querySelectorAll('table > tbody > tr > td');

        tds.forEach(td => {
          const width = td.getAttribute('width');
          const textoPuro = (td.textContent || '').replace(/\u00A0/g, ' ').trim();

          if (width === '30%') {
             td.setAttribute('width', '45%');
          }

          if (width === '34%') {
             td.setAttribute('width', '20%');
          }

          if (/\bSegredo\b/i.test(textoPuro)) {
            td.remove();
            return;
          }

          if (/^Ass\.:/i.test(textoPuro)) {
            td.remove();
            return;
          }

          if (width === '5%' && textoPuro === '') {
             td.remove();
             return;
          }

          if (textoPuro.includes('Arquivo:')) {
            td.innerHTML = td.innerHTML.replace(/Arquivo:\s*/gi, '');
          }
        });
      }
    } catch (err) {
      console.warn('[SEEU] erro em alterarMovimentacoes()', err);
    }
  }

  let mutationObserver = null;
  function ativarMutationObserver() {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver((records) => {
      let precisa = false;
      for (const r of records) {
        if (r.addedNodes && r.addedNodes.length) {
          precisa = true;
          break;
        }
      }
      if (precisa) {
        try { clearTimeout(ativarMutationObserver._t); } catch (e) {}
        ativarMutationObserver._t = setTimeout(() => {
          alterarMovimentacoes();
        }, 50);
      }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function integrarComAjaxUpdater() {
    try {
      const Ajax = window.Ajax;
      if (!Ajax || typeof Ajax.Updater !== 'function') return;
      const OldUpdater = Ajax.Updater;
      Ajax.Updater = function (a, b, c) {
        const result = OldUpdater.call(this, a, b, c);
        setTimeout(alterarMovimentacoes, 50);
        return result;
      };
      Ajax.Updater.prototype = OldUpdater.prototype;
    } catch (e) {
      console.warn('[SEEU] não foi possível integrar com Ajax.Updater', e);
    }
  }

  /**
   * Exibe um aviso de carregamento enquanto a lista de documentos é montada.
   * @param {Element} mutationTarget Elemento alvo que receberá o aviso.
   */
  function inserirAvisoSeNecessario(mutationTarget) {
    try {
      if (!mutationTarget || !mutationTarget.parentNode) return;
      if (mutationTarget.querySelector(':scope > table')) return;
      if (mutationTarget.parentNode.querySelector(`.${classNames.avisoCarregando}`)) return;

      const aviso = document.createElement('div');
      aviso.className = classNames.avisoCarregando;
      aviso.textContent = 'Carregando lista de documentos...';
      mutationTarget.parentNode.insertBefore(aviso, mutationTarget);

      let mo = null;
      try {
        mo = new MutationObserver(() => {
          if (mutationTarget.querySelector(':scope > table')) {
            aviso.remove();
            if (mo) mo.disconnect();
          }
        });
        mo.observe(mutationTarget, { childList: true });
        if (mutationTarget.querySelector(':scope > table')) {
          aviso.remove();
          mo.disconnect();
        }
      } catch (e) {
        const iv = setInterval(() => {
          if (mutationTarget.querySelector(':scope > table')) {
            aviso.remove();
            clearInterval(iv);
          }
        }, 100);
        setTimeout(() => clearInterval(iv), 5000);
      }
    } catch (e) {
      console.warn('[SEEU] inserirAvisoSeNecessario falhou', e);
    }
  }

  function main() {
    try {
      alterarMovimentacoes();
      ativarMutationObserver();
      integrarComAjaxUpdater();

      try {
        const imgs = xpathSnapshot("//img[starts-with(@id,'iconmovimentacoes')]");
        for (const img of imgs) {
          let mutationTarget = null;
          try {
            mutationTarget = document.evaluate(
              'ancestor::tr/following-sibling::*[1]/self::tr//*[contains(concat(" ", normalize-space(@class), " "), " extendedinfo ")]',
              img, null, XPATH.FIRST, null
            ).singleNodeValue;
          } catch (e) { mutationTarget = null; }

          if (!mutationTarget) continue;

          img.addEventListener('click', () => {
            inserirAvisoSeNecessario(mutationTarget);
          });

          try {
            const io = new IntersectionObserver((entries, obs) => {
              for (const ent of entries) {
                if (ent.isIntersecting) {
                  obs.unobserve(ent.target);
                  try { ent.target.click(); } catch (e) {}
                }
              }
            });
            io.observe(img);
          } catch (e) {}
        }
      } catch (e) {}
    } catch (err) {
      console.error('[SEEU] erro na inicialização do userscript', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
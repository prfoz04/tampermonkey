// ==UserScript==
// @name         SEEU - Preview PDF em Pop-up
// @namespace    https://github.com/4Vara
// @version      3
// @description  Abre o primeiro PDF em um pop-up e reutiliza essa janela para os PDFs seguintes.
// @match        https://seeu.pje.jus.br/*
// @grant        GM_addStyle
// ==/UserScript==

/*
 * Este script exibe o primeiro PDF em uma janela pop-up e reutiliza essa janela
 * para os próximos PDFs ao passar o mouse sobre os links.
 * A documentação foi adicionada sem alterar o funcionamento do preview.
 */

(function() {
    'use strict';

    let hoverTimer = null;
    // Variável para armazenar a referência da janela pop-up
    let popupWindow = null;

    /**
     * Abre ou atualiza uma janela pop-up com o PDF selecionado.
     * @param {HTMLAnchorElement} link Link do PDF a ser exibido.
     */
    function showPreview(link) {
        // Define tamanho e opções da janela
        const width = 800;
        const height = 600;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);
        const windowOptions = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`;

        // Nome único para a janela, para que possa ser reutilizada
        const windowName = 'seeuPdfPreview';

        // Verifica se a janela já existe e não foi fechada pelo usuário
        if (popupWindow && !popupWindow.closed) {
            // Se a janela já está aberta, apenas muda a URL dela
            popupWindow.location.href = link.href;
            // Traz a janela para o foco, caso esteja atrás de outras
            popupWindow.focus();
        } else {
            // Se a janela não existe ou foi fechada, abre uma nova e guarda a referência
            popupWindow = window.open(link.href, windowName, windowOptions);
        }
    }

    function hidePreview() {
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
    }

    document.addEventListener("mouseover", function(e) {
        // Encontra o link mais próximo do elemento onde o mouse passou
        const link = e.target.closest("a.link"); // ajuste para os links de PDF
        if (link) {
            // Abre após 1,5s de hover
            hoverTimer = setTimeout(() => showPreview(link), 1500);
        }
    });

    document.addEventListener("mouseout", function(e) {
        if (e.target.closest("a.link")) {
            hidePreview();
        }
    });

})();

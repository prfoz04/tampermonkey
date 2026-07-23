// ==UserScript==
// @name         SEEU - Enviar Concluso
// @namespace    https://github.com/4Vara
// @version      1
// @description  Automatiza envio concluso no SEEU
// @author       Scheeee
// @match        https://seeu.pje.jus.br/seeu/visualizacaoProcesso.do*
// @grant        none
// ==/UserScript==

/*
 * Este script adiciona um botão de automação para enviar o processo como concluso,
 * aguardando a seleção do agrupador dentro do iframe para concluir o fluxo.
 * A documentação a seguir descreve cada etapa do processo sem mudar a lógica.
 */

(function() {
    'use strict';

    /**
     * Adiciona o botão "Iniciar Fluxo" na interface.
     * @returns {boolean} - Retorna true se o botão foi adicionado ou já existe.
     */
    function addButton() {
        const container = document.querySelector("td.buttons.button-group-action");
        if (!container) return false;

        if (document.querySelector("#iniciarFluxoButton")) return true;

        const btn = document.createElement("input");
        btn.type = "button";
        btn.className = "button";
        btn.id = "iniciarFluxoButton";
        btn.value = "Enviar Concluso";

        btn.addEventListener("click", iniciarFluxo);

        container.appendChild(btn);

        console.log("[SEEU] Botão 'Enviar Concluso' adicionado!");
        return true;
    }

    /**
     * Inicia o fluxo de automação.
     */
    function iniciarFluxo() {
        console.log("[SEEU] Iniciando fluxo...");

        const targetRow = Array.from(document.querySelectorAll("tr"))
            .find(tr => tr.innerText.includes("Enviar Concluso"));

        if (!targetRow) {
            console.error("[SEEU] Nenhum item 'Enviar Concluso' encontrado!");
            return;
        }

        console.log("[SEEU] Clicando em 'Enviar Concluso'...");
        targetRow.click();
        esperarSelectEmIframe();
    }

    /**
     * Loga a ação final após a seleção do item no dropdown.
     */
    /**
     * Clica no botão final de envio a partir do documento carregado no iframe.
     * @param {Document} iframeDocument Documento do iframe onde o botão está presente.
     */
    function clicarEnviarFinal(iframeDocument) {
        console.log("[SEEU] Clicando em enviar Concluso...");

        const enviarButton = iframeDocument.querySelector("#enviarConclusoButton");

        if (enviarButton) {
            enviarButton.click();
            console.log("[SEEU] Botão final 'Enviar Concluso' clicado com sucesso.");
            setTimeout(() => {

                const closeButton = document.querySelector('div.tjpr_close[id^="window_"][id$="_close"]');
                if (closeButton) {
                    console.log("[SEEU] Fechando a janela modal...");
                    closeButton.click();
                } else {
                    console.warn("[SEEU] Botão de fechar (com ID dinâmico) não encontrado no documento principal.");
                }
            }, 1000);
        } else {
            console.error("[SEEU] Erro: Botão final 'Enviar Concluso' não foi encontrado no formulário.");
        }
    }

    /**
     * Aguarda um elemento aparecer dentro de um iframe usando setInterval.
     */
    function esperarSelectEmIframe() {
        console.log("[SEEU] Aguardando o formulário (em iframe) carregar...");

        const maxTentativas = 20;
        let tentativas = 0;

        const intervalId = setInterval(() => {
            tentativas++;

            const iframe = document.querySelector('iframe');

            if (iframe && iframe.contentDocument) {
                const iframeDocument = iframe.contentDocument;
                const select = iframeDocument.querySelector("#idAgrupador");

                if (select) {
                    console.log("[SEEU] Select '#idAgrupador' encontrado dentro do iframe!");
                    clearInterval(intervalId); 
                    if (!iframeDocument.querySelector("#autoFluxoHelperText")) {
                        const helperText = iframeDocument.createElement('p');
                        helperText.id = "autoFluxoHelperText";
                        helperText.style.color = "darkblue";
                        helperText.style.fontWeight = "bold";
                        helperText.style.marginTop = "5px";
                        helperText.textContent = "Selecione o agrupador. Após a seleção, a conclusão será automática!";
                        select.insertAdjacentElement('afterend', helperText);
                    }

                    select.addEventListener("change", () => {
                        if (select.value) {
                            console.log(`[SEEU] Valor '${select.options[select.selectedIndex].text}' selecionado.`);

                            const currentIframe = document.querySelector('iframe');

                            if (currentIframe && currentIframe.contentDocument) {
                                clicarEnviarFinal(currentIframe.contentDocument);
                            } else {
                                console.error("[SEEU] Erro: Iframe não encontrado no momento da seleção. O envio final não pôde ser realizado.");
                            }
                        }
                    });
                    return; 
                }
            }


            if (tentativas >= maxTentativas) {
                clearInterval(intervalId);
                console.error("[SEEU] Timeout: O elemento '#idAgrupador' não foi encontrado no iframe em 10 segundos.");
            }
        }, 500);
    }


    const initInterval = setInterval(() => {
        if (addButton()) clearInterval(initInterval);
    }, 1000);

})();


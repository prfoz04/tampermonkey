// ==UserScript==
// @name         eproc - Atualizar banco de dados para o site (planilhas de entidade)
// @namespace    https://github.com/4Vara
// @version      1.0.0
// @description  Recolhe as informações de execução de pena do eproc e os insere nas devidas planilhas de entidade, a fim de normalizar os dados para vizualização no site
// @author       Leonardo
// @match        https://eproc.jfpr.jus.br/eprocV2/controlador.php?acao=pena_alternativa_consulta_interna*
// @updateURL    https://raw.githubusercontent.com/prfoz04/tampermonkey/main/eproc/atualizacao-base-real/atualizar-base-real.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/tampermonkey/main/eproc/atualizacao-base-real/atualizar-base-real.user.js
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';
    console.log('iniciando script...');

    const ID_FORM = "#frmConsulta";

    const CMB_ENTIDADE = "#cmbEntidade";

    const CMB_VARA = "#cmbVara";

    function executar() {

    }

    /**
     * cria o botao que inicia a execução do script, o mesmo some ao clicar nele
     */
    function criarBotao() {
        var botao = document.createElement('input');
        botao.type = 'button';
        botao.className = 'eproc-button-primary';
        botao.textContent = 'Exportar dados';
        botao.addEventListener('click', () => {
            botao.remove();
            executar();
        })
        document.querySelector(ID_FORM).appendChild(botao);
    }

    criarBotao();

})();

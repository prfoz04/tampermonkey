// ==UserScript==
// @name         eproc - Atualizar banco de dados para o site (planilhas de entidade)
// @namespace    https://github.com/4Vara
// @version      1.0.1
// @description  Recolhe as informações de execução de pena do eproc e os insere nas devidas planilhas de entidade, a fim de normalizar os dados para vizualização no site
// @author       Leonardo
// @match        https://eproc.jfpr.jus.br/eprocV2/controlador.php?acao=pena_alternativa_consulta_interna*
// @updateURL    https://raw.githubusercontent.com/prfoz04/tampermonkey/main/eproc/atualizacao-base-real/src/atualizar-base-real.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/tampermonkey/main/eproc/atualizacao-base-real/src/atualizar-base-real.user.js
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';
    console.log('iniciando script...');
    /**
     * id do formulário principal
     */
    const ID_FORM = "#frmConsulta";
    /**
     * id do select de entidade
     */
    const ID_ENTIDADE = "#cmbEntidade";
    /**
     * id do select da vara, por segurança, preenche no início
     */
    const ID_VARA = "#cmbVara";
    /**
     * fluxo de execução principal do script
     */
    async function executar() {
        /**
         * @type {HTMLSelectElement}
         */
        const SELECT_ENTIDADE = document.querySelector(ID_ENTIDADE);
        /**
         * @type {HTMLFormElement}
         */
        const FORM = document.querySelector(ID_FORM);
        /**
         * @type {HTMLSelectElement}
         */
        const SELECT_VARA = document.querySelector(ID_VARA);
        //preenche o select da vara caso nao esteja preenchido corretamente
        SELECT_VARA.value = (await aguardarSelect(ID_VARA, option => option.textContent.includes("4") && option.textContent.includes("Foz do Iguaçu")))[0];
        /**
         * @type {string[]}
         * possui o atributo value de todas as entidades
         */
        const ENTIDADES = await aguardarSelect(ID_ENTIDADE);
        console.log(ENTIDADES)
    }
    /**
     * função necessária pois o select é preenchido alguns milissegundos atrasado
     * @param {string} idSelect 
     * @param {(option: HTMLOptionElement)=>boolean} [filtro=null] 
     * @return {Promise<string[]>}
     */
    async function aguardarSelect(idSelect, filtro = null) {
        return new Promise((response) => {
            const interval = setInterval(() => {
                const select = document.querySelector(idSelect);
                if (!select) {
                    return;
                }
                const options = select.querySelectorAll('option');
                const temOpcoesValidas = Array.from(options).some(option => option.value && option.value.trim() !== ' ' && option.value.trim() !== 'Selecione' && option.value.trim() !== 'null');
                if (options.length > 1 && temOpcoesValidas) {
                    clearInterval(interval);
                    let respostas = Array.from(options);
                    if (filtro)
                        respostas = respostas.filter(filtro);
                    respostas = respostas.filter(option => option.value && option.value.trim() !== ' ' && option.value.trim() !== 'Selecione' && option.value.trim() !== 'null');
                    response(respostas.map(option => option.value));
                }
                if (options.length === 1 && (!options[0].value || options[0].value.trim() === 'null')) {
                    clearInterval(interval);
                    response([]);
                }
            }, 300); //tempo de checagem
        });
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

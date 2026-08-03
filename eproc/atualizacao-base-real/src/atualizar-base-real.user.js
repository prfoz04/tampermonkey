// ==UserScript==
// @name         eproc - Atualizar banco de dados para o site (planilhas de entidade)
// @namespace    https://github.com/4Vara
// @version      1.0.10
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
     * id da tabela gerada ao apertar botao
     */
    const ID_RESULTADO = "#divResultadoPesquisa";
    /**
     * id do botao que gera o resultado, não vem através de submit
     */
    const ID_BOTAO_PESQUISAR = "#btnPesquisar";
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
        /**
         * @type {HTMLInputElement}
         */
        const BOTAO_PESQUISAR = document.querySelector(ID_BOTAO_PESQUISAR);
        //preenche o select da vara caso nao esteja preenchido corretamente
        const VALUE_VARA = (await aguardarSelect(ID_VARA, option => option.textContent.includes("4") && option.textContent.includes("Foz do Iguaçu")))[0];
        forcarTrocaSelect(SELECT_VARA, VALUE_VARA);
        forcarChange(SELECT_VARA);
        /**
         * @type {string[]}
         * possui o atributo value de todas as entidades
         */
        const ENTIDADES = await aguardarSelect(ID_ENTIDADE);
        /**
         * guarda os elementos no vetor para ficar mais rápido iterar sobre depois
         * @type {HTMLTableElement[]}
         */
        const TABELAS = [];
        //itera sobre entidades capturando as tabelas resultado
        try {
            for (let value of ENTIDADES) {
                forcarTrocaSelect(SELECT_ENTIDADE, value);
                forcarChange(SELECT_ENTIDADE);
                BOTAO_PESQUISAR.click();
                var resposta = await esperaResultado()
                if (resposta)
                    TABELAS.push(resposta.innerHTML);
            }
            console.log(TABELAS)
        } catch (error) {
            console.error(error);
        }
    }
    /**
     * @typedef linhaPrestador
     * @property {string} Entidade
     * @property {string} Prestador
     * @property {string} Ano
     * @property {string} Mes
     * @property {string} Horas
     * @property {string} Observações
     */
    /**
     * transforma a tabela em um vetor de objetos
     * @param {HTMLTableElement} tabela 
     * @return {linhaPrestador[]}
     */
    function extraiDados(tabela) {

    }
    /**
     * espera a página responder com uma nova tabela
     * @returns {Promise<HTMLTableElement>}
     */
    function esperaResultado() {
        return new Promise((response) => {
            const INTERVAL = setInterval(() => {
                /**
                 * @type {HTMLDivElement}
                 */
                var resultado = document.querySelector(ID_RESULTADO);
                if (resultado) {
                    clearInterval(INTERVAL);
                    //ignora as tabelas que não possuem registro
                    var primeiraLinha = resultado.querySelectorAll('td');
                    //se tiver só uma coluna, é vazio
                    if (primeiraLinha.length === 1) {
                        clearInterval(INTERVAL);
                        response(null);
                    }
                    response(resultado.querySelector('table'));
                }
            }, 50) 
        })
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
                    respostas = respostas.filter(option => option.value && option.value !== ' ' && option.value.trim() !== 'Selecione' && option.value.trim() !== 'null');
                    response(respostas.map(option => option.value));
                }
                if (options.length === 1 && (!options[0].value || options[0].value.trim() === 'null')) {
                    clearInterval(interval);
                    response([]);
                }
            }, 50); //tempo de checagem
        });
    }
    /** 
     * necessário pois a página usa jquery
     * @param {HTMLSelectElement} elemento 
     */
    function forcarChange(elemento) {
        elemento.dispatchEvent(new Event('change', { bubbles: true }));
        // @ts-ignore
        if (typeof window.jQuery !== 'undefined') {
            // @ts-ignore
            window.jQuery(elemento).trigger('change');
        }
    }
    /**
     * necessário pois a página usa jquery
     * @param {HTMLSelectElement} selectElement 
     * @param {string} valor 
     */
    function forcarTrocaSelect(selectElement, valor) {
        if (!selectElement) {
            return;
        }
        const option = Array.from(selectElement.options).find(opt => opt.value === valor);
        if (!option) {
            return;
        }
        Array.from(selectElement.options).forEach(opt => opt.selected = false);
        option.selected = true;
        selectElement.value = valor;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        // @ts-ignore
        if (window.$ || window.jQuery) {
            // @ts-ignore
            (window.$ || window.jQuery)(selectElement).trigger('change');
        }
    }
    /**
     * cria o botao que inicia a execução do script, o mesmo some ao clicar nele
     */
    function criarBotao() {
        var botao = document.createElement('button');
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

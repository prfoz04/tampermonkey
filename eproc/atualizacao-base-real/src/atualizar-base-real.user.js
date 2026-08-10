// ==UserScript==
// @name         eproc - Atualizar banco de dados do site (planilhas de entidade)
// @namespace    https://github.com/4Vara
// @version      1.4.1
// @description  Recolhe as informações de execução de pena do eproc e os insere nas devidas planilhas de entidade, a fim de normalizar os dados para vizualização no site
// @author       Leonardo
// @match        https://eproc.jfpr.jus.br/eprocV2/controlador.php?acao=pena_alternativa_consulta_interna*
// @updateURL    https://raw.githubusercontent.com/prfoz04/tampermonkey/main/eproc/atualizacao-base-real/src/atualizar-base-real.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/tampermonkey/main/eproc/atualizacao-base-real/src/atualizar-base-real.user.js
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// ==/UserScript==

(async function () {
    'use strict';
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
     * id da div que contém o formulário, para esconder enquanto o script roda
     */
    const ID_DIV_PRINCIPAL = "#divInfraAreaTela";
    /**
     * fluxo de execução principal do script
     */
    async function executar() {
        /**
         * @type {HTMLDivElement}
         */
        const DIV_PRINCIPAL = document.querySelector(ID_DIV_PRINCIPAL);
        const DISPLAY_PRINCIPAL = DIV_PRINCIPAL.style.display;
        //esconde a div principal para não atrapalhar a execução do script
        DIV_PRINCIPAL.style.display = 'none';
        //cria a barra de progresso
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
        const BARRA_CARREGAMENTO = new ProgressBar(ENTIDADES.length);
        const TABELAS = [];
        //itera sobre entidades capturando as tabelas resultado
        try {
            var contador = 0;
            for (let value of ENTIDADES) {
                forcarTrocaSelect(SELECT_ENTIDADE, value);
                forcarChange(SELECT_ENTIDADE);
                BOTAO_PESQUISAR.click();
                var resposta = await esperaResultado()
                if (resposta)
                    TABELAS.push(extraiDados(resposta));
                BARRA_CARREGAMENTO.update(++contador);
            }
        } catch (error) {
            console.error(error);
        }
        alert(await enviar(TABELAS.flat()));
        BARRA_CARREGAMENTO.remove();
        //retorna a página ao estado original
        window.location.reload();
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
     * dispacha o lote para a api
     * @param {linhaPrestador[]} lote 
     */
    function enviar(lote) {
    const URL_API = "https://script.google.com/macros/s/AKfycbxH4GeMfR5z0deOlwgFOpvlEY9LLKAzj921hYuEOgM4pt-oc7ce5sviMQxhqnzMP914/exec";
    const DATA = new URLSearchParams();
    DATA.append('atualizarPlanilhas', JSON.stringify(lote));
    try {
        return fetch(URL_API, {
            method: 'POST',
            body: DATA
        }).then(res => res.text())
    } catch (error) {
        alert('Erro ao exportar dados: ' + error);
    }
}
    /**
     * transforma a tabela em um vetor de objetos
     * @param {HTMLTableElement} tabela 
     * @return {linhaPrestador[]}
     */
    function extraiDados(tabela) {
        const linhas = Array.from(tabela.querySelectorAll('tr'));
        const cabecalho = Array.from(linhas[0].querySelectorAll('th')).map(th => th.textContent.trim()).map(str => str.replace(/ç/g, 'c').replace(/õ/g, 'o').replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ /g, '').replace(/\./g, '').replace(/\//g, '').replace(/\-/g, '').toLowerCase());
        const dados = [];
        for (let i = 1; i < linhas.length; i++) {
            const colunas = Array.from(linhas[i].querySelectorAll('td'));
            const linha = {};
            cabecalho.forEach((coluna, index) => {
                // @ts-ignore
                linha[coluna] = colunas[index].textContent.trim();
            });
            dados.push(linha);
        }
        // @ts-ignore
        return dados;
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
                        return response(null);
                    }
                    response(resultado.querySelector('table'));
                }
            }, 500) 
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
            }, 500); //tempo de checagem
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
    class ProgressBar {
    /**
     * @param {number} totalItems Quantidade total de itens a processar
     * @param {string} [titulo='Gerando Relatórios...'] Título da janela
     */
    constructor(totalItems, titulo = 'Consultando registros...') {
        this.totalItems = totalItems;
        this.currentProgress = 0;
        // Container principal (Overlay escuro)
        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: '99999',
            fontFamily: 'Arial, sans-serif',
        });
        // Caixa modal branca
        this.modal = document.createElement('div');
        Object.assign(this.modal.style, {
            backgroundColor: '#fff', padding: '25px', borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '400px', textAlign: 'center'
        });
        // Título
        this.titleEl = document.createElement('h3');
        this.titleEl.textContent = titulo;
        Object.assign(this.titleEl.style, {
            marginTop: '0', marginBottom: '15px', color: '#333', fontSize: '18px'
        });
        // Texto de status (ex: "Processando 1 de 10")
        this.statusEl = document.createElement('div');
        this.statusEl.textContent = 'Iniciando...';
        Object.assign(this.statusEl.style, {
            marginBottom: '15px', color: '#555', fontSize: '14px', fontWeight: 'bold'
        });
        // Fundo da barra
        this.barContainer = document.createElement('div');
        Object.assign(this.barContainer.style, {
            width: '100%', height: '22px', backgroundColor: '#e0e0e0',
            borderRadius: '11px', overflow: 'hidden', border: '1px solid #ccc'
        });
        // Preenchimento da barra
        this.barFill = document.createElement('div');
        Object.assign(this.barFill.style, {
            width: '0%', height: '100%', backgroundColor: '#4CAF50', // Verde
            transition: 'width 0.3s ease, background-color 0.3s ease'
        });
        // Montagem do DOM
        this.barContainer.appendChild(this.barFill);
        this.modal.append(this.titleEl, this.statusEl, this.barContainer);
        this.container.appendChild(this.modal);
        document.body.appendChild(this.container);
    }
    /**
     * Atualiza o progresso da barra
     * @param {number} current Valor atual (ex: índice do loop)
     * @param {string} [textoStatus] Texto opcional para exibir (ex: nome do prestador)
     */
    update(current, textoStatus) {
        this.currentProgress = current;
        const percentage = this.totalItems > 0 ? Math.min(100, Math.round((current / this.totalItems) * 100)) : 100;
        
        this.barFill.style.width = `${percentage}%`;
        
        if (textoStatus) {
            this.statusEl.textContent = textoStatus;
        } else {
            this.statusEl.textContent = `Processando ${current} de ${this.totalItems} (${percentage}%)`;
        }
    }
    /**
     * Finaliza a barra de progresso (Muda a cor e exibe mensagem de sucesso)
     * @param {string} [mensagem='Concluído!'] 
     */
    finish(mensagem = 'Concluído com sucesso!') {
        this.update(this.totalItems);
        this.statusEl.textContent = mensagem;
        this.barFill.style.backgroundColor = '#2196F3';
        // Remove automaticamente após 2 segundos
        setTimeout(() => this.remove(), 2000);
    }
    /**
     * Remove os elementos da tela manualmente
     */
    remove() {
        if (this.container && this.container.parentNode) {
            this.container.remove();
        }
    }
    }
    criarBotao();

})();

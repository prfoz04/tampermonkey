// ==UserScript==
// @name         eproc - Geração de relatórios mensais
// @namespace    https://github.com/4Vara
// @version      1.0.8
// @description  Gera automaticamente os relatórios do último mês registrado para todos os prestadores no eproc.
// @author       Leonardo
// @match        https://eproc.jfpr.jus.br/eprocV2/controlador.php?acao=relatorio_diario_cumprimento_pena*
// @updateURL    https://raw.githubusercontent.com/prfoz04/tampermonkey/eproc/geracao de relatorios/src/geracao-de-relatorios.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/tampermonkey/eproc/geracao de relatorios/src/geracao-de-relatorios.user.js
// @run-at       document-idle
// @grant        GM_download
// ==/UserScript==

(async function () {
    'use strict';
    const ID_SELECT_PRESTADORES = '#cmbPrestador';

    const ID_SELECT_VARA = '#cmbVara';

    const ID_SELECT_ENTIDADE = '#cmbEntidade';

    const ID_FORM = '#frmConsulta';

    const ID_MES = '#cmbMesAno';

    //value necessário para fazer a requisição da geração de relatório
    const CMB_VARA = await aguardarSelect(ID_SELECT_VARA, option => option.textContent.includes('Foz do Iguaçu') && option.textContent.includes('4'));

    const DATE = new Date();

    /**
     * @type {number}
     */
    var tempoInicio;

    /**
     * @type {number}
     */
    var tempoFim;

    /**
     * itera sobre os prestadores capturando os formulários
     * @param {string} mesAno
     */
    async function gerar(mesAno) {
        if (!mesAno || mesAno === 'Selecione')
            return;
        tempoInicio = performance.now();
        /**
         * @type {HTMLSelectElement}
         */
        const selectVara = document.querySelector(ID_SELECT_VARA);
        /**
         * @type {HTMLSelectElement}
         */
        const selectEntidade = document.querySelector(ID_SELECT_ENTIDADE);
        /**
         * @type {HTMLSelectElement}
         */
        const selectPrestadores = document.querySelector(ID_SELECT_PRESTADORES);
        /**
         * @type {HTMLFormElement}
         */
        const form = document.querySelector(ID_FORM);

        /**
         * @type {HTMLFieldSetElement}
         */
        const fieldset = document.querySelector('#fldInformacoesConsulta')
        let displayField = fieldset.style.display;
        fieldset.style.display = 'none';

        var linksPDF = [];

        forcarTrocaSelect(selectVara, CMB_VARA[0]);
        forcarChange(selectVara);

        const entidadeSelecionada = selectEntidade?.value || ' ';
        if (entidadeSelecionada && entidadeSelecionada.trim() !== ' ' && entidadeSelecionada.trim() !== 'Selecione') {
            forcarTrocaSelect(selectEntidade, entidadeSelecionada);
            forcarChange(selectEntidade);
        }

        const prestadoresDisponiveis = await aguardarSelect(ID_SELECT_PRESTADORES);

        const BARRA_CARREGAMENTO = new ProgressBar(prestadoresDisponiveis.length);

        let contador = 0;

        for (const valorPrestador of prestadoresDisponiveis) {
            BARRA_CARREGAMENTO.update(++contador);
            forcarTrocaSelect(selectPrestadores, valorPrestador);
            forcarChange(selectPrestadores);

            const mesesCumpridos = await aguardarSelect(ID_MES);
            const nomePrestador = selectPrestadores.options[selectPrestadores.selectedIndex]?.text || 'Prestador sem nome';
            const mesNormalizado = normalizarMesAno(mesAno);
            const mesesDisponiveisNormalizados = mesesCumpridos.map(normalizarMesAno);

            if (!mesesCumpridos.length || mesesDisponiveisNormalizados.indexOf(mesNormalizado) === -1) {
                continue;
            }

            /**
             * @type {HTMLSelectElement}
             */
            const selectMes = document.querySelector(ID_MES);
            const opcaoCorrespondente = Array.from(selectMes.options).find(opt => {
                const textoOption = normalizarMesAno(opt.textContent);
                const valorOption = normalizarMesAno(opt.value);
                const mesProcurado = mesNormalizado;
                return textoOption === mesProcurado || valorOption === mesProcurado;
            });

            if (!opcaoCorrespondente) {
                continue;
            }

            forcarTrocaSelect(selectMes, opcaoCorrespondente.value);
            forcarChange(selectMes);

            const formData = new FormData(form);
            // @ts-ignore
            const params = new URLSearchParams(formData);
            params.append('btnPesquisar', 'Gerar Relatório');
            params.set('cmbVara', selectVara.value);
            params.set('cmbEntidade', entidadeSelecionada);
            params.set('cmbPrestador', valorPrestador);
            params.set('cmbMesAno', opcaoCorrespondente.value);

            try {
                //cria um iframe para que as abas sejam abertas ocultas aqui e não polua a tela do usuário
                const iframeName = `iframe_oculto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                const iframe = document.createElement('iframe');
                iframe.name = iframeName;
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                const formOculto = document.createElement('form');
                formOculto.method = form.method || 'POST';
                formOculto.action = form.action;
                formOculto.target = iframeName; 
                formOculto.style.display = 'none';

                for (const [nomeCampo, valorCampo] of params.entries()) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = nomeCampo;
                    input.value = valorCampo;
                    formOculto.appendChild(input);
                }

                document.body.appendChild(formOculto);
                formOculto.submit();
                formOculto.remove();
                //destroi o iframe invisível
                setTimeout(() => iframe.remove(), 15000);
                linksPDF.push({ prestador: nomePrestador, pdfUrl: `${form.action}?${params.toString()}`, erro: false, descricao: "" });
            }
            catch (error) {
                linksPDF.push({ prestador: nomePrestador, pdfUrl: " ", erro: true, descricao: `Erro na busca do relatório: ${error}` })
            }
        }
        BARRA_CARREGAMENTO.finish();
        BARRA_CARREGAMENTO.remove();
        await divideEmLotes(linksPDF.filter(link => link.prestador !== 'Selecione'), 6, 3);
        criaBotao();
        fieldset.style.display = displayField;
    }

    /**
     * para contornar o tempo máximo de execução do App Script envia em lotes
     * @param {linkPrestador[]} links 
     * @param {number} tamLote 
     * @param {number} promissesConcorrentes
     */
    async function divideEmLotes(links, tamLote, promissesConcorrentes) {
        try {const lotesArq = Math.ceil(links.length / tamLote);
        const lotesPromisse = Math.ceil(lotesArq / promissesConcorrentes)
        let informacao = [];
        let lote = 1;
        let promises = [];
        let respostas = [];
        for (let link of links) {
            informacao.push(link);
            if (informacao.length >= tamLote) {
                const dadosAtual = [...informacao];
                const loteAtual = lote;
                promises[lote - 1] = () => enviarParaPlanilhas(dadosAtual, loteAtual);
                informacao = [];
                lote++;
            }
        }
        if (informacao.length >= 1) {
            const dadosAtual = [...informacao];
            const loteAtual = lote;
            promises[lote - 1] = () => enviarParaPlanilhas(dadosAtual, loteAtual);
        }
        const BARRA_CARREGAMENTO = new ProgressBar(lotesPromisse + 1, "Enviando arquivos...");
        let contador = 1;
        BARRA_CARREGAMENTO.update(contador++);
        for (let i = 0; i < promises.length; i += promissesConcorrentes) {
            const bloco = promises.slice(i, i + promissesConcorrentes).map(f => f());
            const respostaBloco = await Promise.all(bloco);
            respostas.push(...respostaBloco);
            BARRA_CARREGAMENTO.update(contador++)
        }
        let totalErros = 0;
        let total = 0;
        for (let link of links)
            if (link.erro)
                totalErros++;
            else
                total++
        BARRA_CARREGAMENTO.finish();
        tempoFim = performance.now()
        await enviarParaPlanilhas([null], -1, {respostas: respostas, total: total.toString(), totalErros: totalErros.toString(), tempoExecucao: ((tempoFim-tempoInicio)/60000).toFixed(2).toString().replace('.', ',')})
        BARRA_CARREGAMENTO.remove();}
        catch (error) {
            console.error(error);
            alert("Falha no envio dos arquivos");
        }
    }

    /**
     * @typedef informativo
     * @property {string[]} respostas
     * @property {string} total
     * @property {string} totalErros
     * @property {string} tempoExecucao
     */

    /**
     * @typedef linkPrestador
     * @property {string} pdfUrl
     * @property {string} prestador
     * @property {boolean} erro
     * @property {string} descricao 
     */

    /**
     * envia para a planilha API para que ela possa registrar os valores na planilha PSC e enviar os pdfs para o drive
     * @param {linkPrestador[]} links 
     * @param {number} lote
     * @param {informativo} informe
     */
    async function enviarParaPlanilhas(links, lote, informe = null) {
        const url = "https://script.google.com/macros/s/AKfycbxH4GeMfR5z0deOlwgFOpvlEY9LLKAzj921hYuEOgM4pt-oc7ce5sviMQxhqnzMP914/exec";
        const formData = new FormData();
        formData.append("relatoriosEproc", JSON.stringify(links));
        formData.append("lote", lote.toString());
        if (informe) {
            formData.append("informativo", JSON.stringify(informe));
        }
        try {
            const resposta = await fetch(url, { method: 'POST', body: formData }).then(response => response.json());
            if (!resposta.ok) {
                const mensagemErro = `Lote ${lote} - Erro no servidor (Status: ${resposta.status})`;
                (links || []).forEach(link => {
                    if (!link) {
                        return;
                    }
                    link.erro = true;
                    link.descricao = link.descricao ? `${link.descricao}\n${mensagemErro}` : mensagemErro;
                });
                return mensagemErro;
            }
            return await resposta.response();
        } catch (error) {
            const mensagemErro = `Lote ${lote} - Erro ao enviar para planilha eproc: ${error}`;
            (links || []).forEach(link => {
                if (!link) {
                    return;
                }
                link.erro = true;
                link.descricao = link.descricao ? `${link.descricao}\n${mensagemErro}` : mensagemErro;
            });
            return mensagemErro;
        }
    }

    /**
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
     * normaliza de forma robusta os meses
     * @param {string} valor 
     * @returns {string}
     */
    function normalizarMesAno(valor) {
        return (valor || '')
            .toString()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^0-9]/g, '');
    }

    function criaBotao() {
        /**
         * @type {HTMLFormElement}
         */
        const div = document.querySelector(ID_FORM);
        const botao = document.createElement('button');
        botao.className = 'eproc-button-primary'
        botao.type = 'button'
        botao.onclick = criarInput;
        botao.id = 'gerar-tudo';
        botao.textContent = 'Gerar todos os relatórios'
        div.appendChild(botao);
    }

    function criarInput() {
        document.querySelector('#gerar-tudo').remove();
        const div = document.querySelector(ID_FORM);
        const select = document.createElement('select');
        select.className = 'eproc-select w-default';
        select.onchange = function() {
            gerar(select.value);
            select.remove();
        };
        select.appendChild(criarOption('Selecione'));
        for (let ano = DATE.getFullYear(); ano >= 2026; ano--) {
            for (let mes = DATE.getMonth() + 1; mes >= 1; mes--) {
                select.appendChild(criarOption(`${mes<10?"0"+mes:mes} / ${ano}`));
            }
        }
        div.appendChild(select);
    }

    /**
     * @param {string} text 
     * @returns {HTMLOptionElement}
     */
    function criarOption(text) {
        var option = document.createElement('option');
        option.value = text;
        option.textContent = text;
        return option
    }

    class ProgressBar {
    /**
     * @param {number} totalItems Quantidade total de itens a processar
     * @param {string} [titulo='Gerando Relatórios...'] Título da janela
     */
    constructor(totalItems, titulo = 'Gerando Relatórios...') {
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
        this.barFill.style.backgroundColor = '#2196F3'; // Muda para azul ao concluir
        
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

    criaBotao();

})();

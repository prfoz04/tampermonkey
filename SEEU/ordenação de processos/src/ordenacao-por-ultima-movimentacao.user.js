// ==UserScript==
// @name         SEEU - Ordenação por Última Movimentação
// @namespace    https://github.com/4Vara
// @version      1.5.0
// @description  Ordena os itens com base na última movimentação, cria uma coluna com a data da última movimentação e adiciona um botão para ordenar os itens por essa coluna.
// @author       Leonardo
// @match        https://seeu.pje.jus.br/seeu/*
// @updateURL    https://raw.githubusercontent.com/prfoz04/scripts-tampermonkey/main/src/SEEU/ordenacao-por-ultima-movimentacao.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/scripts-tampermonkey/main/src/SEEU/ordenacao-por-ultima-movimentacao.user.js
// @run-at       document-idle
// ==/UserScript==

//projeto congelado
(function() {
    'use strict';
    
    console.log('[SEEU - Ordenação por Última Movimentação] Script carregado.');

    const tabela = 'table.resultTable';

    const totalProcessos = parseInt(document.querySelector('.navLeft').textContent);

    let processados = 0;

    let ordenadoMaisAntigo = true;

    /**
     * necessário pois o link do login é o mesmo do da página de consulta
     */
    async function executar() {
        //para que não execute em páginas erradas
        if (!document.querySelector(`${tabela}`) || !document.querySelector('.arrowLastOn'))
            return;
        BarraDeProgresso.criar();
        criarColuna();
        buscarLinhas();
    }

    function contaRegistros() {
        return document.querySelectorAll(`${tabela} tbody tr`).length;
    }

    /**
     * navega pelas páginas carregando as tabelas encontradas e inserindo na página 1
     */
    async function buscarLinhas() {
        const tabelaPrincipal = document.querySelector(`${tabela} tbody`);
        //utiliza o botao que leva para ultima pagina para ter o total de páginass
        const botaoUltimaPagina = document.querySelector('.arrowLastOn');
        let total = 1;
        if (botaoUltimaPagina) {
            // @ts-ignore
            const expressao = botaoUltimaPagina.href.match(/processoPageNumber'\]\.value='(\d+)'/);
            total = expressao ? parseInt(expressao[1], 10) : total;
        }
        let itens = 0;
        const promissesTabelas = [];
        for (let i = 2; i <= total; i++) {
            try {
                // @ts-ignore
                const formulario = document.forms['processoForm'];
                if (formulario) {
                    const dados = new FormData(formulario);
                    //página
                    dados.set('processoPageNumber', i.toString());
                    //forma de ordenação
                    dados.set('processoSortColumn', 'numeroUnico');
                    dados.set('processoSortOrder', 'ASC');
                    const requisicao = fetch(formulario.action, {
                        method: formulario.method || 'POST',
                        body: dados
                    })
                    .then(response => response.arrayBuffer())
                    .then(async buffer => {
                        //padrao usado pelo SEEU é o iso (por algum motivo)
                        const decodificador = new TextDecoder('iso-8859-1');
                        const html = decodificador.decode(buffer);
                        //trsnaforma a resposta em num elemento html
                        const parser = new DOMParser();
                        const documentoVirtual = parser.parseFromString(html, 'text/html');
                        await inserirDatas(documentoVirtual);
                        return documentoVirtual.querySelectorAll(`${tabela} tbody tr`);
                    });
                    promissesTabelas.push(requisicao);
                }
                else {
                    console.error('Formulário não encontrado');
                    break;
                }
            }
            catch (erro) {
                console.error(`Erro ao fazer fetch para a página ${i}: ${erro}`)
                break;
            }
        }
        //processa todas ao mesmo tempo e depois insere em lotes na aba principal
        const resultado = await Promise.all(promissesTabelas);
        resultado.forEach(
            lote => lote.forEach(
                linha => {
                    tabelaPrincipal.appendChild(linha);
                    itens++;
                }
            )
        );

        console.log(`[SEEU - Ordenação por Última Movimentação] ${itens} adicionados, consultado até a página ${total}`)
        const navLeft = document.querySelector('.navLeft');
        navLeft.textContent = `${contaRegistros().toString()} registro(s) encontrado(s)`;
        const navRight = document.querySelector('.navRight');
        navRight.remove();
        ordenaLinhas(ordenadoMaisAntigo);
        BarraDeProgresso.remover();
    }

    /**
     * cria a coluna "Última Movimentação" na tabela de processos, coloca a possibilidade de ordenar os itens
     */
    function criarColuna() {
        let linha = document.querySelector(`${tabela} thead tr`);
        if (!linha) {
            console.error('Aba total de processos não encontrada.');
            return;
        }
        let th = document.createElement('th');
        th.innerHTML = '<a href="#" class="ordenar-por-ultima-movimentacao">Última Movimentação</a>';
        th.addEventListener('click', () => {
            ordenadoMaisAntigo = !ordenadoMaisAntigo;
            ordenaLinhas(ordenadoMaisAntigo);
        })
        linha.appendChild(th);
        inserirDatas();
    }

    /**
     * ordena a tabela
     * @param {boolean} maisAntigo 
     */
    function ordenaLinhas(maisAntigo) {
        const linhas = Array.from(document.querySelectorAll(`${tabela} tbody tr`));
        linhas.sort((a, b) => {
            let dataA = data(a).getTime();
            let dataB = data(b).getTime();
            if (maisAntigo)
                return dataA - dataB;
            else
                return dataB - dataA;
        })
    }

    /** * Extrai e formata a data da linha da tabela
     * @param {Element} tr 
     * @returns {Date} 
     */
    function data(tr) {
        let str = tr.querySelector('.ultima-movimentacao').textContent.trim();
        // Transforma 'DD/MM/YYYY' em um array [DD, MM, YYYY]
        let partes = str.split('/'); 
        if (partes.length === 3) {
            return new Date(`${partes[2]}-${partes[1]}-${partes[0]}T00:00:00`);
        }
        return new Date(0); 
    }

    /**
     * insere o dado de data da última movimentação em todas as linhas na tela 
     * @param {Document} documento 
     */
    async function inserirDatas(documento = document) {
        const linhas = documento.querySelectorAll(`${tabela} tbody tr`);
        for (let linha of linhas) {
            // @ts-ignore
            const link = linha.querySelector('.link').href;
            const data = await buscaData(link);
            const td = documento.createElement('td');
            td.style.textAlign = 'center';
            td.innerHTML = data;
            td.className = 'ultima-movimentacao';
            linha.appendChild(td);
        }
    }

    /**
     * abre a página do processo e busca a data da última movimentação
     * @param {string} url link da vizualização de um processo específico
     * @return {Promise<string>} data da última movimentação no formato dd/mm/yyyy
     */
    async function buscaData(url) {
        let data = await fetch(url)
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                //doc é o documento HTML da página do processo
                const doc = parser.parseFromString(html, 'text/html');
                const tabel = doc.querySelector(tabela);
                const primeiraLinha = tabel.querySelector('tr.even');
                const coluna = primeiraLinha.children[3].textContent;
                return coluna.toString().trim().substring(0, 10);
            });
        BarraDeProgresso.atualizar(++processados, totalProcessos);
        return data;
    }
    /**
     * o carregamento é simulado através da inserção das datas de última movimentação na coluna nova,
     * já que, essa é a operação mais custosa do programa
     */
    const BarraDeProgresso = {
        criar: function() {
            // Se a barra já existir na tela, não cria uma duplicada
            if (document.getElementById('seeu-overlay-progresso')) return;

            // Cria o HTML da tela escura e da barra, já com o CSS inline
            const html = `
                <div id="seeu-overlay-progresso" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); z-index: 999999; display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif; backdrop-filter: blur(3px);">
                    <div style="background: #2c3e50; color: white; padding: 30px; border-radius: 12px; width: 450px; text-align: center; box-shadow: 0 15px 30px rgba(0,0,0,0.6);">
                        <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: normal; letter-spacing: 0.5px;">SEEU - Ordenando Processos...</h2>
                    
                        <div style="background: #1a252f; width: 100%; height: 22px; border-radius: 15px; overflow: hidden; margin-bottom: 15px; border: 1px solid #34495e; box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);">
                            <div id="seeu-barra-preenchimento" style="width: 0%; height: 100%; background: linear-gradient(90deg, #1abc9c, #3498db); transition: width 0.3s ease-out;"></div>
                        </div>
                    
                        <p id="seeu-texto-progresso" style="margin: 0; font-size: 14px; color: #bdc3c7;">Processando... 0% (0/0)</p>
                    </div>
                </div>
            `;
        
            // Injeta a barra no final do documento
            document.body.insertAdjacentHTML('beforeend', html);
        },

        /**
         * atualiza a porcentagem
         * @param {number} atual 
         * @param {number} total 
         */
        atualizar: function(atual, total) {
            const barra = document.getElementById('seeu-barra-preenchimento');
            const texto = document.getElementById('seeu-texto-progresso');

            if (barra && texto && total > 0) {
                const porcentagem = Math.round((atual / total) * 100);
            
                // Atualiza a largura visual da barra e o texto na tela
                barra.style.width = `${porcentagem}%`;
                texto.innerText = `Processando... ${porcentagem}% (Processos ${atual}/${total})`;
            }
        },

        remover: function() {
            const overlay = document.getElementById('seeu-overlay-progresso');
            if (overlay) {
                // Um pequeno atraso visual para o utilizador ver a barra chegar aos 100%
                setTimeout(() => {
                    overlay.remove();
                }, 600);
            }
        }
    };

    executar();
})();

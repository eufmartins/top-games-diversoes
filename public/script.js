// Configurações globais
const app = {
    songsData: [],
    filteredSongs: [],
    favorites: JSON.parse(localStorage.getItem('favorites')) || [],
    history: JSON.parse(localStorage.getItem('history')) || [],
    genres: [],
    selectedGenres: [],
    currentPage: 1,
    itemsPerPage: 50
};

// URL da API - será configurada no .env
const API_BASE_URL = window.location.origin + '/api';

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function () {
    // Elementos da UI
    const ui = {
        searchInput: document.getElementById('searchInput'),
        searchButton: document.getElementById('searchButton'),
        suggestions: document.getElementById('suggestions'),
        resultsTableBody: document.getElementById('resultsTableBody'),
        recommendationsContainer: document.getElementById('recommendationsContainer'),
        showGenresBtn: document.getElementById('showGenresBtn'),
        genresCheckboxContainer: document.getElementById('genresCheckboxContainer'),
        genresList: document.getElementById('genresList'),
        prevPageBtn: document.getElementById('prevPageBtn'),
        nextPageBtn: document.getElementById('nextPageBtn'),
        pageInfo: document.getElementById('pageInfo')
    };

    // Carrega as músicas da API
    loadSongsFromAPI().then(() => {
        loadGenres();
        setupGenreFilters();
        applyFilters();
    });

    // Event listeners
    ui.searchButton.addEventListener('click', () => {
        app.currentPage = 1;
        applyFilters();
    });

    ui.searchInput.addEventListener('input', () => showSuggestions(ui.searchInput.value));

    ui.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            app.currentPage = 1;
            applyFilters();
        }
    });

    ui.showGenresBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.genresCheckboxContainer.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!ui.genresCheckboxContainer.contains(e.target) && e.target !== ui.showGenresBtn) {
            ui.genresCheckboxContainer.classList.remove('show');
        }
    });

    ui.prevPageBtn.addEventListener('click', () => {
        if (app.currentPage > 1) {
            app.currentPage--;
            renderCurrentPage();
        }
    });

    ui.nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(app.filteredSongs.length / app.itemsPerPage);
        if (app.currentPage < totalPages) {
            app.currentPage++;
            renderCurrentPage();
        }
    });

    // Funções auxiliares
    async function loadSongsFromAPI() {
        showLoading();

        try {
            const response = await fetch(`${API_BASE_URL}/songs`);
            if (!response.ok) throw new Error('Erro ao carregar músicas');

            const data = await response.json();
            app.songsData = data.map(item => ({
                code: item.CODIGO.toString(),
                interpreter: sanitizeInput(item.CANTOR),
                song: sanitizeInput(item.song_title),
                lyric: sanitizeInput(item.lyric_start),
                genre: sanitizeInput(item.GENERO),
                active: item.ATIVO === 'S'
            }));
        } catch (error) {
            console.error('Erro:', error);
            showMessage('Erro ao carregar o catálogo. Verifique o console para detalhes.');
        }
    }

    function sanitizeInput(input) {
        if (!input) return '';
        return input.toString()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function loadGenres() {
        const genres = new Set();
        app.songsData.forEach(song => {
            if (song.genre && song.active) genres.add(song.genre);
        });
        app.genres = Array.from(genres).sort();
    }

    function setupGenreFilters() {
        ui.genresList.innerHTML = '';

        const allGenresItem = document.createElement('div');
        allGenresItem.className = 'genre-checkbox-item';
        allGenresItem.innerHTML = `
            <input type="checkbox" id="allGenres" ${app.selectedGenres.length === 0 ? 'checked' : ''}>
            <label for="allGenres">Todos os gêneros</label>
        `;
        ui.genresList.appendChild(allGenresItem);

        app.genres.forEach(genre => {
            const genreItem = document.createElement('div');
            genreItem.className = 'genre-checkbox-item';
            genreItem.innerHTML = `
                <input type="checkbox" id="genre-${genre}" value="${genre}" 
                    ${app.selectedGenres.includes(genre) ? 'checked' : ''}>
                <label for="genre-${genre}">${genre}</label>
            `;
            ui.genresList.appendChild(genreItem);
        });

        document.getElementById('allGenres').addEventListener('change', function () {
            if (this.checked) {
                ui.genresList.querySelectorAll('input[type="checkbox"]:not(#allGenres)').forEach(checkbox => {
                    checkbox.checked = false;
                });
                app.selectedGenres = [];
                applyFilters();
            }
        });

        ui.genresList.querySelectorAll('input[type="checkbox"]:not(#allGenres)').forEach(checkbox => {
            checkbox.addEventListener('change', function () {
                document.getElementById('allGenres').checked = false;

                if (this.checked) {
                    app.selectedGenres.push(this.value);
                } else {
                    app.selectedGenres = app.selectedGenres.filter(g => g !== this.value);
                }

                if (app.selectedGenres.length === 0) {
                    document.getElementById('allGenres').checked = true;
                }

                applyFilters();
            });
        });
    }

    async function applyFilters() {
        const searchTerm = ui.searchInput.value.trim();
        app.currentPage = 1;

        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('q', searchTerm);
            if (app.selectedGenres.length > 0) params.append('genres', app.selectedGenres.join(','));

            const response = await fetch(`${API_BASE_URL}/songs/search?${params.toString()}`);
            if (!response.ok) throw new Error('Erro na busca');

            const data = await response.json();
            app.filteredSongs = data.map(item => ({
                code: item.CODIGO.toString(),
                interpreter: sanitizeInput(item.CANTOR),
                song: sanitizeInput(item.song_title),
                lyric: sanitizeInput(item.lyric_start),
                genre: sanitizeInput(item.GENERO)
            }));

            renderCurrentPage();
        } catch (error) {
            console.error('Erro na busca:', error);
            showMessage('Erro ao realizar a busca. Tente novamente.');
        }
    }

    function renderCurrentPage() {
        const startIndex = (app.currentPage - 1) * app.itemsPerPage;
        const endIndex = startIndex + app.itemsPerPage;
        const currentSongs = app.filteredSongs.slice(startIndex, endIndex);

        renderResults(currentSongs);
        updatePaginationControls();
    }

    function updatePaginationControls() {
        const totalPages = Math.ceil(app.filteredSongs.length / app.itemsPerPage);
        ui.pageInfo.textContent = `Página ${app.currentPage} de ${totalPages > 0 ? totalPages : 1}`;
        ui.prevPageBtn.disabled = app.currentPage <= 1;
        ui.nextPageBtn.disabled = app.currentPage >= totalPages;
    }

    function renderResults(songs) {
        if (!songs || !songs.length) {
            ui.resultsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-results">
                        <i class="fas fa-search"></i>
                        <p>Nenhuma música encontrada</p>
                    </td>
                </tr>
            `;
            ui.recommendationsContainer.innerHTML = '';
            return;
        }

        ui.resultsTableBody.innerHTML = songs.map(song => `
            <tr data-code="${song.code}">
                <td>${song.code}</td>
                <td>${song.interpreter}</td>
                <td>${song.song}</td>
                <td>${song.lyric || '-'}</td>
                <td>${song.genre || '-'}</td>
                <td class="actions">
                    <button class="action-btn favorite-btn ${isFavorite(song.code) ? 'favorite' : ''}" 
                            title="${isFavorite(song.code) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
                        <i class="fas fa-heart"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        addTableEventListeners(ui.resultsTableBody);

        if (songs.length === 1) {
            showRecommendations(songs[0]);
        } else {
            ui.recommendationsContainer.innerHTML = '';
        }
    }

    function showRecommendations(currentSong) {
        if (!currentSong.interpreter && !currentSong.genre) {
            ui.recommendationsContainer.innerHTML = '';
            return;
        }

        const sameArtist = app.songsData.filter(song =>
            song.interpreter === currentSong.interpreter &&
            song.code !== currentSong.code
        ).slice(0, 3);

        const sameGenre = app.songsData.filter(song =>
            song.genre === currentSong.genre &&
            song.code !== currentSong.code &&
            !sameArtist.some(s => s.code === song.code)
        ).slice(0, 2);

        const recommendations = [...sameArtist, ...sameGenre];

        if (recommendations.length === 0) {
            ui.recommendationsContainer.innerHTML = '';
            return;
        }

        ui.recommendationsContainer.innerHTML = `
            <div class="recommendations-title">
                <i class="fas fa-lightbulb"></i>
                <span>Você também pode gostar:</span>
            </div>
            <table class="songs-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Cantor</th>
                        <th>Música</th>
                        <th>Gênero</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${recommendations.map(song => `
                        <tr data-code="${song.code}">
                            <td>${song.code}</td>
                            <td>${song.interpreter}</td>
                            <td>${song.song}</td>
                            <td>${song.genre || '-'}</td>
                            <td class="actions">
                                <button class="action-btn favorite-btn ${isFavorite(song.code) ? 'favorite' : ''}" 
                                        title="${isFavorite(song.code) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
                                    <i class="fas fa-heart"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        addTableEventListeners(ui.recommendationsContainer.querySelector('tbody'));
    }

    function addTableEventListeners(tableBody) {
        if (!tableBody) return;

        tableBody.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const code = row.getAttribute('data-code');
                toggleFavorite(code);
            });
        });
    }

    function toggleFavorite(code) {
        const index = app.favorites.findIndex(fav => fav === code);
        const song = app.songsData.find(s => s.code === code);

        if (index === -1) {
            app.favorites.push(code);
            showToast(`${song.song} adicionada aos favoritos`);
        } else {
            app.favorites.splice(index, 1);
            showToast(`${song.song} removida dos favoritos`);
        }

        saveFavorites();

        const favBtns = document.querySelectorAll(`tr[data-code="${code}"] .favorite-btn`);
        favBtns.forEach(btn => {
            btn.classList.toggle('favorite');
            btn.setAttribute('title', isFavorite(code) ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
        });
    }

    function isFavorite(code) {
        return app.favorites.includes(code);
    }

    function saveFavorites() {
        localStorage.setItem('favorites', JSON.stringify(app.favorites));
    }

    function showLoading() {
        ui.resultsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="no-results">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Carregando catálogo...</p>
                </td>
            </tr>
        `;
    }

    function showMessage(msg) {
        ui.resultsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="no-results">
                    <p>${msg}</p>
                </td>
            </tr>
        `;
    }

    function showSuggestions(term) {
        if (!term || term.length < 2 || !app.songsData.length) {
            ui.suggestions.style.display = 'none';
            return;
        }

        const suggestions = app.songsData.filter(song => {
            const searchFields = [
                song.interpreter.toLowerCase(),
                song.song.toLowerCase()
            ];
            return searchFields.some(field => field.includes(term.toLowerCase()));
        }).slice(0, 8);

        if (!suggestions.length) {
            ui.suggestions.style.display = 'none';
            return;
        }

        ui.suggestions.innerHTML = suggestions.map(song => `
            <div class="suggestion-item" data-code="${song.code}">
                ${song.interpreter} - ${song.song}
            </div>
        `).join('');

        ui.suggestions.style.display = 'block';

        document.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.getAttribute('data-code');
                const song = app.songsData.find(s => s.code === code);
                if (song) {
                    ui.searchInput.value = `${song.interpreter} - ${song.song}`;
                    ui.suggestions.style.display = 'none';
                    app.currentPage = 1;
                    applyFilters();
                }
            });
        });
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        }, 100);
    }
});
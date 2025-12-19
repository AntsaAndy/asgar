// sidebar.js - Version avec mini popup pour recherche web

// Import global de storageManager depuis storage.js

document.addEventListener('DOMContentLoaded', async () => {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat');
    const menuBtn = document.getElementById('menu-toggle');
    const historyPanel = document.getElementById('history-panel');

    let aiProcessor = null;
    let isProcessing = false;
    let pendingSearchQuery = null;
    let searchPopup = null; // Référence à la popup

    // Fonction pour charger l'IA
    async function loadAI() {
        try {
            // Créer une instance simplifiée de l'IA directement
            class SimpleAI {
                constructor() {
                    this.stopWords = new Set(['le', 'la', 'de', 'et', 'des', 'un', 'une']);
                }

                async processQuestion(query, storageManager) {
                    const memories = await storageManager.getAllMemories();
                    
                    if (memories.length === 0) {
                        return {
                            answer: "📭 Aucun document disponible dans ma mémoire.",
                            knowsAnswer: false,
                            searchQuery: query
                        };
                    }
                    
                    const lowerQuery = query.toLowerCase();
                    const results = [];
                    
                    // Recherche simple dans tous les documents
                    memories.forEach(memory => {
                        let score = 0;
                        
                        // Vérifier dans le titre
                        if (memory.title && memory.title.toLowerCase().includes(lowerQuery)) {
                            score += 3;
                        }
                        
                        // Vérifier dans l'extrait
                        if (memory.excerpt && memory.excerpt.toLowerCase().includes(lowerQuery)) {
                            score += 2;
                        }
                        
                        // Vérifier dans le texte complet
                        if (memory.fullText && memory.fullText.toLowerCase().includes(lowerQuery)) {
                            score += 1;
                        }
                        
                        // Vérifier les mots individuels
                        const words = lowerQuery.split(' ').filter(w => w.length > 3);
                        words.forEach(word => {
                            const text = `${memory.title} ${memory.excerpt}`.toLowerCase();
                            if (text.includes(word)) {
                                score += 0.5;
                            }
                        });
                        
                        if (score > 0) {
                            results.push({ memory, score });
                        }
                    });
                    
                    if (results.length === 0) {
                        return {
                            answer: `🤔 Je n'ai pas d'information sur "${query}" dans mes documents.`,
                            knowsAnswer: false,
                            searchQuery: query
                        };
                    }
                    
                    // Trier par score
                    results.sort((a, b) => b.score - a.score);
                    const top = results[0].memory;
                    
                    // Vérifier si la réponse est pertinente (score minimum)
                    const knowsAnswer = results[0].score >= 1.5;
                    
                    // Extraire un extrait pertinent
                    let excerpt = top.excerpt || '';
                    if (!excerpt && top.fullText) {
                        excerpt = top.fullText.substring(0, 200) + '...';
                    }
                    
                    // Construire la réponse
                    let answer = `📖 **${top.title || 'Document'}**\n\n`;
                    
                    if (excerpt) {
                        answer += `${excerpt}\n\n`;
                    }
                    
                    if (top.domain && top.domain !== "Import local") {
                        answer += `_Source: ${top.domain}_\n\n`;
                    }
                    
                    if (results.length > 1) {
                        answer += `📚 ${results.length - 1} autre(s) document(s) connexe(s).`;
                    }
                    
                    return {
                        answer: answer,
                        knowsAnswer: knowsAnswer,
                        searchQuery: !knowsAnswer ? query : null
                    };
                }
            }
            
            aiProcessor = new SimpleAI();
            addChatMessage('🤖 Assistant IA prêt ! Posez-moi une question sur vos documents.', 'bot');
            console.log('IA initialisée avec succès');
            
        } catch (error) {
            console.error('Erreur initialisation IA:', error);
            addChatMessage('⚠️ Mode recherche simple activé. Importez des documents pour commencer.', 'bot');
        }
    }

    // Fonction pour ouvrir une recherche Google
    function openWebSearch(query) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        chrome.tabs.create({ url: searchUrl });
        
        // Ajouter un message au chat
        setTimeout(() => {
            addChatMessage(`🌐 Recherche Google lancée pour : "${query}"`, 'bot');
        }, 300);
    }

    // Fonction pour créer et afficher la mini popup
    function showSearchPopup(query) {
        // Supprimer une popup existante
        if (searchPopup) {
            document.body.removeChild(searchPopup);
        }
        
        pendingSearchQuery = query;
        
        // Créer la popup
        searchPopup = document.createElement('div');
        searchPopup.className = 'search-popup';
        searchPopup.innerHTML = `
            <div class="popup-header">
                <span class="popup-icon">🔍</span>
                <span class="popup-title">Recherche Web</span>
                <button class="popup-close">&times;</button>
            </div>
            <div class="popup-content">
                <div class="popup-message">
                    Je n'ai pas assez d'informations sur :
                </div>
                <div class="popup-query">
                    "${query.length > 40 ? query.substring(0, 37) + '...' : query}"
                </div>
                <div class="popup-question">
                    Voulez-vous rechercher sur Google ?
                </div>
                <div class="popup-buttons">
                    <button class="popup-btn popup-btn-yes">
                        <span class="btn-icon">🌐</span>
                        <span>Oui, cherche</span>
                    </button>
                    <button class="popup-btn popup-btn-no">
                        <span class="btn-icon">✖️</span>
                        <span>Non, merci</span>
                    </button>
                </div>
            </div>
        `;
        
        // Ajouter la popup au body
        document.body.appendChild(searchPopup);
        
        // Positionner la popup
        positionPopup();
        
        // Ajouter les événements
        searchPopup.querySelector('.popup-close').addEventListener('click', closeSearchPopup);
        searchPopup.querySelector('.popup-btn-yes').addEventListener('click', () => {
            openWebSearch(query);
            closeSearchPopup();
        });
        searchPopup.querySelector('.popup-btn-no').addEventListener('click', closeSearchPopup);
        
        // Fermer la popup en cliquant à l'extérieur
        setTimeout(() => {
            searchPopup.addEventListener('click', (e) => {
                if (e.target === searchPopup) {
                    closeSearchPopup();
                }
            });
        }, 100);
        
        // Fermer avec la touche Échap
        document.addEventListener('keydown', handlePopupKeydown);
    }

    // Fonction pour positionner la popup
    function positionPopup() {
        if (!searchPopup) return;
        
        const popupWidth = 320;
        const popupHeight = 200;
        
        // Position au centre de l'écran
        searchPopup.style.left = '50%';
        searchPopup.style.top = '50%';
        searchPopup.style.transform = 'translate(-50%, -50%)';
    }

    // Fonction pour fermer la popup
    function closeSearchPopup() {
        if (searchPopup) {
            document.body.removeChild(searchPopup);
            searchPopup = null;
            pendingSearchQuery = null;
            document.removeEventListener('keydown', handlePopupKeydown);
        }
    }

    // Gérer la touche Échap
    function handlePopupKeydown(e) {
        if (e.key === 'Escape') {
            closeSearchPopup();
        }
    }

    // Fonction pour gérer les commandes spéciales
    function handleSpecialCommands(query) {
        const lowerQuery = query.toLowerCase().trim();
        
        if (lowerQuery === 'oui' || lowerQuery === 'yes' || lowerQuery === 'cherche' || lowerQuery === 'recherche') {
            if (pendingSearchQuery) {
                openWebSearch(pendingSearchQuery);
                closeSearchPopup();
                return true;
            }
        }
        
        if (lowerQuery === 'non' || lowerQuery === 'no') {
            if (pendingSearchQuery) {
                closeSearchPopup();
                addChatMessage('D\'accord, je reste à votre disposition.', 'bot');
                return true;
            }
        }
        
        return false;
    }

    // Initialiser l'IA immédiatement
    loadAI();

    if (historyPanel) historyPanel.classList.add('hidden');

    menuBtn.onclick = () => {
        const isHidden = historyPanel.classList.toggle('hidden');
        menuBtn.classList.toggle('active', !isHidden);
        if (!isHidden) window.renderMemories(); 
    };

    // --- ACTIONS DE SAUVEGARDE GLOBALE ---
    document.getElementById('download-all-btn').onclick = async () => {
        const memories = await storageManager.getAllMemories();
        if (memories.length === 0) {
            addChatMessage('📭 Aucun document à exporter.', 'bot');
            return;
        }
        
        try {
            const blob = new Blob([JSON.stringify(memories, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `memories_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            addChatMessage(`✅ ${memories.length} document(s) exporté(s).`, 'bot');
        } catch (error) {
            console.error('Erreur export:', error);
            addChatMessage('❌ Erreur lors de l\'export.', 'bot');
        }
    };

    // --- IMPORTATION DE DOCUMENTS ---
    document.getElementById('add-file-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.txt';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            addChatMessage(`📥 Import de "${file.name}"...`, 'bot');
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const content = event.target.result;
                    
                    // Essayer de parser comme JSON, sinon traiter comme texte brut
                    let memoryData;
                    try {
                        memoryData = JSON.parse(content);
                    } catch {
                        memoryData = {
                            title: file.name,
                            excerpt: `Document texte (${file.size} octets)`,
                            fullText: content
                        };
                    }
                    
                    // S'assurer que c'est un tableau
                    const memoriesToAdd = Array.isArray(memoryData) ? memoryData : [memoryData];
                    let importedCount = 0;
                    
                    for (const item of memoriesToAdd) {
                        const memory = {
                            id: Date.now().toString() + Math.random(),
                            title: item.title || file.name,
                            domain: item.domain || "Import local",
                            url: item.url || "file://" + file.name,
                            excerpt: item.excerpt || `Importé le ${new Date().toLocaleDateString()}`,
                            fullText: item.fullText || content.substring(0, 50000),
                            timestamp: new Date().toISOString()
                        };
                        
                        const result = await storageManager.addMemory(memory);
                        if (result.success) {
                            importedCount++;
                        }
                    }
                    
                    window.renderMemories();
                    addChatMessage(`✅ ${importedCount} document(s) importé(s) depuis "${file.name}".`, 'bot');
                    
                } catch (error) {
                    console.error('Erreur import:', error);
                    addChatMessage('❌ Erreur lors de l\'import du fichier.', 'bot');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // --- LOGIQUE DU CHAT ---
    async function sendMessage() {
        const query = chatInput.value.trim();
        if (!query) return;
        
        // Vérifier d'abord les commandes spéciales
        if (handleSpecialCommands(query)) {
            chatInput.value = '';
            return;
        }
        
        addChatMessage(query, 'user');
        chatInput.value = '';
        chatInput.focus();

        if (isProcessing) {
            addChatMessage('🔄 Je traite déjà une requête...', 'bot');
            return;
        }

        isProcessing = true;

        // Afficher un indicateur de traitement
        const thinkingMsg = document.createElement('div');
        thinkingMsg.className = 'msg bot thinking';
        thinkingMsg.innerHTML = '🧠 Je réfléchis...';
        thinkingMsg.id = 'thinking-message';
        document.getElementById('chat-messages').appendChild(thinkingMsg);
        scrollToBottom();

        try {
            // Attendre un peu pour l'effet visuel
            await new Promise(resolve => setTimeout(resolve, 500));
            
            let response;
            let shouldOfferSearch = false;
            let searchQuery = '';
            
            if (!aiProcessor) {
                // Fallback sans IA
                const memories = await storageManager.getAllMemories();
                if (memories.length === 0) {
                    response = "📭 Aucun document disponible dans ma mémoire.";
                    shouldOfferSearch = true;
                    searchQuery = query;
                } else {
                    const results = await storageManager.searchMemories(query);
                    if (results.length > 0) {
                        response = `📚 J'ai ${results.length} document(s) sur ce sujet.`;
                    } else {
                        response = `🤔 Je n'ai pas d'information sur "${query}" dans mes documents.`;
                        shouldOfferSearch = true;
                        searchQuery = query;
                    }
                }
            } else {
                // Utiliser l'IA
                const aiResponse = await aiProcessor.processQuestion(query, storageManager);
                response = aiResponse.answer;
                shouldOfferSearch = !aiResponse.knowsAnswer;
                searchQuery = aiResponse.searchQuery;
            }
            
            // Supprimer l'indicateur de traitement
            const thinkingElement = document.getElementById('thinking-message');
            if (thinkingElement) thinkingElement.remove();
            
            // Afficher la réponse
            addChatMessage(response, 'bot');
            
            // Si l'IA ne sait pas répondre, afficher la mini popup
            if (shouldOfferSearch && searchQuery) {
                setTimeout(() => {
                    showSearchPopup(searchQuery);
                }, 300);
            }
            
        } catch (error) {
            console.error('Erreur traitement:', error);
            
            // Supprimer l'indicateur de traitement
            const thinkingElement = document.getElementById('thinking-message');
            if (thinkingElement) thinkingElement.remove();
            
            addChatMessage('⚠️ Une erreur est survenue. Réessayez.', 'bot');
        } finally {
            isProcessing = false;
        }
    }

    sendBtn.onclick = sendMessage;
    
    chatInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // --- TOUT SUPPRIMER ---
    document.getElementById('clear-all-btn').onclick = async () => {
        const memories = await storageManager.getAllMemories();
        if (memories.length === 0) {
            addChatMessage('📭 Aucun document à supprimer.', 'bot');
            return;
        }
        
        if (confirm(`Supprimer ${memories.length} document(s) ?`)) {
            await storageManager.clearAllMemories();
            window.renderMemories();
            addChatMessage('🗑️ Tous les documents ont été supprimés.', 'bot');
        }
    };

    // Rendu initial
    window.renderMemories();
});

// --- RENDU : AFFICHAGE DES CARTES ---
window.renderMemories = async function() {
    const list = document.getElementById('memories-list');
    if (!list) return;

    const memories = await storageManager.getAllMemories();
    list.innerHTML = ''; 

    if (memories.length === 0) {
        list.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #94a3b8;">
                <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                <div>Aucun document</div>
                <div style="font-size: 12px; margin-top: 10px;">Cliquez sur 📁 pour importer</div>
            </div>
        `;
        return;
    }

    const displayMemories = memories.slice(0, 20);
    
    displayMemories.forEach(m => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        
        const title = m.title && m.title.length > 50 ? m.title.substring(0, 47) + '...' : m.title || 'Sans titre';
        const date = m.timestamp ? new Date(m.timestamp).toLocaleDateString('fr-FR') : 'Date inconnue';
        
        card.innerHTML = `
            <div class="card-info">
                <div style="color: #6366f1; font-weight: 600; font-size: 13px; margin-bottom: 4px;">${title}</div>
                <div style="font-size: 11px; color: #94a3b8;">
                    ${m.domain || 'Source inconnue'} • ${date}
                </div>
            </div>
            <div class="card-btns">
                <button class="btn-download" title="Exporter">📥</button>
                <button class="btn-delete" title="Supprimer">🗑️</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-btns')) {
                const chatInput = document.getElementById('chat-input');
                chatInput.value = `Parle-moi de "${m.title || 'ce document'}"`;
                chatInput.focus();
            }
        });

        card.querySelector('.btn-download').onclick = (e) => {
            e.stopPropagation();
            window.downloadSingleMemory(m.id);
        };
        
        card.querySelector('.btn-delete').onclick = (e) => {
            e.stopPropagation();
            window.deleteCard(m.id);
        };

        list.appendChild(card);
    });
    
    if (memories.length > 20) {
        const moreText = document.createElement('div');
        moreText.style.textAlign = 'center';
        moreText.style.padding = '10px';
        moreText.style.color = '#94a3b8';
        moreText.style.fontSize = '12px';
        moreText.textContent = `... et ${memories.length - 20} autres documents`;
        list.appendChild(moreText);
    }
};

window.downloadSingleMemory = async (id) => {
    try {
        const memory = await storageManager.getMemoryById(id);
        if (memory) {
            const blob = new Blob([JSON.stringify(memory, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = (memory.title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `${safeName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Erreur export:', error);
    }
};

window.deleteCard = async (id) => {
    if(confirm("Supprimer ce document ?")) {
        await storageManager.deleteMemory(id);
        window.renderMemories();
        addChatMessage('✅ Document supprimé.', 'bot');
    }
};

function addChatMessage(text, role) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    
    const formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/📭/g, '📭')
        .replace(/✅/g, '✅')
        .replace(/❌/g, '❌')
        .replace(/🔍/g, '🔍')
        .replace(/📚/g, '📚')
        .replace(/🤖/g, '🤖')
        .replace(/⚠️/g, '⚠️')
        .replace(/🗑️/g, '🗑️')
        .replace(/📥/g, '📥')
        .replace(/🧠/g, '🧠')
        .replace(/🔄/g, '🔄')
        .replace(/🤔/g, '🤔')
        .replace(/🌐/g, '🌐')
        .replace(/📖/g, '📖');
    
    div.innerHTML = formattedText;
    container.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}
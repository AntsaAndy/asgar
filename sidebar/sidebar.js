// sidebar.js - Stockage de masse sans affichage textuel direct

document.addEventListener('DOMContentLoaded', async () => {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat');
    const menuBtn = document.getElementById('menu-toggle');
    const historyPanel = document.getElementById('history-panel');

    if (historyPanel) historyPanel.classList.add('hidden');

    menuBtn.onclick = () => {
        const isHidden = historyPanel.classList.toggle('hidden');
        menuBtn.classList.toggle('active', !isHidden);
        if (!isHidden) window.renderMemories(); 
    };

    // --- ACTIONS DE SAUVEGARDE GLOBALE ---

    document.getElementById('download-all-btn').onclick = async () => {
        const memories = await storageManager.getAllMemories();
        const blob = new Blob([JSON.stringify(memories, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `archive_totale_brute_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- IMPORTATION DE DOCUMENTS (SANS FILTRE) ---
    document.getElementById('add-file-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.txt';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const fullRawContent = event.target.result;

                await storageManager.addMemory({
                    id: Date.now().toString(),
                    title: "Import: " + file.name,
                    domain: "Fichier Externe",
                    url: "file://" + file.name,
                    excerpt: "Document intégral (" + (file.size / 1024).toFixed(2) + " KB)",
                    fullText: fullRawContent, // Stockage de 100% du contenu
                    timestamp: new Date().toISOString()
                });

                window.renderMemories();
                alert("Le document a été entièrement mémorisé.");
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // --- LOGIQUE DU CHAT (Analyse du texte invisible) ---
    async function sendMessage() {
        const query = chatInput.value.trim();
        if (!query) return;
        
        addChatMessage(query, 'user');
        chatInput.value = '';

        const results = await storageManager.searchMemories(query);
        
        setTimeout(() => {
            if (results.length > 0) {
                addChatMessage(`J'ai scanné les données intégrales. Source trouvée : "${results[0].title}".`, 'bot');
            } else {
                addChatMessage("Aucune information ne correspond dans les documents aspirés.", 'bot');
            }
        }, 500);
    }

    sendBtn.onclick = sendMessage;
    chatInput.onkeydown = (e) => { if(e.key === 'Enter') sendMessage(); };
});

// --- RENDU : AFFICHAGE DES CARTES UNIQUEMENT ---

// --- DANS SIDEBAR.JS (Remplace la fonction window.renderMemories) ---

window.renderMemories = async function() {
    const list = document.getElementById('memories-list');
    if (!list) return;

    const memories = await storageManager.getAllMemories();
    list.innerHTML = ''; 

    memories.forEach(m => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        
        // On reconstruit le lien HTML ici avec m.url
        card.innerHTML = `
            <div class="card-info">
                <a href="${m.url}" target="_blank" class="memory-link" style="text-decoration: none; color: inherit;">
                    <strong style="color: #6366f1;">${m.title}</strong>
                </a>
                <p style="font-size: 0.8em; color: #64748b;">${m.domain}</p>
            </div>
            <div class="card-btns">
                <button class="btn-download" title="Exporter le texte intégral">📥</button>
                <button class="btn-delete" title="Supprimer">🗑️</button>
            </div>
        `;

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
};

// Fonction d'exportation : C'est ici qu'on récupère le texte total
window.downloadSingleMemory = async (id) => {
    const memory = await storageManager.getMemoryById(id);
    if (memory) {
        const blob = new Blob([JSON.stringify(memory, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // On nettoie le titre pour le nom du fichier
        const safeName = (memory.title).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeName}_complet.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

window.deleteCard = async (id) => {
    if(confirm("Supprimer l'intégralité de ce document ?")) {
        await storageManager.deleteMemory(id);
        window.renderMemories(); 
    }
};

function addChatMessage(text, role) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    container.appendChild(div);
    setTimeout(() => { container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }); }, 50);
}
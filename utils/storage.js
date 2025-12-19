// utils/storage.js - Version simplifiée

class StorageManager {
    constructor() {
        this.storageKey = 'memories';
    }

    async getAllMemories() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                resolve(result[this.storageKey] || []);
            });
        });
    }

    async getMemoryById(id) {
        const memories = await this.getAllMemories();
        return memories.find(m => m.id === id);
    }

    async addMemory(memory) {
        const memories = await this.getAllMemories();
        
        // Vérifier les doublons récents
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const isDuplicate = memories.some(m => 
            m.url === memory.url && 
            new Date(m.timestamp).getTime() > oneHourAgo
        );
        
        if (isDuplicate) {
            console.log('Document déjà importé récemment');
            return { success: false, message: 'Document déjà existant' };
        }

        memories.unshift(memory);
        
        // Limiter à 100 documents maximum
        if (memories.length > 100) {
            memories.length = 100;
        }

        await this.saveMemories(memories);
        return { success: true, message: 'Document ajouté' };
    }

    async deleteMemory(id) {
        const memories = await this.getAllMemories();
        const filtered = memories.filter(m => m.id !== id);
        await this.saveMemories(filtered);
        return { success: true };
    }

    async clearAllMemories() {
        await this.saveMemories([]);
        return { success: true };
    }

    async searchMemories(query) {
        const memories = await this.getAllMemories();
        const lowerQuery = query.toLowerCase();
        
        return memories.filter(m => 
            (m.title && m.title.toLowerCase().includes(lowerQuery)) ||
            (m.excerpt && m.excerpt.toLowerCase().includes(lowerQuery)) ||
            (m.fullText && m.fullText.toLowerCase().includes(lowerQuery)) ||
            (m.domain && m.domain.toLowerCase().includes(lowerQuery))
        );
    }

    async exportMemories() {
        const memories = await this.getAllMemories();
        const dataStr = JSON.stringify(memories, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }

    async saveMemories(memories) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.storageKey]: memories }, () => {
                resolve();
            });
        });
    }
}

// Créer l'instance globale
const storageManager = new StorageManager();
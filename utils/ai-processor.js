// utils/ai-processor.js - Version fonctionnelle

// Définition de la classe AIProcessor
class AIProcessor {
    constructor() {
        this.stopWords = new Set([
            'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'mais', 'où', 'donc', 'or', 'ni', 'car',
            'à', 'au', 'aux', 'avec', 'dans', 'par', 'pour', 'sur', 'sous', 'vers', 'chez', 'sans', 'entre'
        ]);
    }

    preprocessText(text) {
        if (!text) return '';
        
        return text.toLowerCase()
            .replace(/[^\w\sàâäéèêëîïôöùûüç]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(word => word.length > 2 && !this.stopWords.has(word))
            .join(' ');
    }

    tokenize(text) {
        return this.preprocessText(text).split(' ').filter(word => word.length > 0);
    }

    calculateTF(text) {
        const tokens = this.tokenize(text);
        const tf = {};
        const totalWords = tokens.length;
        
        if (totalWords === 0) return tf;
        
        tokens.forEach(token => {
            tf[token] = (tf[token] || 0) + 1;
        });
        
        // Normaliser
        Object.keys(tf).forEach(token => {
            tf[token] = tf[token] / totalWords;
        });
        
        return tf;
    }

    calculateIDF(memories) {
        const idf = {};
        const totalDocs = memories.length;
        
        if (totalDocs === 0) return idf;
        
        memories.forEach(memory => {
            const text = this.getMemoryText(memory);
            const uniqueTokens = new Set(this.tokenize(text));
            
            uniqueTokens.forEach(token => {
                idf[token] = (idf[token] || 0) + 1;
            });
        });
        
        // Calcul IDF
        Object.keys(idf).forEach(token => {
            idf[token] = Math.log((totalDocs + 1) / (idf[token] + 1)) + 1;
        });
        
        return idf;
    }

    getMemoryText(memory) {
        return `${memory.title || ''} ${memory.excerpt || ''} ${memory.fullText || ''}`.toLowerCase();
    }

    calculateTFIDFScore(memory, queryTokens, idf) {
        const text = this.getMemoryText(memory);
        const memoryTokens = this.tokenize(text);
        
        if (queryTokens.length === 0 || memoryTokens.length === 0) {
            return 0;
        }
        
        let score = 0;
        
        // Créer vecteur TF pour le memory
        const memoryTF = this.calculateTF(text);
        
        // Pour chaque token de la requête
        queryTokens.forEach(token => {
            const tokenIDF = idf[token] || 1;
            
            // Produit scalaire simplifié
            if (memoryTF[token]) {
                score += memoryTF[token] * tokenIDF;
            }
        });
        
        return score;
    }

    async semanticSearch(query, memories, limit = 3) {
        if (!query || !memories || memories.length === 0) {
            return [];
        }
        
        const processedQuery = this.preprocessText(query);
        const queryTokens = this.tokenize(processedQuery);
        
        if (queryTokens.length === 0) {
            return this.simpleSearch(query, memories, limit);
        }
        
        try {
            const idf = this.calculateIDF(memories);
            
            const scoredMemories = memories.map(memory => {
                let score = this.calculateTFIDFScore(memory, queryTokens, idf);
                
                // Bonus pour les correspondances exactes
                const titleLower = (memory.title || '').toLowerCase();
                const queryLower = query.toLowerCase();
                
                if (titleLower.includes(queryLower)) {
                    score += 0.5;
                }
                
                return {
                    memory: memory,
                    score: score
                };
            });
            
            return scoredMemories
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .filter(item => item.score > 0.01);
            
        } catch (error) {
            console.error('Erreur recherche sémantique:', error);
            return this.simpleSearch(query, memories, limit);
        }
    }

    // Recherche simple par mots-clés (fallback)
    simpleSearch(query, memories, limit = 5) {
        const lowerQuery = query.toLowerCase();
        const queryWords = lowerQuery.split(' ').filter(w => w.length > 2);
        
        const scored = memories.map(memory => {
            let score = 0;
            const text = this.getMemoryText(memory);
            
            queryWords.forEach(word => {
                if (text.includes(word)) {
                    score += 1;
                }
            });
            
            if (memory.title && memory.title.toLowerCase().includes(lowerQuery)) {
                score += 3;
            }
            
            return {
                memory: memory,
                score: score
            };
        });
        
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .filter(item => item.score > 0);
    }

    generateResponse(query, searchResults) {
        if (searchResults.length === 0) {
            return `🤔 Je n'ai pas d'information sur "${query}" dans mes documents.`;
        }
        
        const topResult = searchResults[0];
        const memory = topResult.memory;
        
        // Calculer la pertinence (0-100%)
        const relevance = Math.min(Math.round(topResult.score * 100), 100);
        
        const relevantExcerpt = this.extractRelevantExcerpt(memory.fullText || memory.excerpt || '', query);
        
        let response = `📖 **${memory.title || 'Document'}** `;
        
        if (relevance < 30) {
            response += `(pertinence faible: ${relevance}%)\n\n`;
        } else {
            response += `\n\n`;
        }
        
        if (relevantExcerpt) {
            response += `${relevantExcerpt}\n\n`;
        }
        
        if (memory.domain && memory.domain !== "Import local") {
            response += `_Source: ${memory.domain}_\n\n`;
        }
        
        if (searchResults.length > 1) {
            response += `📚 ${searchResults.length - 1} autre(s) document(s) connexe(s).`;
        }
        
        return response;
    }

    extractRelevantExcerpt(text, query) {
        if (!text || text.length === 0) return 'Aucun contenu disponible.';
        
        if (text.length < 300) {
            return text;
        }
        
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const queryWords = this.preprocessText(query).split(' ').filter(w => w.length > 2);
        
        if (sentences.length === 0) {
            return text.substring(0, 250) + '...';
        }
        
        let bestSentence = '';
        let bestScore = 0;
        
        sentences.forEach(sentence => {
            const sentenceLower = sentence.toLowerCase();
            let score = 0;
            
            queryWords.forEach(word => {
                if (sentenceLower.includes(word)) {
                    score += 2;
                }
            });
            
            if (score > bestScore) {
                bestScore = score;
                bestSentence = sentence.trim();
            }
        });
        
        if (bestSentence.length < 50) {
            return text.substring(0, 250) + '...';
        }
        
        if (bestSentence.length > 300) {
            bestSentence = bestSentence.substring(0, 297) + '...';
        }
        
        return bestSentence;
    }

    async processQuestion(query, storageManager) {
        try {
            const memories = await storageManager.getAllMemories();
            
            if (memories.length === 0) {
                return {
                    answer: "📭 Aucun document disponible dans ma mémoire.\n\nSouhaitez-vous que je recherche cette information sur internet ?",
                    knowsAnswer: false,
                    searchQuery: query
                };
            }
            
            const searchResults = await this.semanticSearch(query, memories);
            
            if (searchResults.length === 0) {
                return {
                    answer: `🤔 Je n'ai pas d'information sur "${query}" dans mes documents.\n\nVoulez-vous que je recherche cela sur internet ?`,
                    knowsAnswer: false,
                    searchQuery: query
                };
            }
            
            // Vérifier si la réponse est pertinente (score minimum)
            const knowsAnswer = searchResults[0].score >= 0.3;
            
            const response = this.generateResponse(query, searchResults);
            
            // Ajouter la suggestion de recherche si la réponse n'est pas pertinente
            if (!knowsAnswer) {
                response += `\n\n🤔 Cette information semble incomplète. Souhaitez-vous une recherche plus approfondie sur internet ?`;
            }
            
            return {
                answer: response,
                knowsAnswer: knowsAnswer,
                searchQuery: !knowsAnswer ? query : null
            };
            
        } catch (error) {
            console.error('Erreur traitement question:', error);
            return {
                answer: "⚠️ Désolé, une erreur est survenue.",
                knowsAnswer: false,
                searchQuery: null
            };
        }
    }
}

// Exporter l'instance
const aiProcessor = new AIProcessor();
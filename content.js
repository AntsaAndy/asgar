// content.js

function createFloatingButton() {
    if (document.getElementById('active-ai-memory-fab')) return;

    const btn = document.createElement('div');
    btn.id = 'active-ai-memory-fab';
    btn.innerHTML = '🧠';

    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        backgroundColor: '#1c1d44ff',
        borderRadius: '50%',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        zIndex: '2147483647',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
        userSelect: 'none',
        transition: 'transform 0.2s ease, hover 0.2s ease'
    });

    btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseleave = () => btn.style.transform = 'scale(1)';

    btn.addEventListener('click', () => {
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => btn.style.transform = 'scale(1.1)', 100);
        chrome.runtime.sendMessage({ action: "open_side_panel" });
    });

    document.body.appendChild(btn);
}

function extractPageData() {
    const title = document.title;
    const url = window.location.href;
    const domain = window.location.hostname;
    const fullBodyText = document.body.innerText.trim();

    return {
        id: Date.now().toString(),
        title: title,
        domain: domain,
        url: url,
        excerpt: fullBodyText.substring(0, 200) + "...", 
        fullText: fullBodyText,
        timestamp: new Date().toISOString()
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
} else {
    createFloatingButton();
}

window.addEventListener('load', () => {
    const pageData = extractPageData();
    chrome.runtime.sendMessage({ 
        action: "save_page_data", 
        data: pageData 
    }, (response) => {
        console.log("✅ Document intégral aspiré :", pageData.title);
    });
});
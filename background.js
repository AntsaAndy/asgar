// Configuration globale du SidePanel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Forcer l'ouverture au clic sur l'icône de l'extension
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "open_side_panel") {
    chrome.sidePanel.open({ windowId: sender.tab.windowId })
      .then(() => sendResponse({ status: "success" }))
      .catch((err) => sendResponse({ status: "error" }));
    return true;
  }

  if (message.action === "save_page_data") {
    chrome.storage.local.get({ memories: [] }, (result) => {
      let memories = result.memories;
      const exists = memories.some(m => m.url === message.data.url);
      
      if (!exists) {
        memories.unshift(message.data);
        if (memories.length > 50) memories.pop();
        chrome.storage.local.set({ memories: memories }, () => {
          sendResponse({ status: "saved" });
        });
      } else {
        sendResponse({ status: "already_exists" });
      }
    });
    return true;
  }
});
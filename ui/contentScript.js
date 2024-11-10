const observer = new MutationObserver((mutationList, observer) => {
  const panelSide = document.querySelector("#pane-side");
  const qrCode = document.querySelector("#qrcode");
  if (panelSide) {
    chrome.storage.local.set({ login: true });
    observer.disconnect();
    chrome.storage.local.get("login", (result) => {
      console.log("Login status after reading:", result);
    })
  } else if (qrCode) {
    chrome.storage.local.set({ login: false });
    observer.disconnect();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Content script to check if the user is logged in
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkLogin") {
      const isLoggedIn = document.querySelector("#pane-side") !== null;
      sendResponse({ loggedIn: isLoggedIn });
    }
  });


const observer = new MutationObserver((mutationList, observer) => {
  const panelSide = document.querySelector("#pane-side");
  const qrCode = document.querySelector('canvas[aria-label="Scan this QR code to link a device!"]');
  if (panelSide) {
    observer.disconnect();
    chrome.storage.local.get("login", (result) => {
      if (result.login === false) {
        console.log("Login success but we will update the service:", result);
      }
      else {
        chrome.storage.local.set({ login: true });
      }
    })
  } else if (qrCode) {
    chrome.storage.local.set({ login: false });
    observer.disconnect();
    console.log("Login status after reading qrcode:");
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


const NATIVE_HOST_NAME = "com.bestdownloadmanager.app";

// Listen for downloads created in the browser
chrome.downloads.onCreated.addListener((downloadItem) => {
  // Prevent catching our own downloads or internal blobs
  if (downloadItem.url.startsWith("blob:") || downloadItem.url.startsWith("data:")) {
    return;
  }

  // Cancel the browser's native download
  chrome.downloads.cancel(downloadItem.id, () => {
    // Send the URL to our Best Download Manager desktop app via Native Messaging
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST_NAME,
      {
        action: "add_download",
        url: downloadItem.url,
        filename: downloadItem.filename,
        referrer: downloadItem.referrer
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Best Download Manager Native Host not found or error:", chrome.runtime.lastError.message);
          // If the app isn't running or installed, we could fallback to resuming the native download
        } else {
          console.log("Sent to Best Download Manager:", response);
        }
      }
    );
  });
});

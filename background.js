console.log("Background script loaded");

let apiCalls = [];
let trackHeaders = true;

browser.storage.local.get('trackHeaders').then(result => {
  trackHeaders = result.trackHeaders !== false;
});

browser.webRequest.onBeforeRequest.addListener(
  logApiCall,
  {urls: ["<all_urls>"]},
  ["requestBody"]
);

browser.webRequest.onSendHeaders.addListener(
  logHeaders,
  {urls: ["<all_urls>"]},
  ["requestHeaders"]
);

function logApiCall(details) {
  console.log("Network request intercepted:", details.url, details.method);
  let call = {
    url: details.url,
    method: details.method,
    timestamp: details.timeStamp,
    requestBody: details.requestBody ? parseRequestBody(details.requestBody) : null
  };
  apiCalls.push(call);
  console.log("API call logged:", call);
  return {};
}

function logHeaders(details) {
  if (!trackHeaders) return {};
  
  let call = apiCalls.find(call => call.url === details.url && Math.abs(call.timestamp - details.timeStamp) < 50);
  if (call) {
    call.headers = details.requestHeaders.reduce((acc, header) => {
      acc[header.name] = header.value;
      return acc;
    }, {});
    console.log("Headers added to call:", call);
  }
  return {};
}

function parseRequestBody(requestBody) {
  if (requestBody.formData) {
    return requestBody.formData;
  } else if (requestBody.raw) {
    try {
      return JSON.parse(decodeURIComponent(String.fromCharCode.apply(null, new Uint8Array(requestBody.raw[0].bytes))));
    } catch (e) {
      return "Unable to parse raw request body";
    }
  }
  return "No request body data";
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);
  if (message.action === "getApiCalls") {
    console.log("Sending API calls:", apiCalls);
    sendResponse({apiCalls: apiCalls});
  } else if (message.action === "clearApiCalls") {
    apiCalls = [];
    console.log("API calls cleared");
    sendResponse({success: true});
  } else if (message.action === "updateHeaderTracking") {
    trackHeaders = message.trackHeaders;
    console.log("Header tracking updated:", trackHeaders);
    browser.storage.local.set({trackHeaders: trackHeaders});
    sendResponse({success: true});
  }
  return true; // Indicates that we will send a response asynchronously
});

browser.downloads.onCreated.addListener((downloadItem) => {
  console.log("Download created:", downloadItem);
});

browser.downloads.onChanged.addListener((delta) => {
  console.log("Download changed:", delta);
});